"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksPanel = exports.VIEW_TYPE_TASKS = void 0;
const obsidian_1 = require("obsidian");
const FilePickerModal_1 = require("../../ui/FilePickerModal");
const CaptureModal_1 = require("../../ui/CaptureModal");
const taskUtils_1 = require("../../utils/taskUtils");
const fileUtils_1 = require("../../utils/fileUtils");
const areaUtils_1 = require("../../utils/areaUtils");
const TabBar_1 = require("./components/TabBar");
const FilterBar_1 = require("./components/FilterBar");
const TaskItem_1 = require("./components/TaskItem");
const taskFiltering_1 = require("./utils/taskFiltering");
const taskOperations_1 = require("./utils/taskOperations");
/**
 * View type identifier for the Tasks panel.
 */
exports.VIEW_TYPE_TASKS = "tasks-view";
/**
 * Side panel view for displaying and managing tasks.
 */
class TasksPanel extends obsidian_1.ItemView {
    /**
     * Creates a new Tasks panel.
     * @param leaf - Workspace leaf to attach to
     * @param settings - Plugin settings
     */
    constructor(leaf, settings) {
        super(leaf);
        this.currentTab = "today-overdue";
        this.filters = { area: "All", project: "Any", priority: "Any", due: "any", query: "" };
        this.tasks = [];
        this.projectPaths = []; // for filter dropdown (file paths)
        this.settings = settings;
    }
    /**
     * Returns the view type identifier.
     * @returns View type string
     */
    getViewType() { return exports.VIEW_TYPE_TASKS; }
    /**
     * Returns the display text for the view.
     * @returns Display text
     */
    getDisplayText() { return "Tasks"; }
    /**
     * Returns the icon name for the view.
     * @returns Icon name
     */
    getIcon() { return "check-circle"; }
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
            await (0, CaptureModal_1.captureQuickTask)(this.app, this.settings);
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
    async onClose() { }
    /**
     * Renders the tab navigation UI.
     * @param host - Container element to render into
     */
    renderTabs(host) {
        (0, TabBar_1.renderTabBar)(host, this.currentTab, (tab) => {
            this.currentTab = tab;
            this.rerender();
        });
    }
    /**
     * Renders the filter UI controls.
     * @param host - Container element to render into
     */
    renderFilters(host) {
        (0, FilterBar_1.renderFilterBar)(host, this.app, this.settings, this.currentTab, this.filters, this.projectPaths, (filters) => {
            this.filters = filters;
            this.rerender();
        }, (paths) => {
            this.projectPaths = paths;
        });
    }
    /**
     * Reindexes all tasks in the vault and updates the task list.
     */
    async reindex() {
        const tasks = [];
        // Filter files in tasks folder (excluding tasks folder file)
        const tasksFolderFiles = (0, fileUtils_1.getTasksFolderFiles)(this.app, this.settings)
            .filter(f => !(0, areaUtils_1.isTasksFolderFile)(f.path, this.settings));
        // Load tasks from all files and collect project paths
        for (const file of tasksFolderFiles) {
            const fileTasks = await (0, taskUtils_1.loadTasksFromFile)(this.app, file, this.settings);
            tasks.push(...fileTasks);
        }
        // Get sorted project files (Inbox first, then areas alphabetically)
        const sortedFiles = (0, areaUtils_1.getSortedProjectFiles)(this.app, this.settings);
        this.projectPaths = sortedFiles.map(f => f.path);
        this.tasks = tasks;
        // re-render filters project dropdown
        const filtersHost = this.container.find(".geckotask-filters");
        if (filtersHost)
            this.renderFilters(filtersHost);
    }
    /**
     * Renders the filtered task list.
     * @param host - Container element to render into
     */
    renderList(host) {
        host.empty();
        // Filter and sort tasks
        let rows = (0, taskFiltering_1.filterTasks)(this.tasks, this.currentTab, this.filters, this.app, this.settings);
        rows = (0, taskFiltering_1.sortTasks)(rows, this.currentTab, this.settings);
        // list (card-based layout)
        const list = host.createDiv({ cls: "geckotask-rows" });
        // Show warning box for "Now" tab when there are more than 5 tasks
        if (this.currentTab === "today-overdue" && rows.length > 5) {
            const warningBox = list.createDiv({ cls: "geckotask-warning-box" });
            const warningIcon = warningBox.createSpan({ cls: "geckotask-warning-icon", text: "⚠️" });
            const warningText = warningBox.createSpan({ cls: "geckotask-warning-text" });
            warningText.setText(`You have ${rows.length} tasks. Daily review tip: Choose 3–5 key tasks as today's focus.`);
        }
        // Show empty state messages for tabs when no tasks
        if (rows.length === 0) {
            const emptyMsg = list.createDiv({ cls: "geckotask-empty-message" });
            if (this.currentTab === "today-overdue") {
                emptyMsg.setText("No tasks due today or overdue");
            }
            else if (this.currentTab === "inbox") {
                emptyMsg.setText("No tasks in inbox");
            }
            else if (this.currentTab === "waiting-for") {
                emptyMsg.setText(`No tasks with ${this.settings.waitingForTag} tag`);
            }
            else if (this.currentTab === "next-actions") {
                emptyMsg.setText("No next actions available");
            }
            // Update title with task count (0)
            if (this.titleElement) {
                this.titleElement.setText(`Tasks (0)`);
            }
            return;
        }
        // Create callbacks for task items
        const callbacks = {
            onToggle: async (task, checked) => {
                await (0, taskOperations_1.toggleTask)(this.app, task, checked);
                await this.reindex();
                this.rerender();
            },
            onUpdateField: async (task, key, value) => {
                await (0, taskOperations_1.updateTaskField)(this.app, task, key, value);
                await this.reindex();
                this.rerender();
            },
            onUpdateTitle: async (task, newTitle) => {
                await (0, taskOperations_1.updateTaskTitle)(this.app, task, newTitle);
                await this.reindex();
                this.rerender();
            },
            onMove: async (task) => {
                await this.handleMoveTask(task);
            },
            onOpen: async (task) => {
                await (0, taskOperations_1.openTaskInNote)(this.app, task);
            },
            onEdit: async (task) => {
                await (0, CaptureModal_1.captureQuickTask)(this.app, this.settings, task);
                await this.reindex();
                this.rerender();
            },
            onRerender: () => {
                this.rerender();
            }
        };
        // Render each task
        for (const task of rows) {
            (0, TaskItem_1.renderTaskItem)(list, this.app, this.settings, task, callbacks);
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
    async handleMoveTask(task) {
        try {
            // FilePickerModal will automatically get and sort files
            const modal = new FilePickerModal_1.FilePickerModal(this.app, [], this.settings);
            const target = await modal.openAndGet();
            if (!target) {
                // User cancelled - this is fine, just return
                return;
            }
            await (0, taskOperations_1.moveTask)(this.app, task, target);
            await this.reindex();
            this.rerender();
        }
        catch (error) {
            new obsidian_1.Notice(`GeckoTask: Error moving task: ${error}`);
            console.error("GeckoTask: Error moving task:", error);
        }
    }
    /**
     * Triggers a re-render of the entire panel (tabs, filters, and list).
     */
    rerender() {
        const tabsEl = this.container.find(".geckotask-tabs");
        if (tabsEl)
            this.renderTabs(tabsEl);
        const filtersEl = this.container.find(".geckotask-filters");
        if (filtersEl)
            this.renderFilters(filtersEl);
        const listEl = this.container.find(".geckotask-list");
        if (listEl)
            this.renderList(listEl);
    }
    /**
     * Creates a debounced version of a function.
     * @param fn - Function to debounce
     * @param ms - Debounce delay in milliseconds
     * @returns Debounced function
     */
    debounce(fn, ms) {
        let h;
        return ((...args) => {
            window.clearTimeout(h);
            h = window.setTimeout(() => fn(...args), ms);
        });
    }
    /**
     * Detects if the current device is a touch device (mobile/tablet).
     * @returns True if the device supports touch input
     */
    isTouchDevice() {
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
exports.TasksPanel = TasksPanel;
