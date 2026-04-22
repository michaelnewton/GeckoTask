import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { TabType, FilterState, IndexedTask } from "../TasksPanelTypes";
import { formatISODate, startOf, endOf, add } from "../../../utils/dateUtils";
import { isInAnySpace, isInInboxFolder, isAreaTasksFile, isSomedayMaybeFile, getSortedProjectFiles } from "../../../utils/areaUtils";

/**
 * Filters tasks based on tab type and filter state.
 */
export function filterTasks(
  tasks: IndexedTask[],
  currentTab: TabType,
  filters: FilterState,
  app: App,
  settings: GeckoTaskSettings
): IndexedTask[] {
  // Start with open or all tasks based on showCompletedTasks
  let rows = settings.showCompletedTasks
    ? [...tasks]
    : tasks.filter(t => !t.checked);
  const today = formatISODate(new Date());

  // Apply tab-specific filtering
  if (currentTab === "today-overdue") {
    const nowTag = settings.nowTag;
    rows = rows.filter(t => {
      const hasNowTag = t.tags.includes(nowTag);
      const isDueTodayOrOverdue = t.due && (t.due === today || t.due < today);
      const isScheduledTodayOrPast = t.scheduled && (t.scheduled === today || t.scheduled < today);
      return hasNowTag || isDueTodayOrOverdue || isScheduledTodayOrPast;
    });
  } else if (currentTab === "inbox") {
    // Show tasks from any file in the Inbox folder
    rows = rows.filter(t => isInInboxFolder(t.path, settings));
  } else if (currentTab === "waiting-for") {
    const waitingForTag = settings.waitingForTag;
    rows = rows.filter(t => t.tags.includes(waitingForTag));
  } else if (currentTab === "next-actions") {
    const allUncompletedTasks = tasks.filter(t => !t.checked);
    const singleActionTasks: IndexedTask[] = [];
    const projectFirstTasks: IndexedTask[] = [];

    const endDate = add(settings.nextActionsDueDays, "days", today);
    const waitingForTag = settings.waitingForTag;

    const tasksByFile = new Map<string, IndexedTask[]>();
    for (const task of allUncompletedTasks) {
      if (!tasksByFile.has(task.path)) {
        tasksByFile.set(task.path, []);
      }
      tasksByFile.get(task.path)!.push(task);
    }

    // Get all tasks from area task files (single action equivalent)
    for (const [filePath, fileTasks] of tasksByFile.entries()) {
      if (isAreaTasksFile(filePath, settings) && isInAnySpace(filePath, settings)) {
        const filteredTasks = fileTasks.filter(t => {
          if (t.tags.includes(waitingForTag)) return false;
          if (t.scheduled && t.scheduled > today) return false;
          return !t.due || (t.due >= today && t.due <= endDate);
        });
        singleActionTasks.push(...filteredTasks);
      }
    }

    // Get first uncompleted task from each project file
    const projectFiles = getSortedProjectFiles(app, settings)
      .filter(f => {
        if (isAreaTasksFile(f.path, settings)) return false;
        if (isInInboxFolder(f.path, settings)) return false;
        if (isSomedayMaybeFile(f.path, settings)) return false;
        return true;
      });

    for (const projectFile of projectFiles) {
      const fileTasks = tasksByFile.get(projectFile.path) || [];
      if (fileTasks.length > 0) {
        const sortedTasks = [...fileTasks].sort((a, b) => a.line - b.line);
        const firstTask = sortedTasks[0];

        if (firstTask.tags.includes(waitingForTag)) continue;
        if (firstTask.scheduled && firstTask.scheduled > today) continue;

        projectFirstTasks.push(firstTask);
      }
    }

    rows = [...singleActionTasks, ...projectFirstTasks];
  } else {
    // Apply due filter only for "All Tasks" tab
    if (filters.due === "today") {
      rows = rows.filter(t => t.due === today);
    } else if (filters.due === "overdue") {
      rows = rows.filter(t => t.due && t.due < today);
    } else if (filters.due === "nodue") {
      rows = rows.filter(t => !t.due);
    } else if (filters.due && /^\d+d$/.test(filters.due)) {
      const days = parseInt(filters.due.replace("d", ""), 10);
      if (!isNaN(days)) {
        const endDate = add(days, "days", today);
        rows = rows.filter(t => t.due && t.due >= today && t.due <= endDate);
      }
    } else if (filters.due === "this-week") {
      const weekStart = startOf("week");
      const weekEnd = endOf("week");
      rows = rows.filter(t => t.due && t.due >= weekStart && t.due <= weekEnd);
    } else if (filters.due === "next-week") {
      const nextWeekStart = startOf("week", add(1, "weeks"));
      const nextWeekEnd = endOf("week", add(1, "weeks"));
      rows = rows.filter(t => t.due && t.due >= nextWeekStart && t.due <= nextWeekEnd);
    } else if (filters.due === "this-month") {
      const monthStart = startOf("month");
      const monthEnd = endOf("month");
      rows = rows.filter(t => t.due && t.due >= monthStart && t.due <= monthEnd);
    } else if (filters.due === "next-month") {
      const nextMonthStart = startOf("month", add(1, "months"));
      const nextMonthEnd = endOf("month", add(1, "months"));
      rows = rows.filter(t => t.due && t.due >= nextMonthStart && t.due <= nextMonthEnd);
    }
  }

  // Apply other filters (common to all tabs)
  // Space filter doesn't apply to inbox tab — inbox tasks have no space
  if (filters.space !== "All" && currentTab !== "inbox") rows = rows.filter(t => (t.space || "") === filters.space);
  if (filters.project !== "Any") {
    rows = rows.filter(t => t.path === filters.project);
  }
  if (filters.priority !== "Any") {
    rows = rows.filter(t => t.priority === filters.priority);
  }
  if (filters.query.trim()) {
    const q = filters.query.toLowerCase();
    rows = rows.filter(t => `${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q));
  }

  return rows;
}

/**
 * Sorts tasks based on current tab and priority settings.
 */
export function sortTasks(tasks: IndexedTask[], currentTab: TabType, settings: GeckoTaskSettings): IndexedTask[] {
  const today = formatISODate(new Date());

  const prioRank = (p?: string) => {
    if (!p) return 999;
    const idx = settings.allowedPriorities.indexOf(p);
    return idx >= 0 ? idx : 999;
  };

  const sorted = [...tasks];
  sorted.sort((a, b) => {
    if (currentTab === "today-overdue") {
      const nowTag = settings.nowTag;
      const aOverdue = !!(a.due && a.due < today) || !!(a.scheduled && a.scheduled < today);
      const bOverdue = !!(b.due && b.due < today) || !!(b.scheduled && b.scheduled < today);
      const aDueToday = !!(a.due && a.due === today) || !!(a.scheduled && a.scheduled === today);
      const bDueToday = !!(b.due && b.due === today) || !!(b.scheduled && b.scheduled === today);
      const aHasNowTag = a.tags.includes(nowTag);
      const bHasNowTag = b.tags.includes(nowTag);
      const aIsNowTagOnly = aHasNowTag && !aDueToday && !aOverdue;
      const bIsNowTagOnly = bHasNowTag && !bDueToday && !bOverdue;

      const getGroup = (overdue: boolean, dueToday: boolean, isNowTagOnly: boolean): number => {
        if (overdue) return 1;
        if (dueToday) return 2;
        if (isNowTagOnly) return 3;
        return 4;
      };

      const aGroup = getGroup(aOverdue, aDueToday, aIsNowTagOnly);
      const bGroup = getGroup(bOverdue, bDueToday, bIsNowTagOnly);

      if (aGroup !== bGroup) return aGroup - bGroup;

      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      const aHasPriority = ap !== 999;
      const bHasPriority = bp !== 999;
      if (aHasPriority !== bHasPriority) return aHasPriority ? -1 : 1;

      if (aHasPriority && bHasPriority && ap !== bp) {
        return bp - ap;
      }
    } else if (currentTab === "next-actions") {
      const nowTag = settings.nowTag;
      const endDate = add(settings.nextActionsDueDays, "days", today);
      const aHasNowTag = a.tags.includes(nowTag);
      const bHasNowTag = b.tags.includes(nowTag);

      if (aHasNowTag !== bHasNowTag) {
        return aHasNowTag ? -1 : 1;
      }

      if (!aHasNowTag && !bHasNowTag) {
        const aDueInWindow = !!(a.due && a.due >= today && a.due <= endDate);
        const bDueInWindow = !!(b.due && b.due >= today && b.due <= endDate);
        if (aDueInWindow !== bDueInWindow) {
          return aDueInWindow ? -1 : 1;
        }
      }

      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      const aHasPriority = ap !== 999;
      const bHasPriority = bp !== 999;
      if (aHasPriority !== bHasPriority) {
        return aHasPriority ? -1 : 1;
      }

      if (aHasPriority && bHasPriority && ap !== bp) {
        return ap - bp;
      }

      const ad = a.due || "9999-12-31";
      const bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
    }

    if (currentTab !== "today-overdue" && currentTab !== "next-actions") {
      const ad = a.due || "9999-12-31";
      const bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);

      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      if (ap !== bp) return ap - bp;
    }

    if ((a.space||"") !== (b.space||"")) return (a.space||"").localeCompare(b.space||"");
    if ((a.project||"") !== (b.project||"")) return (a.project||"").localeCompare(b.project||"");
    return a.title.localeCompare(b.title);
  });

  return sorted;
}
