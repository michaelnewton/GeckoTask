import { App, TFolder } from "obsidian";
import { GeckoTaskSettings } from "../settings";

/**
 * Gets the list of areas by detecting first-level directories in the tasks folder.
 * Returns empty array if areasEnabled is false, otherwise scans the filesystem.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of area names (sorted alphabetically)
 */
export function getAreas(app: App, settings: GeckoTaskSettings): string[] {
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
export function inferAreaFromPath(filePath: string, app: App, settings: GeckoTaskSettings): string | undefined {
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
export function isInTasksFolder(filePath: string, settings: GeckoTaskSettings): boolean {
  return filePath.startsWith(settings.tasksFolder + "/");
}

/**
 * Gets the full path for an area folder
 */
export function getAreaPath(area: string, settings: GeckoTaskSettings): string {
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
export function isSpecialFile(filePath: string, settings: GeckoTaskSettings): boolean {
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  // Check if this is the configured inbox file
  if (filePath === normalizedInboxPath) {
    return true;
  }
  // Check if basename matches the general tasks file
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
  return basename === settings.generalTasksFile;
}

/**
 * Checks if a file path matches the tasks folder name itself (e.g., tasks.md if tasksFolder is "tasks").
 * These files should be excluded from project dropdowns.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @returns True if the file matches the tasks folder name
 */
export function isTasksFolderFile(filePath: string, settings: GeckoTaskSettings): boolean {
  // Check if the file is directly in the tasks folder and matches the folder name
  // Handle both with and without .md extension
  const tasksFolderFileWithExt = `${settings.tasksFolder}/${settings.tasksFolder}.md`;
  const tasksFolderFileWithoutExt = `${settings.tasksFolder}/${settings.tasksFolder}`;
  
  // Check exact match with extension
  if (filePath === tasksFolderFileWithExt) return true;
  
  // Check if path without extension matches
  const pathWithoutExt = filePath.endsWith(".md") ? filePath.slice(0, -3) : filePath;
  if (pathWithoutExt === tasksFolderFileWithoutExt) return true;
  
  // Also check if the basename matches the tasks folder name and it's directly in the tasks folder
  const pathParts = filePath.split("/");
  if (pathParts.length === 2 && pathParts[0] === settings.tasksFolder) {
    const basename = pathParts[1].replace(/\.md$/, "");
    if (basename === settings.tasksFolder) return true;
  }
  
  return false;
}

/**
 * Gets the display name for a project path in dropdowns.
 * For General tasks files, returns the Area name instead of the file path.
 * For other files, shows the relative path from the tasks folder (e.g., "Work/Project" or just "Project").
 * Tasks folder files should never be passed to this function, but we check anyway for safety.
 * @param filePath - The file path
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Display name for the project
 */
export function getProjectDisplayName(filePath: string, app: App, settings: GeckoTaskSettings): string {
  // Safety check: if this is the tasks folder file, return empty string (shouldn't happen)
  if (isTasksFolderFile(filePath, settings)) {
    return "";
  }
  
  // Check if this is the General tasks file
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
  if (basename === settings.generalTasksFile) {
    // Return the Area name instead of the file path
    const area = inferAreaFromPath(filePath, app, settings);
    if (area) {
      return area;
    }
  }
  
  // Check if this is the inbox file
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  if (filePath === normalizedInboxPath) {
    // Show just "Inbox" for the inbox file
    return "Inbox";
  }
  
  // For other files, show the relative path from the tasks folder
  // Remove the tasks folder prefix and .md extension
  if (!filePath.startsWith(settings.tasksFolder + "/")) {
    // Fallback: just remove .md extension
    return filePath.endsWith(".md") ? filePath.slice(0, -3) : filePath;
  }
  
  // Get the relative path from tasks folder
  const relativePath = filePath.substring(settings.tasksFolder.length + 1);
  // Remove .md extension
  return relativePath.endsWith(".md") ? relativePath.slice(0, -3) : relativePath;
}

