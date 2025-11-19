import { Editor, MarkdownFileInfo, MarkdownView, Notice } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { captureQuickTask } from "../ui/CaptureModal";
import { archiveAllCompletedInVault } from "../services/Archive";
import { moveTaskAtCursorInteractive, createProjectFile } from "../services/VaultIO";
import { toggleCompleteAtCursor, setFieldAtCursor, addRemoveTagsAtCursor, normalizeTaskLine } from "../services/TaskOps";
import type { GeckoTaskPlugin } from "../main";

/**
 * Registers all plugin commands.
 * @param plugin - The plugin instance
 */
export function registerCommands(plugin: GeckoTaskPlugin) {
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
    editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file) {
        // Not in a markdown view, just open add mode
        await captureQuickTask(app, settings);
        return;
      }

      // Try to get task at cursor
      const existingTask = plugin.getTaskAtCursor(editor, view.file);
      if (existingTask) {
        // Task found at cursor, open in edit mode
        await captureQuickTask(app, settings, existingTask);
      } else {
        // No task at cursor, open in add mode
        await captureQuickTask(app, settings);
      }
    },
    callback: async () => {
      // Fallback when not in editor - just open add mode
      await captureQuickTask(app, settings);
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
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return new Notice("GeckoTask: Not in a Markdown view.");
      toggleCompleteAtCursor(editor, view, settings);
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
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await moveTaskAtCursorInteractive(app, editor, settings);
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
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "due", settings);
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
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "scheduled", settings);
    }
  });

  /**
   * Sets or updates the priority field for the task at the cursor.
   * Unregistered automatically on plugin unload.
   */
  plugin.addCommand({
    id: "geckotask-set-priority",
    name: "Set Priority (at cursor)",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "priority", settings);
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
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "recur", settings);
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
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await addRemoveTagsAtCursor(app, editor, settings);
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
      await createProjectFile(app, settings);
    }
  });

  /**
   * Normalizes the task line at the cursor to standard format.
   * Unregistered automatically on plugin unload.
   */
  plugin.addCommand({
    id: "geckotask-normalize-task",
    name: "Normalize Task Line (at cursor)",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      normalizeTaskLine(editor);
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
      const moved = await archiveAllCompletedInVault(app, settings);
      new Notice(`GeckoTask: Archived ${moved} completed task(s) across vault.`);
    }
  });
}

