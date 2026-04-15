"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthPanel = exports.VIEW_TYPE_HEALTH = void 0;
const obsidian_1 = require("obsidian");
const HealthService_1 = require("../../services/HealthService");
const TaskTrackingService_1 = require("../../services/TaskTrackingService");
const TaskModel_1 = require("../../models/TaskModel");
const Recurrence_1 = require("../../services/Recurrence");
const NLDate_1 = require("../../services/NLDate");
const CaptureModal_1 = require("../../ui/CaptureModal");
const FilePickerModal_1 = require("../../ui/FilePickerModal");
const PromptModal_1 = require("../../ui/PromptModal");
const ConfirmationModal_1 = require("../../ui/ConfirmationModal");
const areaUtils_1 = require("../../utils/areaUtils");
const taskUtils_1 = require("../../utils/taskUtils");
const dateUtils_1 = require("../../utils/dateUtils");
/**
 * View type identifier for the Health Panel.
 */
exports.VIEW_TYPE_HEALTH = "health-view";
/**
 * Side panel view for health check functionality.
 */
class HealthPanel extends obsidian_1.ItemView {
    /**
     * Creates a new Health Panel.
     * @param leaf - Workspace leaf to attach to
     * @param settings - Plugin settings
     * @param plugin - Plugin instance for data persistence
     */
    constructor(leaf, settings, plugin) {
        super(leaf);
        this.healthReport = null;
        this.tasks = [];
        this.collapsedSections = new Set();
        this.hiddenTasks = new Set(); // Track hidden tasks by task ID
        this.settings = settings;
        this.plugin = plugin;
    }
    /**
     * Returns the view type identifier.
     * @returns View type string
     */
    getViewType() { return exports.VIEW_TYPE_HEALTH; }
    /**
     * Returns the display text for the view.
     * @returns Display text
     */
    getDisplayText() { return "Health Check"; }
    /**
     * Returns the icon name for the view.
     * @returns Icon name
     */
    getIcon() { return "activity"; }
    /**
     * Called when the view is opened. Sets up UI and loads health report.
     */
    async onOpen() {
        this.container = this.contentEl;
        this.container.empty();
        this.container.addClass("health-panel");
        // Show loading state
        this.container.createDiv({ cls: "health-loading", text: "Analyzing tasks..." });
        await this.refresh();
        // Refresh on file changes
        const debouncedRefresh = this.debounce(async () => {
            await this.refresh();
        }, 500);
        this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
        this.registerEvent(this.app.metadataCache.on("changed", debouncedRefresh));
    }
    /**
     * Called when the view is closed. Cleans up resources.
     */
    async onClose() { }
    /**
     * Refreshes the health report and re-renders the panel.
     */
    async refresh() {
        // Load all tasks
        await this.loadTasks();
        // Update task tracking
        await (0, TaskTrackingService_1.updateTaskTracking)(this.plugin, this.tasks);
        // Analyze tasks
        this.healthReport = await (0, HealthService_1.analyzeAllTasks)(this.app, this.settings, this.plugin);
        // Render the report
        this.render();
    }
    /**
     * Loads all tasks from the vault.
     */
    async loadTasks() {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => (0, areaUtils_1.isInTasksFolder)(f.path, this.settings) && !(0, areaUtils_1.isTasksFolderFile)(f.path, this.settings));
        this.tasks = await (0, taskUtils_1.loadTasksFromFiles)(this.app, files, this.settings);
    }
    /**
     * Renders the health report.
     */
    render() {
        this.container.empty();
        this.container.addClass("health-panel");
        if (!this.healthReport) {
            this.container.createDiv({ text: "No health report available" });
            return;
        }
        // Header - using same pattern as WeeklyReviewPanel
        const header = this.container.createDiv({ cls: "weekly-review-header" });
        const headerTop = header.createDiv({ cls: "geckotask-title-header" });
        headerTop.createEl("h2", { text: "Health Check" });
        const refreshBtn = headerTop.createEl("button", {
            text: "Refresh",
            cls: "geckotask-quick-add-btn"
        });
        refreshBtn.addEventListener("click", async () => {
            await this.refresh();
        });
        // Metrics summary
        this.renderMetrics(this.healthReport.metrics);
        // Health sections - using same pattern as WeeklyReviewPanel
        this.renderSection("stale-tasks", "Stale Tasks (Potential)", this.healthReport.staleTasks, (task) => this.renderStaleTask(task));
        this.renderSection("quick-wins", "Quick Wins (≤10 min)", this.healthReport.quickWins, (task) => this.renderQuickWin(task));
        this.renderSection("must-move", "Must-Move Items", this.healthReport.mustMoveItems, (task) => this.renderMustMoveItem(task));
        this.renderSection("oversized", "Oversized Tasks", this.healthReport.oversizedTasks, (task) => this.renderOversizedTask(task));
        this.renderSection("breakdown", "Tasks Needing Breakdown", this.healthReport.tasksNeedingBreakdown, (task) => this.renderBreakdownTask(task));
        this.renderSection("recurring", "Recurring Task Issues", this.healthReport.recurringIssues, (issue) => this.renderRecurringIssue(issue));
        this.renderCleanupSuggestions(this.healthReport.cleanupSuggestions);
    }
    /**
     * Renders the metrics summary.
     */
    renderMetrics(metrics) {
        const metricsEl = this.container.createDiv({ cls: "weekly-review-guidance" });
        metricsEl.createEl("h4", { text: "System Health Summary" });
        const grid = metricsEl.createDiv({ cls: "health-metrics-grid" });
        this.createMetric(grid, "Total Active Tasks", String(metrics.totalActiveTasks));
        this.createMetric(grid, "Overdue Tasks", String(metrics.overdueTasks), metrics.overdueTasks > 0 ? "metric-warning" : "");
        this.createMetric(grid, "Urgent Tasks", String(metrics.urgentTasks), metrics.urgentTasks > 0 ? "metric-warning" : "");
        this.createMetric(grid, "High Priority Tasks", String(metrics.highPriorityTasks));
        this.createMetric(grid, "Tasks with No Due Date", String(metrics.tasksWithNoDueDate));
        this.createMetric(grid, "Projects with High Task Count", String(metrics.projectsWithHighTaskCount.length));
        // Tasks by area
        if (Object.keys(metrics.tasksByArea).length > 0) {
            const areaEl = metricsEl.createDiv({ cls: "health-metrics-areas" });
            areaEl.createEl("strong", { text: "Tasks by Area: " });
            const areaList = areaEl.createEl("span");
            const areaStrings = Object.entries(metrics.tasksByArea).map(([area, count]) => `${area} (${count})`);
            areaList.textContent = areaStrings.join(", ");
        }
    }
    /**
     * Creates a metric display item.
     */
    createMetric(container, label, value, warningClass = "") {
        const metric = container.createDiv({ cls: `health-metric ${warningClass}` });
        const labelEl = metric.createEl("span", { cls: "health-metric-label", text: label });
        const valueEl = metric.createEl("strong", { cls: "health-metric-value", text: value });
    }
    /**
     * Gets a unique task ID for tracking hidden tasks.
     */
    getHiddenTaskId(task) {
        return `${task.path}:${task.line}`;
    }
    /**
     * Renders a collapsible section with hide/show functionality.
     */
    renderSection(sectionId, title, items, renderItem) {
        if (items.length === 0)
            return;
        // Filter out hidden tasks
        const visibleItems = items.filter(item => !this.hiddenTasks.has(this.getHiddenTaskId(item)));
        const hiddenCount = items.length - visibleItems.length;
        const section = this.container.createDiv({ cls: "weekly-review-guidance" });
        const header = section.createDiv({ cls: "health-section-header" });
        const toggle = header.createEl("button", {
            cls: "weekly-review-btn-icon health-section-toggle"
        });
        toggle.innerHTML = this.collapsedSections.has(sectionId) ? "▶" : "▼";
        toggle.addEventListener("click", () => {
            const isCollapsed = this.collapsedSections.has(sectionId);
            if (isCollapsed) {
                this.collapsedSections.delete(sectionId);
            }
            else {
                this.collapsedSections.add(sectionId);
            }
            this.render();
        });
        header.createEl("h4", { text: `${title} (${visibleItems.length}${hiddenCount > 0 ? `, ${hiddenCount} hidden` : ""})` });
        // Add show/hide button for hidden tasks
        if (hiddenCount > 0) {
            const showHiddenBtn = header.createEl("button", {
                text: `Show ${hiddenCount} Hidden`,
                cls: "weekly-review-btn-action weekly-review-btn-small"
            });
            showHiddenBtn.style.marginLeft = "auto";
            showHiddenBtn.addEventListener("click", () => {
                // Show all hidden tasks in this section
                items.forEach(item => {
                    this.hiddenTasks.delete(this.getHiddenTaskId(item));
                });
                this.render();
            });
        }
        const content = section.createDiv({
            cls: `weekly-review-tasks-list ${this.collapsedSections.has(sectionId) ? "collapsed" : ""}`
        });
        if (!this.collapsedSections.has(sectionId)) {
            for (const item of visibleItems) {
                content.appendChild(renderItem(item));
            }
        }
    }
    /**
     * Renders a stale task.
     */
    renderStaleTask(task) {
        return this.renderTaskCard(task, {
            subtitle: `${task.daysSinceFirstSeen} days old • ${task.reason}`,
            showAge: true
        });
    }
    /**
     * Renders a quick win task.
     */
    renderQuickWin(task) {
        const subtitle = task.estimatedMinutes
            ? `~${task.estimatedMinutes} min • ${task.reason}`
            : task.reason;
        return this.renderTaskCard(task, { subtitle });
    }
    /**
     * Renders a must-move item.
     */
    renderMustMoveItem(task) {
        return this.renderTaskCard(task, { subtitle: task.reason });
    }
    /**
     * Renders an oversized task.
     */
    renderOversizedTask(task) {
        return this.renderTaskCard(task, { subtitle: task.reason });
    }
    /**
     * Renders a task needing breakdown.
     */
    renderBreakdownTask(task) {
        return this.renderBreakdownTaskCard(task);
    }
    /**
     * Renders a recurring issue.
     */
    renderRecurringIssue(issue) {
        const card = this.renderTaskCard(issue.task, { subtitle: issue.issue });
        return card;
    }
    /**
     * Renders cleanup suggestions.
     */
    renderCleanupSuggestions(suggestions) {
        if (suggestions.length === 0)
            return;
        const section = this.container.createDiv({ cls: "weekly-review-guidance" });
        const header = section.createDiv({ cls: "health-section-header" });
        const toggle = header.createEl("button", {
            cls: "weekly-review-btn-icon health-section-toggle"
        });
        toggle.innerHTML = this.collapsedSections.has("cleanup") ? "▶" : "▼";
        toggle.addEventListener("click", () => {
            const isCollapsed = this.collapsedSections.has("cleanup");
            if (isCollapsed) {
                this.collapsedSections.delete("cleanup");
            }
            else {
                this.collapsedSections.add("cleanup");
            }
            this.render();
        });
        header.createEl("h4", { text: `Cleanup Suggestions (${suggestions.length})` });
        const content = section.createDiv({
            cls: `${this.collapsedSections.has("cleanup") ? "collapsed" : ""}`
        });
        if (!this.collapsedSections.has("cleanup")) {
            for (const suggestion of suggestions) {
                const item = content.createEl("p", { text: suggestion.message });
                item.style.marginTop = "8px";
                item.style.marginBottom = "8px";
            }
        }
    }
    /**
     * Renders a task card with action buttons - using same pattern as WeeklyReviewPanel.
     */
    renderTaskCard(task, options = {}) {
        const card = this.container.createDiv({ cls: "weekly-review-task-card" });
        // Task info - using same pattern as WeeklyReviewPanel
        const taskInfo = card.createDiv({ cls: "weekly-review-task-info" });
        const taskTitle = taskInfo.createEl("div", {
            text: task.title,
            cls: "weekly-review-task-title"
        });
        taskTitle.style.cursor = "pointer";
        taskTitle.style.textDecoration = "underline";
        taskTitle.addEventListener("click", () => this.openTaskInNote(task));
        if (options.subtitle) {
            taskInfo.createEl("div", {
                text: options.subtitle,
                cls: "weekly-review-task-description"
            });
        }
        // Metadata - using same pattern as WeeklyReviewPanel
        const metadata = taskInfo.createDiv({ cls: "weekly-review-task-metadata" });
        if (task.project) {
            metadata.createEl("span", { text: task.project });
        }
        if (task.area) {
            metadata.createEl("span", { text: task.area });
        }
        if (task.due) {
            const dueText = task.due < (0, dateUtils_1.formatISODate)(new Date())
                ? `${task.due} (overdue)`
                : task.due;
            metadata.createEl("span", { text: `Due: ${dueText}` });
        }
        if (task.priority) {
            metadata.createEl("span", { text: `Priority: ${task.priority}` });
        }
        // Action buttons - using same pattern as WeeklyReviewPanel
        const actions = card.createDiv({ cls: "weekly-review-task-actions" });
        // Hide button
        const hideBtn = actions.createEl("button", { text: "Hide", cls: "weekly-review-btn-action weekly-review-btn-small" });
        hideBtn.addEventListener("click", () => {
            this.hiddenTasks.add(this.getHiddenTaskId(task));
            this.render();
        });
        const editBtn = actions.createEl("button", { text: "Edit", cls: "weekly-review-btn-action weekly-review-btn-small" });
        editBtn.addEventListener("click", async () => {
            await (0, CaptureModal_1.captureQuickTask)(this.app, this.settings, task);
            await this.refresh();
        });
        const completeBtn = actions.createEl("button", { text: "Complete", cls: "weekly-review-btn-action weekly-review-btn-small" });
        completeBtn.addEventListener("click", async () => {
            if (task.recur) {
                const confirmed = await new ConfirmationModal_1.ConfirmationModal(this.app, "Complete Recurring Task", `This task will be completed and a new occurrence will be created. Continue?`, `Task: ${task.title}`).prompt();
                if (!confirmed)
                    return;
            }
            await this.completeTask(task);
            await this.refresh();
        });
        const moveBtn = actions.createEl("button", { text: "Move", cls: "weekly-review-btn-action weekly-review-btn-small" });
        moveBtn.addEventListener("click", async () => {
            await this.moveTask(task);
            await this.refresh();
        });
        const deleteBtn = actions.createEl("button", { text: "Delete", cls: "weekly-review-btn-action weekly-review-btn-small weekly-review-btn-danger" });
        deleteBtn.addEventListener("click", async () => {
            const confirmed = await new ConfirmationModal_1.ConfirmationModal(this.app, "Delete Task", `Are you sure you want to delete this task?`, `Task: ${task.title}`).prompt();
            if (!confirmed)
                return;
            await this.deleteTask(task);
            await this.refresh();
        });
        const dueBtn = actions.createEl("button", { text: "Set Due", cls: "weekly-review-btn-action weekly-review-btn-small" });
        dueBtn.addEventListener("click", async () => {
            await this.updateDueDate(task);
            await this.refresh();
        });
        return card;
    }
    /**
     * Renders a task card with a break down button for tasks needing breakdown.
     */
    renderBreakdownTaskCard(task) {
        const card = this.renderTaskCard(task, { subtitle: task.reason });
        // Add break down button to actions
        const actions = card.querySelector(".weekly-review-task-actions");
        if (actions) {
            const breakDownBtn = actions.createEl("button", {
                text: "Break Down",
                cls: "weekly-review-btn-action weekly-review-btn-small"
            });
            breakDownBtn.addEventListener("click", async () => {
                await this.breakDownTask(task);
                await this.refresh();
            });
        }
        // Add suggested breakdown display
        if (task.suggestedSubTasks.length > 0) {
            const breakdown = card.createDiv({ cls: "weekly-review-task-description" });
            breakdown.createEl("strong", { text: "Suggested breakdown: " });
            const list = breakdown.createEl("ul", { cls: "health-breakdown-list" });
            list.style.marginTop = "4px";
            list.style.paddingLeft = "20px";
            for (const subTask of task.suggestedSubTasks) {
                list.createEl("li", { text: subTask });
            }
        }
        return card;
    }
    /**
     * Breaks down a task into multiple sub-tasks.
     */
    async breakDownTask(task) {
        // For now, just show a notice - full breakdown modal can be added later
        new obsidian_1.Notice("Break down functionality coming soon. Use the suggested breakdown as a guide.");
    }
    /**
     * Completes a task.
     */
    async completeTask(task) {
        const file = this.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof obsidian_1.TFile))
            return;
        await this.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            const taskLineIdx = task.line - 1;
            const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
            if (taskLineIdx < 0 || taskLineIdx >= lines.length)
                return data;
            const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
            if (!parsed)
                return data;
            parsed.checked = true;
            if (!parsed.completion) {
                parsed.completion = (0, dateUtils_1.formatISODateTime)(new Date());
            }
            // Handle recurring tasks
            let nextOccurrenceTask = null;
            if (parsed.recur && parsed.recur.length > 0) {
                const today = new Date();
                const nextDates = (0, Recurrence_1.calculateNextOccurrenceDates)(parsed.recur, today, parsed);
                if (nextDates) {
                    nextOccurrenceTask = {
                        ...parsed,
                        checked: false,
                        scheduled: nextDates.scheduled,
                        due: nextDates.due,
                        completion: undefined,
                        recur: parsed.recur,
                    };
                }
            }
            const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
            if (nextOccurrenceTask) {
                const nextOccurrenceLines = (0, TaskModel_1.formatTaskWithDescription)(nextOccurrenceTask);
                updatedLines.push(...nextOccurrenceLines);
            }
            const numLinesToReplace = descEndIdx - taskLineIdx + 1;
            lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
            return lines.join("\n");
        });
        new obsidian_1.Notice("Task completed");
    }
    /**
     * Deletes a task.
     */
    async deleteTask(task) {
        const file = this.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof obsidian_1.TFile))
            return;
        await this.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            const taskLineIdx = task.line - 1;
            const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
            if (taskLineIdx < 0 || taskLineIdx >= lines.length)
                return data;
            const numLinesToRemove = descEndIdx - taskLineIdx + 1;
            lines.splice(taskLineIdx, numLinesToRemove);
            return lines.join("\n");
        });
        new obsidian_1.Notice("Task deleted");
    }
    /**
     * Moves a task to a different file.
     */
    async moveTask(task) {
        // FilePickerModal will automatically get and sort files
        const target = await new FilePickerModal_1.FilePickerModal(this.app, [], this.settings).openAndGet();
        if (!target)
            return;
        const oldTaskId = (0, TaskTrackingService_1.getTaskId)(task);
        const sourceFile = this.app.vault.getAbstractFileByPath(task.path);
        if (!(sourceFile instanceof obsidian_1.TFile))
            return;
        let taskWithDescription = null;
        await this.app.vault.process(sourceFile, (data) => {
            const lines = data.split("\n");
            const taskLineIdx = task.line - 1;
            const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
            if (taskLineIdx < 0 || taskLineIdx >= lines.length)
                return data;
            const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
            if (!parsed)
                return data;
            taskWithDescription = {
                ...parsed,
                area: undefined,
                project: undefined
            };
            const numLinesToRemove = descEndIdx - taskLineIdx + 1;
            lines.splice(taskLineIdx, numLinesToRemove);
            return lines.join("\n");
        });
        if (!taskWithDescription)
            return;
        const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(taskWithDescription);
        const targetFile = this.app.vault.getAbstractFileByPath(target.path);
        if (!(targetFile instanceof obsidian_1.TFile))
            return;
        const targetContent = await this.app.vault.read(targetFile);
        const finalLines = updatedLines.join("\n");
        const updated = targetContent.trim().length
            ? targetContent + "\n" + finalLines + "\n"
            : finalLines + "\n";
        await this.app.vault.modify(targetFile, updated);
        // Update tracking data
        const newTaskId = `${target.path}:${task.line}`;
        await (0, TaskTrackingService_1.updateTaskPath)(this.plugin, oldTaskId, newTaskId);
        new obsidian_1.Notice(`Task moved to ${target.path}`);
    }
    /**
     * Updates a task's due date.
     */
    async updateDueDate(task) {
        const defaultValue = task.due ?? "today";
        const modal = new PromptModal_1.PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
        const next = await modal.prompt();
        if (next == null || next.trim() === "")
            return;
        const parsed = (0, NLDate_1.parseNLDate)(next) ?? next;
        await this.updateField(task, "due", parsed);
    }
    /**
     * Updates a field value on a task.
     */
    async updateField(t, key, value) {
        const file = this.app.vault.getAbstractFileByPath(t.path);
        if (!(file instanceof obsidian_1.TFile))
            return;
        await this.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            const taskLineIdx = (t.line ?? 1) - 1;
            const descEndIdx = (t.descriptionEndLine ?? t.line) - 1;
            if (taskLineIdx < 0 || taskLineIdx >= lines.length)
                return data;
            const { task: parsed } = (0, TaskModel_1.parseTaskWithDescription)(lines, taskLineIdx);
            if (!parsed)
                return data;
            if (key === "due") {
                parsed.due = value;
            }
            else if (key === "priority") {
                parsed.priority = value;
            }
            else if (key === "recur") {
                parsed.recur = value;
            }
            const updatedLines = (0, TaskModel_1.formatTaskWithDescription)(parsed);
            const numLinesToReplace = descEndIdx - taskLineIdx + 1;
            lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
            return lines.join("\n");
        });
        new obsidian_1.Notice(`Task ${key} updated`);
    }
    /**
     * Opens the note containing a task and scrolls to it.
     * @param task - The indexed task to open
     */
    async openTaskInNote(task) {
        const file = this.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof obsidian_1.TFile))
            return;
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        // Scroll to the line
        const view = leaf.view;
        if (view instanceof obsidian_1.MarkdownView && view.editor) {
            const editor = view.editor;
            const line = Math.max(0, task.line - 1); // 0-based
            editor.setCursor(line, 0);
            editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
        }
    }
    /**
     * Creates a debounced version of a function.
     */
    debounce(fn, ms) {
        let h;
        return ((...args) => {
            window.clearTimeout(h);
            h = window.setTimeout(() => fn(...args), ms);
        });
    }
}
exports.HealthPanel = HealthPanel;
