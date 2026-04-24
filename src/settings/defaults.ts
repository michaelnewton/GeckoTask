import { GeckoTaskSettings } from "./index";

/**
 * Default settings values used when no saved settings exist.
 */
export const DEFAULT_SETTINGS: GeckoTaskSettings = {
  spacePaths: ["Personal"],
  projectsSubfolder: "1Projects",
  areaTasksSubfolder: "2Areas",
  tasksFileName: "_tasks",
  somedayMaybeFileName: "_SomedayMaybe",
  inboxFolderName: "Inbox",
  showCompletedTasks: false,
  hideEmptyTasks: true,
  autoOpenTasksPanel: true,
  allowedPriorities: ["low","med","high","urgent"],
  nlDateParsing: true,
  dueDateRanges: ["7d", "14d", "30d", "60d", "90d"],
  referenceListPaths: [],
  customCollectionPoints: [],
  waitingForTag: "#WaitingFor",
  nowTag: "#t/now",
  nextActionsDueDays: 3,
  // Health check defaults
  healthCheckStaleFileDays: 90,
  healthCheckStaleTaskDays: 90,
  healthCheckUnmodifiedTaskDays: 60,
  healthCheckQuickWinKeywords: ["order", "book", "cancel", "check", "confirm", "set up", "make", "appointment", "call", "email", "message", "reply", "buy", "refill"],
  healthCheckHighTaskCount: 30,
  healthCheckInboxThreshold: 20,
  healthCheckBreakdownTitleLength: 100,
  healthCheckBreakdownKeywords: ["and", "then", "also", "plus"]
};
