import { Editor, MarkdownFileInfo, MarkdownView, Notice } from "obsidian";
import { captureQuickTask } from "../ui/CaptureModal";
import { moveTaskAtCursorInteractive, createProjectFile } from "../services/VaultIO";
import { toggleCompleteAtCursor, setFieldAtCursor, addRemoveTagsAtCursor, normalizeTaskLine, deleteCompletedTasks } from "../services/TaskOps";
import type { GeckoTaskPlugin } from "../main";

/**
 * Registers all plugin commands.
 */
export function registerCommands(plugin: GeckoTaskPlugin) {
  const { app, settings } = plugin;

  plugin.addCommand({
    id: "geckotask-open-panel",
    name: "Open Tasks Panel",
    icon: "check-circle",
    callback: () => plugin.activateView()
  });

  plugin.addCommand({
    id: "weekly-review-open-panel",
    name: "Open Weekly Review Panel",
    icon: "calendar",
    callback: () => plugin.activateWeeklyReviewView()
  });

  plugin.addCommand({
    id: "health-open-panel",
    name: "Open Health Check Panel",
    icon: "activity",
    callback: () => plugin.activateHealthView()
  });

  plugin.addRibbonIcon("check-circle", "Tasks Panel", () => plugin.activateView());

  plugin.addCommand({
    id: "geckotask-quick-add",
    name: "Quick Add/Edit Task",
    icon: "plus-circle",
    hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file) {
        await captureQuickTask(app, settings);
        return;
      }
      const existingTask = plugin.getTaskAtCursor(editor, view.file);
      if (existingTask) {
        await captureQuickTask(app, settings, existingTask);
      } else {
        await captureQuickTask(app, settings);
      }
    },
    callback: async () => {
      await captureQuickTask(app, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-toggle-complete",
    name: "Complete/Uncomplete Task at Cursor",
    icon: "check",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return new Notice("GeckoTask: Not in a Markdown view.");
      toggleCompleteAtCursor(editor, view, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-move-task",
    name: "Move Task (pick project)",
    icon: "arrow-right",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await moveTaskAtCursorInteractive(app, editor, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-due",
    name: "Set Due (at cursor)",
    icon: "calendar",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "due", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-scheduled",
    name: "Set Scheduled (at cursor)",
    icon: "calendar-clock",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "scheduled", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-priority",
    name: "Set Priority (at cursor)",
    icon: "flag",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "priority", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-recur",
    name: "Set Recurrence (at cursor)",
    icon: "repeat",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "recur", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-add-remove-tags",
    name: "Add/Remove Tags (at cursor)",
    icon: "tag",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await addRemoveTagsAtCursor(app, editor, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-create-project",
    name: "Create Project File",
    icon: "folder-plus",
    callback: async () => {
      await createProjectFile(app, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-normalize-task",
    name: "Normalize Task Line (at cursor)",
    icon: "wand-2",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      normalizeTaskLine(editor, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-delete-completed",
    name: "Delete Completed Tasks (current file)",
    icon: "trash-2",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      deleteCompletedTasks(editor, settings);
    }
  });

}
