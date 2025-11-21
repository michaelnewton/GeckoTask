import { App, TFile, TFolder } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTask, parseTaskWithDescription, formatTaskWithDescription, Task } from "../models/TaskModel";
import { inferAreaFromPath } from "../utils/areaUtils";

/**
 * Generates the archive file path based on settings pattern and date.
 * @param settings - Plugin settings
 * @param date - Date to use for year substitution (defaults to today)
 * @returns Archive file path with YYYY replaced by year
 */
function archivePathFor(settings: GeckoTaskSettings, date = new Date()): string {
  const y = date.getFullYear();
  return settings.archivePattern.replace("YYYY", String(y));
}

/**
 * Gets the archive directory path from the archive pattern.
 * @param settings - Plugin settings
 * @returns Archive directory path (e.g., "Archive" from "Archive/Completed-YYYY.md")
 */
function archiveDirectoryFor(settings: GeckoTaskSettings): string | null {
  const archivePath = archivePathFor(settings);
  const pathParts = archivePath.split("/");
  if (pathParts.length <= 1) {
    // Archive is at root, no directory
    return null;
  }
  // Return the directory part (everything except the filename)
  return pathParts.slice(0, -1).join("/");
}

/**
 * Checks if a file path is in the archive directory or is the archive file itself.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @returns True if the file is in the archive directory or is the archive file
 */
function isArchiveFile(filePath: string, settings: GeckoTaskSettings): boolean {
  const archivePath = archivePathFor(settings);
  const archiveDir = archiveDirectoryFor(settings);
  
  // Check if this is the archive file itself
  if (filePath === archivePath) {
    return true;
  }
  
  // Check if the file is in the archive directory
  if (archiveDir && filePath.startsWith(archiveDir + "/")) {
    return true;
  }
  
  return false;
}

/**
 * Ensures the directory for the given file path exists, creating it if necessary.
 * @param app - Obsidian app instance
 * @param filePath - The file path (e.g., "Archive/Completed-2024.md")
 * @returns Promise that resolves when the directory is ensured to exist
 */
async function ensureDirectoryExists(app: App, filePath: string): Promise<void> {
  const pathParts = filePath.split("/");
  if (pathParts.length <= 1) {
    // No directory component, file is at root
    return;
  }

  // Remove the filename, keep only directory parts
  const dirPath = pathParts.slice(0, -1).join("/");
  
  // Check if directory already exists
  const existingDir = app.vault.getAbstractFileByPath(dirPath);
  if (existingDir instanceof TFolder) {
    // Directory already exists
    return;
  }

  // Create the directory (and any parent directories if needed)
  await app.vault.createFolder(dirPath);
}

/**
 * Processes lines to separate tasks into keep/move arrays based on archive criteria.
 * @param lines - All lines from the file
 * @param settings - Plugin settings
 * @param filePath - Current file path
 * @param shouldArchive - Function that determines if a completed task should be archived
 * @returns Object with keep array (lines to keep), move array (tasks to archive), and count
 */
function processTasksForArchive(
  lines: string[],
  settings: GeckoTaskSettings,
  filePath: string,
  shouldArchive: (task: Task) => boolean
): { keep: string[]; move: Array<{ task: Task; startLine: number; endLine: number }>; count: number } {
  const keep: string[] = [];
  const move: Array<{ task: Task; startLine: number; endLine: number }> = [];
  const processedLines = new Set<number>(); // Track lines we've already processed

  for (let i = 0; i < lines.length; i++) {
    // Skip lines we've already processed (description lines)
    if (processedLines.has(i)) continue;

    const { task, endLine } = parseTaskWithDescription(lines, i);
    
    // Skip tasks that are already archived (have origin_file pointing to archive)
    if (task?.origin_file && isArchiveFile(task.origin_file, settings)) {
      // Keep already-archived tasks in place
      for (let j = i; j <= endLine; j++) {
        processedLines.add(j);
        keep.push(lines[j]);
      }
      continue;
    }
    
    if (task && task.checked && task.completion && shouldArchive(task)) {
      // Mark all lines (task + description) as processed
      for (let j = i; j <= endLine; j++) {
        processedLines.add(j);
      }
      
      // Task will be moved - we'll format it later with origin metadata
      move.push({ task, startLine: i, endLine });
    } else {
      // Not a task to archive, keep all lines (task + description)
      for (let j = i; j <= endLine; j++) {
        processedLines.add(j);
        keep.push(lines[j]);
      }
    }
  }

  return { keep, move, count: move.length };
}

/**
 * Writes tasks to the archive file, ensuring the archive file exists.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param tasksToArchive - Array of tasks to archive (with origin metadata already added)
 * @returns The archive file that was written to
 */
async function writeToArchive(
  app: App,
  settings: GeckoTaskSettings,
  tasksToArchive: { task: Task; startLine: number; endLine: number }[],
  file: TFile
): Promise<TFile> {
  const archivePath = archivePathFor(settings);
  
  // Ensure the archive directory exists before creating the file
  await ensureDirectoryExists(app, archivePath);
  
  let archiveFile = app.vault.getAbstractFileByPath(archivePath) as TFile | null;
  if (!archiveFile) {
    archiveFile = await app.vault.create(archivePath, "# Completed Tasks\n\n");
  }

  // Format tasks with origin metadata and append to archive
  const taskLines: string[] = [];
  for (const item of tasksToArchive) {
    const taskWithOrigin = appendOriginToTask(item.task, file, app, settings);
    taskLines.push(...formatTaskWithDescription(taskWithOrigin));
  }

  if (taskLines.length > 0) {
    const prev = await app.vault.read(archiveFile);
    // Remove trailing newlines from existing content to avoid extra blank lines
    const normalizedPrev = prev.replace(/\n+$/, "");
    const next = normalizedPrev + "\n" + taskLines.join("\n") + "\n";
    await app.vault.modify(archiveFile, next);
  }

  return archiveFile;
}

/**
 * Archives all completed tasks from a single file.
 * @param app - Obsidian app instance
 * @param file - The file to archive tasks from
 * @param settings - Plugin settings
 * @returns Number of tasks archived
 */
export async function archiveCompletedInFile(app: App, file: TFile, settings: GeckoTaskSettings): Promise<number> {
  // Skip if this file is already in the archive directory or is the archive file itself
  if (isArchiveFile(file.path, settings)) {
    return 0;
  }
  
  const src = await app.vault.read(file);
  const lines = src.split("\n");
  
  // Archive all completed tasks (no date filter)
  const { keep, move, count } = processTasksForArchive(
    lines,
    settings,
    file.path,
    () => true // Archive all completed tasks
  );

  if (count === 0) return 0;

  // Write source (kept lines)
  await app.vault.modify(file, keep.join("\n").replace(/\n+$/,"") + "\n");

  // Append to archive file
  await writeToArchive(app, settings, move, file);

  return count;
}

/**
 * Archives all completed tasks across the vault that are older than configured days.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Total number of tasks archived
 */
export async function archiveAllCompletedInVault(app: App, settings: GeckoTaskSettings): Promise<number> {
  const files = app.vault.getMarkdownFiles();
  let total = 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.archiveOlderThanDays);

  // Ensure the archive directory exists once before processing files
  const archivePath = archivePathFor(settings);
  await ensureDirectoryExists(app, archivePath);

  for (const file of files) {
    // Skip files that are already in the archive directory or is the archive file itself
    if (isArchiveFile(file.path, settings)) {
      continue;
    }
    
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    
    // Archive completed tasks older than cutoff date
    const { keep, move, count } = processTasksForArchive(
      lines,
      settings,
      file.path,
      (task) => {
        if (!task.completion) return false;
        const dt = new Date(task.completion);
        return !isNaN(dt.getTime()) && dt <= cutoff;
      }
    );

    if (count === 0) continue;

    await app.vault.modify(file, keep.join("\n").replace(/\n+$/,"") + "\n");

    await writeToArchive(app, settings, move, file);
    total += count;
  }
  return total;
}

/**
 * Appends origin metadata fields to a task if not already present.
 * @param task - The task object
 * @param file - The file the task is from
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Task with origin metadata fields added
 */
function appendOriginToTask(task: Task, file: TFile, app: App, settings: GeckoTaskSettings): Task {
  // If origin fields already exist, return as-is to prevent duplicates.
  // Check all origin fields to be safe - if any exist, don't overwrite.
  if (task.origin_file || task.origin_project || task.origin_area) {
    return task;
  }
  
  const project = file.basename;
  const area = inferAreaFromPath(file.path, app, settings) || "";
  
  return {
    ...task,
    origin_file: file.path,
    origin_project: project,
    origin_area: area
  };
}
