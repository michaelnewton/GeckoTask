import { WizardState, SerializedWizardState, ReviewStep } from "../../WeeklyReviewPanelTypes";

/**
 * All review steps in order.
 */
export const ALL_STEPS: ReviewStep[] = [
  "1A-collect-loose-ends",
  "1B-empty-head",
  "1C-process-inbox",
  "2A-review-next-actions",
  "2B-review-calendar-past",
  "2C-review-calendar-future",
  "2D-review-projects",
  "2E-review-waiting-for",
  "2F-review-someday-maybe",
  "3A-brainstorm"
];

/**
 * Creates a default wizard state.
 * @returns Default wizard state
 */
export function createDefaultState(): WizardState {
  return {
    currentStep: ALL_STEPS[0],
    completedSteps: new Set(),
    reviewedTasks: new Set(),
    showReviewedTasks: false,
    reviewedProjects: new Set(),
    showReviewedProjects: false,
    reviewedSomedayMaybeProjects: new Set(),
    showReviewedSomedayMaybeProjects: false,
    isCompleted: false,
    dateStarted: undefined,
    notes: {
      looseEnds: {
        physicalItems: "",
        emailMessages: "",
        custom: {}
      },
      emptyHead: {
        worries: "",
        postponements: "",
        smallWins: ""
      },
      calendarPast: "",
      calendarFuture: "",
      brainstorm: ""
    }
  };
}

/**
 * Serializes wizard state for persistence (converts Sets to arrays).
 * @param state - Wizard state to serialize
 * @returns Serialized state
 */
export function serializeState(state: WizardState): SerializedWizardState {
  return {
    currentStep: state.currentStep,
    completedSteps: Array.from(state.completedSteps),
    reviewedTasks: Array.from(state.reviewedTasks),
    showReviewedTasks: state.showReviewedTasks,
    reviewedProjects: Array.from(state.reviewedProjects),
    showReviewedProjects: state.showReviewedProjects,
    reviewedSomedayMaybeProjects: Array.from(state.reviewedSomedayMaybeProjects),
    showReviewedSomedayMaybeProjects: state.showReviewedSomedayMaybeProjects,
    isCompleted: state.isCompleted,
    dateStarted: state.dateStarted,
    notes: state.notes
  };
}

/**
 * Deserializes wizard state from persistence (converts arrays to Sets).
 * @param serialized - Serialized state
 * @returns Wizard state
 */
export function deserializeState(serialized: SerializedWizardState): WizardState {
  return {
    currentStep: serialized.currentStep,
    completedSteps: new Set(serialized.completedSteps),
    reviewedTasks: new Set(serialized.reviewedTasks),
    showReviewedTasks: serialized.showReviewedTasks,
    reviewedProjects: new Set(serialized.reviewedProjects),
    showReviewedProjects: serialized.showReviewedProjects,
    reviewedSomedayMaybeProjects: new Set(serialized.reviewedSomedayMaybeProjects),
    showReviewedSomedayMaybeProjects: serialized.showReviewedSomedayMaybeProjects,
    isCompleted: serialized.isCompleted,
    dateStarted: serialized.dateStarted,
    notes: serialized.notes
  };
}

/**
 * Gets the phase for a step (Get Clear, Get Current, or Get Creative).
 */
export function getStepPhase(step: ReviewStep): string {
  const phases: Record<ReviewStep, string> = {
    "1A-collect-loose-ends": "1. GET CLEAR",
    "1B-empty-head": "1. GET CLEAR",
    "1C-process-inbox": "1. GET CLEAR",
    "2A-review-next-actions": "2. GET CURRENT",
    "2B-review-calendar-past": "2. GET CURRENT",
    "2C-review-calendar-future": "2. GET CURRENT",
    "2D-review-projects": "2. GET CURRENT",
    "2E-review-waiting-for": "2. GET CURRENT",
    "2F-review-someday-maybe": "2. GET CURRENT",
    "3A-brainstorm": "3. GET CREATIVE"
  };
  return phases[step];
}

/**
 * Gets the title for a step.
 */
export function getStepTitle(step: ReviewStep): string {
  const titles: Record<ReviewStep, string> = {
    "1A-collect-loose-ends": "1-A) Collect Loose Ends",
    "1B-empty-head": "1-B) Empty Your Head",
    "1C-process-inbox": "1-C) Process Inbox",
    "2A-review-next-actions": "2-A) Review Next Actions",
    "2B-review-calendar-past": "2-B) Review Calendar (Past 2-3 weeks)",
    "2C-review-calendar-future": "2-C) Review Calendar (Next 2 weeks)",
    "2D-review-projects": "2-D) Review Projects",
    "2E-review-waiting-for": "2-E) Review Waiting For",
    "2F-review-someday-maybe": "2-F) Review Someday/Maybe",
    "3A-brainstorm": "3) Brainstorm / Creative Sweep"
  };
  return titles[step];
}

