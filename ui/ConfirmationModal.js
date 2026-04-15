"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmationModal = void 0;
const obsidian_1 = require("obsidian");
/**
 * Modal for confirming destructive actions with yes/no options.
 */
class ConfirmationModal extends obsidian_1.Modal {
    /**
     * Creates a new confirmation modal.
     * @param app - Obsidian app instance
     * @param title - Modal title
     * @param message - Confirmation message to display
     * @param details - Optional additional details to show
     */
    constructor(app, title, message, details) {
        super(app);
        this.title = title;
        this.message = message;
        this.details = details;
        this.resolve = null;
        this.isResolved = false;
    }
    /**
     * Called when modal opens. Renders the confirmation UI.
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(this.title);
        this.isResolved = false;
        const messageEl = contentEl.createDiv({ cls: "confirmation-modal-message" });
        messageEl.createEl("p", { text: this.message });
        if (this.details) {
            const detailsEl = contentEl.createDiv({ cls: "confirmation-modal-details" });
            detailsEl.style.fontSize = "0.9em";
            detailsEl.style.color = "var(--text-muted)";
            detailsEl.createEl("p", { text: this.details });
        }
        new obsidian_1.Setting(contentEl)
            .addButton((btn) => btn
            .setButtonText("Yes")
            .setCta()
            .onClick(() => this.confirm(true)))
            .addButton((btn) => btn
            .setButtonText("No")
            .onClick(() => this.confirm(false)));
    }
    /**
     * Called when modal closes. Resolves promise if not already resolved.
     */
    onClose() {
        if (!this.isResolved && this.resolve) {
            this.resolve(false);
            this.resolve = null;
        }
    }
    /**
     * Confirms the action and closes the modal.
     * @param value - True if confirmed, false if cancelled
     */
    confirm(value) {
        if (this.isResolved)
            return;
        this.isResolved = true;
        if (this.resolve) {
            this.resolve(value);
            this.resolve = null;
        }
        this.close();
    }
    /**
     * Opens the modal and returns a promise that resolves with the user's choice.
     * @returns Promise that resolves to true if confirmed, false if cancelled
     */
    async prompt() {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
exports.ConfirmationModal = ConfirmationModal;
