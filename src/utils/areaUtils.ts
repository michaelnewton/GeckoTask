import { App, TFolder } from "obsidian";
import { TaskWorkSettings } from "../settings";

/**
 * Gets the list of areas by detecting first-level directories in the tasks folder.
 * Returns empty array if areasEnabled is false, otherwise scans the filesystem.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of area names (sorted alphabetically)
 */
export function getAreas(app: App, settings: TaskWorkSettings): string[] {
  // If areas are disabled, return empty array
  if (!settings.areasEnabled) {
    return [];
  }

  // Get the tasks folder
  const tasksFolder = app.vault.getAbstractFileByPath(settings.tasksFolder);
  if (!tasksFolder || !(tasksFolder instanceof TFolder)) {
    return [];
  }

  // Get all first-level children that are folders
  const areas: string[] = [];
  for (const child of tasksFolder.children) {
    if (child instanceof TFolder) {
      // Filter out common non-area directories like "Archive"
      // Only include if it's a direct child folder
      if (child.path.startsWith(settings.tasksFolder + "/")) {
        const relativePath = child.path.substring(settings.tasksFolder.length + 1);
        // Check if it's a first-level directory (no slashes in relative path)
        if (!relativePath.includes("/")) {
          areas.push(child.name);
        }
      }
    }
  }

  // Sort alphabetically for consistency
  return areas.sort();
}

/**
 * Infers the area from a file path based on settings.
 * Returns the area name if the file is under tasksFolder/{area}/, otherwise undefined.
 * @param filePath - The file path to check
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Area name or undefined
 */
export function inferAreaFromPath(filePath: string, app: App, settings: TaskWorkSettings): string | undefined {
  // Check if file is under tasksFolder
  if (!filePath.startsWith(settings.tasksFolder + "/")) {
    return undefined;
  }

  // Get the path relative to tasksFolder
  const relativePath = filePath.substring(settings.tasksFolder.length + 1);
  
  // Get detected areas
  const areas = getAreas(app, settings);
  
  // Check each area to see if the file is under that area folder
  for (const area of areas) {
    if (relativePath.startsWith(area + "/")) {
      return area;
    }
  }

  return undefined;
}

/**
 * Checks if a file path is within the tasks folder structure
 */
export function isInTasksFolder(filePath: string, settings: TaskWorkSettings): boolean {
  return filePath.startsWith(settings.tasksFolder + "/");
}

/**
 * Gets the full path for an area folder
 */
export function getAreaPath(area: string, settings: TaskWorkSettings): string {
  return `${settings.tasksFolder}/${area}`;
}

/**
 * Normalizes an inbox path by ensuring it has .md extension
 * Users can enter paths without .md, but internally we need the full path
 */
export function normalizeInboxPath(path: string): string {
  if (!path) return path;
  // Remove .md if present, then add it back to ensure consistency
  const withoutExt = path.endsWith(".md") ? path.slice(0, -3) : path;
  return withoutExt + ".md";
}

/**
 * Gets the display path for inbox (without .md extension)
 */
export function getInboxDisplayPath(path: string): string {
  if (!path) return path;
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}

/**
 * Checks if a file path is a special file that shouldn't show a project name
 * (e.g., the configured inbox file or the general tasks file)
 */
export function isSpecialFile(filePath: string, settings: TaskWorkSettings): boolean {
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  // Check if this is the configured inbox file
  if (filePath === normalizedInboxPath) {
    return true;
  }
  // Check if basename matches the general tasks file
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
  return basename === settings.generalTasksFile;
}

