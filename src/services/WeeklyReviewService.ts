import { App, TFile, TFolder } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";
import { ProjectReviewInfo } from "../view/weekly-review/WeeklyReviewPanelTypes";
import {
  isInAnyArea,
  isInInboxFolder,
  inferAreaFromPath,
  isAreaTasksFile,
  isSomedayMaybeFile,
  getAreas,
  getSortedProjectFiles,
  getProjectsPath,
  getProjectTasksFilePath,
  inferProjectFromPath,
  getInboxFolderPath
} from "../utils/areaUtils";
import { loadTasksFromFile } from "../utils/taskUtils";
import { formatISODate, add } from "../utils/dateUtils";

/**
 * Fetches all uncompleted tasks from the Inbox folder.
 */
export async function fetchInboxTasks(app: App, settings: GeckoTaskSettings): Promise<IndexedTask[]> {
  const inboxFolder = getInboxFolderPath(settings);
  const folder = app.vault.getAbstractFileByPath(inboxFolder);
  if (!(folder instanceof TFolder)) {
    return [];
  }

  const allFiles = app.vault.getMarkdownFiles();
  const inboxFiles = allFiles.filter(f => isInInboxFolder(f.path, settings));

  const tasks: IndexedTask[] = [];
  for (const file of inboxFiles) {
    const fileTasks = await loadTasksFromFile(app, file, settings);
    tasks.push(...fileTasks);
  }
  return tasks;
}

/**
 * Fetches all tasks with a specific tag.
 */
export async function fetchTasksByTag(
  app: App,
  settings: GeckoTaskSettings,
  tag: string
): Promise<IndexedTask[]> {
  const sortedFiles = getSortedProjectFiles(app, settings);

  const tasks: IndexedTask[] = [];
  const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;

  for (const file of sortedFiles) {
    const fileTasks = await loadTasksFromFile(app, file, settings);
    const taggedTasks = fileTasks.filter(t => t.tags.includes(normalizedTag));
    tasks.push(...taggedTasks);
  }

  return tasks;
}

/**
 * Fetches all tasks from Someday/Maybe files (area and project level).
 */
export async function fetchSomedayMaybeTasks(
  app: App,
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const tasks: IndexedTask[] = [];
  const allFiles = app.vault.getMarkdownFiles();

  // Find all someday/maybe files
  const smFiles = allFiles.filter(f => isSomedayMaybeFile(f.path, settings));

  for (const file of smFiles) {
    const fileTasks = await loadTasksFromFile(app, file, settings);
    tasks.push(...fileTasks);
  }

  return tasks;
}

/**
 * Fetches all project files from Someday/Maybe.
 */
export async function fetchSomedayMaybeProjects(
  app: App,
  settings: GeckoTaskSettings
): Promise<ProjectReviewInfo[]> {
  const projects: ProjectReviewInfo[] = [];
  const allFiles = app.vault.getMarkdownFiles();

  // Find all someday/maybe files
  const smFiles = allFiles.filter(f => isSomedayMaybeFile(f.path, settings));

  for (const file of smFiles) {
    const path = file.path;
    const area = inferAreaFromPath(path, app, settings);
    if (!area) continue;

    const projectInfo = inferProjectFromPath(path, settings);
    const projectName = projectInfo?.project || file.basename;

    const tasks = await loadTasksFromFile(app, file, settings);
    const uncompletedTasks = tasks.filter(t => !t.checked);
    const hasNextAction = uncompletedTasks.length > 0;

    projects.push({
      path,
      name: projectName,
      area,
      tasks: uncompletedTasks,
      hasNextAction
    });
  }

  projects.sort((a, b) => {
    const areaA = a.area || "";
    const areaB = b.area || "";
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return a.name.localeCompare(b.name);
  });

  return projects;
}

/**
 * Fetches all actionable tasks matching the same logic as the Tasks Panel's "next-actions" tab.
 */
export async function fetchNextActions(
  app: App,
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const sortedFiles = getSortedProjectFiles(app, settings);
  const allTasks: IndexedTask[] = [];

  for (const file of sortedFiles) {
    const fileTasks = await loadTasksFromFile(app, file, settings);
    allTasks.push(...fileTasks);
  }

  const allUncompletedTasks = allTasks.filter(t => !t.checked);
  const singleActionTasks: IndexedTask[] = [];
  const projectFirstTasks: IndexedTask[] = [];

  const today = formatISODate(new Date());
  const endDate = add(settings.nextActionsDueDays, "days", today);
  const waitingForTag = settings.waitingForTag;

  // Group by file
  const tasksByFile = new Map<string, IndexedTask[]>();
  for (const task of allUncompletedTasks) {
    if (!tasksByFile.has(task.path)) {
      tasksByFile.set(task.path, []);
    }
    tasksByFile.get(task.path)!.push(task);
  }

  // Get all tasks from area task files (single action equivalent)
  for (const [filePath, fileTasks] of tasksByFile.entries()) {
    if (isAreaTasksFile(filePath, settings) && isInAnyArea(filePath, settings)) {
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
      if (fileTasks.length > 0) {
        const sortedTasks = [...fileTasks].sort((a, b) => a.line - b.line);
        const firstTask = sortedTasks[0];

        if (firstTask.tags.includes(waitingForTag)) continue;
        if (firstTask.scheduled && firstTask.scheduled > today) continue;

        projectFirstTasks.push(firstTask);
      }
    }
  }

  return [...singleActionTasks, ...projectFirstTasks];
}

/**
 * Fetches all project files with their tasks.
 */
export async function fetchProjectsWithTasks(
  app: App,
  settings: GeckoTaskSettings
): Promise<ProjectReviewInfo[]> {
  const projects: ProjectReviewInfo[] = [];
  const areas = getAreas(app, settings);

  for (const area of areas) {
    const projectsPath = getProjectsPath(area, settings);
    const projectsFolder = app.vault.getAbstractFileByPath(projectsPath);
    if (!(projectsFolder instanceof TFolder)) continue;

    const projectDirs = projectsFolder.children
      .filter((c): c is TFolder => c instanceof TFolder)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const projectDir of projectDirs) {
      const taskFilePath = getProjectTasksFilePath(area, projectDir.name, settings);
      const taskFile = app.vault.getAbstractFileByPath(taskFilePath);
      if (!(taskFile instanceof TFile)) continue;

      const tasks = await loadTasksFromFile(app, taskFile, settings);
      const uncompletedTasks = tasks.filter(t => !t.checked);
      const hasNextAction = uncompletedTasks.length > 0;

      projects.push({
        path: taskFilePath,
        name: projectDir.name,
        area,
        tasks: uncompletedTasks,
        hasNextAction
      });
    }
  }

  projects.sort((a, b) => {
    const areaA = a.area || "";
    const areaB = b.area || "";
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return a.name.localeCompare(b.name);
  });

  return projects;
}
