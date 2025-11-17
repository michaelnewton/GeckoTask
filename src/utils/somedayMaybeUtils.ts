import { App } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { getAreas, getAreaPath } from "./areaUtils";

/**
 * Gets the Someday Maybe path for a given area.
 * @param area - The area name
 * @param settings - Plugin settings
 * @returns The full path to the Someday Maybe folder/file for the area
 */
export function getSomedayMaybePath(area: string, settings: GeckoTaskSettings): string {
  return `${getAreaPath(area, settings)}/${settings.somedayMaybeFolderName}`;
}

/**
 * Checks if a file path is in a Someday Maybe folder.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @param app - Obsidian app instance
 * @returns True if the path is in a Someday Maybe folder
 */
export function isInSomedayMaybeFolder(
  filePath: string,
  settings: GeckoTaskSettings,
  app: App
): boolean {
  const somedayMaybeFolderName = settings.somedayMaybeFolderName;
  const areas = getAreas(app, settings);
  
  for (const area of areas) {
    const somedayMaybePath = getSomedayMaybePath(area, settings);
    if (filePath.startsWith(somedayMaybePath + "/") || filePath === somedayMaybePath + ".md") {
      return true;
    }
  }
  
  return false;
}

