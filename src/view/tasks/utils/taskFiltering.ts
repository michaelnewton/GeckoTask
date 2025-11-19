import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { TabType, FilterState, IndexedTask } from "../TasksPanelTypes";
import { formatISODate, startOf, endOf, add } from "../../../utils/dateUtils";
import { isInTasksFolder, isSpecialFile, normalizeInboxPath, getSortedProjectFiles } from "../../../utils/areaUtils";
import { isInSomedayMaybeFolder } from "../../../utils/somedayMaybeUtils";

/**
 * Filters tasks based on tab type and filter state.
 * @param tasks - All tasks to filter
 * @param currentTab - Current active tab
 * @param filters - Filter state
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Filtered tasks
 */
export function filterTasks(
  tasks: IndexedTask[],
  currentTab: TabType,
  filters: FilterState,
  app: App,
  settings: GeckoTaskSettings
): IndexedTask[] {
  // Start with open tasks only
  let rows = tasks.filter(t => !t.checked);
  const today = formatISODate(new Date());
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  
  // Apply tab-specific filtering
  if (currentTab === "today-overdue") {
    // Show tasks due today or overdue, OR tasks with the "now" tag, OR tasks scheduled for today or in the past
    const nowTag = settings.nowTag;
    rows = rows.filter(t => {
      const hasNowTag = t.tags.includes(nowTag);
      const isDueTodayOrOverdue = t.due && (t.due === today || t.due < today);
      const isScheduledTodayOrPast = t.scheduled && (t.scheduled === today || t.scheduled < today);
      return hasNowTag || isDueTodayOrOverdue || isScheduledTodayOrPast;
    });
  } else if (currentTab === "inbox") {
    // Show only tasks from the inbox file
    rows = rows.filter(t => t.path === normalizedInboxPath);
  } else if (currentTab === "waiting-for") {
    // Show only tasks with the WaitingFor tag
    const waitingForTag = settings.waitingForTag;
    rows = rows.filter(t => t.tags.includes(waitingForTag));
  } else if (currentTab === "next-actions") {
    // Show all Single Action tasks and first uncompleted task from each project file
    // Use all uncompleted tasks (not filtered rows) to build the map
    const allUncompletedTasks = tasks.filter(t => !t.checked);
    const singleActionTasks: IndexedTask[] = [];
    const projectFirstTasks: IndexedTask[] = [];
    
    // Calculate due date window
    const endDate = add(settings.nextActionsDueDays, "days", today);
    const waitingForTag = settings.waitingForTag;
    
    // Group all uncompleted tasks by file path first
    const tasksByFile = new Map<string, IndexedTask[]>();
    for (const task of allUncompletedTasks) {
      if (!tasksByFile.has(task.path)) {
        tasksByFile.set(task.path, []);
      }
      tasksByFile.get(task.path)!.push(task);
    }
    
    // Get ALL tasks from ALL Single Action files
    // Iterate through the tasksByFile map to find Single Action files
    for (const [filePath, fileTasks] of tasksByFile.entries()) {
      // Check if this file is a Single Action file (but not the inbox)
      if (isSpecialFile(filePath, settings) && 
          filePath !== normalizedInboxPath &&
          isInTasksFolder(filePath, settings)) {
        // Filter out tasks with waiting tag and filter by due date window (only for single actions)
        const filteredTasks = fileTasks.filter(t => {
          // Exclude single action tasks with waiting tag
          if (t.tags.includes(waitingForTag)) return false;
          // For single action items, include if no due date OR due date is within the next X days
          return !t.due || (t.due >= today && t.due <= endDate);
        });
        singleActionTasks.push(...filteredTasks);
      }
    }
    
    // Get first uncompleted task from each project file
    // Exclude project files in someday/maybe folders
    const projectFiles = getSortedProjectFiles(app, settings)
      .filter(f => {
        // Exclude Inbox and Single Action files
        if (isSpecialFile(f.path, settings)) return false;
        // Exclude project files in someday/maybe folders
        if (isInSomedayMaybeFolder(f.path, settings, app)) return false;
        return true;
      });
    
    // For each project file, get the first uncompleted task (sorted by line number)
    for (const projectFile of projectFiles) {
      const fileTasks = tasksByFile.get(projectFile.path) || [];
      if (fileTasks.length > 0) {
        // Filter out tasks in someday/maybe folders
        const filteredTasks = fileTasks.filter(t => {
          // Exclude tasks from files in someday/maybe folders
          if (isInSomedayMaybeFolder(t.path, settings, app)) return false;
          return true;
        });
        if (filteredTasks.length > 0) {
          // Sort by line number and take the first one
          const sortedTasks = [...filteredTasks].sort((a, b) => a.line - b.line);
          projectFirstTasks.push(sortedTasks[0]);
        }
      }
    }
    
    // Combine Single Action tasks and first project tasks
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
      // Configurable day range (e.g., "7d", "14d", "30d")
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
  if (filters.area !== "All") rows = rows.filter(t => (t.area || "") === filters.area);
  if (filters.project !== "Any") {
    // Filter by file path
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
 * @param tasks - Tasks to sort
 * @param currentTab - Current active tab
 * @param settings - Plugin settings
 * @returns Sorted tasks
 */
export function sortTasks(tasks: IndexedTask[], currentTab: TabType, settings: GeckoTaskSettings): IndexedTask[] {
  const today = formatISODate(new Date());
  
  // Priority rank based on order in settings (first = highest priority)
  const prioRank = (p?: string) => {
    if (!p) return 999;
    const idx = settings.allowedPriorities.indexOf(p);
    return idx >= 0 ? idx : 999;
  };
  
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    // For Today view: overdue, due/scheduled today, prioritized, then non-prioritized
    if (currentTab === "today-overdue") {
      const nowTag = settings.nowTag;
      const aOverdue = !!(a.due && a.due < today) || !!(a.scheduled && a.scheduled < today);
      const bOverdue = !!(b.due && b.due < today) || !!(b.scheduled && b.scheduled < today);
      const aDueToday = !!(a.due && a.due === today) || !!(a.scheduled && a.scheduled === today);
      const bDueToday = !!(b.due && b.due === today) || !!(b.scheduled && b.scheduled === today);
      const aHasNowTag = a.tags.includes(nowTag);
      const bHasNowTag = b.tags.includes(nowTag);
      // "Now" tag tasks are those with the tag but not due/scheduled today (or overdue)
      const aIsNowTagOnly = aHasNowTag && !aDueToday && !aOverdue;
      const bIsNowTagOnly = bHasNowTag && !bDueToday && !bOverdue;
      
      // Assign group numbers: 1=overdue, 2=due/scheduled today, 3=now tag only
      const getGroup = (overdue: boolean, dueToday: boolean, isNowTagOnly: boolean): number => {
        if (overdue) return 1;
        if (dueToday) return 2;
        if (isNowTagOnly) return 3;
        return 4; // Shouldn't happen in today view, but fallback
      };
      
      const aGroup = getGroup(aOverdue, aDueToday, aIsNowTagOnly);
      const bGroup = getGroup(bOverdue, bDueToday, bIsNowTagOnly);
      
      // First: sort by group (overdue < due/scheduled today < now tag only)
      if (aGroup !== bGroup) return aGroup - bGroup;
      
      // Second: within same group, prioritized tasks come before non-prioritized
      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      const aHasPriority = ap !== 999;
      const bHasPriority = bp !== 999;
      if (aHasPriority !== bHasPriority) return aHasPriority ? -1 : 1;
      
      // Third: if both have priorities, sort by priority rank (descending: urgent → high → med → low)
      if (aHasPriority && bHasPriority && ap !== bp) {
        return bp - ap;
      }
    } else if (currentTab === "next-actions") {
      // For Next Actions view: now tag → due dates → prioritized → unprioritized
      const nowTag = settings.nowTag;
      const endDate = add(settings.nextActionsDueDays, "days", today);
      const aHasNowTag = a.tags.includes(nowTag);
      const bHasNowTag = b.tags.includes(nowTag);
      
      // Group 1: Tasks with now tag (highest priority)
      if (aHasNowTag !== bHasNowTag) {
        return aHasNowTag ? -1 : 1;
      }
      
      // Group 2: Tasks due today or within next X days (without now tag)
      if (!aHasNowTag && !bHasNowTag) {
        const aDueInWindow = !!(a.due && a.due >= today && a.due <= endDate);
        const bDueInWindow = !!(b.due && b.due >= today && b.due <= endDate);
        if (aDueInWindow !== bDueInWindow) {
          return aDueInWindow ? -1 : 1;
        }
      }
      
      // Group 3: Tasks with priority (sorted by priority rank)
      // Group 4: Tasks without priority
      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      const aHasPriority = ap !== 999;
      const bHasPriority = bp !== 999;
      if (aHasPriority !== bHasPriority) {
        return aHasPriority ? -1 : 1;
      }
      
      // If both have priorities, sort by priority rank (lower index = higher priority)
      if (aHasPriority && bHasPriority && ap !== bp) {
        return ap - bp;
      }
      
      // Within same priority group, sort by due date
      const ad = a.due || "9999-12-31";
      const bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
    }
    
    // For other tabs, sort by due date first
    if (currentTab !== "today-overdue" && currentTab !== "next-actions") {
      const ad = a.due || "9999-12-31";
      const bd = b.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      
      // Then by priority
      const ap = prioRank(a.priority), bp = prioRank(b.priority);
      if (ap !== bp) return ap - bp;
    }
    
    // Then area, project, title
    if ((a.area||"") !== (b.area||"")) return (a.area||"").localeCompare(b.area||"");
    if ((a.project||"") !== (b.project||"")) return (a.project||"").localeCompare(b.project||"");
    return a.title.localeCompare(b.title);
  });
  
  return sorted;
}

