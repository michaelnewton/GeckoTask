import { App, TFile, TFolder } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTask } from "../models/TaskModel";
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
 * Archives all completed tasks from a single file.
 * @param app - Obsidian app instance
 * @param file - The file to archive tasks from
 * @param settings - Plugin settings
 * @returns Number of tasks archived
 */
export async function archiveCompletedInFile(app: App, file: TFile, settings: GeckoTaskSettings): Promise<number> {
  const src = await app.vault.read(file);
  const lines = src.split("\n");
  const keep: string[] = [];
  const move: string[] = [];

  for (const line of lines) {
    const t = parseTask(line);
    if (t?.checked && t.completed) {
      // ensure origin metadata
          const withOrigin = appendOrigin(line, file, app, settings);
          move.push(withOrigin);
    } else {
      keep.push(line);
    }
  }

  if (move.length === 0) return 0;

  // Write source (kept lines)
  await app.vault.modify(file, keep.join("\n").replace(/\n+$/,"") + "\n");

  // Append to archive file
  const archivePath = archivePathFor(settings);
  
  // Ensure the archive directory exists before creating the file
  await ensureDirectoryExists(app, archivePath);
  
  let archiveFile = app.vault.getAbstractFileByPath(archivePath) as TFile | null;
  if (!archiveFile) {
    archiveFile = await app.vault.create(archivePath, "# Completed Tasks\n\n");
  }
  const prev = await app.vault.read(archiveFile);
  const next = prev + move.join("\n") + "\n";
  await app.vault.modify(archiveFile, next);

  return move.length;
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
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    let changed = false;
    const keep: string[] = [];
    const move: string[] = [];

    for (const line of lines) {
      const t = parseTask(line);
        if (t?.checked && t.completed) {
          const dt = new Date(t.completed);
          if (!isNaN(dt.getTime()) && dt <= cutoff) {
            move.push(appendOrigin(line, file, app, settings));
            changed = true;
        } else {
          keep.push(line);
        }
      } else {
        keep.push(line);
      }
    }

    if (!changed) continue;

    await app.vault.modify(file, keep.join("\n").replace(/\n+$/,"") + "\n");

    let archiveFile = app.vault.getAbstractFileByPath(archivePath) as TFile | null;
    if (!archiveFile) archiveFile = await app.vault.create(archivePath, "# Completed Tasks\n\n");
    const prev = await app.vault.read(archiveFile);
    await app.vault.modify(archiveFile, prev + move.join("\n") + "\n");
    total += move.length;
  }
  return total;
}

/**
 * Appends origin metadata fields to a task line if not already present.
 * @param line - The task line
 * @param file - The file the task is from
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Task line with origin metadata appended
 */
function appendOrigin(line: string, file: TFile, app: App, settings: GeckoTaskSettings): string {
  // If origin fields exist, return as-is; else append.
  if (/\borigin_file::\b/.test(line)) return line;
  const project = file.basename;
  const area = inferAreaFromPath(file.path, app, settings) || "";
  const suffix = `  origin_file:: ${file.path}  origin_project:: ${project}  origin_area:: ${area}`;
  return line + suffix;
}
