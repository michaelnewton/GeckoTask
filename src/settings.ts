import { App, PluginSettingTab, Setting } from "obsidian";
import TaskWorkPlugin from "./main";
import { normalizeInboxPath, getInboxDisplayPath } from "./utils/areaUtils";

/**
 * Plugin settings interface defining all configuration options.
 */
export interface TaskWorkSettings {
  tasksFolder: string;                // e.g., "tasks"
  areasEnabled: boolean;              // When enabled, areas are auto-detected from first-level directories in tasksFolder
  inboxPath: string;                  // e.g., "tasks/Inbox.md" - single inbox for all areas
  generalTasksFile: string;            // e.g., "General" - file name for general tasks (no project shown)
  somedayMaybeFolderName: string;      // e.g., "Someday Maybe" - folder name for someday/maybe items per area
  archivePattern: string;             // "Archive/Completed-YYYY.md"
  archiveOlderThanDays: number;       // 7
  allowedPriorities: string[];        // ["low","med","high","urgent"]
  nlDateParsing: boolean;
  dueDateRanges: string[];            // Configurable due date ranges (e.g., ["7d", "14d", "30d", "60d"])
  customCollectionPoints: string[];   // Custom collection points for step 1A (e.g., ["Facebook", "Slack", "Twitter"])
}

/**
 * Default settings values used when no saved settings exist.
 */
export const DEFAULT_SETTINGS: TaskWorkSettings = {
  tasksFolder: "tasks",
  areasEnabled: false, // Areas are auto-detected from first-level directories when enabled
  inboxPath: "tasks/Inbox", // Without .md extension - will be normalized when used
  generalTasksFile: "General", // File name for general tasks (no project shown, like Inbox)
  somedayMaybeFolderName: "Someday Maybe", // Folder name for someday/maybe items per area
  archivePattern: "Archive/Completed-YYYY.md",
  archiveOlderThanDays: 7,
  allowedPriorities: ["low","med","high","urgent"],
  nlDateParsing: true,
  dueDateRanges: ["7d", "14d", "30d", "60d", "90d"],  // Default configurable ranges
  customCollectionPoints: []  // No custom collection points by default
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

    // Enabled Areas checkbox
    new Setting(containerEl)
      .setName("Enabled Areas")
      .setDesc("When enabled, areas are automatically detected from first-level directories in the tasks folder. Each directory directly under the tasks folder will be treated as an area.")
      .addToggle(t => t
        .setValue(this.plugin.settings.areasEnabled)
        .onChange(async (v) => {
          this.plugin.settings.areasEnabled = v;
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

    // Someday Maybe folder name
    new Setting(containerEl)
      .setName("Someday Maybe folder name")
      .setDesc("Folder name for someday/maybe items per area (e.g., 'Someday Maybe'). This folder will be created under each area folder.")
      .addText(t => t
        .setValue(this.plugin.settings.somedayMaybeFolderName)
        .onChange(async (v) => {
          this.plugin.settings.somedayMaybeFolderName = v.trim() || "Someday Maybe";
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

    new Setting(containerEl)
      .setName("Due date ranges")
      .setDesc("Comma-separated list of due date ranges to show in filter dropdown (e.g., '7d, 14d, 30d, 60d, 90d'). Use format like '7d' for days or '30d' for 30 days.")
      .addText(t => t
        .setValue(this.plugin.settings.dueDateRanges.join(", "))
        .onChange(async (v) => {
          const ranges = v.split(",").map(r => r.trim()).filter(Boolean);
          this.plugin.settings.dueDateRanges = ranges.length > 0 ? ranges : ["7d", "14d", "30d", "60d", "90d"];
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Weekly Review" });

    new Setting(containerEl)
      .setName("Custom collection points")
      .setDesc("Comma-separated list of additional collection points for step 1A (e.g., 'Facebook, Slack, Twitter'). These will appear as additional fields in the Collect Loose Ends step.")
      .addText(t => t
        .setValue(this.plugin.settings.customCollectionPoints.join(", "))
        .onChange(async (v) => {
          const points = v.split(",").map(p => p.trim()).filter(Boolean);
          this.plugin.settings.customCollectionPoints = points;
          await this.plugin.saveSettings();
        })
      );
  }
}
