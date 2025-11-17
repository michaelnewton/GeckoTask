import { App, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { IndexedTask } from "../view/TasksPanelTypes";
import { parseTaskWithDescription } from "../models/TaskModel";
import { inferAreaFromPath, isSpecialFile } from "./areaUtils";

/**
 * Loads all tasks from a specific file.
 * This is a shared utility to eliminate duplication across multiple services and views.
 * @param app - Obsidian app instance
 * @param file - File to read tasks from
 * @param settings - Plugin settings
 * @returns Array of indexed tasks from the file
 */
export async function loadTasksFromFile(
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
    // Project is derived from file basename, not stored in metadata
    const project = isSpecialFile(path, settings) ? undefined : file.basename;

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

/**
 * Loads all tasks from multiple files.
 * @param app - Obsidian app instance
 * @param files - Array of files to read tasks from
 * @param settings - Plugin settings
 * @returns Array of all indexed tasks from the files
 */
export async function loadTasksFromFiles(
  app: App,
  files: TFile[],
  settings: GeckoTaskSettings
): Promise<IndexedTask[]> {
  const allTasks: IndexedTask[] = [];
  
  for (const file of files) {
    const tasks = await loadTasksFromFile(app, file, settings);
    allTasks.push(...tasks);
  }
  
  return allTasks;
}

