import { App, TFile } from "obsidian";
import { Plugin } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";
import {
  HealthReport,
  HealthMetrics,
  StaleTask,
  QuickWin,
  MustMoveItem,
  OversizedTask,
  TaskNeedingBreakdown,
  RecurringIssue,
  CleanupSuggestion,
  ProjectInfo,
  TaskTrackingData
} from "../view/health/HealthPanelTypes";
import {
  getTaskTracking,
  getTaskId,
  calculateTaskAge,
  calculateDaysSinceModified,
  calculateDaysSinceReviewed
} from "./TaskTrackingService";
import { isValidRecurrencePattern } from "./Recurrence";
import {
  isInTasksFolder,
  normalizeInboxPath,
  inferAreaFromPath,
  isSpecialFile,
  getAreas,
  isTasksFolderFile
} from "../utils/areaUtils";
import { parseTaskWithDescription } from "../models/TaskModel";
import { loadTasksFromFiles } from "../utils/taskUtils";
import { isInSomedayMaybeFolder } from "../utils/somedayMaybeUtils";
import { formatISODate } from "../utils/dateUtils";

/**
 * Main analysis function that processes all tasks and generates a health report.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param plugin - Plugin instance for data persistence
 * @returns Complete health report
 */
export async function analyzeAllTasks(
  app: App,
  settings: GeckoTaskSettings,
  plugin: Plugin
): Promise<HealthReport> {
  // Load all tasks
  const tasks = await loadAllTasks(app, settings);
  
  // Load tracking data
  const taskTracking = await getTaskTracking(plugin);
  
  // Get project information
  const projects = await getProjectInfo(app, settings, tasks);
  
  // Get file objects for modification dates
  const files = new Map<string, TFile>();
  for (const file of app.vault.getMarkdownFiles()) {
    if (isInTasksFolder(file.path, settings) && !isTasksFolderFile(file.path, settings)) {
      files.set(file.path, file);
    }
  }

  // Calculate metrics
  const metrics = calculateHealthMetrics(tasks, projects);

  // Identify issues
  const staleTasks = identifyStaleTasks(
    tasks,
    taskTracking,
    settings.healthCheckStaleTaskDays,
    settings.healthCheckUnmodifiedTaskDays,
    settings
  );
  
  const quickWins = identifyQuickWins(tasks, settings.healthCheckQuickWinKeywords);
  
  const mustMoveItems = identifyMustMoveItems(tasks, settings);
  
  const oversizedTasks = identifyOversizedTasks(tasks);
  
  const tasksNeedingBreakdown = identifyTasksNeedingBreakdown(
    tasks,
    settings.healthCheckBreakdownTitleLength,
    settings.healthCheckBreakdownKeywords
  );
  
  const recurringIssues = analyzeRecurringTasks(tasks);
  
  const cleanupSuggestions = generateCleanupSuggestions(
    tasks,
    projects,
    files,
    settings
  );

  return {
    metrics,
    staleTasks,
    quickWins,
    mustMoveItems,
    oversizedTasks,
    tasksNeedingBreakdown,
    recurringIssues,
    cleanupSuggestions
  };
}

/**
 * Loads all tasks from the vault.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of all indexed tasks
 */
async function loadAllTasks(app: App, settings: GeckoTaskSettings): Promise<IndexedTask[]> {
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings) && !isTasksFolderFile(f.path, settings));
  
  return await loadTasksFromFiles(app, files, settings);
}

/**
 * Gets project information for analysis.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param tasks - All tasks
 * @returns Array of project information
 */
async function getProjectInfo(
  app: App,
  settings: GeckoTaskSettings,
  tasks: IndexedTask[]
): Promise<ProjectInfo[]> {
  const projectMap = new Map<string, { path: string; name: string; area?: string; count: number; file?: TFile }>();

  for (const task of tasks) {
    if (!task.project) continue;
    
    const key = task.path;
    const existing = projectMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      const file = app.vault.getAbstractFileByPath(task.path);
      projectMap.set(key, {
        path: task.path,
        name: task.project,
        area: task.area,
        count: 1,
        file: file instanceof TFile ? file : undefined
      });
    }
  }

  return Array.from(projectMap.values()).map(p => ({
    path: p.path,
    name: p.name,
    area: p.area,
    taskCount: p.count,
    file: p.file!
  }));
}

/**
 * Calculates high-level system health metrics.
 * @param tasks - All tasks
 * @param projects - Project information
 * @returns Health metrics
 */
export function calculateHealthMetrics(
  tasks: IndexedTask[],
  projects: ProjectInfo[]
): HealthMetrics {
  const activeTasks = tasks.filter(t => !t.checked);
  const today = formatISODate(new Date());
  
  // Tasks by area
  const tasksByArea: Record<string, number> = {};
  for (const task of activeTasks) {
    const area = task.area || "Unknown";
    tasksByArea[area] = (tasksByArea[area] || 0) + 1;
  }

  // Overdue tasks
  const overdueTasks = activeTasks.filter(t => t.due && t.due < today).length;

  // Urgent and high priority tasks
  const urgentTasks = activeTasks.filter(t => t.priority === "urgent").length;
  const highPriorityTasks = activeTasks.filter(t => t.priority === "high").length;

  // Tasks with no due date
  const tasksWithNoDueDate = activeTasks.filter(t => !t.due).length;

  // Completed tasks older than threshold (using completed field)
  const completedTasks = tasks.filter(t => t.checked);
  // Note: We'd need completed date from task metadata, but for now we'll skip this
  const completedTasksOlderThanThreshold = 0; // Placeholder

  // Projects with high task count
  const highTaskCountProjects = projects.filter(p => p.taskCount > 30);

  return {
    totalActiveTasks: activeTasks.length,
    tasksByArea,
    overdueTasks,
    urgentTasks,
    highPriorityTasks,
    tasksWithNoDueDate,
    completedTasksOlderThanThreshold,
    projectsWithHighTaskCount: highTaskCountProjects.map(p => ({
      path: p.path,
      name: p.name,
      count: p.taskCount
    }))
  };
}

/**
 * Identifies stale tasks using plugin-tracked creation dates.
 * @param tasks - All tasks
 * @param taskTracking - Task tracking data
 * @param staleThreshold - Days threshold for stale tasks
 * @param unmodifiedThreshold - Days threshold for unmodified tasks
 * @returns Array of stale tasks
 */
export function identifyStaleTasks(
  tasks: IndexedTask[],
  taskTracking: TaskTrackingData,
  staleThreshold: number,
  unmodifiedThreshold: number,
  settings: GeckoTaskSettings
): StaleTask[] {
  const stale: StaleTask[] = [];
  const activeTasks = tasks.filter(t => !t.checked);

  for (const task of activeTasks) {
    // Skip tasks in Someday Maybe folders - these are intentionally deferred
    const isInSomedayMaybe = isInSomedayMaybeFolder(task.path, settings, app) ||
                             task.area === "Someday Maybe";
    if (isInSomedayMaybe) {
      continue;
    }
    const taskId = getTaskId(task);
    const age = calculateTaskAge(taskTracking, taskId);
    const daysSinceModified = calculateDaysSinceModified(taskTracking, taskId);
    const daysSinceReviewed = calculateDaysSinceReviewed(taskTracking, taskId);

    const reasons: string[] = [];

    // Check if task has no due date and is old
    if (!task.due && age !== null && age >= staleThreshold) {
      reasons.push(`No due date, ${age} days old`);
    }

    // Check if task hasn't been modified in a while
    if (daysSinceModified !== null && daysSinceModified >= unmodifiedThreshold) {
      reasons.push(`Not modified in ${daysSinceModified} days`);
    }

    // Check if task hasn't been reviewed
    if (daysSinceReviewed !== null && daysSinceReviewed >= staleThreshold) {
      reasons.push(`Not reviewed in ${daysSinceReviewed} days`);
    }

    // Check for past event projects (heuristic)
    if (task.project) {
      const projectLower = task.project.toLowerCase();
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      // Check for year references in past
      if (projectLower.includes(String(lastYear)) || 
          projectLower.includes(String(currentYear - 2))) {
        reasons.push("Project appears to be from past year");
      }
      
      // Check for quarter references
      const currentMonth = new Date().getMonth();
      if (projectLower.includes("q1") && currentMonth >= 3) {
        reasons.push("Project appears to be from past quarter");
      }
    }

    // Check for unlikely actionable keywords
    const unlikelyKeywords = ["maybe", "someday", "consider", "think about", "confirm if done", "if available"];
    const titleLower = task.title.toLowerCase();
    if (unlikelyKeywords.some(kw => titleLower.includes(kw))) {
      reasons.push("Contains unlikely actionable keywords");
    }
    
    // Check for tasks that might be completed but not marked (heuristic: "confirm if done")
    if (titleLower.includes("confirm if done") || titleLower.includes("(confirm if done)")) {
      reasons.push("Task may already be completed - needs confirmation");
    }

    if (reasons.length > 0) {
      stale.push({
        ...task,
        daysSinceFirstSeen: age || 0,
        daysSinceLastModified: daysSinceModified || 0,
        daysSinceLastReviewed: daysSinceReviewed || undefined,
        reason: reasons.join("; ")
      });
    }
  }

  return stale;
}

/**
 * Identifies quick win tasks (easy, short tasks).
 * @param tasks - All tasks
 * @param keywords - Keywords that indicate quick wins
 * @returns Array of quick win tasks
 */
export function identifyQuickWins(
  tasks: IndexedTask[],
  keywords: string[]
): QuickWin[] {
  const quickWins: QuickWin[] = [];
  const activeTasks = tasks.filter(t => !t.checked);
  const keywordsLower = keywords.map(k => k.toLowerCase());

  for (const task of activeTasks) {
    const titleLower = task.title.toLowerCase();
    const reasons: string[] = [];

    // Check for keyword matches
    for (const keyword of keywordsLower) {
      if (titleLower.includes(keyword)) {
        reasons.push(`Contains "${keyword}"`);
        break;
      }
    }

    // Estimate time based on keywords
    let estimatedMinutes: number | undefined;
    if (titleLower.includes("order") || titleLower.includes("buy")) {
      estimatedMinutes = 5; // Online ordering
    } else if (titleLower.includes("book") || titleLower.includes("appointment")) {
      estimatedMinutes = 5; // Booking/appointment
    } else if (titleLower.includes("cancel")) {
      estimatedMinutes = 3; // Cancellation
    } else if (titleLower.includes("check") || titleLower.includes("confirm")) {
      estimatedMinutes = 5; // Quick check/confirmation
    } else if (titleLower.includes("set up") && titleLower.length < 50) {
      estimatedMinutes = 10; // Simple setup
    } else if (titleLower.includes("message") || titleLower.includes("email") || titleLower.includes("reply")) {
      estimatedMinutes = 5;
    } else if (titleLower.includes("call") || /\d{2,}/.test(task.title)) {
      estimatedMinutes = 10; // Call or phone number detected
    } else if (titleLower.includes("refill") || titleLower.includes("top up")) {
      estimatedMinutes = 5; // Quick refill
    }

    if (reasons.length > 0) {
      quickWins.push({
        ...task,
        estimatedMinutes,
        reason: reasons.join("; ")
      });
    }
  }

  return quickWins;
}

/**
 * Identifies must-move items (high priority/urgent tasks).
 * @param tasks - All tasks
 * @param settings - Plugin settings
 * @returns Array of must-move items
 */
export function identifyMustMoveItems(
  tasks: IndexedTask[],
  settings: GeckoTaskSettings
): MustMoveItem[] {
  const mustMove: MustMoveItem[] = [];
  const activeTasks = tasks.filter(t => !t.checked);
  const today = getMomentNow();
  const nextWeek = today.clone().add(7, "days");
  const nextTwoWeeks = today.clone().add(14, "days");

  for (const task of activeTasks) {
    const reasons: string[] = [];

    // Check for urgent/high priority
    if (task.priority === "urgent") {
      reasons.push("Urgent priority");
    } else if (task.priority === "high") {
      reasons.push("High priority");
    }

    // Check for waiting-for tag
    if (task.tags.includes(settings.waitingForTag)) {
      reasons.push(`Tagged with ${settings.waitingForTag}`);
    }

    // Check for due date in next 7-14 days
    if (task.due) {
      const dueDate = parseMomentDate(task.due);
      if (dueDate.isAfter(today) && dueDate.isBefore(nextTwoWeeks)) {
        if (dueDate.isBefore(nextWeek)) {
          reasons.push("Due within 7 days");
        } else {
          reasons.push("Due within 14 days");
        }
      }
    }

    if (reasons.length > 0) {
      mustMove.push({
        ...task,
        reason: reasons.join("; ")
      });
    }
  }

  return mustMove;
}

/**
 * Identifies oversized tasks (looks like a whole project).
 * @param tasks - All tasks
 * @returns Array of oversized tasks
 */
export function identifyOversizedTasks(tasks: IndexedTask[]): OversizedTask[] {
  const oversized: OversizedTask[] = [];
  const activeTasks = tasks.filter(t => !t.checked);
  const oversizedKeywords = ["rewrite", "fix everything", "finish report", "complete system", "overhaul", "refactor everything", "clean out", "clean up", "organise"];

  for (const task of activeTasks) {
    const titleLower = task.title.toLowerCase();
    const reasons: string[] = [];

    for (const keyword of oversizedKeywords) {
      if (titleLower.includes(keyword)) {
        reasons.push(`Contains "${keyword}"`);
        break;
      }
    }

    if (reasons.length > 0) {
      oversized.push({
        ...task,
        reason: reasons.join("; ")
      });
    }
  }

  return oversized;
}

/**
 * Identifies tasks that need to be broken down into multiple steps.
 * @param tasks - All tasks
 * @param titleLengthThreshold - Maximum title length before flagging
 * @param keywords - Keywords that suggest multiple actions
 * @returns Array of tasks needing breakdown
 */
export function identifyTasksNeedingBreakdown(
  tasks: IndexedTask[],
  titleLengthThreshold: number,
  keywords: string[]
): TaskNeedingBreakdown[] {
  const needingBreakdown: TaskNeedingBreakdown[] = [];
  const activeTasks = tasks.filter(t => !t.checked);
  const keywordsLower = keywords.map(k => k.toLowerCase());

  for (const task of activeTasks) {
    const titleLower = task.title.toLowerCase();
    const reasons: string[] = [];
    const suggestedSubTasks: string[] = [];

    // Check for very long titles
    if (task.title.length > titleLengthThreshold) {
      reasons.push(`Title is ${task.title.length} characters (threshold: ${titleLengthThreshold})`);
    }

    // Check for multiple action verbs with conjunctions
    let hasMultipleActions = false;
    for (const keyword of keywordsLower) {
      // Match keyword as whole word, not part of another word
      const keywordPattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      if (keywordPattern.test(task.title)) {
        hasMultipleActions = true;
        reasons.push(`Contains "${keyword}" suggesting multiple actions`);
        
        // Try to suggest breakdown - split on the keyword
        const parts = task.title.split(new RegExp(`\\s+${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, "i"));
        if (parts.length > 1) {
          parts.forEach((part) => {
            const trimmed = part.trim();
            if (trimmed && !keywordsLower.includes(trimmed.toLowerCase())) {
              suggestedSubTasks.push(trimmed);
            }
          });
        }
        break;
      }
    }

    // Check for semicolons (often indicates multiple steps)
    if (task.title.includes(";")) {
      reasons.push("Contains semicolon suggesting multiple steps");
      const parts = task.title.split(";");
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) {
          suggestedSubTasks.push(trimmed);
        }
      });
    }

    // Check for multiple verbs (heuristic: look for "and" followed by another verb)
    const verbPattern = /\b(and|then|also|plus)\s+[a-z]+\s+/i;
    if (verbPattern.test(task.title) && !hasMultipleActions && !task.title.includes(";")) {
      reasons.push("Contains sequential action pattern");
      // Try to split on conjunctions
      const parts = task.title.split(/\s+(and|then|also|plus)\s+/i);
      if (parts.length > 1) {
        parts.forEach((part) => {
          const trimmed = part.trim();
          if (trimmed && !["and", "then", "also", "plus"].includes(trimmed.toLowerCase())) {
            suggestedSubTasks.push(trimmed);
          }
        });
      }
    }
    
    // Check for "Plan out" or "Organise" which often have multiple steps in description
    if ((titleLower.startsWith("plan out") || titleLower.startsWith("organise") || titleLower.startsWith("organize")) && task.description) {
      reasons.push("Planning/organizing task with description suggesting multiple steps");
      // If description has multiple lines, suggest those as sub-tasks
      const descLines = task.description.split("\n").filter(line => line.trim().length > 0);
      if (descLines.length > 1) {
        descLines.forEach(line => {
          const trimmed = line.trim();
          // Remove common prefixes like "- ", "* ", numbers, etc.
          const cleaned = trimmed.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
          if (cleaned && cleaned.length > 3) {
            suggestedSubTasks.push(cleaned);
          }
        });
      }
    }

    if (reasons.length > 0) {
      needingBreakdown.push({
        ...task,
        suggestedSubTasks: suggestedSubTasks.length > 0 ? suggestedSubTasks : [task.title],
        reason: reasons.join("; ")
      });
    }
  }

  return needingBreakdown;
}

/**
 * Analyzes recurring tasks for issues.
 * @param tasks - All tasks
 * @returns Array of recurring task issues
 */
export function analyzeRecurringTasks(tasks: IndexedTask[]): RecurringIssue[] {
  const issues: RecurringIssue[] = [];
  const activeTasks = tasks.filter(t => !t.checked);

  // Track recurring tasks by pattern and project
  const recurringByPattern = new Map<string, IndexedTask[]>();

  for (const task of activeTasks) {
    if (!task.recur) continue;

    // Check for broken syntax
    if (!isValidRecurrencePattern(task.recur)) {
      issues.push({
        task,
        issue: `Invalid recurrence pattern: "${task.recur}"`
      });
    }

    // Check for missing due date
    if (!task.due) {
      issues.push({
        task,
        issue: "Recurring task missing due date"
      });
    }

    // Track for duplicate detection
    const key = `${task.recur}:${task.project || "none"}`;
    if (!recurringByPattern.has(key)) {
      recurringByPattern.set(key, []);
    }
    recurringByPattern.get(key)!.push(task);
  }

  // Check for duplicates
  for (const [key, tasksWithPattern] of recurringByPattern.entries()) {
    if (tasksWithPattern.length > 1) {
      for (const task of tasksWithPattern) {
        issues.push({
          task,
          issue: `Duplicate recurring task (${tasksWithPattern.length} tasks with same pattern in same project)`
        });
      }
    }
  }

  return issues;
}

/**
 * Generates cleanup suggestions.
 * @param tasks - All tasks
 * @param projects - Project information
 * @param files - File objects for modification dates
 * @param settings - Plugin settings
 * @returns Array of cleanup suggestions
 */
export function generateCleanupSuggestions(
  tasks: IndexedTask[],
  projects: ProjectInfo[],
  files: Map<string, TFile>,
  settings: GeckoTaskSettings
): CleanupSuggestion[] {
  const suggestions: CleanupSuggestion[] = [];
  const activeTasks = tasks.filter(t => !t.checked);
  const today = new Date();

  // Projects with high task counts
  const highTaskCountProjects = projects.filter(p => p.taskCount > settings.healthCheckHighTaskCount);
  for (const project of highTaskCountProjects) {
    suggestions.push({
      type: "high-task-count",
      message: `Project "${project.name}" has ${project.taskCount} tasks (threshold: ${settings.healthCheckHighTaskCount})`,
      details: { project: project.name, count: project.taskCount }
    });
  }

  // Files that haven't been modified recently
  const staleFileThreshold = settings.healthCheckStaleFileDays;
  for (const [path, file] of files.entries()) {
    if (file.stat) {
      const daysSinceModified = Math.floor((today.getTime() - file.stat.mtime) / (1000 * 60 * 60 * 24));
      if (daysSinceModified >= staleFileThreshold) {
        const projectTasks = activeTasks.filter(t => t.path === path);
        if (projectTasks.length > 0) {
          suggestions.push({
            type: "stale-file",
            message: `File "${file.basename}" hasn't been modified in ${daysSinceModified} days (${projectTasks.length} active tasks)`,
            details: { path, daysSinceModified, taskCount: projectTasks.length }
          });
        }
      }
    }
  }

  // Inbox overflow
  const inboxPath = normalizeInboxPath(settings.inboxPath);
  const inboxTasks = activeTasks.filter(t => t.path === inboxPath);
  if (inboxTasks.length > settings.healthCheckInboxThreshold) {
    suggestions.push({
      type: "inbox-overflow",
      message: `Inbox has ${inboxTasks.length} untriaged items (threshold: ${settings.healthCheckInboxThreshold})`,
      details: { count: inboxTasks.length }
    });
  }

  // Area imbalance
  const tasksByArea: Record<string, number> = {};
  for (const task of activeTasks) {
    const area = task.area || "Unknown";
    tasksByArea[area] = (tasksByArea[area] || 0) + 1;
  }
  
  const areaCounts = Object.values(tasksByArea);
  if (areaCounts.length > 1) {
    const max = Math.max(...areaCounts);
    const min = Math.min(...areaCounts);
    const imbalance = max / min;
    
    if (imbalance > 5) { // One area has 5x more tasks than another
      suggestions.push({
        type: "area-imbalance",
        message: `Significant area imbalance detected (largest area has ${Math.round(imbalance)}x more tasks than smallest)`,
        details: { tasksByArea, imbalance: Math.round(imbalance) }
      });
    }
  }

  // Completed tasks that could be archived
  const completedTasks = tasks.filter(t => t.checked);
  // Note: We'd need completed dates from task metadata for this
  // For now, we'll skip this suggestion

  return suggestions;
}

