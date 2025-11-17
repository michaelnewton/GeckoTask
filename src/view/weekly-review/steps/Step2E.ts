import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../../TasksPanelTypes";
import { fetchTasksByTag } from "../../../services/WeeklyReviewService";
import { renderTaskCard, TaskCardCallbacks } from "../components/TaskCard";

/**
 * Renders Step 2E: Review Waiting For.
 */
export async function renderStep2E(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  callbacks: TaskCardCallbacks & {
    onRerender: () => Promise<void>;
  }
): Promise<void> {
  host.empty();
  
  // Guidance text
  const guidance = host.createDiv({ cls: "weekly-review-guidance" });
  guidance.createEl("h4", { text: "Review Waiting For List" });
  guidance.createEl("p", { 
    text: "Record appropriate actions for any needed follow-up. Check off received ones." 
  });
  
  host.createEl("p", { 
    text: "Review each Waiting For task. Update, complete, or remove the tag as needed." 
  });

  const waitingForTasks = await fetchTasksByTag(app, settings, settings.waitingForTag);

  if (waitingForTasks.length === 0) {
    host.createEl("p", { 
      text: "No Waiting For tasks found." 
    });
    return;
  }

  const countText = host.createEl("p");
  countText.setAttribute("data-weekly-review-count", "true");
  countText.textContent = `Found ${waitingForTasks.length} Waiting For task(s).`;

  const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
  for (const task of waitingForTasks) {
    await renderTaskCard(tasksList, app, settings, task, callbacks, {
      isWaitingFor: true
    });
  }
}

