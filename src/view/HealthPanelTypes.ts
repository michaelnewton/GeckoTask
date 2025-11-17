import { IndexedTask } from "./TasksPanelTypes";
import { TFile } from "obsidian";

/**
 * Task tracking data stored in plugin storage.
 * Maps task IDs (path:line) to tracking metadata.
 */
export interface TaskTrackingData {
  [taskId: string]: {
    firstSeen: string;      // YYYY-MM-DD
    lastModified: string;   // YYYY-MM-DD
    lastReviewed?: string;  // YYYY-MM-DD (optional)
    contentHash: string;    // Hash of task content to detect changes
  };
}

/**
 * High-level system health metrics.
 */
export interface HealthMetrics {
  totalActiveTasks: number;
  tasksByArea: Record<string, number>;
  overdueTasks: number;
  urgentTasks: number;
  highPriorityTasks: number;
  tasksWithNoDueDate: number;
  completedTasksOlderThanThreshold: number;
  projectsWithHighTaskCount: Array<{ path: string; name: string; count: number }>;
}

/**
 * Stale task with tracking information.
 */
export interface StaleTask extends IndexedTask {
  daysSinceFirstSeen: number;
  daysSinceLastModified: number;
  daysSinceLastReviewed?: number;
  reason: string; // Why it's considered stale
}

/**
 * Quick win task (easy, short task).
 */
export interface QuickWin extends IndexedTask {
  estimatedMinutes?: number;
  reason: string; // Why it's considered a quick win
}

/**
 * Must-move item (high priority/urgent task).
 */
export interface MustMoveItem extends IndexedTask {
  reason: string; // Why it needs attention
}

/**
 * Oversized task (looks like a whole project).
 */
export interface OversizedTask extends IndexedTask {
  reason: string; // Why it's considered oversized
}

/**
 * Task that needs to be broken down into multiple steps.
 */
export interface TaskNeedingBreakdown extends IndexedTask {
  suggestedSubTasks: string[]; // Suggested breakdown steps
  reason: string; // Why it needs breakdown
}

/**
 * Recurring task issue.
 */
export interface RecurringIssue {
  task: IndexedTask;
  issue: string; // Description of the issue
}

/**
 * Cleanup suggestion.
 */
export interface CleanupSuggestion {
  type: "high-task-count" | "stale-file" | "inbox-overflow" | "area-imbalance" | "completed-archive";
  message: string;
  details?: Record<string, any>;
}

/**
 * Complete health report containing all analysis sections.
 */
export interface HealthReport {
  metrics: HealthMetrics;
  staleTasks: StaleTask[];
  quickWins: QuickWin[];
  mustMoveItems: MustMoveItem[];
  oversizedTasks: OversizedTask[];
  tasksNeedingBreakdown: TaskNeedingBreakdown[];
  recurringIssues: RecurringIssue[];
  cleanupSuggestions: CleanupSuggestion[];
}

/**
 * Project information for analysis.
 */
export interface ProjectInfo {
  path: string;
  name: string;
  area?: string;
  taskCount: number;
  file: TFile;
}

