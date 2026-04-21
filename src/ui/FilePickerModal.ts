import { App, SuggestModal, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { getProjectDisplayName, getSortedProjectFiles } from "../utils/areaUtils";
import { createProjectFile } from "../services/VaultIO";

/**
 * Special marker to represent "Create new project" option.
 */
const CREATE_NEW_PROJECT_MARKER = "__CREATE_NEW_PROJECT__" as const;

/**
 * Modal for picking a file from a list of suggestions.
 */
export class FilePickerModal extends SuggestModal<TFile | typeof CREATE_NEW_PROJECT_MARKER> {
  app: App;
  result: TFile | null = null;
  settings: GeckoTaskSettings;
  files: TFile[];

  constructor(app: App, files: TFile[], settings: GeckoTaskSettings) {
    super(app);
    this.app = app;
    this.settings = settings;
    this.files = files;
  }

  getSuggestions(query: string): (TFile | typeof CREATE_NEW_PROJECT_MARKER)[] {
    const suggestions: (TFile | typeof CREATE_NEW_PROJECT_MARKER)[] = [CREATE_NEW_PROJECT_MARKER];

    const filesToUse = this.files.length === 0
      ? getSortedProjectFiles(this.app, this.settings)
      : this.files;

    if (!query) {
      suggestions.push(...filesToUse);
      return suggestions;
    }

    const q = query.toLowerCase();
    const filtered = filesToUse.filter(f => {
      const pathMatch = f.path.toLowerCase().includes(q);
      const displayName = getProjectDisplayName(f.path, this.app, this.settings);
      const displayMatch = displayName.toLowerCase().includes(q);
      return pathMatch || displayMatch;
    });

    suggestions.push(...filtered);
    return suggestions;
  }

  renderSuggestion(item: TFile | typeof CREATE_NEW_PROJECT_MARKER, el: HTMLElement) {
    if (item === CREATE_NEW_PROJECT_MARKER) {
      el.setText("➕ Create new project");
      el.addClass("geckotask-clickable");
      el.addClass("geckotask-font-bold");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onChooseSuggestion(item);
      });
      return;
    }

    const f = item as TFile;
    const displayName = getProjectDisplayName(f.path, this.app, this.settings);
    el.setText(displayName);

    el.addClass("geckotask-clickable");
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onChooseSuggestion(f);
    });
  }

  async onChooseSuggestion(item: TFile | typeof CREATE_NEW_PROJECT_MARKER) {
    if (item === CREATE_NEW_PROJECT_MARKER) {
      this.isCreatingProject = true;
      super.close();

      const newFile = await createProjectFile(this.app, this.settings);
      if (newFile) {
        let fileToReturn = this.app.vault.getAbstractFileByPath(newFile.path);
        if (!fileToReturn || !(fileToReturn instanceof TFile)) {
          fileToReturn = newFile;
        }

        this.result = fileToReturn as TFile;
        if (this.resolvePromise) {
          this.resolvePromise(this.result);
          this.resolvePromise = null;
        }
      } else {
        if (this.resolvePromise) {
          this.resolvePromise(null);
          this.resolvePromise = null;
        }
      }

      this.isCreatingProject = false;
      return;
    }

    const f = item as TFile;
    this.result = f;
    this.close();
  }

  private resolvePromise: ((value: TFile | null) => void) | null = null;
  private isCreatingProject: boolean = false;

  close(): void {
    super.close();
    if (this.resolvePromise && !this.isCreatingProject) {
      this.resolvePromise(this.result);
      this.resolvePromise = null;
    }
  }

  async openAndGet(): Promise<TFile | null> {
    this.result = null;

    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      const originalOnClose = this.onClose;

      this.onClose = () => {
        if (originalOnClose) {
          originalOnClose.call(this);
        }
        // Don't resolve here if we're creating a project — onChooseSuggestion handles it
        if (this.resolvePromise && !this.isCreatingProject) {
          this.resolvePromise(this.result);
          this.resolvePromise = null;
        }
      };

      this.open();
    });
  }
}
