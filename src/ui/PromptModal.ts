import { App, Modal, Setting } from "obsidian";

/**
 * Modal for prompting user for text input.
 */
export class PromptModal extends Modal {
  private inputValue: string = "";
  private resolve: ((value: string | null) => void) | null = null;
  private isResolved: boolean = false;

  /**
   * Creates a new prompt modal.
   * @param app - Obsidian app instance
   * @param promptText - Text to display as prompt
   * @param defaultValue - Default input value
   */
  constructor(
    app: App,
    private promptText: string,
    private defaultValue: string = ""
  ) {
    super(app);
    this.inputValue = defaultValue;
  }

  /**
   * Called when modal opens. Renders the input UI.
   */
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(this.promptText);
    this.isResolved = false;

    new Setting(contentEl)
      .setName(this.promptText)
      .addText((text) => {
        text.setValue(this.defaultValue);
        text.inputEl.focus();
        text.inputEl.select();
        text.onChange((value) => {
          this.inputValue = value;
        });
        // Handle Enter key
        text.inputEl.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter") {
            evt.preventDefault();
            this.submit();
          }
          if (evt.key === "Escape") {
            evt.preventDefault();
            this.cancel();
          }
        });
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("OK")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Cancel")
          .onClick(() => this.cancel())
      );
  }

  /**
   * Called when modal closes. Resolves promise if not already resolved.
   */
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolve && !this.isResolved) {
      this.isResolved = true;
      this.resolve(null);
    }
  }

  /**
   * Submits the input value and closes the modal.
   */
  private submit() {
    if (this.resolve && !this.isResolved) {
      this.isResolved = true;
      this.resolve(this.inputValue);
    }
    this.close();
  }

  /**
   * Cancels the prompt and closes the modal.
   */
  private cancel() {
    if (this.resolve && !this.isResolved) {
      this.isResolved = true;
      this.resolve(null);
    }
    this.close();
  }

  /**
   * Opens the modal and returns the user's input.
   * @returns Input value or null if cancelled
   */
  async prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

