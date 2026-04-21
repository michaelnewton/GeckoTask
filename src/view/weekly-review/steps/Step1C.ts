import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { fetchInboxTasks } from "../../../services/WeeklyReviewService";
import { renderTaskCard, TaskCardCallbacks } from "../components/TaskCard";

/**
 * Renders Step 1C: Process Inbox.
 */
export async function renderStep1C(
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
  guidance.createEl("h4", { text: "Get \"IN\" to Zero" });
  guidance.createEl("p", { 
    text: "Process completely all outstanding paper materials, journal and meeting notes, voicemails, dictation, and emails." 
  });
  
  const processGuidance = host.createDiv({ cls: "weekly-review-guidance" });
  processGuidance.createEl("h4", { text: "Processing Guidelines" });
  processGuidance.createEl("p", { 
    text: "2-Minute Rule: If a task takes less than 2 minutes, do it now (mark complete)." 
  });
  processGuidance.createEl("p", { 
    text: "Process vs Organize: First decide the outcome/next step (Process), then put it on the right list (Organize)." 
  });
  const processList = processGuidance.createEl("ul");
  processList.createEl("li", { 
    text: "Process = Decide: Do it, Delegate it, Defer it, or Delete it" 
  });
  processList.createEl("li", { 
    text: "Organize = Put it in the right place: Project, Someday/Maybe, Waiting For, or Archive" 
  });

  // Fetch inbox tasks
  const inboxTasks = await fetchInboxTasks(app, settings);
  const uncompletedTasks = inboxTasks.filter(t => !t.checked);

  if (uncompletedTasks.length === 0) {
    host.createEl("p", { 
      text: "No uncompleted tasks in Inbox. Great job!" 
    });
    return;
  }

  const countText = host.createEl("p");
  countText.setAttribute("data-weekly-review-count", "true");
  countText.textContent = `Found ${uncompletedTasks.length} uncompleted task(s) in Inbox.`;

  const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
  for (const task of uncompletedTasks) {
    await renderTaskCard(tasksList, app, settings, task, callbacks, {
      isInbox: true
    });
  }
}

