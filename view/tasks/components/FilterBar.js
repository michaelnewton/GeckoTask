"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFilterBar = renderFilterBar;
const areaUtils_1 = require("../../../utils/areaUtils");
/**
 * Renders the filter UI controls.
 * @param host - Container element to render into
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param currentTab - Current active tab
 * @param filters - Current filter state
 * @param projectPaths - Array of project file paths
 * @param onFilterChange - Callback when any filter changes
 * @param onProjectPathsUpdate - Callback to update project paths
 */
function renderFilterBar(host, app, settings, currentTab, filters, projectPaths, onFilterChange, onProjectPathsUpdate) {
    // Preserve focus state before emptying
    const activeElement = document.activeElement;
    const wasSearchFocused = activeElement?.classList.contains("filter-search");
    const cursorPosition = wasSearchFocused ? activeElement.selectionStart : null;
    host.empty();
    host.addClass("geckotask-filters-compact");
    // For "Today" tab, hide the due filter since it's implicit
    const showDueFilter = currentTab === "all";
    // First row: Search (full width)
    const searchRow = host.createDiv({ cls: "filter-row" });
    const searchInput = searchRow.createEl("input", {
        type: "text",
        placeholder: "Search tasks or #tags",
        cls: "filter-search"
    });
    searchInput.value = filters.query;
    searchInput.addEventListener("input", (e) => {
        onFilterChange({
            ...filters,
            query: e.target.value
        });
    });
    // Restore focus and cursor position if search input was focused
    if (wasSearchFocused && cursorPosition !== null) {
        // Use requestAnimationFrame to ensure DOM is ready before restoring focus
        requestAnimationFrame(() => {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
        });
    }
    // Second row: Compact filter buttons
    const filterRow = host.createDiv({ cls: "filter-row filter-buttons" });
    // Area dropdown (only show if areas are configured)
    const areas = (0, areaUtils_1.getAreas)(app, settings);
    if (areas.length > 0) {
        const areaContainer = filterRow.createDiv({ cls: "filter-item" });
        areaContainer.createEl("label", { text: "Area:", cls: "filter-label" });
        const areaSelect = areaContainer.createEl("select", { cls: "filter-select" });
        // Add "All" option
        const allOpt = areaSelect.createEl("option", { text: "All" });
        allOpt.value = "All";
        if (filters.area === "All")
            allOpt.selected = true;
        // Add detected areas
        areas.forEach(a => {
            const opt = areaSelect.createEl("option", { text: a });
            opt.value = a;
            if (a === filters.area)
                opt.selected = true;
        });
        areaSelect.addEventListener("change", (e) => {
            onFilterChange({
                ...filters,
                area: e.target.value
            });
        });
    }
    // Priority dropdown
    const prioContainer = filterRow.createDiv({ cls: "filter-item" });
    prioContainer.createEl("label", { text: "Priority:", cls: "filter-label" });
    const prioSelect = prioContainer.createEl("select", { cls: "filter-select" });
    // Add "Any" option first
    const anyOpt = prioSelect.createEl("option", { text: "Any" });
    anyOpt.value = "Any";
    if (filters.priority === "Any")
        anyOpt.selected = true;
    // Add priorities from settings
    settings.allowedPriorities.forEach(p => {
        const opt = prioSelect.createEl("option", { text: p });
        opt.value = p;
        if (p === filters.priority)
            opt.selected = true;
    });
    prioSelect.addEventListener("change", (e) => {
        onFilterChange({
            ...filters,
            priority: e.target.value
        });
    });
    // Due dropdown (only show for "All Tasks" tab)
    if (showDueFilter) {
        const dueContainer = filterRow.createDiv({ cls: "filter-item" });
        dueContainer.createEl("label", { text: "Due:", cls: "filter-label" });
        const dueSelect = dueContainer.createEl("select", { cls: "filter-select" });
        // Fixed options
        const dueOpts = [
            ["Any", "any"],
            ["Today", "today"],
            ["Overdue", "overdue"],
            ["None", "nodue"]
        ];
        // Add configurable day ranges from settings
        settings.dueDateRanges.forEach(range => {
            // Validate format (e.g., "7d", "14d", "30d")
            if (/^\d+d$/.test(range)) {
                dueOpts.push([range, range]);
            }
        });
        // Add relative periods
        dueOpts.push(["This week", "this-week"], ["Next week", "next-week"], ["This month", "this-month"], ["Next month", "next-month"]);
        dueOpts.forEach(([label, val]) => {
            const opt = dueSelect.createEl("option", { text: label });
            opt.value = val;
            if (val === filters.due)
                opt.selected = true;
        });
        dueSelect.addEventListener("change", (e) => {
            onFilterChange({
                ...filters,
                due: e.target.value
            });
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
        // Get sorted project files (Inbox first, then areas alphabetically)
        const sortedFiles = (0, areaUtils_1.getSortedProjectFiles)(app, settings);
        // Update the stored projectPaths
        const newProjectPaths = sortedFiles.map(f => f.path);
        onProjectPathsUpdate(newProjectPaths);
        // Clear and rebuild dropdown options
        const currentValue = projSelect.value;
        projSelect.empty();
        // Add "Any" option first
        const anyProjOpt = projSelect.createEl("option", { text: "Any" });
        anyProjOpt.value = "Any";
        // Add project files (inbox first, then others), excluding tasks folder file
        newProjectPaths
            .filter(path => !(0, areaUtils_1.isTasksFolderFile)(path, settings))
            .forEach(path => {
            const opt = projSelect.createEl("option", { text: (0, areaUtils_1.getProjectDisplayName)(path, app, settings) });
            opt.value = path;
        });
        // Restore the selected value if it still exists, otherwise use "Any"
        if (currentValue === "Any") {
            projSelect.value = "Any";
        }
        else if (newProjectPaths.includes(currentValue)) {
            projSelect.value = currentValue;
        }
        else {
            projSelect.value = "Any";
            onFilterChange({
                ...filters,
                project: "Any"
            });
        }
    };
    // Add "Any" option first
    const anyProjOpt = projSelect.createEl("option", { text: "Any" });
    anyProjOpt.value = "Any";
    if (filters.project === "Any")
        anyProjOpt.selected = true;
    // Add project files (inbox first, then others), excluding tasks folder file
    projectPaths
        .filter(path => !(0, areaUtils_1.isTasksFolderFile)(path, settings))
        .forEach(path => {
        const opt = projSelect.createEl("option", { text: (0, areaUtils_1.getProjectDisplayName)(path, app, settings) });
        opt.value = path;
        // Match by path
        if (path === filters.project) {
            opt.selected = true;
        }
    });
    projSelect.addEventListener("change", (e) => {
        const selectedValue = e.target.value;
        // Store the file path in the filter
        onFilterChange({
            ...filters,
            project: selectedValue
        });
    });
    // Refresh options when dropdown is clicked/focused
    projSelect.addEventListener("mousedown", refreshProjectOptions);
    projSelect.addEventListener("focus", refreshProjectOptions);
}
