import { App, ItemView, WorkspaceLeaf, TFile, Notice, Setting, SuggestModal, MarkdownView } from "obsidian";
import { parseTask, parseTaskWithDescription, formatTask, formatTaskWithDescription, Task } from "../models/TaskModel";
import { TaskWorkSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { calculateNextOccurrence } from "../services/Recurrence";
import { inferAreaFromPath, isInTasksFolder, isSpecialFile } from "../utils/areaUtils";
import { PromptModal } from "../ui/PromptModal";

/**
 * View type identifier for the TaskWork panel.
 */
export const VIEW_TYPE_TASKWORK = "taskwork-tasks-view";

/**
 * Due date filter window options.
 */
type DueWindow = "any" | "today" | "7d" | "overdue" | "nodue";

/**
 * Filter state for task filtering in the panel.
 */
interface FilterState {
  area: "All" | string; // "All" or one of settings.areas
  project: "Any" | string;
  priority: "Any" | string; // Dynamic from settings.allowedPriorities
  due: DueWindow;
  query: string;
}

/**
 * Task with indexing information for display in the panel.
 */
interface IndexedTask {
  path: string;
  line: number;        // 1-based task line
  raw: string;         // task line only (first line)
  title: string;
  description?: string; // Multi-line description
  tags: string[];
  area?: string;
  project?: string;
  priority?: string;
  due?: string;        // YYYY-MM-DD
  recur?: string;      // Recurrence pattern (e.g., "every Tuesday", "every 10 days")
  checked: boolean;
  descriptionEndLine?: number; // Last line of description (1-based, inclusive)
}

/**
 * Side panel view for displaying and managing tasks.
 */
export class TaskWorkPanel extends ItemView {
  settings: TaskWorkSettings;
  container!: HTMLElement;
  filters: FilterState = { area: "All", project: "Any", priority: "Any", due: "any", query: "" };
  tasks: IndexedTask[] = [];
  projects: string[] = []; // for filter dropdown

  /**
   * Creates a new TaskWork panel.
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
  getViewType(): string { return VIEW_TYPE_TASKWORK; }

  /**
   * Returns the display text for the view.
   * @returns Display text
   */
  getDisplayText(): string { return "TaskWork: Tasks"; }

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
    this.container.addClass("taskwork-panel");

    // Title
    const titleEl = this.container.createDiv({ cls: "taskwork-title" });
    titleEl.createEl("h2", { text: "TaskWork: Tasks" });

    // Filters UI
    const filtersEl = this.container.createDiv({ cls: "taskwork-filters" });
    this.renderFilters(filtersEl);

    // Results
    const listEl = this.container.createDiv({ cls: "taskwork-list" });

    // Index initial
    await this.reindex();
    this.renderList(listEl);

    // Refresh on changes
    const debouncedRefresh = this.debounce(async () => {
      await this.reindex();
      this.renderList(listEl);
    }, 200);

    this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
    this.registerEvent(this.app.metadataCache.on("changed", debouncedRefresh));
  }

  /**
   * Called when the view is closed. Cleans up resources.
   */
  async onClose() {}

  /**
   * Renders the filter UI controls.
   * @param host - Container element to render into
   */
  private renderFilters(host: HTMLElement) {
    host.empty();
    host.addClass("taskwork-filters-compact");

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
    if (this.settings.areas.length > 0) {
      const areaContainer = filterRow.createDiv({ cls: "filter-item" });
      areaContainer.createEl("label", { text: "Area:", cls: "filter-label" });
      const areaSelect = areaContainer.createEl("select", { cls: "filter-select" });
      // Add "All" option
      const allOpt = areaSelect.createEl("option", { text: "All" });
      allOpt.value = "All";
      if (this.filters.area === "All") allOpt.selected = true;
      // Add configured areas
      this.settings.areas.forEach(a => {
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

    // Due dropdown
    const dueContainer = filterRow.createDiv({ cls: "filter-item" });
    dueContainer.createEl("label", { text: "Due:", cls: "filter-label" });
    const dueSelect = dueContainer.createEl("select", { cls: "filter-select" });
    const dueOpts: [string, DueWindow][] = [["Any","any"],["Today","today"],["7d","7d"],["Overdue","overdue"],["None","nodue"]];
    dueOpts.forEach(([label,val]) => {
      const opt = dueSelect.createEl("option", { text: label });
      opt.value = val;
      if (val === this.filters.due) opt.selected = true;
    });
    dueSelect.addEventListener("change", (e) => {
      this.filters.due = (e.target as HTMLSelectElement).value as DueWindow;
      this.rerender();
    });

    // Project dropdown
    const projContainer = filterRow.createDiv({ cls: "filter-item" });
    projContainer.createEl("label", { text: "Project:", cls: "filter-label" });
    const projSelect = projContainer.createEl("select", { cls: "filter-select" });
    const projOpt = projSelect.createEl("option", { text: "Any" });
    projOpt.value = "Any";
    if (this.filters.project === "Any") projOpt.selected = true;
    this.projects.forEach(p => {
      const opt = projSelect.createEl("option", { text: p });
      opt.value = p;
      if (p === this.filters.project) opt.selected = true;
    });
    projSelect.addEventListener("change", (e) => {
      this.filters.project = (e.target as HTMLSelectElement).value;
      this.rerender();
    });
  }

  /**
   * Reindexes all tasks in the vault and updates the task list.
   */
  private async reindex() {
    const files = this.app.vault.getMarkdownFiles();
    const tasks: IndexedTask[] = [];
    const projects = new Set<string>();

    for (const file of files) {
      const path = file.path;
      
      // Only index files in tasks folder structure
      if (!isInTasksFolder(path, this.settings)) continue;
      
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
        const area = inferAreaFromPath(path, this.settings);
        const project = parsed.project || (isSpecialFile(path, this.settings) ? undefined : file.basename);
        if (project) projects.add(project);

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

    // sort projects
    this.projects = Array.from(projects).sort();
    this.tasks = tasks;
    // re-render filters project dropdown
    const filtersHost = this.container.find(".taskwork-filters") as HTMLElement;
    if (filtersHost) this.renderFilters(filtersHost);
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
    if (f.area !== "All") rows = rows.filter(t => (t.area || "") === f.area);
    if (f.project !== "Any") rows = rows.filter(t => (t.project || "") === f.project);
    if (f.priority !== "Any") {
      rows = rows.filter(t => t.priority === f.priority);
    }
    const today = (window as any).moment().format("YYYY-MM-DD");
    if (f.due === "today") rows = rows.filter(t => t.due === today);
    if (f.due === "7d") {
      const next7 = (window as any).moment(today).add(7, "days").format("YYYY-MM-DD");
      rows = rows.filter(t => t.due && t.due >= today && t.due <= next7);
    }
    if (f.due === "overdue") rows = rows.filter(t => t.due && t.due < today);
    if (f.due === "nodue") rows = rows.filter(t => !t.due);
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
    const list = host.createDiv({ cls: "taskwork-rows" });
    for (const t of rows) {
      const card = list.createDiv({ cls: "taskwork-card" });

      // Top row: Checkbox + Title
      const topRow = card.createDiv({ cls: "task-card-top" });
      const cb = topRow.createEl("input", { type: "checkbox", cls: "task-checkbox" });
      cb.checked = false;
      cb.addEventListener("change", async () => {
        await this.toggleTask(t, cb.checked);
      });
      const title = topRow.createEl("div", { text: t.title, cls: "task-title" });
      title.style.cursor = "pointer";
      title.addEventListener("click", () => {
        this.startEditingTitle(title, t);
      });

      // Description row (if exists)
      if (t.description) {
        const descRow = card.createDiv({ cls: "task-card-description" });
        const descEl = descRow.createEl("div", { cls: "task-description" });
        // Preserve line breaks - split by newlines and render each line
        const descLines = t.description.split("\n");
        descLines.forEach((line, idx) => {
          if (line.trim().length > 0) {
            descEl.createEl("div", { text: line, cls: "task-description-line" });
          } else if (idx < descLines.length - 1) {
            // Empty line for spacing
            descEl.createEl("div", { cls: "task-description-empty" });
          }
        });
      }

      // Middle row: Metadata badges
      const metaRow = card.createDiv({ cls: "task-card-meta" });
      
      // Due badge (clickable)
      if (t.due) {
        const dueBadge = metaRow.createEl("span", { 
          text: `📅 ${t.due}`, 
          cls: "task-badge task-due" 
        });
        dueBadge.addEventListener("click", async () => {
          const defaultValue = t.due ?? (this.settings.nlDateParsing ? "today" : "");
          const modal = new PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
          const next = await modal.prompt();
          if (next == null || next.trim() === "") return;
          const parsed = this.settings.nlDateParsing ? (parseNLDate(next) ?? next) : next;
          await this.updateField(t, "due", parsed);
        });
      } else {
        const dueBadge = metaRow.createEl("span", { 
          text: "📅 Set due", 
          cls: "task-badge task-due task-due-empty" 
        });
        dueBadge.addEventListener("click", async () => {
          const defaultValue = this.settings.nlDateParsing ? "today" : "";
          const modal = new PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
          const next = await modal.prompt();
          if (next == null || next.trim() === "") return;
          const parsed = this.settings.nlDateParsing ? (parseNLDate(next) ?? next) : next;
          await this.updateField(t, "due", parsed);
        });
      }

      // Priority badge (clickable dropdown)
      const prioContainer = metaRow.createDiv({ cls: "task-priority-container" });
      const prioBadge = prioContainer.createEl("span", { 
        text: t.priority ? `! ${t.priority}` : "! Set priority", 
        cls: `task-badge task-priority ${t.priority ? "" : "task-priority-empty"}` 
      });
      prioBadge.addEventListener("click", async (e) => {
        e.stopPropagation();
        // Remove any existing select
        const existing = prioContainer.querySelector(".task-priority-select");
        if (existing) existing.remove();
        
        const sel = prioContainer.createEl("select", { cls: "task-priority-select" });
        // Add "(none)" option first
        const noneOpt = sel.createEl("option", { text: "(none)" });
        noneOpt.value = "";
        if (!t.priority) noneOpt.selected = true;
        // Add priorities from settings
        this.settings.allowedPriorities.forEach(p => {
          const opt = sel.createEl("option", { text: p });
          opt.value = p;
          if (p === (t.priority || "")) opt.selected = true;
        });
        sel.addEventListener("change", async () => {
          await this.updateField(t, "priority", sel.value || undefined);
          sel.remove();
        });
        sel.addEventListener("blur", () => sel.remove());
        sel.focus();
      });

      // Recurrence badge (clickable to set/edit)
      if (t.recur) {
        const recurBadge = metaRow.createEl("span", { 
          text: `🔁 ${t.recur}`, 
          cls: "task-badge task-recur" 
        });
        recurBadge.addEventListener("click", async (e) => {
          e.stopPropagation();
          const modal = new PromptModal(this.app, "Set recurrence (e.g., 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'):", t.recur || "");
          const value = await modal.prompt();
          if (value != null) {
            await this.updateField(t, "recur", value.trim() || undefined);
          }
        });
      } else {
        const recurBadge = metaRow.createEl("span", { 
          text: "🔁 Set recurrence", 
          cls: "task-badge task-recur task-recur-empty" 
        });
        recurBadge.addEventListener("click", async (e) => {
          e.stopPropagation();
          const modal = new PromptModal(this.app, "Set recurrence (e.g., 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'):", "");
          const value = await modal.prompt();
          if (value != null) {
            await this.updateField(t, "recur", value.trim() || undefined);
          }
        });
      }

      // Area badge
      if (t.area) {
        metaRow.createEl("span", { text: t.area, cls: "task-badge task-area" });
      }

      // Project badge
      if (t.project) {
        metaRow.createEl("span", { text: t.project, cls: "task-badge task-project" });
      }

      // Tags
      t.tags.forEach(tag => {
        metaRow.createEl("span", { text: tag, cls: "task-badge task-tag" });
      });

      // Bottom row: Actions
      const actionRow = card.createDiv({ cls: "task-card-actions" });
      
      // Open Note button
      const openBtn = actionRow.createEl("button", { 
        text: "Open", 
        cls: "taskwork-action-btn taskwork-action-btn-primary"
      });
      openBtn.addEventListener("click", async () => {
        await this.openTaskInNote(t);
      });

      // Move button
      const moveBtn = actionRow.createEl("button", { 
        text: "Move", 
        cls: "taskwork-action-btn"
      });
      moveBtn.addEventListener("click", async () => {
        await this.moveTask(t);
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
      
      // If we have a next occurrence, add it after the current task
      if (nextOccurrenceTask) {
        const nextOccurrenceLines = formatTaskWithDescription(nextOccurrenceTask);
        updatedLines.push("", ...nextOccurrenceLines);
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
    const currentText = titleEl.textContent || "";
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

    const finishEditing = async () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentText) {
        await this.updateTitle(t, newTitle);
      } else {
        // Restore original if cancelled or empty
        const newTitleEl = document.createElement("div");
        newTitleEl.textContent = currentText;
        newTitleEl.className = "task-title";
        newTitleEl.style.cursor = "pointer";
        newTitleEl.addEventListener("click", () => {
          this.startEditingTitle(newTitleEl, t);
        });
        input.replaceWith(newTitleEl);
      }
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await finishEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        const newTitleEl = document.createElement("div");
        newTitleEl.textContent = currentText;
        newTitleEl.className = "task-title";
        newTitleEl.style.cursor = "pointer";
        newTitleEl.addEventListener("click", () => {
          this.startEditingTitle(newTitleEl, t);
        });
        input.replaceWith(newTitleEl);
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
   * Triggers a re-render of the task list.
   */
  private rerender() {
    const listEl = this.container.find(".taskwork-list") as HTMLElement;
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
      .filter(f => isInTasksFolder(f.path, this.settings));

    const target = await new FilePickerModal(this.app, files).openAndGet();
    if (!target) return;

    // Infer new area and project from target file
    const newArea = inferAreaFromPath(target.path, this.settings);
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

    new Notice(`TaskWork: Moved task to ${target.path}`);
    await this.reindex();
    this.rerender();
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
}

/**
 * Modal for picking a file from a list of suggestions.
 */
class FilePickerModal extends SuggestModal<TFile> {
  files: TFile[];
  result: TFile | null = null;

  /**
   * Creates a new file picker modal.
   * @param app - Obsidian app instance
   * @param files - List of files to choose from
   */
  constructor(app: App, files: TFile[]) {
    super(app);
    this.files = files;
  }

  /**
   * Filters files based on query string.
   * @param query - Search query
   * @returns Filtered list of files
   */
  getSuggestions(query: string): TFile[] {
    return this.files.filter(f => 
      f.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Renders a file suggestion in the list.
   * @param f - The file to render
   * @param el - The element to render into
   */
  renderSuggestion(f: TFile, el: HTMLElement) {
    el.setText(f.path);
  }

  /**
   * Called when a file is chosen from the list.
   * @param f - The chosen file
   */
  onChooseSuggestion(f: TFile) {
    this.result = f;
    this.close();
  }

  /**
   * Opens the modal and returns the selected file.
   * @returns Selected file or null if cancelled
   */
  async openAndGet(): Promise<TFile | null> {
    return new Promise((resolve) => {
      this.onClose = () => resolve(this.result);
      this.open();
    });
  }
}
