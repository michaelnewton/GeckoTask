import { App, SuggestModal, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { getProjectDisplayName } from "../utils/areaUtils";

/**
 * Modal for picking a file from a list of suggestions.
 */
export class FilePickerModal extends SuggestModal<TFile> {
  files: TFile[];
  result: TFile | null = null;
  settings: GeckoTaskSettings;

  /**
   * Creates a new file picker modal.
   * @param app - Obsidian app instance
   * @param files - List of files to choose from
   * @param settings - Plugin settings
   */
  constructor(app: App, files: TFile[], settings: GeckoTaskSettings) {
    super(app);
    this.files = files;
    this.settings = settings;
  }

  /**
   * Filters files based on query string (searches both path and display name).
   * @param query - Search query
   * @returns Filtered list of files
   */
  getSuggestions(query: string): TFile[] {
    if (!query) return this.files;
    const q = query.toLowerCase();
    return this.files.filter(f => {
      const pathMatch = f.path.toLowerCase().includes(q);
      const displayName = getProjectDisplayName(f.path, this.app, this.settings);
      const displayMatch = displayName.toLowerCase().includes(q);
      return pathMatch || displayMatch;
    });
  }

  /**
   * Renders a file suggestion in the list using the project display name.
   * @param f - The file to render
   * @param el - The element to render into
   */
  renderSuggestion(f: TFile, el: HTMLElement) {
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
   * Called when a file is chosen from the list.
   * @param f - The chosen file
   */
  onChooseSuggestion(f: TFile) {
    this.result = f;
    this.close();
  }

  private resolvePromise: ((value: TFile | null) => void) | null = null;

  /**
   * Override close to ensure promise resolves.
   */
  close(): void {
    super.close();
    // Ensure promise resolves when modal closes
    if (this.resolvePromise) {
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



