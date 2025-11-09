import { App, ItemView, WorkspaceLeaf, TFile, Notice, MarkdownView } from "obsidian";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "../models/TaskModel";
import { GeckoTaskSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { calculateNextOccurrence } from "../services/Recurrence";
import { inferAreaFromPath, isInTasksFolder, isSpecialFile, normalizeInboxPath, getAreas, isTasksFolderFile, getProjectDisplayName } from "../utils/areaUtils";
import { PromptModal } from "../ui/PromptModal";
import { FilePickerModal } from "../ui/FilePickerModal";
import { captureQuickTask } from "../ui/CaptureModal";
import { DueWindow, TabType, FilterState, IndexedTask } from "./TasksPanelTypes";

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
    titleHeader.createEl("h2", { text: "Tasks" });
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
    host.empty();
    host.addClass("geckotask-tabs-container");

    const todayTab = host.createDiv({ 
      cls: `geckotask-tab ${this.currentTab === "today-overdue" ? "geckotask-tab-active" : ""}`
    });
    todayTab.setText("Today");
    todayTab.addEventListener("click", () => {
      this.currentTab = "today-overdue";
      this.rerender();
    });

    const inboxTab = host.createDiv({ 
      cls: `geckotask-tab ${this.currentTab === "inbox" ? "geckotask-tab-active" : ""}`
    });
    inboxTab.setText("Inbox");
    inboxTab.addEventListener("click", () => {
      this.currentTab = "inbox";
      this.rerender();
    });

    const allTab = host.createDiv({ 
      cls: `geckotask-tab ${this.currentTab === "all" ? "geckotask-tab-active" : ""}`
    });
    allTab.setText("All Tasks");
    allTab.addEventListener("click", () => {
      this.currentTab = "all";
      this.rerender();
    });
  }

  /**
   * Renders the filter UI controls.
   * @param host - Container element to render into
   */
  private renderFilters(host: HTMLElement) {
    host.empty();
    host.addClass("geckotask-filters-compact");

    // For "Today" tab, hide the due filter since it's implicit
    const showDueFilter = this.currentTab === "all";

    // First row: Search (full width)
    const searchRow = host.createDiv({ cls: "filter-row" });
    const searchInput = searchRow.createEl("input", {
      type: "text",
      placeholder: "Search tasks or #tags",
      cls: "filter-search"
    });
    searchInput.value = this.filters.query;
    searchInput.addEventListener("input", (e) => {
      this.filters.query = (e.target as HTMLInputElement).value;
      this.rerender();
    });

    // Second row: Compact filter buttons
    const filterRow = host.createDiv({ cls: "filter-row filter-buttons" });
    
    // Area dropdown (only show if areas are configured)
    const areas = getAreas(this.app, this.settings);
    if (areas.length > 0) {
      const areaContainer = filterRow.createDiv({ cls: "filter-item" });
      areaContainer.createEl("label", { text: "Area:", cls: "filter-label" });
      const areaSelect = areaContainer.createEl("select", { cls: "filter-select" });
      // Add "All" option
      const allOpt = areaSelect.createEl("option", { text: "All" });
      allOpt.value = "All";
      if (this.filters.area === "All") allOpt.selected = true;
      // Add detected areas
      areas.forEach(a => {
        const opt = areaSelect.createEl("option", { text: a });
        opt.value = a;
        if (a === this.filters.area) opt.selected = true;
      });
      areaSelect.addEventListener("change", (e) => {
        this.filters.area = (e.target as HTMLSelectElement).value;
        this.rerender();
      });
    }

    // Priority dropdown
    const prioContainer = filterRow.createDiv({ cls: "filter-item" });
    prioContainer.createEl("label", { text: "Priority:", cls: "filter-label" });
    const prioSelect = prioContainer.createEl("select", { cls: "filter-select" });
    // Add "Any" option first
    const anyOpt = prioSelect.createEl("option", { text: "Any" });
    anyOpt.value = "Any";
    if (this.filters.priority === "Any") anyOpt.selected = true;
    // Add priorities from settings
    this.settings.allowedPriorities.forEach(p => {
      const opt = prioSelect.createEl("option", { text: p });
      opt.value = p;
      if (p === this.filters.priority) opt.selected = true;
    });
    prioSelect.addEventListener("change", (e) => {
      this.filters.priority = (e.target as HTMLSelectElement).value;
      this.rerender();
    });

    // Due dropdown (only show for "All Tasks" tab)
    if (showDueFilter) {
      const dueContainer = filterRow.createDiv({ cls: "filter-item" });
      dueContainer.createEl("label", { text: "Due:", cls: "filter-label" });
      const dueSelect = dueContainer.createEl("select", { cls: "filter-select" });
      
      // Fixed options
      const dueOpts: [string, DueWindow][] = [
        ["Any", "any"],
        ["Today", "today"],
        ["Overdue", "overdue"],
        ["None", "nodue"]
      ];
      
      // Add configurable day ranges from settings
      this.settings.dueDateRanges.forEach(range => {
        // Validate format (e.g., "7d", "14d", "30d")
        if (/^\d+d$/.test(range)) {
          dueOpts.push([range, range as DueWindow]);
        }
      });
      
      // Add relative periods
      dueOpts.push(
        ["This week", "this-week"],
        ["Next week", "next-week"],
        ["This month", "this-month"],
        ["Next month", "next-month"]
      );
      
      dueOpts.forEach(([label, val]) => {
        const opt = dueSelect.createEl("option", { text: label });
        opt.value = val;
        if (val === this.filters.due) opt.selected = true;
      });
      
      dueSelect.addEventListener("change", (e) => {
        this.filters.due = (e.target as HTMLSelectElement).value as DueWindow;
        this.rerender();
      });
    }

    // Project dropdown (similar to modal - shows file paths)
    const projContainer = filterRow.createDiv({ cls: "filter-item" });
    projContainer.createEl("label", { text: "Project:", cls: "filter-label" });
    const projSelect = projContainer.createEl("select", { cls: "filter-select" });
    
    /**
     * Refreshes the project dropdown options by updating projectPaths and re-rendering options.
     */
    const refreshProjectOptions = () => {
      // Update projectPaths from current vault state
      const files = this.app.vault.getMarkdownFiles();
      const projectPathsSet = new Set<string>();
      
      for (const file of files) {
        const path = file.path;
        if (!isInTasksFolder(path, this.settings)) continue;
        if (isTasksFolderFile(path, this.settings)) continue;
        projectPathsSet.add(path);
      }
      
      // Sort project paths (inbox first, then alphabetically)
      const normalizedInboxPath = normalizeInboxPath(this.settings.inboxPath);
      const projectPathsList = Array.from(projectPathsSet);
      projectPathsList.sort((a, b) => {
        if (a === normalizedInboxPath) return -1;
        if (b === normalizedInboxPath) return 1;
        return a.localeCompare(b);
      });
      
      // Update the stored projectPaths
      this.projectPaths = projectPathsList;
      
      // Clear and rebuild dropdown options
      const currentValue = projSelect.value;
      projSelect.empty();
      
      // Add "Any" option first
      const anyProjOpt = projSelect.createEl("option", { text: "Any" });
      anyProjOpt.value = "Any";
      
      // Add project files (inbox first, then others), excluding tasks folder file
      this.projectPaths
        .filter(path => !isTasksFolderFile(path, this.settings))
        .forEach(path => {
          const opt = projSelect.createEl("option", { text: getProjectDisplayName(path, this.app, this.settings) });
          opt.value = path;
        });
      
      // Restore the selected value if it still exists, otherwise use "Any"
      if (currentValue === "Any") {
        projSelect.value = "Any";
      } else if (this.projectPaths.includes(currentValue)) {
        projSelect.value = currentValue;
      } else {
        projSelect.value = "Any";
        this.filters.project = "Any";
      }
    };
    
    // Add "Any" option first
    const anyProjOpt = projSelect.createEl("option", { text: "Any" });
    anyProjOpt.value = "Any";
    if (this.filters.project === "Any") anyProjOpt.selected = true;
    
    // Add project files (inbox first, then others), excluding tasks folder file
    this.projectPaths
      .filter(path => !isTasksFolderFile(path, this.settings))
      .forEach(path => {
        const opt = projSelect.createEl("option", { text: getProjectDisplayName(path, this.app, this.settings) });
        opt.value = path;
        // Match by path
        if (path === this.filters.project) {
          opt.selected = true;
        }
      });
    
    projSelect.addEventListener("change", (e) => {
      const selectedValue = (e.target as HTMLSelectElement).value;
      // Store the file path in the filter
      this.filters.project = selectedValue;
      this.rerender();
    });
    
    // Refresh options when dropdown is clicked/focused
    projSelect.addEventListener("mousedown", refreshProjectOptions);
    projSelect.addEventListener("focus", refreshProjectOptions);
  }

  /**
   * Reindexes all tasks in the vault and updates the task list.
   */
  private async reindex() {
    const files = this.app.vault.getMarkdownFiles();
    const tasks: IndexedTask[] = [];
    const projectPathsSet = new Set<string>();

    for (const file of files) {
      const path = file.path;
      
      // Only index files in tasks folder structure
      if (!isInTasksFolder(path, this.settings)) continue;
      
      // Exclude tasks folder file from project paths
      if (isTasksFolderFile(path, this.settings)) continue;
      
      // Add all project files to the set (not just those with tasks)
      projectPathsSet.add(path);
      
      const cache = this.app.metadataCache.getCache(path);
      const lists = cache?.listItems;         // works for checkboxes
      if (!lists || lists.length === 0) continue;

      // Check if file has any tasks before reading
      const hasTasks = lists.some(li => li.task);
      if (!hasTasks) continue;

      // Read file content to get actual line text (only for files with tasks)
      let fileContent: string;
      try {
        fileContent = await this.app.vault.read(file);
      } catch {
        continue;
      }
      const lines = fileContent.split("\n");

      for (const li of lists) {
        if (!li.task) continue;               // only task items
        const lineNo = li.position?.start?.line ?? 0;
        if (lineNo < 0 || lineNo >= lines.length) continue;
        
        // Parse task with description (reads subsequent indented lines)
        const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
        if (!parsed) continue;

        // Get raw task line (first line only)
        const raw = lines[lineNo].trim();

        // Infer area from folder path (not from metadata)
        const area = inferAreaFromPath(path, this.app, this.settings);
        const project = parsed.project || (isSpecialFile(path, this.settings) ? undefined : file.basename);

        tasks.push({
          path,
          line: lineNo + 1, // 1-based task line
          raw,
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags || [],
          area,
          project,
          priority: parsed.priority,
          due: parsed.due,
          recur: parsed.recur,
          checked: parsed.checked,
          descriptionEndLine: endLine + 1 // 1-based, inclusive
        });
      }
    }

    // Sort project paths (inbox first, then alphabetically)
    const normalizedInboxPath = normalizeInboxPath(this.settings.inboxPath);
    const projectPathsList = Array.from(projectPathsSet);
    projectPathsList.sort((a, b) => {
      // Put inbox first
      if (a === normalizedInboxPath) return -1;
      if (b === normalizedInboxPath) return 1;
      // Then sort alphabetically
      return a.localeCompare(b);
    });
    this.projectPaths = projectPathsList;
    this.tasks = tasks;
    // re-render filters project dropdown
    const filtersHost = this.container.find(".geckotask-filters") as HTMLElement;
    if (filtersHost) this.renderFilters(filtersHost);
  }

  /**
   * Formats a due date for display.
   * Shows day name if within next 7 days, otherwise shortened format like "7th Nov".
   * @param dueDate - ISO date string (YYYY-MM-DD)
   * @returns Formatted date string
   */
  private formatDueDate(dueDate: string): string {
    const moment = (window as any).moment;
    const due = moment(dueDate);
    const today = moment().startOf("day");
    const daysDiff = due.diff(today, "days");
    
    if (daysDiff < 0) {
      // Overdue - show shortened format
      return due.format("Do MMM");
    } else if (daysDiff === 0) {
      return "Today";
    } else if (daysDiff <= 7) {
      // Within next 7 days - show day name
      return due.format("dddd");
    } else {
      // Beyond 7 days - show shortened format
      return due.format("Do MMM");
    }
  }

  /**
   * Gets the priority color class for styling.
   * Maps priority position in the user-defined array to escalating color classes.
   * @param priority - Priority value
   * @returns CSS class name for priority color
   */
  private getPriorityColorClass(priority?: string): string {
    if (!priority) return "priority-none";
    const idx = this.settings.allowedPriorities.indexOf(priority);
    if (idx < 0) return "priority-none";
    
    const totalPriorities = this.settings.allowedPriorities.length;
    if (totalPriorities === 0) return "priority-none";
    
    // Map based on position in array (last = highest priority)
    // Escalate colors from low → medium → high → urgent as index increases
    if (totalPriorities === 1) {
      // Single priority → medium
      return "priority-medium";
    } else if (totalPriorities === 2) {
      // Two priorities: [low, urgent]
      return idx === 0 ? "priority-low" : "priority-urgent";
    } else if (totalPriorities === 3) {
      // Three priorities: [low, medium, urgent]
      if (idx === 0) return "priority-low";
      if (idx === 1) return "priority-medium";
      return "priority-urgent";
    } else {
      // Four or more priorities: map proportionally
      // First → low, Last → urgent, distribute medium/high in between
      if (idx === 0) return "priority-low";
      if (idx === totalPriorities - 1) return "priority-urgent";
      
      // Map middle priorities proportionally across low → medium → high
      // Divide the range (excluding first and last) into segments
      const middleRange = totalPriorities - 2; // Exclude first and last
      const positionInMiddle = idx - 1; // Position within middle range (0-based)
      
      if (middleRange === 1) {
        // Only one middle priority → medium
        return "priority-medium";
      } else if (middleRange === 2) {
        // Two middle priorities → medium, high
        return positionInMiddle === 0 ? "priority-medium" : "priority-high";
      } else {
        // Three or more middle priorities → distribute across medium and high
        const mediumEnd = Math.floor(middleRange / 2);
        return positionInMiddle <= mediumEnd ? "priority-medium" : "priority-high";
      }
    }
  }

  /**
   * Extracts all labels from a task (hashtags and @ labels from description).
   * @param task - The indexed task
   * @returns Array of label strings
   */
  private extractLabels(task: IndexedTask): string[] {
    const labels: string[] = [];
    
    // Add hashtags from task tags
    labels.push(...task.tags);
    
    // Extract @ labels from description
    if (task.description) {
      const labelPattern = /@[\w/-]+/g;
      const descLabels = task.description.match(labelPattern);
      if (descLabels) {
        // Add unique labels only
        descLabels.forEach(label => {
          if (!labels.includes(label)) {
            labels.push(label);
          }
        });
      }
    }
    
    return labels;
  }

  /**
   * Renders the filtered task list.
   * @param host - Container element to render into
   */
  private renderList(host: HTMLElement) {
    host.empty();

    // filter
    let rows = this.tasks.filter(t => !t.checked); // open only
    const f = this.filters;
    const today = (window as any).moment().format("YYYY-MM-DD");
    const normalizedInboxPath = normalizeInboxPath(this.settings.inboxPath);
    
    // Apply tab-specific filtering
    if (this.currentTab === "today-overdue") {
      // Show tasks due today or overdue
      rows = rows.filter(t => t.due && (t.due === today || t.due < today));
    } else if (this.currentTab === "inbox") {
      // Show only tasks from the inbox file
      rows = rows.filter(t => t.path === normalizedInboxPath);
    } else {
      // Apply due filter only for "All Tasks" tab
      const moment = (window as any).moment;
      
      if (f.due === "today") {
        rows = rows.filter(t => t.due === today);
      } else if (f.due === "overdue") {
        rows = rows.filter(t => t.due && t.due < today);
      } else if (f.due === "nodue") {
        rows = rows.filter(t => !t.due);
      } else if (f.due && /^\d+d$/.test(f.due)) {
        // Configurable day range (e.g., "7d", "14d", "30d")
        const days = parseInt(f.due.replace("d", ""), 10);
        if (!isNaN(days)) {
          const endDate = moment(today).add(days, "days").format("YYYY-MM-DD");
          rows = rows.filter(t => t.due && t.due >= today && t.due <= endDate);
        }
      } else if (f.due === "this-week") {
        const weekStart = moment().startOf("week").format("YYYY-MM-DD");
        const weekEnd = moment().endOf("week").format("YYYY-MM-DD");
        rows = rows.filter(t => t.due && t.due >= weekStart && t.due <= weekEnd);
      } else if (f.due === "next-week") {
        const nextWeekStart = moment().add(1, "week").startOf("week").format("YYYY-MM-DD");
        const nextWeekEnd = moment().add(1, "week").endOf("week").format("YYYY-MM-DD");
        rows = rows.filter(t => t.due && t.due >= nextWeekStart && t.due <= nextWeekEnd);
      } else if (f.due === "this-month") {
        const monthStart = moment().startOf("month").format("YYYY-MM-DD");
        const monthEnd = moment().endOf("month").format("YYYY-MM-DD");
        rows = rows.filter(t => t.due && t.due >= monthStart && t.due <= monthEnd);
      } else if (f.due === "next-month") {
        const nextMonthStart = moment().add(1, "month").startOf("month").format("YYYY-MM-DD");
        const nextMonthEnd = moment().add(1, "month").endOf("month").format("YYYY-MM-DD");
        rows = rows.filter(t => t.due && t.due >= nextMonthStart && t.due <= nextMonthEnd);
      }
    }
    
    // Apply other filters (common to both tabs)
    if (f.area !== "All") rows = rows.filter(t => (t.area || "") === f.area);
    if (f.project !== "Any") {
      // Filter by file path
      rows = rows.filter(t => t.path === f.project);
    }
    if (f.priority !== "Any") {
      rows = rows.filter(t => t.priority === f.priority);
    }
    if (f.query.trim()) {
      const q = f.query.toLowerCase();
      rows = rows.filter(t => `${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q));
    }

    // sort: due asc, priority rank, area, project, title
    // Priority rank based on order in settings (first = highest priority)
    const prioRank = (p?: string) => {
      if (!p) return 999;
      const idx = this.settings.allowedPriorities.indexOf(p);
      return idx >= 0 ? idx : 999;
    };
    rows.sort((a,b) => {
      const ad = a.due || "9999-12-31";
      const bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      if (ap !== bp) return ap - bp;
      if ((a.area||"") !== (b.area||"")) return (a.area||"").localeCompare(b.area||"");
      if ((a.project||"") !== (b.project||"")) return (a.project||"").localeCompare(b.project||"");
      return a.title.localeCompare(b.title);
    });

    // list (card-based layout)
    const list = host.createDiv({ cls: "geckotask-rows" });
    
    // Show empty state messages for tabs when no tasks
    if (rows.length === 0) {
      const emptyMsg = list.createDiv({ cls: "geckotask-empty-message" });
      if (this.currentTab === "today-overdue") {
        emptyMsg.setText("No tasks due today or overdue");
      } else if (this.currentTab === "inbox") {
        emptyMsg.setText("No tasks in inbox");
      }
      return;
    }
    
    for (const t of rows) {
      const card = list.createDiv({ cls: "geckotask-card" });
      
      // Mobile tap-to-reveal: toggle action buttons on card tap
      // Only add this on touch devices (mobile)
      if (this.isTouchDevice()) {
        card.addEventListener("click", (e) => {
          // Don't toggle if clicking on interactive elements
          const target = e.target as HTMLElement;
          const isInteractive = target.closest("input, button, .task-checkbox, .task-recur-icon, .task-due-container, .task-description-icon, .task-priority-container, .geckotask-action-btn, .task-title, .task-title-container");
          
          if (!isInteractive) {
            // Toggle this card and close others
            const wasExpanded = card.classList.contains("task-card-expanded");
            // Close all cards first
            list.querySelectorAll(".geckotask-card").forEach((c) => {
              c.classList.remove("task-card-expanded");
            });
            // Toggle this card if it wasn't already expanded
            if (!wasExpanded) {
              card.classList.add("task-card-expanded");
            }
          }
        });
      }

      // Top row: Checkbox + Recurring icon + Title
      const topRow = card.createDiv({ cls: "task-card-top" });
      const cb = topRow.createEl("input", { type: "checkbox", cls: "task-checkbox" });
      cb.checked = false;
      
      // Add priority color class to checkbox
      const priorityClass = this.getPriorityColorClass(t.priority);
      cb.classList.add(priorityClass);
      
      cb.addEventListener("change", async () => {
        await this.toggleTask(t, cb.checked);
      });
      
      // Recurring task icon (icon only, no text)
      if (t.recur) {
        const recurIcon = topRow.createDiv({ cls: "task-recur-icon" });
        recurIcon.innerHTML = "🔁";
        recurIcon.title = `Recurring: ${t.recur}`;
        recurIcon.style.cursor = "pointer";
        recurIcon.addEventListener("click", async (e) => {
          e.stopPropagation();
          const modal = new PromptModal(
            this.app, 
            "Set recurrence", 
            t.recur || "",
            "Examples: 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'"
          );
          const value = await modal.prompt();
          if (value != null) {
            await this.updateField(t, "recur", value.trim() || undefined);
          }
        });
      }
      
      const titleContainer = topRow.createDiv({ cls: "task-title-container" });
      const title = titleContainer.createEl("div", { cls: "task-title" });
      title.style.cursor = "pointer";
      this.renderDescriptionLine(title, t.title);
      title.addEventListener("click", () => {
        this.startEditingTitle(title, t);
      });

      // Bottom row: Due date + Priority + Tags on left, Project on right
      const bottomRow = card.createDiv({ cls: "task-card-bottom" });
      
      // Left side: Due date + Priority + Tags
      const leftSide = bottomRow.createDiv({ cls: "task-card-bottom-left" });
      
      // Due date (with calendar icon)
      if (t.due) {
        const dueContainer = leftSide.createDiv({ cls: "task-due-container" });
        const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
        dueIcon.innerHTML = "📅";
        const dueText = dueContainer.createEl("span", { cls: "task-due-text" });
        dueText.textContent = this.formatDueDate(t.due);
        dueContainer.style.cursor = "pointer";
        dueContainer.addEventListener("click", async () => {
          const defaultValue = t.due ?? (this.settings.nlDateParsing ? "today" : "");
          const modal = new PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
          const next = await modal.prompt();
          if (next == null || next.trim() === "") return;
          const parsed = this.settings.nlDateParsing ? (parseNLDate(next) ?? next) : next;
          await this.updateField(t, "due", parsed);
        });
      } else {
        const dueContainer = leftSide.createDiv({ cls: "task-due-container task-due-empty" });
        const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
        dueIcon.innerHTML = "📅";
        const dueText = dueContainer.createEl("span", { cls: "task-due-text" });
        dueText.textContent = "Set due";
        dueContainer.style.cursor = "pointer";
        dueContainer.style.opacity = "0.6";
        dueContainer.addEventListener("click", async () => {
          const defaultValue = this.settings.nlDateParsing ? "today" : "";
          const modal = new PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
          const next = await modal.prompt();
          if (next == null || next.trim() === "") return;
          const parsed = this.settings.nlDateParsing ? (parseNLDate(next) ?? next) : next;
          await this.updateField(t, "due", parsed);
        });
      }
      
      // Priority (with priority icon) - styled as pill/badge with color
      const priorityColorClass = this.getPriorityColorClass(t.priority);
      const priorityContainer = leftSide.createDiv({ 
        cls: `task-priority-container ${priorityColorClass}${!t.priority ? " task-priority-empty" : ""}` 
      });
      const priorityIcon = priorityContainer.createEl("span", { cls: "task-priority-icon" });
      // Show exclamation marks based on index (index 0 = !, index 1 = !!, etc.)
      if (t.priority) {
        const priorityIdx = this.settings.allowedPriorities.indexOf(t.priority);
        priorityIcon.innerHTML = "!".repeat(priorityIdx >= 0 ? priorityIdx + 1 : 1);
      } else {
        priorityIcon.innerHTML = "!";
      }
      
      // Tags/labels (with tag icon) - extract from both tags and description
      const allLabels = this.extractLabels(t);
      if (allLabels.length > 0) {
        allLabels.forEach(label => {
          const tagContainer = leftSide.createEl("span", { cls: "task-tag-container" });
          const tagIcon = tagContainer.createEl("span", { cls: "task-tag-icon" });
          tagIcon.textContent = "🏷️";
          const tagText = tagContainer.createEl("span", { cls: "task-tag-text" });
          tagText.textContent = label;
        });
      }
      
      // Description icon (if description exists) - on same line as labels/tags
      if (t.description) {
        const descIcon = leftSide.createEl("span", { 
          text: "📄", 
          cls: "task-description-icon" 
        });
        descIcon.title = "Show description";
        descIcon.style.cursor = "pointer";
      }
      
      // Right side: Project
      const rightSide = bottomRow.createDiv({ cls: "task-card-bottom-right" });
      if (t.project) {
        const projectContainer = rightSide.createDiv({ cls: "task-project-container" });
        const projectText = projectContainer.createEl("span", { cls: "task-project-text" });
        projectText.textContent = `# ${t.project}`;
      }

      // Description row (if exists) - hidden by default
      if (t.description) {
        const descRow = card.createDiv({ cls: "task-card-description task-description-hidden" });
        const descEl = descRow.createDiv({ cls: "task-description" });
        // Preserve line breaks - split by newlines and render each line
        // Don't render labels as badges in description (they're shown in bottom left)
        const descLines = t.description.split("\n");
        descLines.forEach((line, idx) => {
          if (line.trim().length > 0) {
            const lineEl = descEl.createDiv({ cls: "task-description-line" });
            this.renderDescriptionLine(lineEl, line, false); // false = don't render labels as badges
          } else if (idx < descLines.length - 1) {
            // Empty line for spacing
            descEl.createEl("div", { cls: "task-description-empty" });
          }
        });
        
        // Find the description icon we created earlier and add click handler
        const descIcon = leftSide.querySelector(".task-description-icon") as HTMLElement;
        if (descIcon) {
          // Toggle description visibility on icon click
          descIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            descRow.classList.toggle("task-description-hidden");
            descIcon.textContent = descRow.classList.contains("task-description-hidden") ? "📄" : "📄▼";
            descIcon.title = descRow.classList.contains("task-description-hidden") ? "Show description" : "Hide description";
          });
        }
      }

      // Action buttons (shown on hover)
      const actionRow = card.createDiv({ cls: "task-card-actions" });
      
      // Edit button
      const editBtn = actionRow.createEl("button", { 
        text: "Edit", 
        cls: "geckotask-action-btn geckotask-action-btn-edit"
      });
      editBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await captureQuickTask(this.app, this.settings, t);
        // Refresh the panel after editing
        await this.reindex();
        this.rerender();
      });

      // Move button
      const moveBtn = actionRow.createEl("button", { 
        text: "Move", 
        cls: "geckotask-action-btn geckotask-action-btn-move"
      });
      moveBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.moveTask(t);
      });

      // Open Note button
      const openBtn = actionRow.createEl("button", { 
        text: "Open", 
        cls: "geckotask-action-btn geckotask-action-btn-primary"
      });
      openBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.openTaskInNote(t);
      });
    }
  }

  /**
   * Toggles the completion status of a task.
   * @param t - The indexed task to toggle
   * @param checked - New checked state
   */
  private async toggleTask(t: IndexedTask, checked: boolean) {
    const file = this.app.vault.getAbstractFileByPath(t.path);
    if (!(file instanceof TFile)) return;

    let nextOccurrenceDue: string | null = null;

    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = (t.line ?? 1) - 1;
      const descEndIdx = (t.descriptionEndLine ?? t.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      // Parse the current task to preserve all fields including description
      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      // Update checked status
      parsed.checked = checked;
      
      // Update completed date
      let nextOccurrenceTask: Task | null = null;
      if (checked) {
        if (!parsed.completed) {
          const today = (window as any).moment().format("YYYY-MM-DD");
          parsed.completed = today;
        }
        
        // If recurring task, create next occurrence
        if (parsed.recur && parsed.recur.length > 0) {
          const today = new Date();
          const nextDue = calculateNextOccurrence(parsed.recur, today);
          if (nextDue) {
            nextOccurrenceDue = nextDue;
            nextOccurrenceTask = {
              ...parsed,
              checked: false,
              due: nextDue,
              completed: undefined,
              recur: parsed.recur,
            };
            delete nextOccurrenceTask.description; // Don't duplicate description
          }
        }
      } else {
        parsed.completed = undefined;
      }

      // Format task with description
      const updatedLines = formatTaskWithDescription(parsed);
      
      // If we have a next occurrence, add it directly underneath the current task
      if (nextOccurrenceTask) {
        const nextOccurrenceLines = formatTaskWithDescription(nextOccurrenceTask);
        updatedLines.push(...nextOccurrenceLines);
      }
      
      // Replace task line and description lines
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });

    if (checked && nextOccurrenceDue) {
      new Notice(`Task completed. Next occurrence scheduled for ${nextOccurrenceDue}`);
    } else {
      new Notice(`Task ${checked ? "completed" : "reopened"}`);
    }
    await this.reindex();
    this.rerender();
  }

  /**
   * Updates a field value on a task.
   * @param t - The indexed task to update
   * @param key - Field key to update ("due", "priority", or "recur")
   * @param value - New field value (optional)
   */
  private async updateField(t: IndexedTask, key: "due"|"priority"|"recur", value?: string) {
    const file = this.app.vault.getAbstractFileByPath(t.path);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = (t.line ?? 1) - 1;
      const descEndIdx = (t.descriptionEndLine ?? t.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      // Parse the current task to preserve all fields including description
      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      // Update the field
      if (key === "due") {
        parsed.due = value;
      } else if (key === "priority") {
        parsed.priority = value;
      } else if (key === "recur") {
        parsed.recur = value;
      }

      // Format task with description
      const updatedLines = formatTaskWithDescription(parsed);
      
      // Replace task line and description lines
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });
    await this.reindex();
    this.rerender();
  }

  /**
   * Starts inline editing of a task title.
   * @param titleEl - The title element to replace with input
   * @param t - The indexed task being edited
   */
  private startEditingTitle(titleEl: HTMLElement, t: IndexedTask) {
    // Get the original title text (from the task, not from rendered element)
    const currentText = t.title;
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.className = "task-title-edit";
    input.style.width = "100%";
    input.style.padding = "2px 4px";
    
    // Replace the div with the input
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let isFinishing = false;
    const finishEditing = async () => {
      // Prevent multiple calls
      if (isFinishing) return;
      isFinishing = true;

      // Check if input is still in the DOM
      if (!input.parentElement) {
        return;
      }

      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentText) {
        // Remove event listeners before rerender removes the element
        input.removeEventListener("blur", finishEditing);
        await this.updateTitle(t, newTitle);
      } else {
        // Restore original if cancelled or empty
        // Check again if input is still in the DOM
        if (!input.parentElement) {
          return;
        }
        const newTitleEl = document.createElement("div");
        newTitleEl.className = "task-title";
        newTitleEl.style.cursor = "pointer";
        this.renderDescriptionLine(newTitleEl, currentText);
        newTitleEl.addEventListener("click", () => {
          this.startEditingTitle(newTitleEl, t);
        });
        input.replaceWith(newTitleEl);
      }
    };

    const handleEscape = () => {
      // Check if input is still in the DOM
      if (!input.parentElement) {
        return;
      }
      const newTitleEl = document.createElement("div");
      newTitleEl.className = "task-title";
      newTitleEl.style.cursor = "pointer";
      this.renderDescriptionLine(newTitleEl, currentText);
      newTitleEl.addEventListener("click", () => {
        this.startEditingTitle(newTitleEl, t);
      });
      input.replaceWith(newTitleEl);
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await finishEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleEscape();
      }
    });
  }

  /**
   * Updates the title of a task.
   * @param t - The indexed task to update
   * @param newTitle - New title text
   */
  private async updateTitle(t: IndexedTask, newTitle: string) {
    const file = this.app.vault.getAbstractFileByPath(t.path);
    if (!(file instanceof TFile)) return;
    
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = (t.line ?? 1) - 1;
      const descEndIdx = (t.descriptionEndLine ?? t.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;
      
      // Parse the current task to preserve all fields including description
      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;
      
      // Update the title
      parsed.title = newTitle;
      
      // Format task with description
      const updatedLines = formatTaskWithDescription(parsed);
      
      // Replace task line and description lines
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });
    
    await this.reindex();
    this.rerender();
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
   * Opens the note containing a task and scrolls to it.
   * @param t - The indexed task to open
   */
  private async openTaskInNote(t: IndexedTask) {
    const file = this.app.vault.getAbstractFileByPath(t.path);
    if (!(file instanceof TFile)) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    
    // Scroll to the line
    const view = leaf.view;
    if (view instanceof MarkdownView && view.editor) {
      const editor = view.editor;
      const line = Math.max(0, t.line - 1); // 0-based
      editor.setCursor(line, 0);
      editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  }

  /**
   * Moves a task to a different file via file picker.
   * @param t - The indexed task to move
   */
  private async moveTask(t: IndexedTask) {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => isInTasksFolder(f.path, this.settings))
      .filter(f => !isTasksFolderFile(f.path, this.settings));

    const target = await new FilePickerModal(this.app, files).openAndGet();
    if (!target) return;

    // Infer new area and project from target file
    const newArea = inferAreaFromPath(target.path, this.app, this.settings);
    const newProject = target.basename;

    // Remove from current file (preserving description)
    const sourceFile = this.app.vault.getAbstractFileByPath(t.path);
    if (!(sourceFile instanceof TFile)) return;

    let taskWithDescription: Task | null = null;
    await this.app.vault.process(sourceFile, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = t.line - 1; // 0-based
      const descEndIdx = (t.descriptionEndLine ?? t.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      // Parse current task with description
      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      // Update task metadata (remove area:: since we're using folder-based areas)
      taskWithDescription = {
        ...parsed,
        area: undefined, // Don't store area in metadata, it's derived from folder
        project: isSpecialFile(target.path, this.settings) ? parsed.project : newProject,
      };

      // Remove task line and description lines
      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      return lines.join("\n");
    });

    if (!taskWithDescription) return;

    // Format task with description
    const updatedLines = formatTaskWithDescription(taskWithDescription);

    // Append to target file
    const targetContent = await this.app.vault.read(target);
    const finalLines = updatedLines.join("\n");
    const updated = targetContent.trim().length 
      ? targetContent + "\n" + finalLines + "\n" 
      : finalLines + "\n";
    await this.app.vault.modify(target, updated);

    new Notice(`GeckoTask: Moved task to ${target.path}`);
    await this.reindex();
    this.rerender();
  }

  /**
   * Renders a description line, converting labels like "@ppl/Libby" into badges.
   * @param container - Container element to render into
   * @param line - Description line text
   * @param renderLabelsAsBadges - Whether to render labels as badges (default: true for titles, false for descriptions)
   */
  private renderDescriptionLine(container: HTMLElement, line: string, renderLabelsAsBadges: boolean = true) {
    // Pattern to match labels like @ppl/Libby, @person/Name, @label, etc.
    // Matches @ followed by word characters, slashes, hyphens, and underscores
    const labelPattern = /(@[\w/-]+)/g;
    const parts: Array<{ text: string; isLabel: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = labelPattern.exec(line)) !== null) {
      // Add text before the label
      if (match.index > lastIndex) {
        parts.push({ text: line.substring(lastIndex, match.index), isLabel: false });
      }
      // Add the label
      parts.push({ text: match[1], isLabel: true });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last label
    if (lastIndex < line.length) {
      parts.push({ text: line.substring(lastIndex), isLabel: false });
    }

    // If no labels found, just add the text as-is
    if (parts.length === 0) {
      container.textContent = line;
      return;
    }

    // Render parts
    parts.forEach(part => {
      if (part.isLabel && renderLabelsAsBadges) {
        // Create a badge for the label (only in titles)
        container.createEl("span", { 
          text: part.text, 
          cls: "task-description-label" 
        });
      } else if (part.isLabel && !renderLabelsAsBadges) {
        // Just show label as plain text in descriptions (since they're shown in bottom left)
        container.appendText(part.text);
      } else if (part.text.length > 0) {
        // Add regular text (only if not empty)
        container.appendText(part.text);
      }
    });
  }

  /**
   * Creates a debounced version of a function.
   * @param fn - Function to debounce
   * @param ms - Debounce delay in milliseconds
   * @returns Debounced function
   */
  private debounce<T extends (...args:any[])=>any>(fn: T, ms: number): T {
    let h: number | undefined;
    return ((...args: any[]) => {
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

