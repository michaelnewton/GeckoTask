"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchInboxTasks = fetchInboxTasks;
exports.fetchTasksByTag = fetchTasksByTag;
exports.fetchSomedayMaybeTasks = fetchSomedayMaybeTasks;
exports.fetchSomedayMaybeProjects = fetchSomedayMaybeProjects;
exports.fetchNextActions = fetchNextActions;
exports.fetchProjectsWithTasks = fetchProjectsWithTasks;
const obsidian_1 = require("obsidian");
const areaUtils_1 = require("../utils/areaUtils");
const taskUtils_1 = require("../utils/taskUtils");
const somedayMaybeUtils_1 = require("../utils/somedayMaybeUtils");
const fileUtils_1 = require("../utils/fileUtils");
const dateUtils_1 = require("../utils/dateUtils");
/**
 * Fetches all uncompleted tasks from the Inbox file.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from the Inbox
 */
async function fetchInboxTasks(app, settings) {
    const inboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    const inboxFile = app.vault.getAbstractFileByPath(inboxPath);
    if (!(inboxFile instanceof obsidian_1.TFile)) {
        return [];
    }
    return await (0, taskUtils_1.loadTasksFromFile)(app, inboxFile, settings);
}
/**
 * Fetches all tasks with a specific tag.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param tag - Tag to search for (e.g., settings.waitingForTag)
 * @returns Array of indexed tasks with the tag
 */
async function fetchTasksByTag(app, settings, tag) {
    const files = (0, fileUtils_1.getTasksFolderFiles)(app, settings);
    const tasks = [];
    const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
    for (const file of files) {
        const fileTasks = await (0, taskUtils_1.loadTasksFromFile)(app, file, settings);
        const taggedTasks = fileTasks.filter(t => t.tags.includes(normalizedTag));
        tasks.push(...taggedTasks);
    }
    return tasks;
}
/**
 * Fetches all tasks from Someday/Maybe folders (one per area).
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from Someday/Maybe folders
 */
async function fetchSomedayMaybeTasks(app, settings) {
    const tasks = [];
    const somedayMaybeFolderName = settings.somedayMaybeFolderName;
    // Check each area for a Someday Maybe folder
    const areas = (0, areaUtils_1.getAreas)(app, settings);
    for (const area of areas) {
        const somedayMaybePath = (0, somedayMaybeUtils_1.getSomedayMaybePath)(area, settings);
        const somedayMaybeFolder = app.vault.getAbstractFileByPath(somedayMaybePath);
        if (somedayMaybeFolder && somedayMaybeFolder instanceof obsidian_1.TFile) {
            // If it's a file, read it
            const fileTasks = await (0, taskUtils_1.loadTasksFromFile)(app, somedayMaybeFolder, settings);
            tasks.push(...fileTasks);
        }
        else if (somedayMaybeFolder) {
            // If it's a folder, get all markdown files in it
            const files = app.vault.getMarkdownFiles()
                .filter(f => f.path.startsWith(somedayMaybePath + "/") && f.path.endsWith(".md"));
            for (const file of files) {
                const fileTasks = await (0, taskUtils_1.loadTasksFromFile)(app, file, settings);
                tasks.push(...fileTasks);
            }
        }
    }
    return tasks;
}
/**
 * Fetches all project files from Someday/Maybe folders (one per area).
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of project review information from Someday/Maybe folders
 */
async function fetchSomedayMaybeProjects(app, settings) {
    const projects = [];
    const somedayMaybeFolderName = settings.somedayMaybeFolderName;
    // Get all markdown files in the tasks folder
    const files = (0, fileUtils_1.getTasksFolderFiles)(app, settings);
    for (const file of files) {
        const path = file.path;
        // Check if this file is in a Someday Maybe folder
        // The path should contain /{somedayMaybeFolderName}/ or end with /{somedayMaybeFolderName}.md
        const somedayMaybePattern = `/${somedayMaybeFolderName}/`;
        const somedayMaybeFilePattern = `/${somedayMaybeFolderName}.md`;
        const isInSomedayMaybeFolder = path.includes(somedayMaybePattern) ||
            path.endsWith(somedayMaybeFilePattern);
        if (!isInSomedayMaybeFolder)
            continue;
        // Extract area from path structure: tasks/{area}/Someday Maybe/...
        // This works even if area names in settings don't match folder names exactly
        const pathParts = path.split("/");
        if (pathParts.length < 3)
            continue; // Need at least tasks/{area}/...
        // Find the Someday Maybe folder in the path
        const somedayMaybeIndex = pathParts.findIndex(part => part === somedayMaybeFolderName);
        if (somedayMaybeIndex < 2)
            continue; // Should be after tasks/{area}
        // The area is the part right before the Someday Maybe folder
        const areaFromPath = pathParts[somedayMaybeIndex - 1];
        // Try to match with detected areas, or use the folder name directly
        // This allows the function to work even if area names don't match exactly
        const areas = (0, areaUtils_1.getAreas)(app, settings);
        let area;
        if (areas.includes(areaFromPath)) {
            area = areaFromPath;
        }
        else {
            // If not in detected areas, try to infer it (might work if partial match)
            area = (0, areaUtils_1.inferAreaFromPath)(path, app, settings) || areaFromPath;
        }
        if (!area)
            continue;
        // Check if this is a project file inside the Someday Maybe folder
        // We want files like:
        // - tasks/Home/Someday Maybe/Project.md (file directly in Someday Maybe folder)
        // - tasks/Home/Someday Maybe/ProjectFolder/Project.md (file in subfolder of Someday Maybe)
        // - tasks/Home/Someday Maybe/Someday Maybe.md (the Someday Maybe file itself)
        const isSomedayMaybeFile = pathParts.length === somedayMaybeIndex + 2 &&
            pathParts[somedayMaybeIndex + 1] === `${somedayMaybeFolderName}.md`;
        const isProjectInSomedayMaybe = pathParts.length > somedayMaybeIndex + 1;
        if (!isSomedayMaybeFile && !isProjectInSomedayMaybe)
            continue;
        const tasks = await (0, taskUtils_1.loadTasksFromFile)(app, file, settings);
        const uncompletedTasks = tasks.filter(t => !t.checked);
        const hasNextAction = uncompletedTasks.length > 0;
        projects.push({
            path: file.path,
            name: file.basename,
            area,
            tasks: uncompletedTasks,
            hasNextAction
        });
    }
    // Sort by area, then by project name
    projects.sort((a, b) => {
        const areaA = a.area || "";
        const areaB = b.area || "";
        if (areaA !== areaB)
            return areaA.localeCompare(areaB);
        return a.name.localeCompare(b.name);
    });
    return projects;
}
/**
 * Fetches all actionable tasks matching the same logic as the Tasks Panel's "next-actions" tab.
 * This includes:
 * - All Single Action tasks (excluding inbox) that meet due date criteria
 * - First uncompleted task from each project file
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed actionable tasks
 */
async function fetchNextActions(app, settings) {
    // Load all tasks from all files (same as Tasks Panel does)
    const files = (0, fileUtils_1.getTasksFolderFiles)(app, settings);
    const allTasks = [];
    for (const file of files) {
        const fileTasks = await (0, taskUtils_1.loadTasksFromFile)(app, file, settings);
        allTasks.push(...fileTasks);
    }
    // Filter to uncompleted tasks only
    const allUncompletedTasks = allTasks.filter(t => !t.checked);
    const singleActionTasks = [];
    const projectFirstTasks = [];
    // Calculate due date window
    const today = (0, dateUtils_1.formatISODate)(new Date());
    const endDate = (0, dateUtils_1.add)(settings.nextActionsDueDays, "days", today);
    const waitingForTag = settings.waitingForTag;
    const normalizedInboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    // Group all uncompleted tasks by file path first
    const tasksByFile = new Map();
    for (const task of allUncompletedTasks) {
        if (!tasksByFile.has(task.path)) {
            tasksByFile.set(task.path, []);
        }
        tasksByFile.get(task.path).push(task);
    }
    // Get ALL tasks from ALL Single Action files
    // Iterate through the tasksByFile map to find Single Action files
    for (const [filePath, fileTasks] of tasksByFile.entries()) {
        // Check if this file is a Single Action file (but not the inbox)
        if ((0, areaUtils_1.isSpecialFile)(filePath, settings) &&
            filePath !== normalizedInboxPath &&
            (0, areaUtils_1.isInTasksFolder)(filePath, settings)) {
            // Filter out tasks with waiting tag and filter by due date window (only for single actions)
            const filteredTasks = fileTasks.filter(t => {
                // Exclude single action tasks with waiting tag
                if (t.tags.includes(waitingForTag))
                    return false;
                // Exclude tasks with scheduled date in the future
                if (t.scheduled && t.scheduled > today)
                    return false;
                // For single action items, include if no due date OR due date is within the next X days
                return !t.due || (t.due >= today && t.due <= endDate);
            });
            singleActionTasks.push(...filteredTasks);
        }
    }
    // Get first uncompleted task from each project file
    // Exclude project files in someday/maybe folders
    const projectFiles = (0, areaUtils_1.getSortedProjectFiles)(app, settings)
        .filter(f => {
        // Exclude Inbox and Single Action files
        if ((0, areaUtils_1.isSpecialFile)(f.path, settings))
            return false;
        // Exclude project files in someday/maybe folders
        if ((0, somedayMaybeUtils_1.isInSomedayMaybeFolder)(f.path, settings, app))
            return false;
        return true;
    });
    // For each project file, get the first uncompleted task (sorted by line number)
    for (const projectFile of projectFiles) {
        const fileTasks = tasksByFile.get(projectFile.path) || [];
        if (fileTasks.length > 0) {
            // Filter out tasks in someday/maybe folders
            const filteredTasks = fileTasks.filter(t => {
                // Exclude tasks from files in someday/maybe folders
                if ((0, somedayMaybeUtils_1.isInSomedayMaybeFolder)(t.path, settings, app))
                    return false;
                return true;
            });
            if (filteredTasks.length > 0) {
                // Sort by line number and take the first one
                const sortedTasks = [...filteredTasks].sort((a, b) => a.line - b.line);
                const firstTask = sortedTasks[0];
                // Exclude entire project if first task is waiting for or scheduled in the future
                if (firstTask.tags.includes(waitingForTag))
                    continue;
                if (firstTask.scheduled && firstTask.scheduled > today)
                    continue;
                projectFirstTasks.push(firstTask);
            }
        }
    }
    // Combine Single Action tasks and first project tasks
    return [...singleActionTasks, ...projectFirstTasks];
}
/**
 * Fetches all project files with their tasks.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of project review information
 */
async function fetchProjectsWithTasks(app, settings) {
    const files = (0, fileUtils_1.getTasksFolderFiles)(app, settings);
    const projects = [];
    const somedayMaybeFolderName = settings.somedayMaybeFolderName;
    const inboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    for (const file of files) {
        const path = file.path;
        // Skip Inbox, Single Action, Someday Maybe folders, and Archive
        if (path === inboxPath)
            continue;
        if ((0, areaUtils_1.isSpecialFile)(path, settings))
            continue;
        if ((0, somedayMaybeUtils_1.isInSomedayMaybeFolder)(path, settings, app))
            continue;
        if ((0, areaUtils_1.isInArchiveDirectory)(path, settings))
            continue;
        const area = (0, areaUtils_1.inferAreaFromPath)(path, app, settings);
        const projectName = (0, areaUtils_1.isSpecialFile)(path, settings) ? undefined : file.basename;
        if (!projectName)
            continue; // Skip if no project name
        const tasks = await (0, taskUtils_1.loadTasksFromFile)(app, file, settings);
        const uncompletedTasks = tasks.filter(t => !t.checked);
        const hasNextAction = uncompletedTasks.length > 0;
        projects.push({
            path,
            name: projectName,
            area,
            tasks: uncompletedTasks,
            hasNextAction
        });
    }
    // Sort by area, then by project name
    projects.sort((a, b) => {
        const areaA = a.area || "";
        const areaB = b.area || "";
        if (areaA !== areaB)
            return areaA.localeCompare(areaB);
        return a.name.localeCompare(b.name);
    });
    return projects;
}
