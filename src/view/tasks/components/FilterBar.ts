import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { TabType, FilterState, DueWindow } from "../TasksPanelTypes";
import { getSpaces, getProjectDisplayName, getSortedProjectFiles, isInInboxFolder } from "../../../utils/areaUtils";

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

  // Space dropdown
  const spaces = getSpaces(app, settings);
  if (spaces.length > 0) {
    const areaContainer = filterRow.createDiv({ cls: "filter-item" });
    areaContainer.createEl("label", { text: "Space:", cls: "filter-label" });
    const areaSelect = areaContainer.createEl("select", { cls: "filter-select" });
    const allOpt = areaSelect.createEl("option", { text: "All" });
    allOpt.value = "All";
    if (filters.space === "All") allOpt.selected = true;
    spaces.forEach(s => {
      const opt = areaSelect.createEl("option", { text: s });
      opt.value = s;
      if (s === filters.space) opt.selected = true;
    });
    areaSelect.addEventListener("change", (e) => {
      onFilterChange({
        ...filters,
        space: (e.target as HTMLSelectElement).value
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

  const buildProjectOptions = (paths: string[]): string[] => {
    const inboxPaths = paths.filter(path => isInInboxFolder(path, settings));
    const nonInboxPaths = paths.filter(path => !isInInboxFolder(path, settings));
    const inboxRepresentative = inboxPaths[0];
    return inboxRepresentative ? [inboxRepresentative, ...nonInboxPaths] : nonInboxPaths;
  };

  const renderProjectSelectOptions = (paths: string[]) => {
    const anyProjOpt = projSelect.createEl("option", { text: "Any" });
    anyProjOpt.value = "Any";

    paths.forEach(path => {
      const opt = projSelect.createEl("option", {
        text: isInInboxFolder(path, settings) ? "Inbox" : getProjectDisplayName(path, app, settings)
      });
      opt.value = path;
    });
  };

  const refreshProjectOptions = () => {
    const sortedFiles = getSortedProjectFiles(app, settings);
    const newProjectPaths = sortedFiles.map(f => f.path);
    onProjectPathsUpdate(newProjectPaths);
    const normalizedProjectPaths = buildProjectOptions(newProjectPaths);

    const currentValue = projSelect.value;
    projSelect.empty();
    renderProjectSelectOptions(normalizedProjectPaths);

    if (currentValue === "Any") {
      projSelect.value = "Any";
    } else if (normalizedProjectPaths.includes(currentValue)) {
      projSelect.value = currentValue;
    } else {
      projSelect.value = "Any";
      onFilterChange({
        ...filters,
        project: "Any"
      });
    }
  };

  const normalizedProjectPaths = buildProjectOptions(projectPaths);
  renderProjectSelectOptions(normalizedProjectPaths);
  if (filters.project === "Any" || !normalizedProjectPaths.includes(filters.project)) {
    projSelect.value = "Any";
  } else {
    projSelect.value = filters.project;
  }

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
