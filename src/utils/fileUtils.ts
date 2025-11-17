import { App, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { isInTasksFolder } from "./areaUtils";

/**
 * Gets all markdown files in the tasks folder.
 * This is a helper to avoid repeating the filter pattern.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of markdown files in the tasks folder
 */
export function getTasksFolderFiles(
  app: App,
  settings: GeckoTaskSettings
): TFile[] {
  return app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings));
}

