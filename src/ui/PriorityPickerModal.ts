import { App, SuggestModal } from "obsidian";

/**
 * Marker value for clearing task priority.
 */
const CLEAR_PRIORITY_MARKER = "__CLEAR_PRIORITY__" as const;

/**
 * Modal for choosing a task priority from allowed values.
 */
export class PriorityPickerModal extends SuggestModal<string | typeof CLEAR_PRIORITY_MARKER> {
  private result: string | undefined | null = null;
  private resolvePromise: ((value: string | undefined | null) => void) | null = null;
  private readonly priorities: string[];

  constructor(app: App, priorities: string[], private readonly currentPriority?: string) {
    super(app);
    this.priorities = priorities.filter((p) => p.trim().length > 0);
    this.setPlaceholder("Select priority");
    this.setInstructions([
      { command: "Enter", purpose: "Select priority" },
      { command: "Esc", purpose: "Cancel" }
    ]);
  }

  getSuggestions(query: string): (string | typeof CLEAR_PRIORITY_MARKER)[] {
    const suggestions: (string | typeof CLEAR_PRIORITY_MARKER)[] = [CLEAR_PRIORITY_MARKER, ...this.priorities];
    if (!query) return suggestions;
    const q = query.toLowerCase();
    return suggestions.filter((item) => {
      if (item === CLEAR_PRIORITY_MARKER) return "clear priority".includes(q);
      return item.toLowerCase().includes(q);
    });
  }

  renderSuggestion(item: string | typeof CLEAR_PRIORITY_MARKER, el: HTMLElement): void {
    if (item === CLEAR_PRIORITY_MARKER) {
      el.setText("No priority (clear)");
      if (!this.currentPriority) {
        el.addClass("is-selected");
      }
      el.addClass("geckotask-clickable");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onChooseSuggestion(item);
      });
      return;
    }

    el.setText(item);
    if (item === this.currentPriority) {
      el.createSpan({ text: " (current)" });
    }
    el.addClass("geckotask-clickable");
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onChooseSuggestion(item);
    });
  }

  onChooseSuggestion(item: string | typeof CLEAR_PRIORITY_MARKER): void {
    this.result = item === CLEAR_PRIORITY_MARKER ? undefined : item;
    this.close();
  }

  async openAndGet(): Promise<string | undefined | null> {
    this.result = null;
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      const originalOnClose = this.onClose;
      this.onClose = () => {
        if (originalOnClose) {
          originalOnClose.call(this);
        }
        if (this.resolvePromise) {
          this.resolvePromise(this.result);
          this.resolvePromise = null;
        }
      };
      this.open();
    });
  }
}
