import { App, SuggestModal, TFile } from "obsidian";

/**
 * Modal for picking a file from a list of suggestions.
 */
export class FilePickerModal extends SuggestModal<TFile> {
  files: TFile[];
  result: TFile | null = null;

  /**
   * Creates a new file picker modal.
   * @param app - Obsidian app instance
   * @param files - List of files to choose from
   */
  constructor(app: App, files: TFile[]) {
    super(app);
    this.files = files;
  }

  /**
   * Filters files based on query string.
   * @param query - Search query
   * @returns Filtered list of files
   */
  getSuggestions(query: string): TFile[] {
    return this.files.filter(f => 
      f.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Renders a file suggestion in the list.
   * @param f - The file to render
   * @param el - The element to render into
   */
  renderSuggestion(f: TFile, el: HTMLElement) {
    el.setText(f.path);
  }

  /**
   * Called when a file is chosen from the list.
   * @param f - The chosen file
   */
  onChooseSuggestion(f: TFile) {
    this.result = f;
    this.close();
  }

  /**
   * Opens the modal and returns the selected file.
   * @returns Selected file or null if cancelled
   */
  async openAndGet(): Promise<TFile | null> {
    return new Promise((resolve) => {
      this.onClose = () => resolve(this.result);
      this.open();
    });
  }
}



