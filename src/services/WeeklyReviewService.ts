import { App, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTaskWithDescription, Task } from "../models/TaskModel";
import { IndexedTask } from "../view/TasksPanelTypes";
import { TaskReviewItem, ProjectReviewInfo } from "../view/WeeklyReviewPanelTypes";
import { 
  isInTasksFolder, 
  normalizeInboxPath, 
  inferAreaFromPath, 
  isSpecialFile,
  getAreaPath,
  getAreas
} from "../utils/areaUtils";

/**
 * Fetches all uncompleted tasks from the Inbox file.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from the Inbox
 */
export async function fetchInboxTasks(app: App, settings: GeckoTaskSettings): Promise<IndexedTask[]> {
  const inboxPath = normalizeInboxPath(settings.inboxPath);
  const inboxFile = app.vault.getAbstractFileByPath(inboxPath);
  
  if (!(inboxFile instanceof TFile)) {
    return [];
  }

  return await fetchTasksFromFile(app, inboxFile, settings);
}

/**
 * Fetches all tasks with a specific tag.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param tag - Tag to search for (e.g., "#WaitingFor")
 * @returns Array of indexed tasks with the tag
 */
export async function fetchTasksByTag(
  app: App, 
  settings: GeckoTaskSettings, 
  tag: string
): Promise<IndexedTask[]> {
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings));
  
  const tasks: IndexedTask[] = [];
  const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;

  for (const file of files) {
    const fileTasks = await fetchTasksFromFile(app, file, settings);
    const taggedTasks = fileTasks.filter(t => t.tags.includes(normalizedTag));
    tasks.push(...taggedTasks);
  }

  return tasks;
}

/**
 * Fetches all tasks from Someday/Maybe folders (one per area).
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from Someday/Maybe folders
 */
export async function fetchSomedayMaybeTasks(
  app: App, 
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const tasks: IndexedTask[] = [];
  const somedayMaybeFolderName = settings.somedayMaybeFolderName;

  // Check each area for a Someday Maybe folder
  const areas = getAreas(app, settings);
  for (const area of areas) {
    const somedayMaybePath = `${getAreaPath(area, settings)}/${somedayMaybeFolderName}`;
    const somedayMaybeFolder = app.vault.getAbstractFileByPath(somedayMaybePath);
    
    if (somedayMaybeFolder && somedayMaybeFolder instanceof TFile) {
      // If it's a file, read it
      const fileTasks = await fetchTasksFromFile(app, somedayMaybeFolder, settings);
      tasks.push(...fileTasks);
    } else if (somedayMaybeFolder) {
      // If it's a folder, get all markdown files in it
      const files = app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith(somedayMaybePath + "/") && f.path.endsWith(".md"));
      
      for (const file of files) {
        const fileTasks = await fetchTasksFromFile(app, file, settings);
        tasks.push(...fileTasks);
      }
    }
  }

  return tasks;
}

/**
 * Fetches all project files from Someday/Maybe folders (one per area).
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of project review information from Someday/Maybe folders
 */
export async function fetchSomedayMaybeProjects(
  app: App, 
  settings: GeckoTaskSettings
): Promise<ProjectReviewInfo[]> {
  const projects: ProjectReviewInfo[] = [];
  const somedayMaybeFolderName = settings.somedayMaybeFolderName;

  // Get all markdown files in the tasks folder
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings));
  
  for (const file of files) {
    const path = file.path;
    
    // Check if this file is in a Someday Maybe folder
    // The path should contain /{somedayMaybeFolderName}/ or end with /{somedayMaybeFolderName}.md
    const somedayMaybePattern = `/${somedayMaybeFolderName}/`;
    const somedayMaybeFilePattern = `/${somedayMaybeFolderName}.md`;
    
    const isInSomedayMaybeFolder = path.includes(somedayMaybePattern) || 
                                    path.endsWith(somedayMaybeFilePattern);
    
    if (!isInSomedayMaybeFolder) continue;
    
    // Extract area from path structure: tasks/{area}/Someday Maybe/...
    // This works even if area names in settings don't match folder names exactly
    const pathParts = path.split("/");
    if (pathParts.length < 3) continue; // Need at least tasks/{area}/...
    
    // Find the Someday Maybe folder in the path
    const somedayMaybeIndex = pathParts.findIndex(part => part === somedayMaybeFolderName);
    if (somedayMaybeIndex < 2) continue; // Should be after tasks/{area}
    
    // The area is the part right before the Someday Maybe folder
    const areaFromPath = pathParts[somedayMaybeIndex - 1];
    
    // Try to match with detected areas, or use the folder name directly
    // This allows the function to work even if area names don't match exactly
    const areas = getAreas(app, settings);
    let area: string | undefined;
    if (areas.includes(areaFromPath)) {
      area = areaFromPath;
    } else {
      // If not in detected areas, try to infer it (might work if partial match)
      area = inferAreaFromPath(path, app, settings) || areaFromPath;
    }
    
    if (!area) continue;
    
    // Check if this is a project file inside the Someday Maybe folder
    // We want files like:
    // - tasks/Home/Someday Maybe/Project.md (file directly in Someday Maybe folder)
    // - tasks/Home/Someday Maybe/ProjectFolder/Project.md (file in subfolder of Someday Maybe)
    // - tasks/Home/Someday Maybe/Someday Maybe.md (the Someday Maybe file itself)
    const isSomedayMaybeFile = pathParts.length === somedayMaybeIndex + 2 && 
                                pathParts[somedayMaybeIndex + 1] === `${somedayMaybeFolderName}.md`;
    const isProjectInSomedayMaybe = pathParts.length > somedayMaybeIndex + 1;
    
    if (!isSomedayMaybeFile && !isProjectInSomedayMaybe) continue;
    
    const tasks = await fetchTasksFromFile(app, file, settings);
    const uncompletedTasks = tasks.filter(t => !t.checked);
    const hasNextAction = uncompletedTasks.length > 0;

    projects.push({
      path: file.path,
      name: file.basename,
      area,
      tasks: uncompletedTasks,
      hasNextAction
    });
  }

  // Sort by area, then by project name
  projects.sort((a, b) => {
    const areaA = a.area || "";
    const areaB = b.area || "";
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return a.name.localeCompare(b.name);
  });

  return projects;
}

/**
 * Fetches all actionable tasks (excluding Waiting For and Someday/Maybe).
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of indexed actionable tasks
 */
export async function fetchNextActions(
  app: App, 
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings));
  
  const tasks: IndexedTask[] = [];
  const somedayMaybeFolderName = settings.somedayMaybeFolderName;
  const waitingForTag = "#WaitingFor";

  for (const file of files) {
    const path = file.path;
    
    // Skip Someday Maybe folders
    let isSomedayMaybe = false;
    const areas = getAreas(app, settings);
    for (const area of areas) {
      const somedayMaybePath = `${getAreaPath(area, settings)}/${somedayMaybeFolderName}`;
      if (path.startsWith(somedayMaybePath + "/") || path === somedayMaybePath + ".md") {
        isSomedayMaybe = true;
        break;
      }
    }
    if (isSomedayMaybe) continue;

    const fileTasks = await fetchTasksFromFile(app, file, settings);
    // Filter out completed tasks and Waiting For tasks
    const actionableTasks = fileTasks.filter(t => 
      !t.checked && !t.tags.includes(waitingForTag)
    );
    tasks.push(...actionableTasks);
  }

  return tasks;
}

/**
 * Fetches all project files with their tasks.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of project review information
 */
export async function fetchProjectsWithTasks(
  app: App, 
  settings: GeckoTaskSettings
): Promise<ProjectReviewInfo[]> {
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings));
  
  const projects: ProjectReviewInfo[] = [];
  const somedayMaybeFolderName = settings.somedayMaybeFolderName;
  const inboxPath = normalizeInboxPath(settings.inboxPath);

  for (const file of files) {
    const path = file.path;
    
    // Skip Inbox, General, and Someday Maybe folders
    if (path === inboxPath) continue;
    if (isSpecialFile(path, settings)) continue;
    
    let isSomedayMaybe = false;
    const areas = getAreas(app, settings);
    for (const area of areas) {
      const somedayMaybePath = `${getAreaPath(area, settings)}/${somedayMaybeFolderName}`;
      if (path.startsWith(somedayMaybePath + "/") || path === somedayMaybePath + ".md") {
        isSomedayMaybe = true;
        break;
      }
    }
    if (isSomedayMaybe) continue;

    const area = inferAreaFromPath(path, app, settings);
    const projectName = isSpecialFile(path, settings) ? undefined : file.basename;
    
    if (!projectName) continue; // Skip if no project name

    const tasks = await fetchTasksFromFile(app, file, settings);
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

  // Sort by area, then by project name
  projects.sort((a, b) => {
    const areaA = a.area || "";
    const areaB = b.area || "";
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return a.name.localeCompare(b.name);
  });

  return projects;
}

/**
 * Fetches all tasks from a specific file.
 * @param app - Obsidian app instance
 * @param file - File to read tasks from
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from the file
 */
async function fetchTasksFromFile(
  app: App, 
  file: TFile, 
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const path = file.path;
  const tasks: IndexedTask[] = [];

  const cache = app.metadataCache.getCache(path);
  const lists = cache?.listItems;
  if (!lists || lists.length === 0) return tasks;

  // Check if file has any tasks before reading
  const hasTasks = lists.some(li => li.task);
  if (!hasTasks) return tasks;

  // Read file content to get actual line text
  let fileContent: string;
  try {
    fileContent = await app.vault.read(file);
  } catch {
    return tasks;
  }
  const lines = fileContent.split("\n");

  for (const li of lists) {
    if (!li.task) continue;
    const lineNo = li.position?.start?.line ?? 0;
    if (lineNo < 0 || lineNo >= lines.length) continue;
    
    // Parse task with description
    const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
    if (!parsed) continue;

    const raw = lines[lineNo].trim();
    const area = inferAreaFromPath(path, app, settings);
    const project = parsed.project || (isSpecialFile(path, settings) ? undefined : file.basename);

    tasks.push({
      path,
      line: lineNo + 1,
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
      descriptionEndLine: endLine + 1
    });
  }

  return tasks;
}

