import { App, PluginSettingTab, Setting } from "obsidian";
import GeckoTaskPlugin from "./main";
import { normalizeInboxPath, getInboxDisplayPath } from "./utils/areaUtils";

/**
 * Plugin settings interface defining all configuration options.
 */
export interface GeckoTaskSettings {
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
  waitingForTag: string;              // Tag for waiting-for tasks (e.g., "#WaitingFor")
  // Health check settings
  healthCheckStaleFileDays: number;   // Files not modified in this time are considered stale (default: 90)
  healthCheckStaleTaskDays: number;   // Tasks with no due date older than this (default: 90)
  healthCheckUnmodifiedTaskDays: number; // Tasks not modified in this time (default: 60)
  healthCheckQuickWinKeywords: string[]; // Keywords that indicate quick wins (default: ["message", "email", "call", "reply", "quick"])
  healthCheckHighTaskCount: number;   // Threshold for high task count projects (default: 30)
  healthCheckInboxThreshold: number;  // Threshold for inbox overflow (default: 20)
  healthCheckCompletedArchiveDays: number; // Completed tasks older than this can be archived (default: 30)
  healthCheckBreakdownTitleLength: number; // Titles longer than this may need breakdown (default: 100)
  healthCheckBreakdownKeywords: string[]; // Keywords that suggest multiple actions (default: ["and", "then", "also", "plus"])
}

/**
 * Default settings values used when no saved settings exist.
 */
export const DEFAULT_SETTINGS: GeckoTaskSettings = {
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
  customCollectionPoints: [],  // No custom collection points by default
  waitingForTag: "#WaitingFor",  // Default tag for waiting-for tasks
  // Health check defaults
  healthCheckStaleFileDays: 90,
  healthCheckStaleTaskDays: 90,
  healthCheckUnmodifiedTaskDays: 60,
  healthCheckQuickWinKeywords: ["order", "book", "cancel", "check", "confirm", "set up", "make", "appointment", "call", "email", "message", "reply", "buy", "refill"],
  healthCheckHighTaskCount: 30,
  healthCheckInboxThreshold: 20,
  healthCheckCompletedArchiveDays: 30,
  healthCheckBreakdownTitleLength: 100,
  healthCheckBreakdownKeywords: ["and", "then", "also", "plus"]
};

/**
 * Settings tab UI for configuring GeckoTask plugin options.
 */
export class GeckoTaskSettingTab extends PluginSettingTab {
  plugin: GeckoTaskPlugin;

  /**
   * Creates a new settings tab.
   * @param app - Obsidian app instance
   * @param plugin - GeckoTask plugin instance
   */
  constructor(app: App, plugin: GeckoTaskPlugin) {
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

    new Setting(containerEl)
      .setName("Waiting For tag")
      .setDesc("Tag used to identify waiting-for tasks (e.g., '#WaitingFor'). Include the '#' symbol.")
      .addText(t => t
        .setValue(this.plugin.settings.waitingForTag)
        .onChange(async (v) => {
          // Ensure tag starts with # if not empty
          const trimmed = v.trim();
          this.plugin.settings.waitingForTag = trimmed && !trimmed.startsWith("#") 
            ? `#${trimmed}` 
            : trimmed || "#WaitingFor";
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "GTD Health Check" });

    new Setting(containerEl)
      .setName("Stale file threshold (days)")
      .setDesc("Files not modified in this time are considered stale")
      .addText(t => t
        .setPlaceholder("90")
        .setValue(String(this.plugin.settings.healthCheckStaleFileDays))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckStaleFileDays = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Stale task threshold (days)")
      .setDesc("Tasks with no due date older than this are considered stale")
      .addText(t => t
        .setPlaceholder("90")
        .setValue(String(this.plugin.settings.healthCheckStaleTaskDays))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckStaleTaskDays = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Unmodified task threshold (days)")
      .setDesc("Tasks not modified in this time are flagged")
      .addText(t => t
        .setPlaceholder("60")
        .setValue(String(this.plugin.settings.healthCheckUnmodifiedTaskDays))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckUnmodifiedTaskDays = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Quick win keywords")
      .setDesc("Comma-separated list of keywords that indicate quick wins")
      .addText(t => t
        .setValue(this.plugin.settings.healthCheckQuickWinKeywords.join(", "))
        .onChange(async (v) => {
          const keywords = v.split(",").map(k => k.trim()).filter(Boolean);
          this.plugin.settings.healthCheckQuickWinKeywords = keywords.length > 0 
            ? keywords 
            : ["message", "email", "call", "reply", "quick"];
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("High task count threshold")
      .setDesc("Projects with more tasks than this are flagged")
      .addText(t => t
        .setPlaceholder("30")
        .setValue(String(this.plugin.settings.healthCheckHighTaskCount))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckHighTaskCount = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Inbox overflow threshold")
      .setDesc("Inbox with more untriaged items than this is flagged")
      .addText(t => t
        .setPlaceholder("20")
        .setValue(String(this.plugin.settings.healthCheckInboxThreshold))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckInboxThreshold = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Breakdown title length threshold")
      .setDesc("Titles longer than this may need breakdown")
      .addText(t => t
        .setPlaceholder("100")
        .setValue(String(this.plugin.settings.healthCheckBreakdownTitleLength))
        .onChange(async (v) => {
          const n = Number(v);
          if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckBreakdownTitleLength = n;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Breakdown keywords")
      .setDesc("Comma-separated list of keywords that suggest multiple actions")
      .addText(t => t
        .setValue(this.plugin.settings.healthCheckBreakdownKeywords.join(", "))
        .onChange(async (v) => {
          const keywords = v.split(",").map(k => k.trim()).filter(Boolean);
          this.plugin.settings.healthCheckBreakdownKeywords = keywords.length > 0 
            ? keywords 
            : ["and", "then", "also", "plus"];
          await this.plugin.saveSettings();
        })
      );
  }
}
