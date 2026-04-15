"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasksFolderFiles = getTasksFolderFiles;
const areaUtils_1 = require("./areaUtils");
/**
 * Gets all markdown files in the tasks folder.
 * This is a helper to avoid repeating the filter pattern.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of markdown files in the tasks folder
 */
function getTasksFolderFiles(app, settings) {
    return app.vault.getMarkdownFiles()
        .filter(f => (0, areaUtils_1.isInTasksFolder)(f.path, settings));
}
