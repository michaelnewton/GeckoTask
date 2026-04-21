import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { GeckoTaskSettings } from "../../settings";
import { FilePickerModal } from "../../ui/FilePickerModal";
import { captureQuickTask } from "../../ui/CaptureModal";
import { TabType, FilterState, IndexedTask } from "./TasksPanelTypes";
import { loadTasksFromFile } from "../../utils/taskUtils";
import { getSortedProjectFiles } from "../../utils/areaUtils";
import { renderTabBar } from "./components/TabBar";
import { renderFilterBar } from "./components/FilterBar";
import { renderTaskItem, TaskItemCallbacks } from "./components/TaskItem";
import { filterTasks, sortTasks } from "./utils/taskFiltering";
import { toggleTask, updateTaskField, updateTaskTitle, moveTask, openTaskInNote } from "./utils/taskOperations";

/**
 * View type identifier for the Tasks panel.
 */
export const VIEW_TYPE_TASKS = "tasks-view";

/**
 * Side panel view for displaying and managing tasks.
 */
export class TasksPanel extends ItemView {
  settings: GeckoTaskSettings;
  container!: HTMLElement;
  currentTab: TabType = "today-overdue";
  filters: FilterState = { area: "All", project: "Any", priority: "Any", due: "any", query: "" };
  tasks: IndexedTask[] = [];
  projectPaths: string[] = []; // for filter dropdown (file paths)
  titleElement!: HTMLElement; // Reference to the title h2 element

  /**
   * Creates a new Tasks panel.
   * @param leaf - Workspace leaf to attach to
   * @param settings - Plugin settings
   */
  constructor(leaf: WorkspaceLeaf, settings: GeckoTaskSettings) {
    super(leaf);
    this.settings = settings;
  }

  /**
   * Returns the view type identifier.
   * @returns View type string
   */
  getViewType(): string { return VIEW_TYPE_TASKS; }

  /**
   * Returns the display text for the view.
   * @returns Display text
   */
  getDisplayText(): string { return "Tasks"; }

  /**
   * Returns the icon name for the view.
   * @returns Icon name
   */
  getIcon(): string { return "check-circle"; }

  /**
   * Called when the view is opened. Sets up UI and event listeners.
   */
  async onOpen() {
    this.container = this.contentEl;
    this.container.empty();
    this.container.addClass("geckotask-panel");

    // Title with Quick Add button
    const titleEl = this.container.createDiv({ cls: "geckotask-title" });
    const titleHeader = titleEl.createDiv({ cls: "geckotask-title-header" });
    this.titleElement = titleHeader.createEl("h2", { text: "Tasks" });
    const quickAddBtn = titleHeader.createEl("button", { 
      text: this.isTouchDevice() ? "➕" : "Quick Add", 
      cls: "geckotask-quick-add-btn" 
    });
    this.registerDomEvent(quickAddBtn, "click", async () => {
      await captureQuickTask(this.app, this.settings);
      // Refresh the panel after adding a task
      await this.reindex();
      this.rerender();
    });

    // Tabs
    const tabsEl = this.container.createDiv({ cls: "geckotask-tabs" });
    this.renderTabs(tabsEl);

    // Filters UI
    const filtersEl = this.container.createDiv({ cls: "geckotask-filters" });
    this.renderFilters(filtersEl);

    // Results
    const listEl = this.container.createDiv({ cls: "geckotask-list" });

    // Index initial
    await this.reindex();
    this.renderList(listEl);

    // Refresh on changes
    const debouncedRefresh = this.debounce(async () => {
      await this.reindex();
      this.rerender();
    }, 200);

    this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
    this.registerEvent(this.app.metadataCache.on("changed", debouncedRefresh));
  }

  /**
   * Called when the view is closed. Cleans up resources.
   */
  async onClose() {}

  /**
   * Renders the tab navigation UI.
   * @param host - Container element to render into
   */
  private renderTabs(host: HTMLElement) {
    renderTabBar(host, this.currentTab, (tab) => {
      this.currentTab = tab;
      this.rerender();
    });
  }

  /**
   * Renders the filter UI controls.
   * @param host - Container element to render into
   */
  private renderFilters(host: HTMLElement) {
    renderFilterBar(
      host,
      this.app,
      this.settings,
      this.currentTab,
      this.filters,
      this.projectPaths,
      (filters) => {
        this.filters = filters;
        this.rerender();
      },
      (paths) => {
        this.projectPaths = paths;
      }
    );
  }

  /**
   * Reindexes all tasks in the vault and updates the task list.
   */
  private async reindex() {
    const tasks: IndexedTask[] = [];

    // Discover all task files (project _tasks.md, area _tasks.md, inbox files)
    const sortedFiles = getSortedProjectFiles(this.app, this.settings);

    // Load tasks from all discovered files
    for (const file of sortedFiles) {
      const fileTasks = await loadTasksFromFile(this.app, file, this.settings);
      tasks.push(...fileTasks);
    }

    this.projectPaths = sortedFiles.map(f => f.path);
    this.tasks = tasks;
    // re-render filters project dropdown
    const filtersHost = this.container.find(".geckotask-filters") as HTMLElement;
    if (filtersHost) this.renderFilters(filtersHost);
  }

  /**
   * Renders the filtered task list.
   * @param host - Container element to render into
   */
  private renderList(host: HTMLElement) {
    host.empty();

    // Filter and sort tasks
    let rows = filterTasks(this.tasks, this.currentTab, this.filters, this.app, this.settings);
    rows = sortTasks(rows, this.currentTab, this.settings);

    // list (card-based layout)
    const list = host.createDiv({ cls: "geckotask-rows" });
    
    // Show warning box for "Now" tab when there are more than 5 tasks
    if (this.currentTab === "today-overdue" && rows.length > 5) {
      const warningBox = list.createDiv({ cls: "geckotask-warning-box" });
      warningBox.createSpan({ cls: "geckotask-warning-icon", text: "⚠️" });
      const warningText = warningBox.createSpan({ cls: "geckotask-warning-text" });
      warningText.setText(`You have ${rows.length} tasks. Daily review tip: Choose 3–5 key tasks as today's focus.`);
    }
    
    // Show empty state messages for tabs when no tasks
    if (rows.length === 0) {
      const emptyMsg = list.createDiv({ cls: "geckotask-empty-message" });
      if (this.currentTab === "today-overdue") {
        emptyMsg.setText("No tasks due today or overdue");
      } else if (this.currentTab === "inbox") {
        emptyMsg.setText("No tasks in inbox");
      } else if (this.currentTab === "waiting-for") {
        emptyMsg.setText(`No tasks with ${this.settings.waitingForTag} tag`);
      } else if (this.currentTab === "next-actions") {
        emptyMsg.setText("No next actions available");
      }
      // Update title with task count (0)
      if (this.titleElement) {
        this.titleElement.setText(`Tasks (0)`);
      }
      return;
    }
    
    // Create callbacks for task items
    const callbacks: TaskItemCallbacks = {
      onToggle: async (task, checked) => {
        await toggleTask(this.app, task, checked);
        await this.reindex();
        this.rerender();
      },
      onUpdateField: async (task, key, value) => {
        await updateTaskField(this.app, task, key, value);
        await this.reindex();
        this.rerender();
      },
      onUpdateTitle: async (task, newTitle) => {
        await updateTaskTitle(this.app, task, newTitle);
        await this.reindex();
        this.rerender();
      },
      onMove: async (task) => {
        await this.handleMoveTask(task);
      },
      onOpen: async (task) => {
        await openTaskInNote(this.app, task);
      },
      onEdit: async (task) => {
        await captureQuickTask(this.app, this.settings, task);
        await this.reindex();
        this.rerender();
      },
      onRerender: () => {
        this.rerender();
      }
    };

    // Render each task
    for (const task of rows) {
      renderTaskItem(list, this.app, this.settings, task, callbacks);
    }
    
    // Update title with task count
    if (this.titleElement) {
      this.titleElement.setText(`Tasks (${rows.length})`);
    }
  }

  /**
   * Handles moving a task to a different file.
   * @param task - The task to move
   */
  private async handleMoveTask(task: IndexedTask) {
    try {
      // FilePickerModal will automatically get and sort files
      const modal = new FilePickerModal(this.app, [], this.settings);
      const target = await modal.openAndGet();
      if (!target) {
        // User cancelled - this is fine, just return
        return;
      }

      await moveTask(this.app, task, target);
      await this.reindex();
      this.rerender();
    } catch (error) {
      new Notice(`GeckoTask: Error moving task: ${error}`);
      console.error("GeckoTask: Error moving task:", error);
    }
  }

  /**
   * Triggers a re-render of the entire panel (tabs, filters, and list).
   */
  private rerender() {
    const tabsEl = this.container.find(".geckotask-tabs") as HTMLElement;
    if (tabsEl) this.renderTabs(tabsEl);
    
    const filtersEl = this.container.find(".geckotask-filters") as HTMLElement;
    if (filtersEl) this.renderFilters(filtersEl);
    
    const listEl = this.container.find(".geckotask-list") as HTMLElement;
    if (listEl) this.renderList(listEl);
  }

  /**
   * Creates a debounced version of a function.
   * @param fn - Function to debounce
   * @param ms - Debounce delay in milliseconds
   * @returns Debounced function
   */
  private debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
    let h: number | undefined;
    return ((...args: Parameters<T>) => {
      window.clearTimeout(h);
      h = window.setTimeout(() => fn(...args), ms);
    }) as unknown as T;
  }

  /**
   * Detects if the current device is a touch device (mobile/tablet).
   * @returns True if the device supports touch input
   */
  private isTouchDevice(): boolean {
    // Check for touch support
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      return true;
    }
    // Check media query for coarse pointer (touch)
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return true;
    }
    return false;
  }
}

