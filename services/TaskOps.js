"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCompleteAtCursor = toggleCompleteAtCursor;
exports.setFieldAtCursor = setFieldAtCursor;
exports.addRemoveTagsAtCursor = addRemoveTagsAtCursor;
exports.normalizeTaskLine = normalizeTaskLine;
const obsidian_1 = require("obsidian");
const TaskModel_1 = require("../models/TaskModel");
const NLDate_1 = require("./NLDate");
const PromptModal_1 = require("../ui/PromptModal");
const Recurrence_1 = require("./Recurrence");
const dateUtils_1 = require("../utils/dateUtils");
const editorUtils_1 = require("../utils/editorUtils");
/**
 * Gets the task at the current cursor line in the editor.
 * @param editor - The editor instance
 * @returns Task and line number, or null if no task found
 */
function getLineTask(editor) {
    const lineNo = editor.getCursor().line;
    const line = editor.getLine(lineNo);
    const task = (0, TaskModel_1.parseTask)(line);
    if (!task)
        return null;
    task.lineNo = lineNo;
    return { task, lineNo };
}
/**
 * Toggles the completion status of the task at the cursor.
 * If the task is recurring and being completed, creates a new occurrence.
 * @param editor - The editor instance
 * @param view - The markdown view
 * @param settings - Plugin settings
 */
async function toggleCompleteAtCursor(editor, view, settings) {
    const ctx = getLineTask(editor);
    if (!ctx) {
        new obsidian_1.Notice("GeckoTask: No task on this line.");
        return;
    }
    const currentLineNo = ctx.lineNo;
    // Get all lines from the editor to parse task with description
    const lines = (0, editorUtils_1.getAllEditorLines)(editor);
    // Parse the task with its description
    const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, currentLineNo);
    if (!parsed) {
        new obsidian_1.Notice("GeckoTask: Could not parse task.");
        return;
    }
    const checked = !parsed.checked;
    const today = new Date();
    const completion = checked ? (0, dateUtils_1.formatISODateTime)(today) : undefined;
    // Update the task
    parsed.checked = checked;
    parsed.completion = completion;
    // Format the updated task with description
    const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
    const updatedText = updatedLines.join("\n");
    // Replace the entire task block (including description) with the updated version
    (0, editorUtils_1.replaceTaskBlock)(editor, currentLineNo, endLine, updatedText);
    // If completing a recurring task, create the next occurrence
    if (checked && parsed.recur && parsed.recur.length > 0) {
        const nextDates = (0, Recurrence_1.calculateNextOccurrenceDates)(parsed.recur, today, parsed);
        if (nextDates) {
            // Create new task with next occurrence (preserve date types based on GTD rules)
            const newTask = {
                ...parsed,
                checked: false,
                scheduled: nextDates.scheduled,
                due: nextDates.due,
                completion: undefined,
                recur: parsed.recur, // Keep the recurrence pattern
            };
            const newTaskLines = (0, TaskModel_1.formatTaskWithDescription)(newTask);
            // Insert on the line directly underneath the task
            // After replacing the task, the task ends at currentLineNo + updatedLines.length - 1
            const taskEndLine = currentLineNo + updatedLines.length - 1;
            const taskEndLineContent = editor.getLine(taskEndLine);
            const insertPos = { line: taskEndLine, ch: taskEndLineContent.length };
            // Insert the new task on the next line (directly underneath)
            const insertText = "\n" + newTaskLines.join("\n");
            editor.replaceRange(insertText, insertPos, insertPos);
            // Build notice message based on which dates were set
            const dateParts = [];
            if (nextDates.scheduled)
                dateParts.push(`scheduled: ${nextDates.scheduled}`);
            if (nextDates.due)
                dateParts.push(`due: ${nextDates.due}`);
            const dateMsg = dateParts.join(", ");
            new obsidian_1.Notice(`GeckoTask: Next occurrence ${dateMsg}`);
        }
        else {
            new obsidian_1.Notice(`GeckoTask: Invalid recurrence pattern: ${parsed.recur}`);
        }
    }
}
/**
 * Sets a field value on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param key - The field key to set ("due", "scheduled", "priority", or "recur")
 * @param settings - Plugin settings
 */
async function setFieldAtCursor(app, editor, key, settings) {
    const currentLineNo = editor.getCursor().line;
    // Get all lines from the editor to parse task with description
    const lines = (0, editorUtils_1.getAllEditorLines)(editor);
    // Parse the task with its description
    const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, currentLineNo);
    if (!parsed) {
        new obsidian_1.Notice("GeckoTask: No task on this line.");
        return;
    }
    let promptText = `Set ${key}:`;
    let defaultValue = "";
    if (key === "due") {
        defaultValue = "today";
    }
    else if (key === "scheduled") {
        defaultValue = "today";
    }
    else if (key === "priority") {
        defaultValue = settings.allowedPriorities[0] || "";
    }
    else if (key === "recur") {
        defaultValue = "every Tuesday";
        promptText = "Set recurrence (e.g., 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'):";
    }
    const modal = new PromptModal_1.PromptModal(app, promptText, defaultValue);
    const value = await modal.prompt();
    if (value == null)
        return;
    let v = value.trim();
    if (key === "due" || key === "scheduled") {
        v = (0, NLDate_1.parseNLDate)(v) ?? v;
    }
    // Update the task with type-safe field assignment
    const updated = { ...parsed };
    if (key === "due") {
        updated.due = v || undefined;
    }
    else if (key === "scheduled") {
        updated.scheduled = v || undefined;
    }
    else if (key === "priority") {
        updated.priority = v || undefined;
    }
    else if (key === "recur") {
        updated.recur = v || undefined;
    }
    // Format the updated task with description
    const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(updated);
    const updatedText = updatedLines.join("\n");
    // Replace the entire task block (including description) with the updated version
    (0, editorUtils_1.replaceTaskBlock)(editor, currentLineNo, endLine, updatedText);
}
/**
 * Adds or removes tags on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
async function addRemoveTagsAtCursor(app, editor, settings) {
    const currentLineNo = editor.getCursor().line;
    // Get all lines from the editor to parse task with description
    const lines = (0, editorUtils_1.getAllEditorLines)(editor);
    // Parse the task with its description
    const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, currentLineNo);
    if (!parsed) {
        new obsidian_1.Notice("GeckoTask: No task on this line.");
        return;
    }
    const currentTags = parsed.tags.join(" ");
    const modal = new PromptModal_1.PromptModal(app, "Add/remove tags (space-separated, prefix with - to remove):", currentTags);
    const input = await modal.prompt();
    if (input == null)
        return;
    const tokens = input.trim().split(/\s+/).filter(Boolean);
    const tagsToAdd = [];
    const tagsToRemove = [];
    const existingTags = new Set(parsed.tags);
    for (const tok of tokens) {
        if (tok.startsWith("-")) {
            const tag = tok.substring(1);
            if (tag.startsWith("#")) {
                tagsToRemove.push(tag);
            }
            else {
                tagsToRemove.push("#" + tag);
            }
        }
        else {
            const tag = tok.startsWith("#") ? tok : "#" + tok;
            tagsToAdd.push(tag);
        }
    }
    // Remove tags
    for (const tag of tagsToRemove) {
        existingTags.delete(tag);
    }
    // Add tags
    for (const tag of tagsToAdd) {
        existingTags.add(tag);
    }
    // Update the task
    const updated = { ...parsed, tags: Array.from(existingTags) };
    // Format the updated task with description
    const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(updated);
    const updatedText = updatedLines.join("\n");
    // Replace the entire task block (including description) with the updated version
    (0, editorUtils_1.replaceTaskBlock)(editor, currentLineNo, endLine, updatedText);
}
/**
 * Normalizes the task line at the cursor to standard format.
 * @param editor - The editor instance
 */
function normalizeTaskLine(editor) {
    const currentLineNo = editor.getCursor().line;
    // Get all lines from the editor to parse task with description
    const lines = (0, editorUtils_1.getAllEditorLines)(editor);
    // Parse the task with its description
    const { task: parsed, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, currentLineNo);
    if (!parsed) {
        new obsidian_1.Notice("GeckoTask: No task on this line.");
        return;
    }
    // Format the normalized task with description
    const normalizedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
    const normalizedText = normalizedLines.join("\n");
    // Replace the entire task block (including description) with the normalized version
    (0, editorUtils_1.replaceTaskBlock)(editor, currentLineNo, endLine, normalizedText);
}
