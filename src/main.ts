import { Editor, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { GeckoTaskSettings, DEFAULT_SETTINGS, GeckoTaskSettingTab } from "./settings";
import { TasksPanel, VIEW_TYPE_TASKS } from "./view/tasks/TasksPanel";
import { WeeklyReviewPanel, VIEW_TYPE_WEEKLY_REVIEW } from "./view/weekly-review/WeeklyReviewPanel";
import { HealthPanel, VIEW_TYPE_HEALTH } from "./view/health/HealthPanel";
import { IndexedTask } from "./view/tasks/TasksPanelTypes";
import { registerCommands } from "./commands";
import {
  activateTasksView,
  activateWeeklyReviewView as activateWeeklyReviewViewUtil,
  activateHealthView as activateHealthViewUtil,
} from "./utils/viewUtils";
import { registerMarkdownChrome } from "./plugin/registerMarkdownChrome";
import { scheduleAutoOpenTasksPanel } from "./plugin/scheduleAutoOpenTasksPanel";
import { getIndexedTaskAtCursor } from "./services/taskAtCursor";

/**
 * Main plugin class for GeckoTask - manages task lifecycle and commands.
 */
export default class GeckoTaskPlugin extends Plugin {
  // definite assignment (!), we set it in loadSettings()
  settings!: GeckoTaskSettings;

  /**
   * Called when the plugin is loaded. Registers commands, settings tab, and view.
   */
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GeckoTaskSettingTab(this.app, this));

    this.registerView(VIEW_TYPE_TASKS, (leaf: WorkspaceLeaf) => new TasksPanel(leaf, this.settings));
    this.registerView(VIEW_TYPE_WEEKLY_REVIEW, (leaf: WorkspaceLeaf) => new WeeklyReviewPanel(leaf, this.settings, this));
    this.registerView(VIEW_TYPE_HEALTH, (leaf: WorkspaceLeaf) => new HealthPanel(leaf, this.settings, this));

    registerCommands(this);

    registerMarkdownChrome(this);
    scheduleAutoOpenTasksPanel(this);
  }

  /**
   * Called when the plugin is unloaded. Cleans up resources.
   * Note: Obsidian automatically unregisters all commands, events, intervals, views,
   * and other registered resources when the plugin is unloaded. No explicit cleanup needed.
   */
  onunload() {
    // All registered resources (commands, events, intervals, views, etc.) are automatically
    // cleaned up by Obsidian's Plugin base class when the plugin is unloaded.
  }

  /**
   * Loads settings from storage, merging with defaults.
   */
  async loadSettings() {
    const loadedData = (await this.loadData()) || {};
    const hasLegacyAreaPaths = Array.isArray(loadedData.areaPaths);
    const hasSpacePaths = Array.isArray(loadedData.spacePaths);

    const migratedData = (!hasSpacePaths && hasLegacyAreaPaths)
      ? { ...loadedData, spacePaths: loadedData.areaPaths }
      : loadedData;

    this.settings = Object.assign({}, DEFAULT_SETTINGS, migratedData);

    // One-time persistence so we write the new key and stop depending on legacy areaPaths.
    if (!hasSpacePaths && hasLegacyAreaPaths) {
      await this.saveSettings();
    }
  }

  /**
   * Saves current settings to storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Activates or reveals the Tasks panel view.
   */
  async activateView() {
    await activateTasksView(this.app);
  }

  /**
   * Activates or reveals the Weekly Review panel view.
   */
  async activateWeeklyReviewView() {
    await activateWeeklyReviewViewUtil(this.app);
  }

  /**
   * Activates or reveals the Health Check panel view.
   */
  async activateHealthView() {
    await activateHealthViewUtil(this.app);
  }

  /**
   * Gets the task at the cursor position and converts it to IndexedTask format.
   * @param editor - The editor instance
   * @param file - The file containing the task
   * @returns IndexedTask if a task is found at the cursor, null otherwise
   */
  getTaskAtCursor(editor: Editor, file: TFile): IndexedTask | null {
    return getIndexedTaskAtCursor(this.app, this.settings, editor, file);
  }
}

// Export the plugin class type for use in other modules
export type { GeckoTaskPlugin };
