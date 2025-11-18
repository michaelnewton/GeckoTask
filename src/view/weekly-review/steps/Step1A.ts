import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { WizardState } from "../WeeklyReviewPanelTypes";

/**
 * Renders Step 1A: Collect Loose Ends.
 */
export function renderStep1A(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: {
    onAddTasksToInbox: (text: string) => Promise<void>;
    onStateChange: (updates: Partial<WizardState["notes"]["looseEnds"]>) => void;
    onDebouncedSave: () => void;
  }
): void {
  host.empty();
  
  // Guidance text
  const guidance = host.createDiv({ cls: "weekly-review-guidance" });
  guidance.createEl("h4", { text: "Collect Loose Papers and Materials" });
  guidance.createEl("p", { 
    text: "Gather all accumulated business cards, receipts, and miscellaneous paper-based materials into your in-tray." 
  });
  
  host.createEl("p", { 
    text: "For each question below, add tasks to the Inbox as you think of them." 
  });

  // Physical items
  const physicalDiv = host.createDiv({ cls: "weekly-review-question" });
  physicalDiv.createEl("h4", { text: "1. Physical items" });
  physicalDiv.createEl("p", { 
    text: "Gather physical notes, receipts, scribbles into your inbox. Any tasks to add?" 
  });
  const physicalInput = physicalDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  physicalInput.placeholder = "Enter notes or tasks here...";
  physicalInput.value = wizardState.notes.looseEnds.physicalItems;
  physicalInput.addEventListener("input", async (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange({ physicalItems: value });
    callbacks.onDebouncedSave();
  });

  const physicalBtn = physicalDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  physicalBtn.addEventListener("click", async () => {
    const text = physicalInput.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      physicalInput.value = "";
      callbacks.onStateChange({ physicalItems: "" });
    }
  });

  // Email messages
  const emailDiv = host.createDiv({ cls: "weekly-review-question" });
  emailDiv.createEl("h4", { text: "2. Email messages" });
  emailDiv.createEl("p", { 
    text: "Review your email inbox. Any tasks to add?" 
  });
  const emailInput = emailDiv.createEl("textarea", { 
    cls: "weekly-review-textarea" 
  });
  emailInput.placeholder = "Enter notes or tasks here...";
  emailInput.value = wizardState.notes.looseEnds.emailMessages;
  emailInput.addEventListener("input", async (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    callbacks.onStateChange({ emailMessages: value });
    callbacks.onDebouncedSave();
  });

  const emailBtn = emailDiv.createEl("button", { 
    text: "Add to Inbox", 
    cls: "weekly-review-btn weekly-review-btn-action" 
  });
  emailBtn.addEventListener("click", async () => {
    const text = emailInput.value.trim();
    if (text) {
      await callbacks.onAddTasksToInbox(text);
      emailInput.value = "";
      callbacks.onStateChange({ emailMessages: "" });
    }
  });

  // Custom collection points
  for (const point of settings.customCollectionPoints) {
    const customDiv = host.createDiv({ cls: "weekly-review-question" });
    customDiv.createEl("h4", { text: point });
    const customInput = customDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    customInput.placeholder = "Enter notes or tasks here...";
    customInput.value = wizardState.notes.looseEnds.custom[point] || "";
    customInput.addEventListener("input", async (e) => {
      const value = (e.target as HTMLTextAreaElement).value;
      callbacks.onStateChange({ 
        custom: { ...wizardState.notes.looseEnds.custom, [point]: value }
      });
      callbacks.onDebouncedSave();
    });

    const customBtn = customDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    customBtn.addEventListener("click", async () => {
      const text = customInput.value.trim();
      if (text) {
        await callbacks.onAddTasksToInbox(text);
        customInput.value = "";
        callbacks.onStateChange({ 
          custom: { ...wizardState.notes.looseEnds.custom, [point]: "" }
        });
      }
    });
  }
}

