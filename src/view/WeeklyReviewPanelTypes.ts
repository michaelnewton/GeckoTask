import { IndexedTask } from "./TaskworkPanelTypes";

/**
 * Step identifier for the weekly review wizard.
 */
export type ReviewStep = 
  | "1A-collect-loose-ends"
  | "1B-empty-head"
  | "1C-process-inbox"
  | "2A-review-next-actions"
  | "2B-review-calendar-past"
  | "2C-review-calendar-future"
  | "2D-review-projects"
  | "2E-review-waiting-for"
  | "2F-review-someday-maybe"
  | "3A-brainstorm";

/**
 * Wizard state for tracking progress through the weekly review.
 */
export interface WizardState {
  currentStep: ReviewStep;
  completedSteps: Set<ReviewStep>;
  reviewedTasks: Set<string>; // Task IDs (path:line) that have been reviewed
  showReviewedTasks: boolean; // Whether to show reviewed tasks in step 2A
  reviewedProjects: Set<string>; // Project paths that have been reviewed
  showReviewedProjects: boolean; // Whether to show reviewed projects in step 2D
  reviewedSomedayMaybeProjects: Set<string>; // Someday Maybe project paths that have been reviewed
  showReviewedSomedayMaybeProjects: boolean; // Whether to show reviewed Someday Maybe projects in step 2F
  isCompleted: boolean; // Whether the review has been completed
  dateStarted?: string; // ISO date string when the review was started
  notes: {
    looseEnds: {
      physicalItems: string;
      emailMessages: string;
      custom: Record<string, string>; // Custom collection points: { "Facebook": "...", "Slack": "..." }
    };
    emptyHead: {
      worries: string;
      postponements: string;
      smallWins: string;
    };
    calendarPast: string;
    calendarFuture: string;
    brainstorm: string;
  };
}

/**
 * Serialized wizard state for persistence (Sets converted to arrays).
 */
export interface SerializedWizardState {
  currentStep: ReviewStep;
  completedSteps: ReviewStep[];
  reviewedTasks: string[];
  showReviewedTasks: boolean;
  reviewedProjects: string[];
  showReviewedProjects: boolean;
  reviewedSomedayMaybeProjects: string[];
  showReviewedSomedayMaybeProjects: boolean;
  isCompleted: boolean;
  dateStarted?: string;
  notes: {
    looseEnds: {
      physicalItems: string;
      emailMessages: string;
      custom: Record<string, string>;
    };
    emptyHead: {
      worries: string;
      postponements: string;
      smallWins: string;
    };
    calendarPast: string;
    calendarFuture: string;
    brainstorm: string;
  };
}

/**
 * Task review item with additional review-specific metadata.
 */
export interface TaskReviewItem extends IndexedTask {
  // Additional fields for review context
  needsAction?: boolean;
  reviewNotes?: string;
}

/**
 * Project review information.
 */
export interface ProjectReviewInfo {
  path: string;
  name: string;
  area?: string;
  tasks: TaskReviewItem[];
  hasNextAction: boolean;
}

