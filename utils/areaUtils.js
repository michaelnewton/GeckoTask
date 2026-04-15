"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAreas = getAreas;
exports.inferAreaFromPath = inferAreaFromPath;
exports.isInTasksFolder = isInTasksFolder;
exports.getAreaPath = getAreaPath;
exports.normalizeInboxPath = normalizeInboxPath;
exports.getInboxDisplayPath = getInboxDisplayPath;
exports.isSpecialFile = isSpecialFile;
exports.isTasksFolderFile = isTasksFolderFile;
exports.getProjectDisplayName = getProjectDisplayName;
exports.isInArchiveDirectory = isInArchiveDirectory;
exports.getSortedProjectFiles = getSortedProjectFiles;
const obsidian_1 = require("obsidian");
/**
 * Gets the list of areas by detecting first-level directories in the tasks folder.
 * Returns empty array if areasEnabled is false, otherwise scans the filesystem.
 * Archive directory is excluded from areas.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of area names (sorted alphabetically)
 */
function getAreas(app, settings) {
    // If areas are disabled, return empty array
    if (!settings.areasEnabled) {
        return [];
    }
    // Get the tasks folder
    const tasksFolder = app.vault.getAbstractFileByPath(settings.tasksFolder);
    if (!tasksFolder || !(tasksFolder instanceof obsidian_1.TFolder)) {
        return [];
    }
    // Get all first-level children that are folders
    const areas = [];
    for (const child of tasksFolder.children) {
        if (child instanceof obsidian_1.TFolder) {
            // Filter out Archive directory and other non-area directories
            // Only include if it's a direct child folder
            if (child.path.startsWith(settings.tasksFolder + "/")) {
                const relativePath = child.path.substring(settings.tasksFolder.length + 1);
                // Check if it's a first-level directory (no slashes in relative path)
                if (!relativePath.includes("/")) {
                    // Exclude Archive directory using the same logic as isInArchiveDirectory
                    if (isInArchiveDirectory(child.path, settings)) {
                        continue;
                    }
                    areas.push(child.name);
                }
            }
        }
    }
    // Sort alphabetically for consistency
    return areas.sort();
}
/**
 * Infers the area from a file path based on settings.
 * Returns the area name if the file is under tasksFolder/{area}/, otherwise undefined.
 * @param filePath - The file path to check
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Area name or undefined
 */
function inferAreaFromPath(filePath, app, settings) {
    // Check if file is under tasksFolder
    if (!filePath.startsWith(settings.tasksFolder + "/")) {
        return undefined;
    }
    // Get the path relative to tasksFolder
    const relativePath = filePath.substring(settings.tasksFolder.length + 1);
    // Get detected areas
    const areas = getAreas(app, settings);
    // Check each area to see if the file is under that area folder
    for (const area of areas) {
        if (relativePath.startsWith(area + "/")) {
            return area;
        }
    }
    return undefined;
}
/**
 * Checks if a file path is within the tasks folder structure
 */
function isInTasksFolder(filePath, settings) {
    return filePath.startsWith(settings.tasksFolder + "/");
}
/**
 * Gets the full path for an area folder
 */
function getAreaPath(area, settings) {
    return `${settings.tasksFolder}/${area}`;
}
/**
 * Normalizes an inbox path by ensuring it has .md extension
 * Users can enter paths without .md, but internally we need the full path
 */
function normalizeInboxPath(path) {
    if (!path)
        return path;
    // Remove .md if present, then add it back to ensure consistency
    const withoutExt = path.endsWith(".md") ? path.slice(0, -3) : path;
    return withoutExt + ".md";
}
/**
 * Gets the display path for inbox (without .md extension)
 */
function getInboxDisplayPath(path) {
    if (!path)
        return path;
    return path.endsWith(".md") ? path.slice(0, -3) : path;
}
/**
 * Checks if a file path is a special file that shouldn't show a project name
 * (e.g., the configured inbox file or the single action file)
 */
function isSpecialFile(filePath, settings) {
    const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
    // Check if this is the configured inbox file
    if (filePath === normalizedInboxPath) {
        return true;
    }
    // Check if basename matches the single action file
    const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
    return basename === settings.singleActionFile;
}
/**
 * Checks if a file path matches the tasks folder name itself (e.g., tasks.md if tasksFolder is "tasks").
 * These files should be excluded from project dropdowns.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @returns True if the file matches the tasks folder name
 */
function isTasksFolderFile(filePath, settings) {
    // Check if the file is directly in the tasks folder and matches the folder name
    // Handle both with and without .md extension
    const tasksFolderFileWithExt = `${settings.tasksFolder}/${settings.tasksFolder}.md`;
    const tasksFolderFileWithoutExt = `${settings.tasksFolder}/${settings.tasksFolder}`;
    // Check exact match with extension
    if (filePath === tasksFolderFileWithExt)
        return true;
    // Check if path without extension matches
    const pathWithoutExt = filePath.endsWith(".md") ? filePath.slice(0, -3) : filePath;
    if (pathWithoutExt === tasksFolderFileWithoutExt)
        return true;
    // Also check if the basename matches the tasks folder name and it's directly in the tasks folder
    const pathParts = filePath.split("/");
    if (pathParts.length === 2 && pathParts[0] === settings.tasksFolder) {
        const basename = pathParts[1].replace(/\.md$/, "");
        if (basename === settings.tasksFolder)
            return true;
    }
    return false;
}
/**
 * Gets the display name for a project path in dropdowns.
 * For Single Action files, returns the Area name instead of the file path.
 * For other files, shows the relative path from the tasks folder (e.g., "Work/Project" or just "Project").
 * Tasks folder files should never be passed to this function, but we check anyway for safety.
 * @param filePath - The file path
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Display name for the project
 */
function getProjectDisplayName(filePath, app, settings) {
    // Safety check: if this is the tasks folder file, return empty string (shouldn't happen)
    if (isTasksFolderFile(filePath, settings)) {
        return "";
    }
    // Check if this is the Single Action file
    const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
    if (basename === settings.singleActionFile) {
        // Return the Area name instead of the file path
        const area = inferAreaFromPath(filePath, app, settings);
        if (area) {
            return area;
        }
    }
    // Check if this is the inbox file
    const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
    if (filePath === normalizedInboxPath) {
        // Show just "Inbox" for the inbox file
        return "Inbox";
    }
    // For other files, show the relative path from the tasks folder
    // Remove the tasks folder prefix and .md extension
    if (!filePath.startsWith(settings.tasksFolder + "/")) {
        // Fallback: just remove .md extension
        return filePath.endsWith(".md") ? filePath.slice(0, -3) : filePath;
    }
    // Get the relative path from tasks folder
    const relativePath = filePath.substring(settings.tasksFolder.length + 1);
    // Remove .md extension
    return relativePath.endsWith(".md") ? relativePath.slice(0, -3) : relativePath;
}
/**
 * Checks if a file path is in the Archive directory (for filtering project files).
 * Archive directory is determined from the archive pattern (e.g., "Archive" from "Archive/Completed-YYYY.md").
 * This excludes both the archive file itself and any project files in the archive directory.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @returns True if the file is in the Archive directory
 */
function isInArchiveDirectory(filePath, settings) {
    // Extract archive directory from archive pattern
    // Pattern format can be:
    // - "Archive/Completed-YYYY.md" -> directory is "Archive"
    // - "Tasks/Archive/Completed-YYYY.md" -> directory is "Archive" (tasks folder included)
    const archivePattern = settings.archivePattern;
    // Remove tasks folder prefix if present to get the relative pattern
    let relativePattern = archivePattern;
    if (archivePattern.startsWith(settings.tasksFolder + "/")) {
        relativePattern = archivePattern.substring(settings.tasksFolder.length + 1);
    }
    // Extract archive directory from relative pattern
    const archiveDirMatch = relativePattern.match(/^([^\/]+)\//);
    if (!archiveDirMatch) {
        // Archive is at root level (no directory), check if file matches the archive pattern exactly
        const archivePatternWithoutExt = relativePattern.replace(/\.md$/, "").replace("YYYY", "\\d{4}");
        const archiveRegex = new RegExp(`^${settings.tasksFolder}/${archivePatternWithoutExt}\\.md$`);
        return archiveRegex.test(filePath);
    }
    // Extract the archive directory name from the relative pattern
    const archiveDir = archiveDirMatch[1];
    const archiveDirPath = `${settings.tasksFolder}/${archiveDir}`;
    // Check if file is in the archive directory
    // This catches files directly in archive, in subdirectories, and the archive file itself
    return filePath === archiveDirPath || filePath.startsWith(archiveDirPath + "/");
}
/**
 * Gets project files sorted in the correct order:
 * 1. Inbox (if exists)
 * 2. Areas and their subfiles/folders in alphabetical order
 * Archive is excluded if it exists in the Tasks directory.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of TFile objects sorted in the correct order
 */
function getSortedProjectFiles(app, settings) {
    const allFiles = app.vault.getMarkdownFiles();
    const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
    // Filter files: must be in tasks folder, not tasks folder file, and not in Archive
    const projectFiles = allFiles.filter(f => {
        const path = f.path;
        if (!isInTasksFolder(path, settings))
            return false;
        if (isTasksFolderFile(path, settings))
            return false;
        if (isInArchiveDirectory(path, settings))
            return false;
        return true;
    });
    // Separate inbox from other files
    const inboxFile = projectFiles.find(f => f.path === normalizedInboxPath);
    const otherFiles = projectFiles.filter(f => f.path !== normalizedInboxPath);
    // Get areas and sort alphabetically
    const areas = getAreas(app, settings);
    const sortedAreas = [...areas].sort();
    // Group files by area
    const filesByArea = new Map();
    const filesWithoutArea = [];
    for (const file of otherFiles) {
        const area = inferAreaFromPath(file.path, app, settings);
        if (area) {
            if (!filesByArea.has(area)) {
                filesByArea.set(area, []);
            }
            filesByArea.get(area).push(file);
        }
        else {
            // File is directly in tasks folder (not in an area)
            filesWithoutArea.push(file);
        }
    }
    // Sort files within each area alphabetically by path
    for (const [area, files] of filesByArea.entries()) {
        files.sort((a, b) => a.path.localeCompare(b.path));
    }
    // Sort files without area alphabetically
    filesWithoutArea.sort((a, b) => a.path.localeCompare(b.path));
    // Build result array: inbox first, then areas in alphabetical order with their files
    const result = [];
    // Add inbox if it exists
    if (inboxFile) {
        result.push(inboxFile);
    }
    // Add files from each area in alphabetical order
    for (const area of sortedAreas) {
        const areaFiles = filesByArea.get(area);
        if (areaFiles) {
            result.push(...areaFiles);
        }
    }
    // Add files without area at the end
    result.push(...filesWithoutArea);
    return result;
}
