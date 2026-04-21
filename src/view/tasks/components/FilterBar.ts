import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { TabType, FilterState, DueWindow } from "../TasksPanelTypes";
import { getAreas, getProjectDisplayName, getSortedProjectFiles } from "../../../utils/areaUtils";

/**
 * Renders the filter UI controls.
 */
export function renderFilterBar(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  currentTab: TabType,
  filters: FilterState,
  projectPaths: string[],
  onFilterChange: (filters: FilterState) => void,
  onProjectPathsUpdate: (paths: string[]) => void
): void {
  // Preserve focus state before emptying
  const activeElement = document.activeElement as HTMLElement;
  const wasSearchFocused = activeElement?.classList.contains("filter-search");
  const cursorPosition = wasSearchFocused ? (activeElement as HTMLInputElement).selectionStart : null;

  host.empty();
  host.addClass("geckotask-filters-compact");

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
      query: (e.target as HTMLInputElement).value
    });
  });

  if (wasSearchFocused && cursorPosition !== null) {
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  // Second row: Compact filter buttons
  const filterRow = host.createDiv({ cls: "filter-row filter-buttons" });

  // Area dropdown
  const areas = getAreas(app, settings);
  if (areas.length > 0) {
    const areaContainer = filterRow.createDiv({ cls: "filter-item" });
    areaContainer.createEl("label", { text: "Area:", cls: "filter-label" });
    const areaSelect = areaContainer.createEl("select", { cls: "filter-select" });
    const allOpt = areaSelect.createEl("option", { text: "All" });
    allOpt.value = "All";
    if (filters.area === "All") allOpt.selected = true;
    areas.forEach(a => {
      const opt = areaSelect.createEl("option", { text: a });
      opt.value = a;
      if (a === filters.area) opt.selected = true;
    });
    areaSelect.addEventListener("change", (e) => {
      onFilterChange({
        ...filters,
        area: (e.target as HTMLSelectElement).value
      });
    });
  }

  // Priority dropdown
  const prioContainer = filterRow.createDiv({ cls: "filter-item" });
  prioContainer.createEl("label", { text: "Priority:", cls: "filter-label" });
  const prioSelect = prioContainer.createEl("select", { cls: "filter-select" });
  const anyOpt = prioSelect.createEl("option", { text: "Any" });
  anyOpt.value = "Any";
  if (filters.priority === "Any") anyOpt.selected = true;
  settings.allowedPriorities.forEach(p => {
    const opt = prioSelect.createEl("option", { text: p });
    opt.value = p;
    if (p === filters.priority) opt.selected = true;
  });
  prioSelect.addEventListener("change", (e) => {
    onFilterChange({
      ...filters,
      priority: (e.target as HTMLSelectElement).value
    });
  });

  // Due dropdown (only show for "All Tasks" tab)
  if (showDueFilter) {
    const dueContainer = filterRow.createDiv({ cls: "filter-item" });
    dueContainer.createEl("label", { text: "Due:", cls: "filter-label" });
    const dueSelect = dueContainer.createEl("select", { cls: "filter-select" });

    const dueOpts: [string, DueWindow][] = [
      ["Any", "any"],
      ["Today", "today"],
      ["Overdue", "overdue"],
      ["None", "nodue"]
    ];

    settings.dueDateRanges.forEach(range => {
      if (/^\d+d$/.test(range)) {
        dueOpts.push([range, range as DueWindow]);
      }
    });

    dueOpts.push(
      ["This week", "this-week"],
      ["Next week", "next-week"],
      ["This month", "this-month"],
      ["Next month", "next-month"]
    );

    dueOpts.forEach(([label, val]) => {
      const opt = dueSelect.createEl("option", { text: label });
      opt.value = val;
      if (val === filters.due) opt.selected = true;
    });

    dueSelect.addEventListener("change", (e) => {
      onFilterChange({
        ...filters,
        due: (e.target as HTMLSelectElement).value as DueWindow
      });
    });
  }

  // Project dropdown
  const projContainer = filterRow.createDiv({ cls: "filter-item" });
  projContainer.createEl("label", { text: "Project:", cls: "filter-label" });
  const projSelect = projContainer.createEl("select", { cls: "filter-select" });

  const refreshProjectOptions = () => {
    const sortedFiles = getSortedProjectFiles(app, settings);
    const newProjectPaths = sortedFiles.map(f => f.path);
    onProjectPathsUpdate(newProjectPaths);

    const currentValue = projSelect.value;
    projSelect.empty();

    const anyProjOpt = projSelect.createEl("option", { text: "Any" });
    anyProjOpt.value = "Any";

    newProjectPaths
      .forEach(path => {
        const opt = projSelect.createEl("option", { text: getProjectDisplayName(path, app, settings) });
        opt.value = path;
      });

    if (currentValue === "Any") {
      projSelect.value = "Any";
    } else if (newProjectPaths.includes(currentValue)) {
      projSelect.value = currentValue;
    } else {
      projSelect.value = "Any";
      onFilterChange({
        ...filters,
        project: "Any"
      });
    }
  };

  const anyProjOpt = projSelect.createEl("option", { text: "Any" });
  anyProjOpt.value = "Any";
  if (filters.project === "Any") anyProjOpt.selected = true;

  projectPaths
    .forEach(path => {
      const opt = projSelect.createEl("option", { text: getProjectDisplayName(path, app, settings) });
      opt.value = path;
      if (path === filters.project) {
        opt.selected = true;
      }
    });

  projSelect.addEventListener("change", (e) => {
    const selectedValue = (e.target as HTMLSelectElement).value;
    onFilterChange({
      ...filters,
      project: selectedValue
    });
  });

  projSelect.addEventListener("mousedown", refreshProjectOptions);
  projSelect.addEventListener("focus", refreshProjectOptions);
}
