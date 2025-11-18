/**
 * Plugin settings interface defining all configuration options.
 */
export interface GeckoTaskSettings {
  tasksFolder: string;                // e.g., "tasks"
  areasEnabled: boolean;              // When enabled, areas are auto-detected from first-level directories in tasksFolder
  inboxPath: string;                  // e.g., "tasks/Inbox.md" - single inbox for all areas
  singleActionFile: string;            // e.g., "Single Action" - file name for single action tasks (no project shown)
  somedayMaybeFolderName: string;      // e.g., "Someday Maybe" - folder name for someday/maybe items per area
  archivePattern: string;             // "Archive/Completed-YYYY.md"
  archiveOlderThanDays: number;       // 7
  allowedPriorities: string[];        // ["low","med","high","urgent"]
  nlDateParsing: boolean;
  dueDateRanges: string[];            // Configurable due date ranges (e.g., ["7d", "14d", "30d", "60d"])
  customCollectionPoints: string[];   // Custom collection points for step 1A (e.g., ["Facebook", "Slack", "Twitter"])
  waitingForTag: string;              // Tag for waiting-for tasks (e.g., "#WaitingFor")
  nowTag: string;                      // Tag for "now" tasks shown in today view (e.g., "#t/now")
  nextActionsDueDays: number;          // Number of days ahead to show tasks in next actions list (default: 3)
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

export { DEFAULT_SETTINGS } from "./defaults";
export { GeckoTaskSettingTab } from "./SettingsTab";

