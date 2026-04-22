/**
 * Plugin settings interface defining all configuration options.
 */
export interface GeckoTaskSettings {
  spacePaths: string[];                  // Root-level space folder names, e.g., ["Personal", "Work"]
  projectsSubfolder: string;             // Subfolder for projects within a space, default "1Projects"
  areaTasksSubfolder: string;            // Subfolder for area-level tasks, default "2Areas"
  tasksFileName: string;                 // Task file name (without .md), default "_tasks"
  somedayMaybeFileName: string;          // Someday/maybe file name (without .md), default "_SomedayMaybe"
  inboxFolderName: string;               // Inbox folder at vault root, default "Inbox"
  showCompletedTasks: boolean;           // Whether to show completed tasks in panels, default true
  autoOpenTasksPanel: boolean;           // Whether to auto-open Tasks panel on startup
  allowedPriorities: string[];           // ["low","med","high","urgent"]
  nlDateParsing: boolean;
  dueDateRanges: string[];               // Configurable due date ranges (e.g., ["7d", "14d", "30d", "60d"])
  customCollectionPoints: string[];      // Custom collection points for step 1A
  waitingForTag: string;                 // Tag for waiting-for tasks (e.g., "#WaitingFor")
  nowTag: string;                        // Tag for "now" tasks shown in today view (e.g., "#t/now")
  nextActionsDueDays: number;            // Number of days ahead to show tasks in next actions list
  // Health check settings
  healthCheckStaleFileDays: number;      // Files not modified in this time are considered stale
  healthCheckStaleTaskDays: number;      // Tasks with no due date older than this
  healthCheckUnmodifiedTaskDays: number; // Tasks not modified in this time
  healthCheckQuickWinKeywords: string[]; // Keywords that indicate quick wins
  healthCheckHighTaskCount: number;      // Threshold for high task count projects
  healthCheckInboxThreshold: number;     // Threshold for inbox overflow
  healthCheckBreakdownTitleLength: number; // Titles longer than this may need breakdown
  healthCheckBreakdownKeywords: string[]; // Keywords that suggest multiple actions
}

export { DEFAULT_SETTINGS } from "./defaults";
export { GeckoTaskSettingTab } from "./SettingsTab";
