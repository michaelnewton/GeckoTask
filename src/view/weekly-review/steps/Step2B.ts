import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { WizardState } from "../WeeklyReviewPanelTypes";

/**
 * Renders Step 2B: Review Calendar (Past).
 */
export function renderStep2B(
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
  guidance.createEl("h4", { text: "Review Previous Calendar Data" });
  guidance.createEl("p", { 
    text: "Review past calendar in detail for remaining action items, reference data, etc., and transfer into the active system." 
  });
  
  host.createEl("p", { 
    text: "Review your calendar for the past 2-3 weeks. Were there any action items or follow-ups from meetings?" 
  });

  const inputDiv = host.createDiv({ cls: "weekly-review-question" });
  const input = inputDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  input.placeholder = "Enter follow-ups or tasks here...";
  input.value = wizardState.notes.calendarPast;
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

