import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { WizardState } from "../../WeeklyReviewPanelTypes";

/**
 * Renders Step 2C: Review Calendar (Future).
 */
export function renderStep2C(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: {
    onAddTasksToInbox: (text: string) => Promise<void>;
    onStateChange: (value: string) => void;
    onDebouncedSave: () => void;
  }
): void {
  host.empty();
  
  // Guidance text
  const guidance = host.createDiv({ cls: "weekly-review-guidance" });
  guidance.createEl("h4", { text: "Review Upcoming Calendar" });
  guidance.createEl("p", { 
    text: "Review upcoming calendar events—long and short term. Capture actions triggered." 
  });
  
  host.createEl("p", { 
    text: "Review your calendar for the next 2 weeks. What do you need to prepare for upcoming meetings, commitments, or events?" 
  });

  const inputDiv = host.createDiv({ cls: "weekly-review-question" });
  const input = inputDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  input.placeholder = "Enter prep tasks here...";
  input.value = wizardState.notes.calendarFuture;
  input.addEventListener("input", (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange(value);
    callbacks.onDebouncedSave();
  });

  const addBtn = inputDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  addBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      input.value = "";
      callbacks.onStateChange("");
    }
  });
}

