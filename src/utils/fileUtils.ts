import { App, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { isInAnyArea, isInInboxFolder } from "./areaUtils";

/**
 * Gets all markdown files in any configured area or the inbox folder.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Array of markdown files in area or inbox paths
 */
export function getTasksFolderFiles(
  app: App,
  settings: GeckoTaskSettings
): TFile[] {
  return app.vault.getMarkdownFiles()
    .filter(f => isInAnyArea(f.path, settings) || isInInboxFolder(f.path, settings));
}
