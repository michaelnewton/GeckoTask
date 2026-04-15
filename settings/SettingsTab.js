"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeckoTaskSettingTab = void 0;
const obsidian_1 = require("obsidian");
const areaUtils_1 = require("../utils/areaUtils");
/**
 * Settings tab UI for configuring GeckoTask plugin options.
 */
class GeckoTaskSettingTab extends obsidian_1.PluginSettingTab {
    /**
     * Creates a new settings tab.
     * @param app - Obsidian app instance
     * @param plugin - GeckoTask plugin instance
     */
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    /**
     * Renders the settings UI with all configuration options.
     */
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Tasks Folder & Areas" });
        // Tasks folder
        new obsidian_1.Setting(containerEl)
            .setName("Tasks folder")
            .setDesc("Base folder where all tasks are stored (e.g., 'tasks')")
            .addText(t => t
            .setValue(this.plugin.settings.tasksFolder)
            .onChange(async (v) => {
            this.plugin.settings.tasksFolder = v.trim() || "tasks";
            // Update inbox path if it was using old tasksFolder
            const currentInbox = (0, areaUtils_1.getInboxDisplayPath)(this.plugin.settings.inboxPath);
            if (currentInbox.startsWith(this.plugin.settings.tasksFolder + "/")) {
                // Keep relative path after tasksFolder
            }
            else {
                this.plugin.settings.inboxPath = `${this.plugin.settings.tasksFolder}/Inbox`;
            }
            await this.plugin.saveSettings();
        }));
        // Enabled Areas checkbox
        new obsidian_1.Setting(containerEl)
            .setName("Enabled Areas")
            .setDesc("When enabled, areas are automatically detected from first-level directories in the tasks folder. Each directory directly under the tasks folder will be treated as an area.")
            .addToggle(t => t
            .setValue(this.plugin.settings.areasEnabled)
            .onChange(async (v) => {
            this.plugin.settings.areasEnabled = v;
            await this.plugin.saveSettings();
        }));
        // Single inbox path
        new obsidian_1.Setting(containerEl)
            .setName("Inbox path")
            .setDesc("Path to the single inbox file for all tasks (without .md extension)")
            .addText(t => t
            .setValue((0, areaUtils_1.getInboxDisplayPath)(this.plugin.settings.inboxPath))
            .onChange(async (v) => {
            // Store without .md extension - will be normalized when used
            this.plugin.settings.inboxPath = v.trim() || `${this.plugin.settings.tasksFolder}/Inbox`;
            await this.plugin.saveSettings();
        }));
        // Single Action file name
        new obsidian_1.Setting(containerEl)
            .setName("Single Action file")
            .setDesc("File name for single action tasks (without .md extension). Tasks in this file won't show a project name, similar to Inbox.")
            .addText(t => t
            .setValue(this.plugin.settings.singleActionFile)
            .onChange(async (v) => {
            this.plugin.settings.singleActionFile = v.trim() || "Single Action";
            await this.plugin.saveSettings();
        }));
        // Someday Maybe folder name
        new obsidian_1.Setting(containerEl)
            .setName("Someday Maybe folder name")
            .setDesc("Folder name for someday/maybe items per area (e.g., 'Someday Maybe'). This folder will be created under each area folder.")
            .addText(t => t
            .setValue(this.plugin.settings.somedayMaybeFolderName)
            .onChange(async (v) => {
            this.plugin.settings.somedayMaybeFolderName = v.trim() || "Someday Maybe";
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h2", { text: "Archive" });
        new obsidian_1.Setting(containerEl)
            .setName("Archive pattern")
            .setDesc("Use YYYY in the filename to group by year (e.g., Archive/Completed-YYYY.md)")
            .addText(t => t
            .setValue(this.plugin.settings.archivePattern)
            .onChange(async (v) => { this.plugin.settings.archivePattern = v; await this.plugin.saveSettings(); }));
        new obsidian_1.Setting(containerEl)
            .setName("Archive older than (days)")
            .addText(t => t
            .setPlaceholder("7")
            .setValue(String(this.plugin.settings.archiveOlderThanDays))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n))
                this.plugin.settings.archiveOlderThanDays = n;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h2", { text: "Task Options" });
        new obsidian_1.Setting(containerEl)
            .setName("Natural language due parsing")
            .setDesc("Enable parsing of dates like 'today', 'tomorrow', 'next monday'")
            .addToggle(t => t
            .setValue(this.plugin.settings.nlDateParsing)
            .onChange(async (v) => { this.plugin.settings.nlDateParsing = v; await this.plugin.saveSettings(); }));
        new obsidian_1.Setting(containerEl)
            .setName("Allowed priorities")
            .setDesc("Comma-separated list of priority values")
            .addText(t => t
            .setValue(this.plugin.settings.allowedPriorities.join(", "))
            .onChange(async (v) => {
            const priorities = v.split(",").map(p => p.trim()).filter(Boolean);
            this.plugin.settings.allowedPriorities = priorities.length > 0 ? priorities : ["low", "med", "high", "urgent"];
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Due date ranges")
            .setDesc("Comma-separated list of due date ranges to show in filter dropdown (e.g., '7d, 14d, 30d, 60d, 90d'). Use format like '7d' for days or '30d' for 30 days.")
            .addText(t => t
            .setValue(this.plugin.settings.dueDateRanges.join(", "))
            .onChange(async (v) => {
            const ranges = v.split(",").map(r => r.trim()).filter(Boolean);
            this.plugin.settings.dueDateRanges = ranges.length > 0 ? ranges : ["7d", "14d", "30d", "60d", "90d"];
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h2", { text: "Weekly Review" });
        new obsidian_1.Setting(containerEl)
            .setName("Custom collection points")
            .setDesc("Comma-separated list of additional collection points for step 1A (e.g., 'Facebook, Slack, Twitter'). These will appear as additional fields in the Collect Loose Ends step.")
            .addText(t => t
            .setValue(this.plugin.settings.customCollectionPoints.join(", "))
            .onChange(async (v) => {
            const points = v.split(",").map(p => p.trim()).filter(Boolean);
            this.plugin.settings.customCollectionPoints = points;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
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
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Now tag")
            .setDesc("Tag used to identify 'now' tasks shown in the Today view (e.g., '#t/now'). Include the '#' symbol.")
            .addText(t => t
            .setValue(this.plugin.settings.nowTag)
            .onChange(async (v) => {
            // Ensure tag starts with # if not empty
            const trimmed = v.trim();
            this.plugin.settings.nowTag = trimmed && !trimmed.startsWith("#")
                ? `#${trimmed}`
                : trimmed || "#t/now";
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Next actions due days")
            .setDesc("Number of days ahead to show tasks in the next actions list (default: 3). Only tasks with due dates within this window will appear.")
            .addText(t => t
            .setPlaceholder("3")
            .setValue(String(this.plugin.settings.nextActionsDueDays))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.nextActionsDueDays = n;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h2", { text: "Health Check" });
        new obsidian_1.Setting(containerEl)
            .setName("Stale file threshold (days)")
            .setDesc("Files not modified in this time are considered stale")
            .addText(t => t
            .setPlaceholder("90")
            .setValue(String(this.plugin.settings.healthCheckStaleFileDays))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckStaleFileDays = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Stale task threshold (days)")
            .setDesc("Tasks with no due date older than this are considered stale")
            .addText(t => t
            .setPlaceholder("90")
            .setValue(String(this.plugin.settings.healthCheckStaleTaskDays))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckStaleTaskDays = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Unmodified task threshold (days)")
            .setDesc("Tasks not modified in this time are flagged")
            .addText(t => t
            .setPlaceholder("60")
            .setValue(String(this.plugin.settings.healthCheckUnmodifiedTaskDays))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckUnmodifiedTaskDays = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
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
        }));
        new obsidian_1.Setting(containerEl)
            .setName("High task count threshold")
            .setDesc("Projects with more tasks than this are flagged")
            .addText(t => t
            .setPlaceholder("30")
            .setValue(String(this.plugin.settings.healthCheckHighTaskCount))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckHighTaskCount = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Inbox overflow threshold")
            .setDesc("Inbox with more untriaged items than this is flagged")
            .addText(t => t
            .setPlaceholder("20")
            .setValue(String(this.plugin.settings.healthCheckInboxThreshold))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckInboxThreshold = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Breakdown title length threshold")
            .setDesc("Titles longer than this may need breakdown")
            .addText(t => t
            .setPlaceholder("100")
            .setValue(String(this.plugin.settings.healthCheckBreakdownTitleLength))
            .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0)
                this.plugin.settings.healthCheckBreakdownTitleLength = n;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
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
        }));
        containerEl.createEl("h2", { text: "Effort tags" });
        new obsidian_1.Setting(containerEl)
            .setName("LLM server URL")
            .setDesc("Optional OpenAI-style endpoint (e.g., http://localhost:11434/v1/chat/completions). Leave blank to disable.")
            .addText(text => text
            .setValue(this.plugin.settings.llmServerUrl)
            .setPlaceholder("https://api.openai.com/v1/chat/completions")
            .onChange(async (value) => {
            this.plugin.settings.llmServerUrl = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("LLM model (optional)")
            .setDesc("Model identifier required by some endpoints (e.g., gpt-4o-mini).")
            .addText(text => text
            .setValue(this.plugin.settings.llmModel)
            .onChange(async (value) => {
            this.plugin.settings.llmModel = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Enable automatic effort tagging")
            .setDesc("Automatically add/update effort tags (e.g., #e/medium) whenever a task line is edited.")
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.enableAutomaticEffortTagging)
            .onChange(async (value) => {
            this.plugin.settings.enableAutomaticEffortTagging = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Use LLM when available")
            .setDesc("Try the configured LLM for more accurate effort estimates before falling back to rule-based heuristics.")
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.useLLMWhenAvailable)
            .onChange(async (value) => {
            this.plugin.settings.useLLMWhenAvailable = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Verbose logging")
            .setDesc("Log efforts and fallbacks in the console to help troubleshoot tagging.")
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.debugLogging)
            .onChange(async (value) => {
            this.plugin.settings.debugLogging = value;
            await this.plugin.saveSettings();
        }));
    }
}
exports.GeckoTaskSettingTab = GeckoTaskSettingTab;
