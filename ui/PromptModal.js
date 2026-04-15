"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptModal = void 0;
const obsidian_1 = require("obsidian");
const ValidationService_1 = require("../services/ValidationService");
/**
 * Modal for prompting user for text input.
 */
class PromptModal extends obsidian_1.Modal {
    /**
     * Creates a new prompt modal.
     * @param app - Obsidian app instance
     * @param promptText - Text to display as prompt
     * @param defaultValue - Default input value
     * @param description - Optional description text to display below the prompt
     * @param fieldType - Optional field type for validation context
     * @param taskTitle - Optional task title for validation context (used with due/scheduled)
     */
    constructor(app, promptText, defaultValue = "", description, fieldType, taskTitle) {
        super(app);
        this.promptText = promptText;
        this.defaultValue = defaultValue;
        this.description = description;
        this.inputValue = "";
        this.resolve = null;
        this.isResolved = false;
        this.fieldType = "other";
        this.inputValue = defaultValue;
        this.fieldType = fieldType || "other";
        this.taskTitle = taskTitle;
    }
    /**
     * Renders validation feedback below an element.
     * @param container - Container element to add feedback to
     * @param results - Validation results to display
     */
    renderValidationFeedback(container, results) {
        // Remove existing validation feedback
        const existing = container.querySelector(".geckotask-validation-container");
        if (existing) {
            existing.remove();
        }
        if (results.length === 0) {
            return;
        }
        const feedbackContainer = container.createDiv({ cls: "geckotask-validation-container" });
        for (const result of results) {
            const feedbackEl = feedbackContainer.createDiv({
                cls: `geckotask-validation-${result.severity}`
            });
            let icon = "";
            if (result.severity === "warning") {
                icon = "⚠️ ";
            }
            else if (result.severity === "error") {
                icon = "❌ ";
            }
            else {
                icon = "ℹ️ ";
            }
            feedbackEl.textContent = icon + result.message;
            if (result.suggestion) {
                const suggestionEl = feedbackContainer.createDiv({
                    cls: `geckotask-validation-${result.severity} geckotask-validation-suggestion`
                });
                suggestionEl.textContent = `💡 ${result.suggestion}`;
                suggestionEl.style.fontSize = "0.85em";
                suggestionEl.style.marginTop = "2px";
                suggestionEl.style.opacity = "0.8";
            }
        }
    }
    /**
     * Debounce helper for validation.
     */
    debounceValidation(func, wait) {
        let timeout = null;
        return (...args) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => func(...args), wait);
        };
    }
    /**
     * Called when modal opens. Renders the input UI.
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(this.promptText);
        this.isResolved = false;
        const setting = new obsidian_1.Setting(contentEl)
            .setName(this.promptText);
        if (this.description) {
            setting.setDesc(this.description);
        }
        const settingEl = setting.settingEl;
        setting.addText((text) => {
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
            // Add debounced validation for date fields
            if (this.fieldType === "due" || this.fieldType === "scheduled") {
                const debouncedValidate = this.debounceValidation((value) => {
                    let results = [];
                    if (this.fieldType === "due") {
                        results = (0, ValidationService_1.validateTaskDueDate)(value, this.taskTitle);
                    }
                    else if (this.fieldType === "scheduled") {
                        results = (0, ValidationService_1.validateTaskScheduled)(value);
                    }
                    this.renderValidationFeedback(settingEl, results);
                }, 300);
                text.inputEl.addEventListener("input", (evt) => {
                    const value = evt.target.value;
                    debouncedValidate(value);
                });
                // Initial validation
                if (this.defaultValue) {
                    let results = [];
                    if (this.fieldType === "due") {
                        results = (0, ValidationService_1.validateTaskDueDate)(this.defaultValue, this.taskTitle);
                    }
                    else if (this.fieldType === "scheduled") {
                        results = (0, ValidationService_1.validateTaskScheduled)(this.defaultValue);
                    }
                    this.renderValidationFeedback(settingEl, results);
                }
            }
        });
        new obsidian_1.Setting(contentEl)
            .addButton((btn) => btn
            .setButtonText("OK")
            .setCta()
            .onClick(() => this.submit()))
            .addButton((btn) => btn
            .setButtonText("Cancel")
            .onClick(() => this.cancel()));
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
    submit() {
        if (this.resolve && !this.isResolved) {
            this.isResolved = true;
            this.resolve(this.inputValue);
        }
        this.close();
    }
    /**
     * Cancels the prompt and closes the modal.
     */
    cancel() {
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
    async prompt() {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
exports.PromptModal = PromptModal;
