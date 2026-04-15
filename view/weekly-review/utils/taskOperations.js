"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeTask = completeTask;
exports.deleteTask = deleteTask;
const obsidian_1 = require("obsidian");
const dateUtils_1 = require("../../../utils/dateUtils");
const TaskModel_1 = require("../../../models/TaskModel");
const Recurrence_1 = require("../../../services/Recurrence");
/**
 * Completes a task and handles recurrence if applicable.
 */
async function completeTask(app, task) {
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
        parsed.checked = true;
        if (!parsed.completion) {
            const today = (0, dateUtils_1.formatISODateTime)(new Date());
            parsed.completion = today;
        }
        // Handle recurring tasks
        let nextOccurrenceTask = null;
        if (parsed.recur && parsed.recur.length > 0) {
            const today = new Date();
            const nextDates = (0, Recurrence_1.calculateNextOccurrenceDates)(parsed.recur, today, parsed);
            if (nextDates) {
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
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
        if (nextOccurrenceTask) {
            const nextOccurrenceLines = (0, TaskModel_1.formatTaskWithDescription)(nextOccurrenceTask);
            updatedLines.push(...nextOccurrenceLines);
        }
        const numLinesToReplace = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
        return lines.join("\n");
    });
    new obsidian_1.Notice("Task completed");
}
/**
 * Deletes a task from its file.
 */
async function deleteTask(app, task) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof obsidian_1.TFile))
        return;
    await app.vault.process(file, (data) => {
        const lines = data.split("\n");
        const taskLineIdx = task.line - 1;
        const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
        if (taskLineIdx < 0 || taskLineIdx >= lines.length)
            return data;
        const numLinesToRemove = descEndIdx - taskLineIdx + 1;
        lines.splice(taskLineIdx, numLinesToRemove);
        return lines.join("\n");
    });
    new obsidian_1.Notice("Task deleted");
}
