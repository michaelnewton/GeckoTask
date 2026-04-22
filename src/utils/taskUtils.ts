import { App, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";
import { parseTaskWithDescriptionFromVault } from "../models/TaskModel";
import { inferAreaFromPath, inferProjectFromPath, isInInboxFolder } from "./areaUtils";

/**
 * Loads all tasks from a specific file.
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

  // Read file content directly (avoids stale metadataCache after vault.process)
  let fileContent: string;
  try {
    fileContent = await app.vault.read(file);
  } catch {
    return tasks;
  }
  const lines = fileContent.split("\n");

  // Scan for task lines by regex instead of relying on metadataCache
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(/^\s*-\s*\[[ x]\]\s+/i)) continue;

    // Parse task with description
    const { task: parsed, endLine } = parseTaskWithDescriptionFromVault(lines, i, settings);
    if (!parsed) continue;

    const raw = lines[i].trim();
    const area = inferAreaFromPath(path, app, settings);

    // Derive project from path structure
    let project: string | undefined;
    if (isInInboxFolder(path, settings)) {
      project = undefined;
    } else {
      const projectInfo = inferProjectFromPath(path, settings);
      project = projectInfo?.project ?? undefined;
    }

    tasks.push({
      path,
      line: i + 1,
      raw,
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags || [],
      area,
      project,
      priority: parsed.priority,
      due: parsed.due,
      scheduled: parsed.scheduled,
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
