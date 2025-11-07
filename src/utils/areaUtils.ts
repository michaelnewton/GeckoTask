import { TaskWorkSettings } from "../settings";

/**
 * Infers the area from a file path based on settings.
 * Returns the area name if the file is under tasksFolder/{area}/, otherwise undefined.
 */
export function inferAreaFromPath(filePath: string, settings: TaskWorkSettings): string | undefined {
  // Check if file is under tasksFolder
  if (!filePath.startsWith(settings.tasksFolder + "/")) {
    return undefined;
  }

  // Get the path relative to tasksFolder
  const relativePath = filePath.substring(settings.tasksFolder.length + 1);
  
  // Check each area to see if the file is under that area folder
  for (const area of settings.areas) {
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

