"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTasksToInbox = addTasksToInbox;
exports.moveTaskToProject = moveTaskToProject;
exports.moveTaskToSomedayMaybe = moveTaskToSomedayMaybe;
exports.updateTaskDueDate = updateTaskDueDate;
exports.removeTag = removeTag;
exports.activateSomedayMaybeTask = activateSomedayMaybeTask;
exports.activateSomedayMaybeProject = activateSomedayMaybeProject;
exports.addTaskToProject = addTaskToProject;
exports.openTaskInNote = openTaskInNote;
exports.openProjectFile = openProjectFile;
const obsidian_1 = require("obsidian");
const TaskModel_1 = require("../../../models/TaskModel");
const NLDate_1 = require("../../../services/NLDate");
const areaUtils_1 = require("../../../utils/areaUtils");
const somedayMaybeUtils_1 = require("../../../utils/somedayMaybeUtils");
const areaUtils_2 = require("../../../utils/areaUtils");
const FilePickerModal_1 = require("../../../ui/FilePickerModal");
const PromptModal_1 = require("../../../ui/PromptModal");
const CaptureModal_1 = require("../../../ui/CaptureModal");
/**
 * Adds tasks to Inbox from text input.
 */
async function addTasksToInbox(app, settings, text) {
    // Split by newlines and create tasks
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const inboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    for (const line of lines) {
        const task = {
            checked: false,
            title: line.trim(),
            tags: [],
            raw: ""
        };
        const taskLines = (0, TaskModel_1.formatTaskWithDescription)(task);
        const inboxFile = app.vault.getAbstractFileByPath(inboxPath);
        if (inboxFile instanceof obsidian_1.TFile) {
            const content = await app.vault.read(inboxFile);
            // Remove trailing newlines from existing content to avoid extra blank lines
            const normalizedContent = content.replace(/\n+$/, "");
            const updated = normalizedContent.length
                ? normalizedContent + "\n" + taskLines.join("\n") + "\n"
                : taskLines.join("\n") + "\n";
            await app.vault.modify(inboxFile, updated);
        }
    }
    new obsidian_1.Notice(`Added ${lines.length} task(s) to Inbox`);
}
/**
 * Moves a task to a project.
 */
async function moveTaskToProject(app, settings, task) {
    // FilePickerModal will automatically get and sort files
    const target = await new FilePickerModal_1.FilePickerModal(app, [], settings).openAndGet();
    if (!target)
        return;
    await moveTask(app, task, target.path);
    new obsidian_1.Notice(`Task moved to ${target.path}`);
}
/**
 * Moves a task to Someday/Maybe.
 */
async function moveTaskToSomedayMaybe(app, settings, task) {
    // Determine area from task
    const areas = (0, areaUtils_2.getAreas)(app, settings);
    const area = task.area || (areas.length > 0 ? areas[0] : undefined);
    if (!area) {
        new obsidian_1.Notice("No area found for task");
        return;
    }
    const somedayMaybePath = (0, somedayMaybeUtils_1.getSomedayMaybePath)(area, settings) + ".md";
    // Check if file exists, create if not
    let somedayMaybeFile = app.vault.getAbstractFileByPath(somedayMaybePath);
    if (!somedayMaybeFile) {
        somedayMaybeFile = await app.vault.create(somedayMaybePath, `# ${settings.somedayMaybeFolderName}\n\n`);
    }
    if (!(somedayMaybeFile instanceof obsidian_1.TFile)) {
        new obsidian_1.Notice(`Failed to create ${settings.somedayMaybeFolderName} file`);
        return;
    }
    await moveTask(app, task, somedayMaybePath);
    new obsidian_1.Notice(`Task moved to ${settings.somedayMaybeFolderName} (${area})`);
}
/**
 * Moves a task to a different file.
 */
async function moveTask(app, task, targetPath) {
    const sourceFile = app.vault.getAbstractFileByPath(task.path);
    if (!(sourceFile instanceof obsidian_1.TFile))
        return;
    let taskWithDescription = null;
    await app.vault.process(sourceFile, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = task.line - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        taskWithDescription = {
            ...parsed,
            area: undefined,
            project: undefined
        };
        const numLinesToRemove = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToRemove);
        return lines.join("\n");
    });
    if (!taskWithDescription)
        return;
    const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(taskWithDescription);
    const targetFile = app.vault.getAbstractFileByPath(targetPath);
    if (!(targetFile instanceof obsidian_1.TFile))
        return;
    const targetContent = await app.vault.read(targetFile);
    const finalLines = updatedLines.join("\n");
    // Remove trailing newlines from existing content to avoid extra blank lines
    const normalizedTarget = targetContent.replace(/\n+$/, "");
    const updated = normalizedTarget.length
        ? normalizedTarget + "\n" + finalLines + "\n"
        : finalLines + "\n";
    await app.vault.modify(targetFile, updated);
}
/**
 * Updates a task's due date.
 */
async function updateTaskDueDate(app, settings, task) {
    const defaultValue = task.due ?? "today";
    const modal = new PromptModal_1.PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue);
    const next = await modal.prompt();
    if (next == null || next.trim() === "")
        return;
    const parsed = (0, NLDate_1.parseNLDate)(next) ?? next;
    await updateTaskField(app, task, "due", parsed);
}
/**
 * Updates a task field.
 */
async function updateTaskField(app, task, key, value) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = task.line - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        if (key === "due") {
            parsed.due = value;
        }
        else if (key === "priority") {
            parsed.priority = value;
        }
        else if (key === "recur") {
            parsed.recur = value;
        }
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
}
/**
 * Removes a tag from a task.
 */
async function removeTag(app, task, tag) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = task.line - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
        parsed.tags = parsed.tags.filter(t => t !== normalizedTag);
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
    new obsidian_1.Notice(`Removed ${tag} tag`);
}
/**
 * Activates a Someday/Maybe task (moves to active project in same area).
 */
async function activateSomedayMaybeTask(app, settings, task) {
    const area = task.area;
    if (!area) {
        new obsidian_1.Notice("No area found for task");
        return;
    }
    // Get all project files in the same area (excluding Someday Maybe folder)
    const normalizedInboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    const files = app.vault.getMarkdownFiles()
        .filter(f => {
        if (!(0, areaUtils_2.isInTasksFolder)(f.path, settings))
            return false;
        if ((0, areaUtils_2.isTasksFolderFile)(f.path, settings))
            return false;
        const fileArea = (0, areaUtils_2.inferAreaFromPath)(f.path, app, settings);
        if (fileArea !== area)
            return false;
        if (f.path === normalizedInboxPath)
            return false;
        if ((0, somedayMaybeUtils_1.isInSomedayMaybeFolder)(f.path, settings, app)) {
            return false;
        }
        return true;
    });
    if (files.length === 0) {
        new obsidian_1.Notice(`No active projects found in ${area} area`);
        return;
    }
    const target = await new FilePickerModal_1.FilePickerModal(app, files, settings).openAndGet();
    if (!target)
        return;
    await moveTask(app, task, target.path);
    new obsidian_1.Notice(`Task activated and moved to ${target.basename}`);
}
/**
 * Activates a Someday/Maybe project (moves all tasks to an active project in same area).
 */
async function activateSomedayMaybeProject(app, settings, project) {
    const area = project.area;
    if (!area) {
        new obsidian_1.Notice("No area found for project");
        return;
    }
    // Get all project files in the same area (excluding Someday Maybe folder)
    const normalizedInboxPath = (0, areaUtils_1.normalizeInboxPath)(settings.inboxPath);
    const files = app.vault.getMarkdownFiles()
        .filter(f => {
        if (!(0, areaUtils_2.isInTasksFolder)(f.path, settings))
            return false;
        if ((0, areaUtils_2.isTasksFolderFile)(f.path, settings))
            return false;
        const fileArea = (0, areaUtils_2.inferAreaFromPath)(f.path, app, settings);
        if (fileArea !== area)
            return false;
        if (f.path === normalizedInboxPath)
            return false;
        if ((0, somedayMaybeUtils_1.isInSomedayMaybeFolder)(f.path, settings, app)) {
            return false;
        }
        return true;
    });
    if (files.length === 0) {
        new obsidian_1.Notice(`No active projects found in ${area} area`);
        return;
    }
    const target = await new FilePickerModal_1.FilePickerModal(app, files, settings).openAndGet();
    if (!target)
        return;
    // Move all tasks from the Someday Maybe project to the target project
    const sourceFile = app.vault.getAbstractFileByPath(project.path);
    if (!(sourceFile instanceof obsidian_1.TFile)) {
        new obsidian_1.Notice("Source project file not found");
        return;
    }
    // Read source file to get all tasks
    const sourceContent = await app.vault.read(sourceFile);
    const sourceLines = sourceContent.split("\n");
    // Find all task lines in the source file
    const cache = app.metadataCache.getCache(project.path);
    const lists = cache?.listItems;
    if (!lists || lists.length === 0) {
        new obsidian_1.Notice("No tasks found in project");
        return;
    }
    // Collect all task line ranges
    const taskRanges = [];
    for (const li of lists) {
        if (!li.task)
            continue;
        const lineNo = li.position?.start?.line ?? 0;
        if (lineNo < 0 || lineNo >= sourceLines.length)
            continue;
        const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(sourceLines, lineNo);
        if (!parsed)
            continue;
        const taskLines = sourceLines.slice(lineNo, endLine + 1);
        taskRanges.push({ startLine: lineNo, endLine, lines: taskLines });
    }
    if (taskRanges.length === 0) {
        new obsidian_1.Notice("No tasks to move");
        return;
    }
    // Remove tasks from source file
    await app.vault.process(sourceFile, (data) => {
        const lines = data.split("\n");
        const sortedRanges = [...taskRanges].sort((a, b) => b.startLine - a.startLine);
        for (const range of sortedRanges) {
            const numLines = range.endLine - range.startLine + 1;
            lines.splice(range.startLine, numLines);
        }
        return lines.join("\n");
    });
    // Add tasks to target file
    const targetContent = await app.vault.read(target);
    const tasksText = taskRanges.map(r => r.lines.join("\n")).join("\n\n");
    // Remove trailing newlines from existing content to avoid extra blank lines
    const normalizedTarget = targetContent.replace(/\n+$/, "");
    const updated = normalizedTarget.length
        ? normalizedTarget + "\n\n" + tasksText + "\n"
        : tasksText + "\n";
    await app.vault.modify(target, updated);
    new obsidian_1.Notice(`Project activated: ${taskRanges.length} task(s) moved to ${target.basename}`);
}
/**
 * Adds a task to a project.
 */
async function addTaskToProject(app, settings, projectPath) {
    await (0, CaptureModal_1.captureQuickTask)(app, settings, undefined, projectPath);
}
/**
 * Opens the note containing a task and scrolls to it.
 */
async function openTaskInNote(app, task) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
    // Scroll to the line
    const view = leaf.view;
    if (view instanceof obsidian_1.MarkdownView && view.editor) {
        const editor = view.editor;
        const line = Math.max(0, task.line - 1); // 0-based
        editor.setCursor(line, 0);
        editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
}
/**
 * Opens a project file.
 */
async function openProjectFile(app, projectPath) {
    const file = app.vault.getAbstractFileByPath(projectPath);
    if (!(file instanceof obsidian_1.TFile))
        return;
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
}
