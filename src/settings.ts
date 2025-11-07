import { App, PluginSettingTab, Setting } from "obsidian";
import TaskWorkPlugin from "./main";
import { normalizeInboxPath, getInboxDisplayPath } from "./utils/areaUtils";

/**
 * Plugin settings interface defining all configuration options.
 */
export interface TaskWorkSettings {
  tasksFolder: string;                // e.g., "tasks"
  areas: string[];                    // e.g., ["Work","Personal"] - folder names under tasksFolder
  inboxPath: string;                  // e.g., "tasks/Inbox.md" - single inbox for all areas
  generalTasksFile: string;            // e.g., "General" - file name for general tasks (no project shown)
  archivePattern: string;             // "Archive/Completed-YYYY.md"
  archiveOlderThanDays: number;       // 7
  allowedPriorities: string[];        // ["low","med","high","urgent"]
  nlDateParsing: boolean;
}

/**
 * Default settings values used when no saved settings exist.
 */
export const DEFAULT_SETTINGS: TaskWorkSettings = {
  tasksFolder: "tasks",
  areas: ["Work","Personal"],
  inboxPath: "tasks/Inbox", // Without .md extension - will be normalized when used
  generalTasksFile: "General", // File name for general tasks (no project shown, like Inbox)
  archivePattern: "Archive/Completed-YYYY.md",
  archiveOlderThanDays: 7,
  allowedPriorities: ["low","med","high","urgent"],
  nlDateParsing: true
};

/**
 * Settings tab UI for configuring TaskWork plugin options.
 */
export class TaskWorkSettingTab extends PluginSettingTab {
  plugin: TaskWorkPlugin;

  /**
   * Creates a new settings tab.
   * @param app - Obsidian app instance
   * @param plugin - TaskWork plugin instance
   */
  constructor(app: App, plugin: TaskWorkPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Renders the settings UI with all configuration options.
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Tasks Folder & Areas" });
    
    // Tasks folder
    new Setting(containerEl)
      .setName("Tasks folder")
      .setDesc("Base folder where all tasks are stored (e.g., 'tasks')")
      .addText(t => t
        .setValue(this.plugin.settings.tasksFolder)
        .onChange(async (v) => {
          this.plugin.settings.tasksFolder = v.trim() || "tasks";
          // Update inbox path if it was using old tasksFolder
          const currentInbox = getInboxDisplayPath(this.plugin.settings.inboxPath);
          if (currentInbox.startsWith(this.plugin.settings.tasksFolder + "/")) {
            // Keep relative path after tasksFolder
          } else {
            this.plugin.settings.inboxPath = `${this.plugin.settings.tasksFolder}/Inbox`;
          }
          await this.plugin.saveSettings();
        })
      );

    // Areas list
    new Setting(containerEl)
      .setName("Areas")
      .setDesc("Comma-separated list of area folder names (e.g., 'Work, Personal'). Leave empty for no areas.")
      .addText(t => t
        .setValue(this.plugin.settings.areas.join(", "))
        .onChange(async (v) => {
          const areas = v.split(",").map(a => a.trim()).filter(Boolean);
          this.plugin.settings.areas = areas;
          await this.plugin.saveSettings();
        })
      );

    // Single inbox path
    new Setting(containerEl)
      .setName("Inbox path")
      .setDesc("Path to the single inbox file for all tasks (without .md extension)")
      .addText(t => t
        .setValue(getInboxDisplayPath(this.plugin.settings.inboxPath))
        .onChange(async (v) => {
          // Store without .md extension - will be normalized when used
          this.plugin.settings.inboxPath = v.trim() || `${this.plugin.settings.tasksFolder}/Inbox`;
          await this.plugin.saveSettings();
        })
      );

    // General tasks file name
    new Setting(containerEl)
      .setName("General tasks file")
      .setDesc("File name for general tasks (without .md extension). Tasks in this file won't show a project name, similar to Inbox.")
      .addText(t => t
        .setValue(this.plugin.settings.generalTasksFile)
        .onChange(async (v) => {
          this.plugin.settings.generalTasksFile = v.trim() || "General";
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Archive" });

    new Setting(containerEl)
      .setName("Archive pattern")
      .setDesc("Use YYYY in the filename to group by year (e.g., Archive/Completed-YYYY.md)")
      .addText(t => t
        .setValue(this.plugin.settings.archivePattern)
        .onChange(async (v) => { this.plugin.settings.archivePattern = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Archive older than (days)")
      .addText(t => t
        .setPlaceholder("7")
        .setValue(String(this.plugin.settings.archiveOlderThanDays))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n)) this.plugin.settings.archiveOlderThanDays = n;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Task Options" });

    new Setting(containerEl)
      .setName("Natural language due parsing")
      .setDesc("Enable parsing of dates like 'today', 'tomorrow', 'next monday'")
      .addToggle(t => t
        .setValue(this.plugin.settings.nlDateParsing)
        .onChange(async (v) => { this.plugin.settings.nlDateParsing = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Allowed priorities")
      .setDesc("Comma-separated list of priority values")
      .addText(t => t
        .setValue(this.plugin.settings.allowedPriorities.join(", "))
        .onChange(async (v) => {
          const priorities = v.split(",").map(p => p.trim()).filter(Boolean);
          this.plugin.settings.allowedPriorities = priorities.length > 0 ? priorities : ["low", "med", "high", "urgent"];
          await this.plugin.saveSettings();
        })
      );
  }
}
