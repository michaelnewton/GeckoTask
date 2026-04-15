"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilePickerModal = void 0;
const obsidian_1 = require("obsidian");
const areaUtils_1 = require("../utils/areaUtils");
const VaultIO_1 = require("../services/VaultIO");
/**
 * Special marker to represent "Create new project" option.
 */
const CREATE_NEW_PROJECT_MARKER = "__CREATE_NEW_PROJECT__";
/**
 * Modal for picking a file from a list of suggestions.
 */
class FilePickerModal extends obsidian_1.SuggestModal {
    /**
     * Creates a new file picker modal.
     * @param app - Obsidian app instance
     * @param files - List of files to choose from. If empty array, files are retrieved and sorted automatically.
     * @param settings - Plugin settings
     */
    constructor(app, files, settings) {
        super(app);
        this.result = null;
        this.resolvePromise = null;
        this.isCreatingProject = false;
        this.app = app;
        this.settings = settings;
        // Store files if provided, otherwise will auto-retrieve in getSuggestions
        this.files = files;
    }
    /**
     * Filters files based on query string (searches both path and display name).
     * Always includes "Create new project" option at the top.
     * If files array is empty, automatically retrieves and sorts files (Inbox first, then areas alphabetically).
     * Otherwise, uses the provided files array.
     * @param query - Search query
     * @returns Filtered list of files with "Create new project" option
     */
    getSuggestions(query) {
        const suggestions = [CREATE_NEW_PROJECT_MARKER];
        // If files array is empty, auto-retrieve and sort files
        // Otherwise, use the provided files (for filtered use cases)
        const filesToUse = this.files.length === 0
            ? (0, areaUtils_1.getSortedProjectFiles)(this.app, this.settings)
            : this.files;
        if (!query) {
            suggestions.push(...filesToUse);
            return suggestions;
        }
        const q = query.toLowerCase();
        const filtered = filesToUse.filter(f => {
            const pathMatch = f.path.toLowerCase().includes(q);
            const displayName = (0, areaUtils_1.getProjectDisplayName)(f.path, this.app, this.settings);
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
    renderSuggestion(item, el) {
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
        const f = item;
        const displayName = (0, areaUtils_1.getProjectDisplayName)(f.path, this.app, this.settings);
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
    async onChooseSuggestion(item) {
        if (item === CREATE_NEW_PROJECT_MARKER) {
            // Set flag to prevent close() from resolving
            this.isCreatingProject = true;
            // Close this modal first (but don't resolve yet - we'll resolve after project creation)
            super.close();
            // Open create project modal
            const newFile = await (0, VaultIO_1.createProjectFile)(this.app, this.settings);
            if (newFile) {
                // Ensure the file is accessible in the vault
                // Sometimes the file might not be immediately available, so we get it from the vault
                let fileToReturn = this.app.vault.getAbstractFileByPath(newFile.path);
                if (!fileToReturn || !(fileToReturn instanceof obsidian_1.TFile)) {
                    // If not found, use the file that was returned from createProjectFile
                    fileToReturn = newFile;
                }
                this.result = fileToReturn;
                // Resolve the promise with the newly created file
                if (this.resolvePromise) {
                    this.resolvePromise(this.result);
                    this.resolvePromise = null;
                }
            }
            else {
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
        const f = item;
        this.result = f;
        this.close();
    }
    /**
     * Override close to ensure promise resolves.
     */
    close() {
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
    async openAndGet() {
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
exports.FilePickerModal = FilePickerModal;
