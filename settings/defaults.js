"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
/**
 * Default settings values used when no saved settings exist.
 */
exports.DEFAULT_SETTINGS = {
    tasksFolder: "tasks",
    areasEnabled: false, // Areas are auto-detected from first-level directories when enabled
    inboxPath: "tasks/Inbox", // Without .md extension - will be normalized when used
    singleActionFile: "Single Action", // File name for single action tasks (no project shown, like Inbox)
    somedayMaybeFolderName: "Someday Maybe", // Folder name for someday/maybe items per area
    archivePattern: "Archive/Completed-YYYY.md",
    archiveOlderThanDays: 7,
    allowedPriorities: ["low", "med", "high", "urgent"],
    nlDateParsing: true,
    dueDateRanges: ["7d", "14d", "30d", "60d", "90d"], // Default configurable ranges
    customCollectionPoints: [], // No custom collection points by default
    waitingForTag: "#WaitingFor", // Default tag for waiting-for tasks
    nowTag: "#t/now", // Default tag for "now" tasks shown in today view
    nextActionsDueDays: 3, // Default number of days ahead to show tasks in next actions list
    // Health check defaults
    healthCheckStaleFileDays: 90,
    healthCheckStaleTaskDays: 90,
    healthCheckUnmodifiedTaskDays: 60,
    healthCheckQuickWinKeywords: ["order", "book", "cancel", "check", "confirm", "set up", "make", "appointment", "call", "email", "message", "reply", "buy", "refill"],
    healthCheckHighTaskCount: 30,
    healthCheckInboxThreshold: 20,
    healthCheckCompletedArchiveDays: 30,
    healthCheckBreakdownTitleLength: 100,
    healthCheckBreakdownKeywords: ["and", "then", "also", "plus"],
    llmServerUrl: "",
    llmModel: "",
    enableAutomaticEffortTagging: false,
    useLLMWhenAvailable: true,
    debugLogging: false
};
