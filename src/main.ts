import { App, Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { TaskWorkSettings, DEFAULT_SETTINGS, TaskWorkSettingTab } from "./settings";
import { captureQuickTask } from "./ui/CaptureModal";
import { archiveAllCompletedInVault, archiveCompletedInFile } from "./services/Archive";
import { moveTaskAtCursorInteractive, createProjectFile } from "./services/VaultIO";
import { toggleCompleteAtCursor, setFieldAtCursor, addRemoveTagsAtCursor, normalizeTaskLine } from "./services/TaskOps";
import { TaskWorkPanel, VIEW_TYPE_TASKWORK } from "./view/TaskworkPanel";


/**
 * Main plugin class for TaskWork - manages task lifecycle and commands.
 */
export default class TaskWorkPlugin extends Plugin {
  // definite assignment (!), we set it in loadSettings()
  settings!: TaskWorkSettings;

  /**
   * Called when the plugin is loaded. Registers commands, settings tab, and view.
   */
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TaskWorkSettingTab(this.app, this));

    // Register the side panel view
    this.registerView(VIEW_TYPE_TASKWORK, (leaf: WorkspaceLeaf) => new TaskWorkPanel(leaf, this.settings));

    // Command: open the side panel
    this.addCommand({
      id: "taskwork-open-panel",
      name: "Open TaskWork Panel",
      callback: () => this.activateView()
    });

    // Optional ribbon icon
    this.addRibbonIcon("check-circle", "TaskWork Panel", () => this.activateView());

    // Quick Add
    this.addCommand({
      id: "taskwork-quick-add",
      name: "Quick Add Task",
      callback: () => captureQuickTask(this.app, this.settings)
    });

    // Toggle Complete — new signature: (editor, ctx)
    this.addCommand({
      id: "taskwork-toggle-complete",
      name: "Complete/Uncomplete Task at Cursor",
      editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return new Notice("TaskWork: Not in a Markdown view.");
        toggleCompleteAtCursor(editor, view, this.settings);
      }
    });

    // Move Task — same approach as above
    this.addCommand({
      id: "taskwork-move-task",
      name: "Move Task (pick project)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await moveTaskAtCursorInteractive(this.app, editor, this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-set-due",
      name: "Set Due (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "due", this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-set-priority",
      name: "Set Priority (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "priority", this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-set-project",
      name: "Set Project (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "project", this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-set-recur",
      name: "Set Recurrence (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "recur", this.settings);
      }
    });

    // Note: Area command removed - areas are now folder-based only
    // Users should move tasks to different folders to change areas

    this.addCommand({
      id: "taskwork-add-remove-tags",
      name: "Add/Remove Tags (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await addRemoveTagsAtCursor(this.app, editor, this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-create-project",
      name: "Create Project File",
      callback: async () => {
        await createProjectFile(this.app, this.settings);
      }
    });

    this.addCommand({
      id: "taskwork-normalize-task",
      name: "Normalize Task Line (at cursor)",
      editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        normalizeTaskLine(editor);
      }
    });

    // Archive in current file — use ctx union type
    this.addCommand({
      id: "taskwork-archive-file",
      name: "Archive Completed in Current File",
      editorCallback: async (_ed: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        const file = ctx instanceof MarkdownView ? ctx.file : ctx.file;
        if (!file) return new Notice("TaskWork: No file in context.");
        const moved = await archiveCompletedInFile(this.app, file, this.settings);
        new Notice(`TaskWork: Archived ${moved} completed task(s) from ${file.name}.`);
      }
    });

    this.addCommand({
      id: "taskwork-archive-global",
      name: "Archive All Completed (older than N days)",
      callback: async () => {
        const moved = await archiveAllCompletedInVault(this.app, this.settings);
        new Notice(`TaskWork: Archived ${moved} completed task(s) across vault.`);
      }
    });
  }

  /**
   * Called when the plugin is unloaded. Cleans up resources.
   */
  onunload() {}

  /**
   * Loads settings from storage, merging with defaults.
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves current settings to storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Activates or reveals the TaskWork panel view.
   */
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASKWORK).first();
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return; // Can't create view if no leaf available
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_TASKWORK, active: true });
    }
    workspace.revealLeaf(leaf);
  }


}
