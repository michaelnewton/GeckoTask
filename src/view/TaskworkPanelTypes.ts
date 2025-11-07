/**
 * Due date filter window options.
 */
export type DueWindow = "any" | "today" | "7d" | "overdue" | "nodue";

/**
 * Tab type for the panel view.
 */
export type TabType = "all" | "today-overdue";

/**
 * Filter state for task filtering in the panel.
 */
export interface FilterState {
  area: "All" | string; // "All" or one of settings.areas
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

