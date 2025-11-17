import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { WizardState } from "../../WeeklyReviewPanelTypes";

/**
 * Renders Step 1B: Empty Your Head.
 */
export function renderStep1B(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: {
    onAddTasksToInbox: (text: string) => Promise<void>;
    onStateChange: (updates: Partial<WizardState["notes"]["emptyHead"]>) => void;
    onDebouncedSave: () => void;
  }
): void {
  host.empty();
  
  // Guidance text
  const guidance = host.createDiv({ cls: "weekly-review-guidance" });
  guidance.createEl("h4", { text: "Empty Your Head" });
  guidance.createEl("p", { 
    text: "Put in writing and process any uncaptured new projects, action items, waiting for's, someday maybe's, etc." 
  });
  
  host.createEl("p", { 
    text: "For each question below, add tasks to the Inbox as you think of them." 
  });

  // Worries
  const worriesDiv = host.createDiv({ cls: "weekly-review-question" });
  worriesDiv.createEl("h4", { text: "1. What am I worried about?" });
  const worriesInput = worriesDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  worriesInput.placeholder = "Enter worries or tasks here...";
  worriesInput.value = wizardState.notes.emptyHead.worries;
  worriesInput.addEventListener("input", (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange({ worries: value });
    callbacks.onDebouncedSave();
  });
  const worriesBtn = worriesDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  worriesBtn.addEventListener("click", async () => {
    const text = worriesInput.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      worriesInput.value = "";
      callbacks.onStateChange({ worries: "" });
    }
  });

  // Postponements
  const postponeDiv = host.createDiv({ cls: "weekly-review-question" });
  postponeDiv.createEl("h4", { text: "2. What do I keep postponing?" });
  const postponeInput = postponeDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  postponeInput.placeholder = "Enter postponed items or tasks here...";
  postponeInput.value = wizardState.notes.emptyHead.postponements;
  postponeInput.addEventListener("input", (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange({ postponements: value });
    callbacks.onDebouncedSave();
  });
  const postponeBtn = postponeDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  postponeBtn.addEventListener("click", async () => {
    const text = postponeInput.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      postponeInput.value = "";
      callbacks.onStateChange({ postponements: "" });
    }
  });

  // Small wins
  const winsDiv = host.createDiv({ cls: "weekly-review-question" });
  winsDiv.createEl("h4", { text: "3. What small wins are dangling?" });
  const winsInput = winsDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  winsInput.placeholder = "Enter small wins or tasks here...";
  winsInput.value = wizardState.notes.emptyHead.smallWins;
  winsInput.addEventListener("input", (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange({ smallWins: value });
    callbacks.onDebouncedSave();
  });
  const winsBtn = winsDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  winsBtn.addEventListener("click", async () => {
    const text = winsInput.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      winsInput.value = "";
      callbacks.onStateChange({ smallWins: "" });
    }
  });
}

