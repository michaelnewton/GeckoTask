/**
 * Due date filter window options.
 * Includes fixed options (any, today, overdue, nodue), configurable day ranges (7d, 14d, 30d, etc.),
 * and relative periods (this-week, next-week, this-month, next-month).
 */
export type DueWindow = 
  | "any" 
  | "today" 
  | "overdue" 
  | "nodue"
  | "7d" | "14d" | "30d" | "60d" | "90d"  // Configurable day ranges
  | "this-week" | "next-week" | "this-month" | "next-month";  // Relative periods

/**
 * Tab type for the panel view.
 */
export type TabType = "all" | "today-overdue" | "inbox" | "waiting-for";

/**
 * Filter state for task filtering in the panel.
 */
export interface FilterState {
  area: "All" | string; // "All" or one of the detected areas
  project: "Any" | string;
  priority: "Any" | string; // Dynamic from settings.allowedPriorities
  due: DueWindow;
  query: string;
}

/**
 * Task with indexing information for display in the panel.
 */
export interface IndexedTask {
  path: string;
  line: number;        // 1-based task line
  raw: string;         // task line only (first line)
  title: string;
  description?: string; // Multi-line description
  tags: string[];
  area?: string;
  project?: string;
  priority?: string;
  due?: string;        // YYYY-MM-DD
  recur?: string;      // Recurrence pattern (e.g., "every Tuesday", "every 10 days")
  checked: boolean;
  descriptionEndLine?: number; // Last line of description (1-based, inclusive)
}

