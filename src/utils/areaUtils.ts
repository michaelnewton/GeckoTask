import { App, TFolder, TFile, normalizePath } from "obsidian";
import { GeckoTaskSettings } from "../settings";

/**
 * Returns the configured space paths from settings.
 * @param _app - Obsidian app instance (unused, kept for API compat)
 * @param settings - Plugin settings
 * @returns Array of space names (sorted alphabetically)
 */
export function getSpaces(_app: App, settings: GeckoTaskSettings): string[] {
  return [...settings.spacePaths].sort();
}

/**
 * Returns the space path (just the space name since spaces are root-level).
 */
export function getSpacePath(space: string, _settings: GeckoTaskSettings): string {
  return normalizePath(space);
}

/**
 * Checks if a file path starts with any configured space path.
 */
export function isInAnySpace(filePath: string, settings: GeckoTaskSettings): boolean {
  // Sort by length descending so longer space names match first (prevents prefix collision)
  const sorted = [...settings.spacePaths].sort((a, b) => b.length - a.length);
  return sorted.some(space =>
    filePath === space || filePath.startsWith(space + "/")
  );
}

/**
 * Infers the space from a file path by matching against configured space paths.
 */
export function inferSpaceFromPath(filePath: string, _app: App, settings: GeckoTaskSettings): string | undefined {
  // Sort by length descending so longer space names match first
  const sorted = [...settings.spacePaths].sort((a, b) => b.length - a.length);
  for (const space of sorted) {
    if (filePath === space || filePath.startsWith(space + "/")) {
      return space;
    }
  }
  return undefined;
}

/**
 * Gets the projects folder path for an area.
 * e.g., "Personal/1Projects"
 */
export function getProjectsPath(area: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.projectsSubfolder}`);
}

/**
 * Gets the area tasks folder path for an area.
 * e.g., "Personal/2Areas"
 */
export function getAreaTasksPath(area: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.areaTasksSubfolder}`);
}

/**
 * Gets the area-level tasks file path.
 * e.g., "Personal/2Areas/_tasks.md"
 */
export function getAreaTasksFilePath(area: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.areaTasksSubfolder}/${settings.tasksFileName}.md`);
}

/**
 * Gets the area-level someday/maybe file path.
 * e.g., "Personal/2Areas/_SomedayMaybe.md"
 */
export function getAreaSomedayMaybePath(area: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.areaTasksSubfolder}/${settings.somedayMaybeFileName}.md`);
}

/**
 * Gets the project tasks file path.
 * e.g., "Personal/1Projects/RouterRevamp/_tasks.md"
 */
export function getProjectTasksFilePath(area: string, project: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.projectsSubfolder}/${project}/${settings.tasksFileName}.md`);
}

/**
 * Gets the project someday/maybe file path.
 * e.g., "Personal/1Projects/RouterRevamp/_SomedayMaybe.md"
 */
export function getProjectSomedayMaybePath(area: string, project: string, settings: GeckoTaskSettings): string {
  return normalizePath(`${area}/${settings.projectsSubfolder}/${project}/${settings.somedayMaybeFileName}.md`);
}

/**
 * Gets the inbox folder path.
 * e.g., "Inbox"
 */
export function getInboxFolderPath(settings: GeckoTaskSettings): string {
  return normalizePath(settings.inboxFolderName);
}

/**
 * Checks if a file path is inside the inbox folder.
 */
export function isInInboxFolder(filePath: string, settings: GeckoTaskSettings): boolean {
  const inboxFolder = getInboxFolderPath(settings);
  return filePath === inboxFolder || filePath.startsWith(`${inboxFolder}/`);
}

/**
 * Checks if a file path is the area-level tasks file.
 * Matches: {space}/{areaTasksSubfolder}/(optional nested folders)/{tasksFileName}.md
 */
export function isAreaTasksFile(filePath: string, settings: GeckoTaskSettings): boolean {
  for (const space of settings.spacePaths) {
    if (isAreaFileForSpace(filePath, space, settings, settings.tasksFileName)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a file's basename matches the someday/maybe file name.
 */
export function isSomedayMaybeFile(filePath: string, settings: GeckoTaskSettings): boolean {
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
  return basename === settings.somedayMaybeFileName;
}

/**
 * Infers project info from a file path.
 * Returns { space, project } for project task files, { space, project: undefined } for area task files,
 * or null if not a recognized task file.
 */
export function inferProjectFromPath(filePath: string, settings: GeckoTaskSettings): { space: string; project: string | undefined } | null {
  // Check inbox
  if (isInInboxFolder(filePath, settings)) {
    return null;
  }

  // Sort by length descending so longer space names match first (prevents prefix collision)
  const sortedSpaces = [...settings.spacePaths].sort((a, b) => b.length - a.length);
  for (const space of sortedSpaces) {
    // Check area tasks file
    if (isAreaFileForSpace(filePath, space, settings, settings.tasksFileName)) {
      return { space, project: undefined };
    }

    // Check area someday/maybe
    if (isAreaFileForSpace(filePath, space, settings, settings.somedayMaybeFileName)) {
      return { space, project: undefined };
    }

    // Check project files: {area}/{projectsSubfolder}/{projectName}/{tasksFileName}.md
    const projectsPrefix = `${space}/${settings.projectsSubfolder}/`;
    if (filePath.startsWith(projectsPrefix)) {
      const relativePath = filePath.substring(projectsPrefix.length);
      const parts = relativePath.split("/");
      if (parts.length >= 2) {
        const projectName = parts[0];
        const fileName = parts[parts.length - 1];
        if (fileName === `${settings.tasksFileName}.md` || fileName === `${settings.somedayMaybeFileName}.md`) {
          return { space, project: projectName };
        }
      }
    }
  }

  return null;
}

/**
 * Gets the display name for a project/file path in dropdowns.
 */
export function getProjectDisplayName(filePath: string, app: App, settings: GeckoTaskSettings): string {
  // Inbox folder files
  if (isInInboxFolder(filePath, settings)) {
    return "Inbox";
  }

  // Area tasks file -> show area name
  for (const area of settings.spacePaths) {
    if (isAreaFileForSpace(filePath, area, settings, settings.tasksFileName)) {
      const areaSubpath = getAreaSubpathForSpace(filePath, area, settings);
      return areaSubpath ? `${area} / ${areaSubpath}` : area;
    }
  }

  // No-spaces mode fallback label for area single-action lists.
  if (settings.spacePaths.length === 0 && isAreaTasksPathNoSpaces(filePath, settings)) {
    return "Single Action List";
  }

  // PARA area someday/maybe (under each space root)
  for (const space of settings.spacePaths) {
    if (isAreaFileForSpace(filePath, space, settings, settings.somedayMaybeFileName)) {
      const areaSubpath = getAreaSubpathForSpace(filePath, space, settings);
      return areaSubpath
        ? `${space} / ${areaSubpath} / Someday Maybe`
        : `${space} / Someday Maybe`;
    }
  }

  // No-spaces mode fallback label for area someday/maybe file shape.
  if (settings.spacePaths.length === 0 && isAreaSomedayMaybePathNoSpaces(filePath, settings)) {
    return "Someday Maybe";
  }

  // Project files
  const projectInfo = inferProjectFromPath(filePath, settings);
  if (projectInfo?.project) {
    return `${projectInfo.space} / ${projectInfo.project}`;
  }

  // No-spaces mode fallback project labels (derive project from path shape).
  if (settings.spacePaths.length === 0) {
    const projectName = inferProjectNameNoSpaces(filePath, settings);
    if (projectName) {
      return projectName;
    }
  }

  // Fallback
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || filePath;
  return basename;
}

/**
 * Discovers all task files across the vault: project _tasks.md, area _tasks.md,
 * someday/maybe files, and inbox folder files.
 * Returns sorted: inbox files first, then area tasks, then project tasks (by area/project alpha).
 */
export function getSortedProjectFiles(app: App, settings: GeckoTaskSettings): TFile[] {
  const allFiles = app.vault.getMarkdownFiles();
  const result: TFile[] = [];

  // 1. Inbox files
  const inboxFiles = allFiles.filter(f => isInInboxFolder(f.path, settings));
  result.push(...inboxFiles);

  // No-spaces mode: discover only convention-matching task files.
  if (settings.spacePaths.length === 0) {
    const nonInboxFiles = allFiles.filter(f => !isInInboxFolder(f.path, settings));
    const areaFiles = nonInboxFiles
      .filter(f =>
        isAreaTasksPathNoSpaces(f.path, settings) ||
        isAreaSomedayMaybePathNoSpaces(f.path, settings)
      )
      .sort((a, b) => a.path.localeCompare(b.path));
    const projectFiles = nonInboxFiles
      .filter(f =>
        isProjectTasksPathNoSpaces(f.path, settings) ||
        isProjectSomedayMaybePathNoSpaces(f.path, settings)
      )
      .sort((a, b) => a.path.localeCompare(b.path));

    result.push(...areaFiles);
    result.push(...projectFiles);
    return result;
  }

  // 2. For each space, collect area tasks file + project task files
  const spaces = getSpaces(app, settings);
  for (const space of spaces) {
    // Area task and someday/maybe files under {space}/{areaTasksSubfolder}/**
    const areaPrefix = `${space}/${settings.areaTasksSubfolder}/`;
    const scopedAreaFiles = allFiles.filter(f => f.path.startsWith(areaPrefix));

    const areaTaskFiles = scopedAreaFiles
      .filter(f => hasFileStem(f.path, settings.tasksFileName))
      .sort((a, b) => a.path.localeCompare(b.path));
    result.push(...areaTaskFiles);

    const areaSomedayMaybeFiles = scopedAreaFiles
      .filter(f => hasFileStem(f.path, settings.somedayMaybeFileName))
      .sort((a, b) => a.path.localeCompare(b.path));
    result.push(...areaSomedayMaybeFiles);

    // Project directories under {space}/{projectsSubfolder}/
    const projectsPath = getProjectsPath(space, settings);
    const projectsFolder = app.vault.getAbstractFileByPath(projectsPath);
    if (projectsFolder instanceof TFolder) {
      // Get project dirs sorted by name
      const projectDirs = projectsFolder.children
        .filter((c): c is TFolder => c instanceof TFolder)
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const projectDir of projectDirs) {
        // Add _tasks.md if it exists
        const taskFilePath = `${projectDir.path}/${settings.tasksFileName}.md`;
        const taskFile = allFiles.find(f => f.path === taskFilePath);
        if (taskFile) {
          result.push(taskFile);
        }

        // Add _SomedayMaybe.md if it exists
        const smFilePath = `${projectDir.path}/${settings.somedayMaybeFileName}.md`;
        const smFile = allFiles.find(f => f.path === smFilePath);
        if (smFile) {
          result.push(smFile);
        }
      }
    }
  }

  return result;
}

function isAreaTasksPathNoSpaces(filePath: string, settings: GeckoTaskSettings): boolean {
  const marker = `/${settings.areaTasksSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return false;
  return hasFileStem(filePath, settings.tasksFileName);
}

function isAreaSomedayMaybePathNoSpaces(filePath: string, settings: GeckoTaskSettings): boolean {
  const marker = `/${settings.areaTasksSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return false;
  return hasFileStem(filePath, settings.somedayMaybeFileName);
}

function hasFileStem(filePath: string, stem: string): boolean {
  return filePath.endsWith(`/${stem}.md`);
}

function isAreaFileForSpace(filePath: string, space: string, settings: GeckoTaskSettings, fileStem: string): boolean {
  const areaPrefix = `${space}/${settings.areaTasksSubfolder}/`;
  return filePath.startsWith(areaPrefix) && hasFileStem(filePath, fileStem);
}

function getAreaSubpathForSpace(filePath: string, space: string, settings: GeckoTaskSettings): string | undefined {
  const areaPrefix = `${space}/${settings.areaTasksSubfolder}/`;
  if (!filePath.startsWith(areaPrefix)) return undefined;

  const relativePath = filePath.slice(areaPrefix.length);
  const parts = relativePath.split("/");
  if (parts.length <= 1) return undefined;

  return parts.slice(0, -1).join("/") || undefined;
}

function isProjectTasksPathNoSpaces(filePath: string, settings: GeckoTaskSettings): boolean {
  const marker = `/${settings.projectsSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return false;
  const after = filePath.slice(idx + marker.length);
  const parts = after.split("/");
  return parts.length >= 2 && parts[parts.length - 1] === `${settings.tasksFileName}.md`;
}

function isProjectSomedayMaybePathNoSpaces(filePath: string, settings: GeckoTaskSettings): boolean {
  const marker = `/${settings.projectsSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return false;
  const after = filePath.slice(idx + marker.length);
  const parts = after.split("/");
  return parts.length >= 2 && parts[parts.length - 1] === `${settings.somedayMaybeFileName}.md`;
}

function inferProjectNameNoSpaces(filePath: string, settings: GeckoTaskSettings): string | undefined {
  const marker = `/${settings.projectsSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return undefined;
  const after = filePath.slice(idx + marker.length);
  const parts = after.split("/");
  if (parts.length < 2) return undefined;
  return parts[0] || undefined;
}

/** @deprecated Use isAreaTasksFile or isInInboxFolder instead */
export function isSpecialFile(filePath: string, settings: GeckoTaskSettings): boolean {
  return isAreaTasksFile(filePath, settings) || isInInboxFolder(filePath, settings);
}

/** @deprecated No longer needed — tasksFileName is used instead */
export function normalizeInboxPath(path: string): string {
  if (!path) return path;
  return path.endsWith(".md") ? path : path + ".md";
}

/** @deprecated No longer needed */
export function getInboxDisplayPath(path: string): string {
  if (!path) return path;
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}

/** @deprecated No longer needed */
export function isTasksFolderFile(_filePath: string, _settings: GeckoTaskSettings): boolean {
  return false;
}

/** @deprecated No longer needed — archive removed */
export function isInArchiveDirectory(_filePath: string, _settings: GeckoTaskSettings): boolean {
  return false;
}
