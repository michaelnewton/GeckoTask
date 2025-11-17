import { App, SuggestModal, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { getProjectDisplayName, getSortedProjectFiles } from "../utils/areaUtils";
import { createProjectFile } from "../services/VaultIO";

/**
 * Special marker to represent "Create new project" option.
 */
const CREATE_NEW_PROJECT_MARKER = "__CREATE_NEW_PROJECT__" as any;

/**
 * Modal for picking a file from a list of suggestions.
 */
export class FilePickerModal extends SuggestModal<TFile | typeof CREATE_NEW_PROJECT_MARKER> {
  app: App;
  result: TFile | null = null;
  settings: GeckoTaskSettings;

  /**
   * Creates a new file picker modal.
   * Note: The files parameter is ignored - files are retrieved and sorted automatically.
   * @param app - Obsidian app instance
   * @param files - List of files to choose from (ignored, will be retrieved automatically)
   * @param settings - Plugin settings
   */
  constructor(app: App, files: TFile[], settings: GeckoTaskSettings) {
    super(app);
    this.app = app;
    this.settings = settings;
  }

  /**
   * Filters files based on query string (searches both path and display name).
   * Always includes "Create new project" option at the top.
   * Files are sorted: Inbox first, then areas alphabetically.
   * @param query - Search query
   * @returns Filtered list of files with "Create new project" option
   */
  getSuggestions(query: string): (TFile | typeof CREATE_NEW_PROJECT_MARKER)[] {
    const suggestions: (TFile | typeof CREATE_NEW_PROJECT_MARKER)[] = [CREATE_NEW_PROJECT_MARKER];
    
    // Get sorted files (Inbox first, then areas alphabetically)
    const sortedFiles = getSortedProjectFiles(this.app, this.settings);
    
    if (!query) {
      suggestions.push(...sortedFiles);
      return suggestions;
    }
    
    const q = query.toLowerCase();
    const filtered = sortedFiles.filter(f => {
      const pathMatch = f.path.toLowerCase().includes(q);
      const displayName = getProjectDisplayName(f.path, this.app, this.settings);
      const displayMatch = displayName.toLowerCase().includes(q);
      return pathMatch || displayMatch;
    });
    
    suggestions.push(...filtered);
    return suggestions;
  }

  /**
   * Renders a file suggestion in the list using the project display name.
   * Handles both regular files and the "Create new project" option.
   * @param item - The file or create marker to render
   * @param el - The element to render into
   */
  renderSuggestion(item: TFile | typeof CREATE_NEW_PROJECT_MARKER, el: HTMLElement) {
    if (item === CREATE_NEW_PROJECT_MARKER) {
      el.setText("➕ Create new project");
      el.style.cursor = "pointer";
      el.style.fontWeight = "bold";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onChooseSuggestion(item);
      });
      return;
    }
    
    const f = item as TFile;
    const displayName = getProjectDisplayName(f.path, this.app, this.settings);
    el.setText(displayName);
    
    // Make the suggestion clickable - single click selects it
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onChooseSuggestion(f);
    });
  }

  /**
   * Called when a file or "Create new project" is chosen from the list.
   * @param item - The chosen file or create marker
   */
  async onChooseSuggestion(item: TFile | typeof CREATE_NEW_PROJECT_MARKER) {
    if (item === CREATE_NEW_PROJECT_MARKER) {
      // Set flag to prevent close() from resolving
      this.isCreatingProject = true;
      
      // Close this modal first (but don't resolve yet - we'll resolve after project creation)
      super.close();
      
      // Open create project modal
      const newFile = await createProjectFile(this.app, this.settings);
      if (newFile) {
        // Ensure the file is accessible in the vault
        // Sometimes the file might not be immediately available, so we get it from the vault
        let fileToReturn = this.app.vault.getAbstractFileByPath(newFile.path);
        if (!fileToReturn || !(fileToReturn instanceof TFile)) {
          // If not found, use the file that was returned from createProjectFile
          fileToReturn = newFile;
        }
        
        this.result = fileToReturn as TFile;
        // Resolve the promise with the newly created file
        if (this.resolvePromise) {
          this.resolvePromise(this.result);
          this.resolvePromise = null;
        }
      } else {
        // User cancelled project creation - resolve with null
        if (this.resolvePromise) {
          this.resolvePromise(null);
          this.resolvePromise = null;
        }
      }
      
      // Reset flag
      this.isCreatingProject = false;
      return;
    }
    
    const f = item as TFile;
    this.result = f;
    this.close();
  }

  private resolvePromise: ((value: TFile | null) => void) | null = null;
  private isCreatingProject: boolean = false;

  /**
   * Override close to ensure promise resolves.
   */
  close(): void {
    super.close();
    // Ensure promise resolves when modal closes (unless we're creating a project)
    if (this.resolvePromise && !this.isCreatingProject) {
      this.resolvePromise(this.result);
      this.resolvePromise = null;
    }
  }

  /**
   * Opens the modal and returns the selected file.
   * @returns Selected file or null if cancelled
   */
  async openAndGet(): Promise<TFile | null> {
    this.result = null; // Reset result before opening
    
    return new Promise((resolve) => {
      // Store the resolve function so we can call it when modal closes
      this.resolvePromise = resolve;
      
      // Store the original onClose handler if it exists
      const originalOnClose = this.onClose;
      
      // Set up our onClose handler
      this.onClose = () => {
        // Call original handler if it exists
        if (originalOnClose) {
          originalOnClose.call(this);
        }
        // Resolve with the result (will be null if cancelled)
        if (this.resolvePromise) {
          this.resolvePromise(this.result);
          this.resolvePromise = null;
        }
      };
      
      // Open the modal
      this.open();
    });
  }
}



