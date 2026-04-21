import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { WizardState } from "../WeeklyReviewPanelTypes";
import { fetchNextActions } from "../../../services/WeeklyReviewService";
import { renderTaskCard, TaskCardCallbacks } from "../components/TaskCard";

/**
 * Renders Step 2A: Review Next Actions.
 */
export async function renderStep2A(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: TaskCardCallbacks & {
    onRerender: () => Promise<void>;
    onMarkTaskReviewed: (taskId: string) => Promise<void>;
    onToggleShowReviewed: () => Promise<void>;
    onResetReviewed: () => Promise<void>;
  }
): Promise<void> {
  host.empty();
  
  // Guidance text
  const guidance = host.createDiv({ cls: "weekly-review-guidance" });
  guidance.createEl("h4", { text: "Review Action Lists" });
  guidance.createEl("p", { 
    text: "Mark off completed actions. Review for reminders of further action steps to record." 
  });
  
  host.createEl("p", { 
    text: "Review each actionable task. Mark done, update, move, or delete as needed. Click 'Reviewed' if no changes are needed." 
  });

  const nextActions = await fetchNextActions(app, settings);

  if (nextActions.length === 0) {
    host.createEl("p", { 
      text: "No actionable tasks found." 
    });
    return;
  }

  // Filter reviewed and unreviewed tasks
  const unreviewedTasks = nextActions.filter(t => 
    !wizardState.reviewedTasks.has(`${t.path}:${t.line}`)
  );
  const reviewedTasks = nextActions.filter(t => 
    wizardState.reviewedTasks.has(`${t.path}:${t.line}`)
  );

  // Controls for showing reviewed tasks and resetting
  const controls = host.createDiv({ cls: "weekly-review-step-controls" });
  controls.style.marginBottom = "12px";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.flexWrap = "wrap";

  if (reviewedTasks.length > 0) {
    const showReviewedBtn = controls.createEl("button", {
      text: wizardState.showReviewedTasks 
        ? `Hide ${reviewedTasks.length} Reviewed Task(s)` 
        : `Show ${reviewedTasks.length} Reviewed Task(s)`,
      cls: "weekly-review-btn weekly-review-btn-small"
    });
    showReviewedBtn.addEventListener("click", async () => {
      await callbacks.onToggleShowReviewed();
      await callbacks.onRerender();
    });
  }

  if (wizardState.reviewedTasks.size > 0) {
    const resetBtn = controls.createEl("button", {
      text: "Reset All Reviewed",
      cls: "weekly-review-btn weekly-review-btn-small"
    });
    resetBtn.addEventListener("click", async () => {
      await callbacks.onResetReviewed();
      await callbacks.onRerender();
    });
  }

  const countText = host.createEl("p");
  countText.setAttribute("data-weekly-review-count", "true");
  countText.textContent = `Found ${unreviewedTasks.length} unreviewed task(s)${reviewedTasks.length > 0 ? `, ${reviewedTasks.length} reviewed` : ""}.`;

  const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
  
  // Show unreviewed tasks
  for (const task of unreviewedTasks) {
    await renderTaskCard(tasksList, app, settings, task, {
      ...callbacks,
      onRerender: async () => {
        await callbacks.onMarkTaskReviewed(`${task.path}:${task.line}`);
        await callbacks.onRerender();
      }
    }, {
      showReviewedButton: true,
      currentStep: "2A-review-next-actions"
    });
  }

  // Show reviewed tasks if enabled
  if (wizardState.showReviewedTasks && reviewedTasks.length > 0) {
    const reviewedSection = host.createDiv({ cls: "weekly-review-reviewed-section" });
    reviewedSection.createEl("h4", { text: "Reviewed Tasks" });
    const reviewedList = reviewedSection.createDiv({ cls: "weekly-review-tasks-list" });
    for (const task of reviewedTasks) {
      await renderTaskCard(reviewedList, app, settings, task, callbacks, {
        showReviewedButton: false
      });
    }
  }
}

