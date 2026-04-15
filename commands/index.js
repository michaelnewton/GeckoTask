"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const obsidian_1 = require("obsidian");
const EffortTags_1 = require("../services/EffortTags");
const CaptureModal_1 = require("../ui/CaptureModal");
const Archive_1 = require("../services/Archive");
const VaultIO_1 = require("../services/VaultIO");
const TaskOps_1 = require("../services/TaskOps");
/**
 * Registers all plugin commands.
 * @param plugin - The plugin instance
 */
function registerCommands(plugin) {
    const { app, settings } = plugin;
    /**
     * Opens the Tasks side panel for task management.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-open-panel",
        name: "Open Tasks Panel",
        callback: () => plugin.activateView()
    });
    /**
     * Opens the Weekly Review side panel.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "weekly-review-open-panel",
        name: "Open Weekly Review Panel",
        callback: () => plugin.activateWeeklyReviewView()
    });
    /**
     * Opens the Health Check side panel.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "health-open-panel",
        name: "Open Health Check Panel",
        callback: () => plugin.activateHealthView()
    });
    // Optional ribbon icon
    plugin.addRibbonIcon("check-circle", "Tasks Panel", () => plugin.activateView());
    /**
     * Opens a modal to quickly capture a new task or edit an existing task at the cursor.
     * If the cursor is on a task line, opens in edit mode; otherwise opens in add mode.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-quick-add",
        name: "Quick Add/Edit Task",
        hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
        editorCallback: async (editor, ctx) => {
            const view = app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!view || !view.file) {
                // Not in a markdown view, just open add mode
                await (0, CaptureModal_1.captureQuickTask)(app, settings);
                return;
            }
            // Try to get task at cursor
            const existingTask = plugin.getTaskAtCursor(editor, view.file);
            if (existingTask) {
                // Task found at cursor, open in edit mode
                await (0, CaptureModal_1.captureQuickTask)(app, settings, existingTask);
            }
            else {
                // No task at cursor, open in add mode
                await (0, CaptureModal_1.captureQuickTask)(app, settings);
            }
        },
        callback: async () => {
            // Fallback when not in editor - just open add mode
            await (0, CaptureModal_1.captureQuickTask)(app, settings);
        }
    });
    /**
     * Toggles the completion status of the task at the cursor position.
     * Handles recurring tasks by creating the next occurrence when completed.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-toggle-complete",
        name: "Complete/Uncomplete Task at Cursor",
        editorCallback: (editor, _ctx) => {
            const view = app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!view)
                return new obsidian_1.Notice("GeckoTask: Not in a Markdown view.");
            (0, TaskOps_1.toggleCompleteAtCursor)(editor, view, settings);
        }
    });
    /**
     * Moves the task at the cursor to a different project file.
     * Prompts user to select the target project.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-move-task",
        name: "Move Task (pick project)",
        editorCallback: async (editor, _ctx) => {
            await (0, VaultIO_1.moveTaskAtCursorInteractive)(app, editor, settings);
        }
    });
    /**
     * Sets or updates the due date field for the task at the cursor.
     * Supports natural language date parsing if enabled.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-set-due",
        name: "Set Due (at cursor)",
        editorCallback: async (editor, _ctx) => {
            await (0, TaskOps_1.setFieldAtCursor)(app, editor, "due", settings);
        }
    });
    /**
     * Sets or updates the scheduled date field for the task at the cursor.
     * Supports natural language date parsing if enabled.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-set-scheduled",
        name: "Set Scheduled (at cursor)",
        editorCallback: async (editor, _ctx) => {
            await (0, TaskOps_1.setFieldAtCursor)(app, editor, "scheduled", settings);
        }
    });
    /**
     * Sets or updates the priority field for the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-set-priority",
        name: "Set Priority (at cursor)",
        editorCallback: async (editor, _ctx) => {
            await (0, TaskOps_1.setFieldAtCursor)(app, editor, "priority", settings);
        }
    });
    // Note: Project command removed - projects are now file-based only
    // Users should move tasks to different files to change projects
    /**
     * Sets or updates the recurrence pattern for the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-set-recur",
        name: "Set Recurrence (at cursor)",
        editorCallback: async (editor, _ctx) => {
            await (0, TaskOps_1.setFieldAtCursor)(app, editor, "recur", settings);
        }
    });
    // Note: Area command removed - areas are now folder-based only
    // Users should move tasks to different folders to change areas
    /**
     * Adds or removes tags from the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-add-remove-tags",
        name: "Add/Remove Tags (at cursor)",
        editorCallback: async (editor, _ctx) => {
            await (0, TaskOps_1.addRemoveTagsAtCursor)(app, editor, settings);
        }
    });
    /**
     * Creates a new project file for organizing tasks.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-create-project",
        name: "Create Project File",
        callback: async () => {
            await (0, VaultIO_1.createProjectFile)(app, settings);
        }
    });
    /**
     * Normalizes the task line at the cursor to standard format.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-normalize-task",
        name: "Normalize Task Line (at cursor)",
        editorCallback: (editor, _ctx) => {
            (0, TaskOps_1.normalizeTaskLine)(editor);
        }
    });
    plugin.addCommand({
        id: "effort-tags-tag-current-file",
        name: "Add effort tags to all tasks in current file",
        callback: async () => {
            const view = app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!view || !view.file) {
                new obsidian_1.Notice("GeckoTask: Not in a Markdown view.");
                return;
            }
            const file = view.file;
            const content = await app.vault.read(file);
            const lines = content.split(/\r?\n/);
            const tasks = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = EffortTags_1.taskRegex.exec(line);
                if (!match)
                    continue;
                const [, , rest] = match;
                tasks.push({ lineIndex: i, original: line, body: (0, EffortTags_1.stripExistingEffortTags)(rest) });
            }
            if (tasks.length === 0) {
                new obsidian_1.Notice("GeckoTask: No checkbox tasks found in current file.");
                return;
            }
            const predictions = await (0, EffortTags_1.estimateEffortWithLLM)(tasks.map((task, index) => ({ index, text: task.body })), settings);
            const predictionMap = new Map();
            for (const prediction of predictions) {
                predictionMap.set(prediction.index, prediction.effort);
            }
            const updatedLines = [...lines];
            let updatedCount = 0;
            for (let index = 0; index < tasks.length; index++) {
                const task = tasks[index];
                const effort = predictionMap.get(index) ?? (0, EffortTags_1.estimateEffortRuleBased)(task.body);
                const updatedLine = (0, EffortTags_1.applyEffortTagToLine)(task.original, effort);
                if (updatedLine !== task.original) {
                    updatedLines[task.lineIndex] = updatedLine;
                    updatedCount += 1;
                }
            }
            if (updatedCount === 0) {
                new obsidian_1.Notice("GeckoTask: Effort tags already up to date.");
                return;
            }
            await app.vault.modify(file, updatedLines.join("\n"));
            new obsidian_1.Notice(`GeckoTask: Applied effort tags to ${updatedCount} task(s).`);
        }
    });
    /**
     * Archives all completed tasks across the vault that are older than the configured threshold.
     * Unregistered automatically on plugin unload.
     */
    plugin.addCommand({
        id: "geckotask-archive-global",
        name: "Archive All Completed (older than N days)",
        callback: async () => {
            const moved = await (0, Archive_1.archiveAllCompletedInVault)(app, settings);
            new obsidian_1.Notice(`GeckoTask: Archived ${moved} completed task(s) across vault.`);
        }
    });
}
