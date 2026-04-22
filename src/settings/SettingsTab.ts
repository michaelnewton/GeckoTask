import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import GeckoTaskPlugin from "../main";
import { TasksPanel, VIEW_TYPE_TASKS } from "../view/tasks/TasksPanel";

function normalizeFolderSegment(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return normalizePath(trimmed).replace(/^\/+|\/+$/g, "") || fallback;
}

function normalizeFileStem(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const normalized = normalizePath(trimmed).replace(/^\/+|\/+$/g, "").replace(/\.md$/i, "");
  return normalized || fallback;
}

/**
 * Settings tab UI for configuring GeckoTask plugin options.
 */
export class GeckoTaskSettingTab extends PluginSettingTab {
  plugin: GeckoTaskPlugin;

  constructor(app: App, plugin: GeckoTaskPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("geckotask-settings");

    containerEl.createEl("h2", { text: "Areas & Structure" });

    // Area paths
    new Setting(containerEl)
      .setName("Area paths")
      .setDesc("Root-level area folder names, comma-separated (e.g., Personal, Work)")
      .addText(t => t
        .setValue(this.plugin.settings.areaPaths.join(", "))
        .onChange(async (v) => {
          const paths = v
            .split(",")
            .map(p => normalizePath(p.trim()).replace(/^\/+|\/+$/g, ""))
            .filter(Boolean);
          this.plugin.settings.areaPaths = paths.length > 0 ? paths : ["Personal"];
          await this.plugin.saveSettings();
        })
      );

    // Projects subfolder
    new Setting(containerEl)
      .setName("Projects subfolder")
      .setDesc("Subfolder name within each area for project directories")
      .addText(t => t
        .setValue(this.plugin.settings.projectsSubfolder)
        .onChange(async (v) => {
          this.plugin.settings.projectsSubfolder = normalizeFolderSegment(v, "1Projects");
          await this.plugin.saveSettings();
        })
      );

    // Area tasks subfolder
    new Setting(containerEl)
      .setName("Area tasks subfolder")
      .setDesc("Subfolder name within each area for area-level single action tasks")
      .addText(t => t
        .setValue(this.plugin.settings.areaTasksSubfolder)
        .onChange(async (v) => {
          this.plugin.settings.areaTasksSubfolder = normalizeFolderSegment(v, "2Areas");
          await this.plugin.saveSettings();
        })
      );

    // Task file name
    new Setting(containerEl)
      .setName("Task file name")
      .setDesc("File name for task lists within project and area directories (without .md)")
      .addText(t => t
        .setValue(this.plugin.settings.tasksFileName)
        .onChange(async (v) => {
          this.plugin.settings.tasksFileName = normalizeFileStem(v, "_tasks");
          await this.plugin.saveSettings();
        })
      );

    // Someday/Maybe file name
    new Setting(containerEl)
      .setName("Someday/Maybe file name")
      .setDesc("File name for someday/maybe items (without .md)")
      .addText(t => t
        .setValue(this.plugin.settings.somedayMaybeFileName)
        .onChange(async (v) => {
          this.plugin.settings.somedayMaybeFileName = normalizeFileStem(v, "_SomedayMaybe");
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Inbox" });

    // Inbox folder name
    new Setting(containerEl)
      .setName("Inbox folder name")
      .setDesc("Vault root folder name for inbox items (one file per captured item)")
      .addText(t => t
        .setValue(this.plugin.settings.inboxFolderName)
        .onChange(async (v) => {
          this.plugin.settings.inboxFolderName = normalizeFolderSegment(v, "Inbox");
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Display" });

    // Show completed tasks toggle
    new Setting(containerEl)
      .setName("Show completed tasks")
      .setDesc("Show completed tasks in the task panel (completed tasks stay in place with completion timestamp)")
      .addToggle(t => t
        .setValue(this.plugin.settings.showCompletedTasks)
        .onChange(async (v) => {
          this.plugin.settings.showCompletedTasks = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto-open Tasks panel")
      .setDesc("Automatically open the Tasks panel when Obsidian starts")
      .addToggle(t => t
        .setValue(this.plugin.settings.autoOpenTasksPanel)
        .onChange(async (v) => {
          this.plugin.settings.autoOpenTasksPanel = v;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h2", { text: "Task Options" });

    new Setting(containerEl)
      .setName("Natural language date parsing")
      .setDesc(
        "When on, values like today, tomorrow, or next monday on due:: and scheduled:: are resolved to YYYY-MM-DD. When off, existing task lines are read as written (no expansion); Quick Add and date prompts require strict YYYY-MM-DD. Open tasks with non-ISO dates may sort or filter oddly until you fix the note."
      )
      .addToggle(t => t
        .setValue(this.plugin.settings.nlDateParsing)
        .onChange(async (v) => {
          const prev = this.plugin.settings.nlDateParsing;
          this.plugin.settings.nlDateParsing = v;
          await this.plugin.saveSettings();
          if (prev !== v) {
            this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKS).forEach((leaf) => {
              const view = leaf.view;
              if (view instanceof TasksPanel) {
                void view.refreshTaskIndex();
              }
            });
          }
        })
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
      .setDesc("Comma-separated list of due date ranges to show in filter dropdown (e.g., '7d, 14d, 30d, 60d, 90d').")
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
      .setDesc("Comma-separated list of additional collection points for step 1A")
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
          const trimmed = v.trim();
          this.plugin.settings.waitingForTag = trimmed && !trimmed.startsWith("#")
            ? `#${trimmed}`
            : trimmed || "#WaitingFor";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Now tag")
      .setDesc("Tag used to identify 'now' tasks shown in the Today view (e.g., '#t/now'). Include the '#' symbol.")
      .addText(t => t
        .setValue(this.plugin.settings.nowTag)
        .onChange(async (v) => {
          const trimmed = v.trim();
          this.plugin.settings.nowTag = trimmed && !trimmed.startsWith("#")
            ? `#${trimmed}`
            : trimmed || "#t/now";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Next actions due days")
      .setDesc("Number of days ahead to show tasks in the next actions list (default: 3).")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("3")
          .setValue(String(this.plugin.settings.nextActionsDueDays))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.nextActionsDueDays = n;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h2", { text: "Health Check" });

    new Setting(containerEl)
      .setName("Stale file threshold (days)")
      .setDesc("Files not modified in this time are considered stale")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("90")
          .setValue(String(this.plugin.settings.healthCheckStaleFileDays))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckStaleFileDays = n;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Stale task threshold (days)")
      .setDesc("Tasks with no due date older than this are considered stale")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("90")
          .setValue(String(this.plugin.settings.healthCheckStaleTaskDays))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckStaleTaskDays = n;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Unmodified task threshold (days)")
      .setDesc("Tasks not modified in this time are flagged")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.healthCheckUnmodifiedTaskDays))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckUnmodifiedTaskDays = n;
            await this.plugin.saveSettings();
          });
      });

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
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.healthCheckHighTaskCount))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckHighTaskCount = n;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Inbox overflow threshold")
      .setDesc("Inbox with more untriaged items than this is flagged")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("20")
          .setValue(String(this.plugin.settings.healthCheckInboxThreshold))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckInboxThreshold = n;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Breakdown title length threshold")
      .setDesc("Titles longer than this may need breakdown")
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.inputMode = "numeric";
        t.inputEl.step = "1";
        t.inputEl.min = "1";
        return t
          .setPlaceholder("100")
          .setValue(String(this.plugin.settings.healthCheckBreakdownTitleLength))
          .onChange(async (v) => {
            const n = Number(v);
            if (!isNaN(n) && n > 0) this.plugin.settings.healthCheckBreakdownTitleLength = n;
            await this.plugin.saveSettings();
          });
      });

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
