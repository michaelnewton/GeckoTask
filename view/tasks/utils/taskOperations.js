"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTask = toggleTask;
exports.updateTaskField = updateTaskField;
exports.updateTaskTitle = updateTaskTitle;
exports.openTaskInNote = openTaskInNote;
exports.moveTask = moveTask;
const obsidian_1 = require("obsidian");
const TaskModel_1 = require("../../../models/TaskModel");
const dateUtils_1 = require("../../../utils/dateUtils");
const Recurrence_1 = require("../../../services/Recurrence");
/**
 * Toggles the completion status of a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to toggle
 * @param checked - New checked state
 * @returns Promise that resolves when task is updated
 */
async function toggleTask(app, task, checked) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    let nextOccurrenceDue = null;
    let nextOccurrenceDates = null;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = (task.line ?? 1) - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        // Parse the current task to preserve all fields including description
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        // Update checked status
        parsed.checked = checked;
        // Update completed date
        let nextOccurrenceTask = null;
        if (checked) {
            if (!parsed.completion) {
                const today = (0, dateUtils_1.formatISODateTime)(new Date());
                parsed.completion = today;
            }
            // If recurring task, create next occurrence
            if (parsed.recur && parsed.recur.length > 0) {
                const today = new Date();
                const nextDates = (0, Recurrence_1.calculateNextOccurrenceDates)(parsed.recur, today, parsed);
                if (nextDates) {
                    nextOccurrenceDates = nextDates;
                    nextOccurrenceDue = nextDates.scheduled || nextDates.due || null;
                    nextOccurrenceTask = {
                        ...parsed,
                        checked: false,
                        scheduled: nextDates.scheduled,
                        due: nextDates.due,
                        completion: undefined,
                        recur: parsed.recur,
                    };
                }
            }
        }
        else {
            parsed.completion = undefined;
        }
        // Format task with description
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        // If we have a next occurrence, add it directly underneath the current task
        if (nextOccurrenceTask) {
            const nextOccurrenceLines = (0, TaskModel_1.formatTaskWithDescription)(nextOccurrenceTask);
            updatedLines.push(...nextOccurrenceLines);
        }
        // Replace task line and description lines
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
    if (checked && nextOccurrenceDue && nextOccurrenceDates) {
        // Build notice message based on which dates were set
        const dateParts = [];
        if (nextOccurrenceDates.scheduled)
            dateParts.push(`scheduled: ${nextOccurrenceDates.scheduled}`);
        if (nextOccurrenceDates.due)
            dateParts.push(`due: ${nextOccurrenceDates.due}`);
        const dateMsg = dateParts.join(", ");
        new obsidian_1.Notice(`Task completed. Next occurrence ${dateMsg}`);
    }
    else {
        new obsidian_1.Notice(`Task ${checked ? "completed" : "reopened"}`);
    }
}
/**
 * Updates a field value on a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to update
 * @param key - Field key to update ("due", "scheduled", "priority", or "recur")
 * @param value - New field value (optional)
 * @returns Promise that resolves when task is updated
 */
async function updateTaskField(app, task, key, value) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = (task.line ?? 1) - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        // Parse the current task to preserve all fields including description
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        // Update the field
        if (key === "due") {
            parsed.due = value;
        }
        else if (key === "scheduled") {
            parsed.scheduled = value;
        }
        else if (key === "priority") {
            parsed.priority = value;
        }
        else if (key === "recur") {
            parsed.recur = value;
        }
        // Format task with description
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        // Replace task line and description lines
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
}
/**
 * Updates the title of a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to update
 * @param newTitle - New title text
 * @returns Promise that resolves when task is updated
 */
async function updateTaskTitle(app, task, newTitle) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = (task.line ?? 1) - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        // Parse the current task to preserve all fields including description
        const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
        if (!parsed)
            return data;
        // Update the title
        parsed.title = newTitle;
        // Format task with description
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        // Replace task line and description lines
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
}
/**
 * Opens the note containing a task and scrolls to it.
 * @param app - Obsidian app instance
 * @param task - The indexed task to open
 * @returns Promise that resolves when file is opened
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
 * Moves a task to a different file via file picker.
 * @param app - Obsidian app instance
 * @param task - The indexed task to move
 * @param targetFile - Target file to move task to
 * @returns Promise that resolves when task is moved
 */
async function moveTask(app, task, targetFile) {
    try {
        // Remove from current file (preserving description)
        const sourceFile = app.vault.getAbstractFileByPath(task.path);
        if (!(sourceFile instanceof obsidian_1.TFile)) {
            new obsidian_1.Notice("GeckoTask: Source file not found.");
            return;
        }
        let taskWithDescription = null;
        await app.vault.process(sourceFile, (data) => {
            const lines = data.split("\n");
            const taskLineIdx = task.line - 1; // 0-based
            const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
            if (taskLineIdx < 0 || taskLineIdx >= lines.length)
                return data;
            // Parse current task with description
            const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
            if (!parsed)
                return data;
            // Update task metadata (remove area:: and project:: since we're using folder/file-based structure)
            taskWithDescription = {
                ...parsed,
                area: undefined, // Don't store area in metadata, it's derived from folder
                project: undefined, // Don't store project in metadata, it's derived from file basename
            };
            // Remove task line and description lines
            const numLinesToRemove = descEndIdx - taskLineIdx + 1;
            lines.splice(taskLineIdx, numLinesToRemove);
            return lines.join("\n");
        });
        if (!taskWithDescription) {
            new obsidian_1.Notice("GeckoTask: Could not parse task to move.");
            return;
        }
        // Format task with description
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(taskWithDescription);
        // Ensure target file exists and is accessible
        let finalTargetFile = app.vault.getAbstractFileByPath(targetFile.path);
        if (!finalTargetFile || !(finalTargetFile instanceof obsidian_1.TFile)) {
            // If file doesn't exist, try to get it from the target object directly
            finalTargetFile = targetFile;
        }
        if (!finalTargetFile || !(finalTargetFile instanceof obsidian_1.TFile)) {
            new obsidian_1.Notice(`GeckoTask: Target file not found: ${targetFile.path}`);
            return;
        }
        // Append to target file
        const targetContent = await app.vault.read(finalTargetFile);
        const finalLines = updatedLines.join("\n");
        const updated = targetContent.trim().length
            ? targetContent + "\n" + finalLines + "\n"
            : finalLines + "\n";
        await app.vault.modify(finalTargetFile, updated);
        new obsidian_1.Notice(`GeckoTask: Moved task to ${finalTargetFile.path}`);
    }
    catch (error) {
        new obsidian_1.Notice(`GeckoTask: Error moving task: ${error}`);
        console.error("GeckoTask: Error moving task:", error);
    }
}
