import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { TaskWorkSettings } from "../settings";

/**
 * View type identifier for the Weekly Review panel.
 */
export const VIEW_TYPE_WEEKLY_REVIEW = "weekly-review-view";

/**
 * Side panel view for weekly review functionality.
 */
export class WeeklyReviewPanel extends ItemView {
  settings: TaskWorkSettings;
  container!: HTMLElement;

  /**
   * Creates a new Weekly Review panel.
   * @param leaf - Workspace leaf to attach to
   * @param settings - Plugin settings
   */
  constructor(leaf: WorkspaceLeaf, settings: TaskWorkSettings) {
    super(leaf);
    this.settings = settings;
  }

  /**
   * Returns the view type identifier.
   * @returns View type string
   */
  getViewType(): string { return VIEW_TYPE_WEEKLY_REVIEW; }

  /**
   * Returns the display text for the view.
   * @returns Display text
   */
  getDisplayText(): string { return "Weekly Review"; }

  /**
   * Returns the icon name for the view.
   * @returns Icon name
   */
  getIcon(): string { return "calendar-clock"; }

  /**
   * Called when the view is opened. Sets up UI.
   */
  async onOpen() {
    this.container = this.contentEl;
    this.container.empty();
    this.container.addClass("weekly-review-panel");

    // Title
    const titleEl = this.container.createDiv({ cls: "weekly-review-title" });
    titleEl.createEl("h2", { text: "Weekly Review" });
  }

  /**
   * Called when the view is closed. Cleans up resources.
   */
  async onClose() {}
}

