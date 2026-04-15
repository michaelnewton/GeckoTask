"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTasksFromFile = loadTasksFromFile;
exports.loadTasksFromFiles = loadTasksFromFiles;
const TaskModel_1 = require("../models/TaskModel");
const areaUtils_1 = require("./areaUtils");
/**
 * Loads all tasks from a specific file.
 * This is a shared utility to eliminate duplication across multiple services and views.
 * @param app - Obsidian app instance
 * @param file - File to read tasks from
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from the file
 */
async function loadTasksFromFile(app, file, settings) {
    const path = file.path;
    const tasks = [];
    const cache = app.metadataCache.getCache(path);
    const lists = cache?.listItems;
    if (!lists || lists.length === 0)
        return tasks;
    // Check if file has any tasks before reading
    const hasTasks = lists.some(li => li.task);
    if (!hasTasks)
        return tasks;
    // Read file content to get actual line text
    let fileContent;
    try {
        fileContent = await app.vault.read(file);
    }
    catch {
        return tasks;
    }
    const lines = fileContent.split("\n");
    for (const li of lists) {
        if (!li.task)
            continue;
        const lineNo = li.position?.start?.line ?? 0;
        if (lineNo < 0 || lineNo >= lines.length)
            continue;
        // Parse task with description
        const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, lineNo);
        if (!parsed)
            continue;
        const raw = lines[lineNo].trim();
        const area = (0, areaUtils_1.inferAreaFromPath)(path, app, settings);
        // Project is derived from file basename, not stored in metadata
        const project = (0, areaUtils_1.isSpecialFile)(path, settings) ? undefined : file.basename;
        tasks.push({
            path,
            line: lineNo + 1,
            raw,
            title: parsed.title,
            description: parsed.description,
            tags: parsed.tags || [],
            area,
            project,
            priority: parsed.priority,
            due: parsed.due,
            scheduled: parsed.scheduled,
            recur: parsed.recur,
            checked: parsed.checked,
            descriptionEndLine: endLine + 1
        });
    }
    return tasks;
}
/**
 * Loads all tasks from multiple files.
 * @param app - Obsidian app instance
 * @param files - Array of files to read tasks from
 * @param settings - Plugin settings
 * @returns Array of all indexed tasks from the files
 */
async function loadTasksFromFiles(app, files, settings) {
    const allTasks = [];
    for (const file of files) {
        const tasks = await loadTasksFromFile(app, file, settings);
        allTasks.push(...tasks);
    }
    return allTasks;
}
