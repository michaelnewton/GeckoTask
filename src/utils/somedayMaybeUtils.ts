import { App } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { getAreaSomedayMaybePath } from "./areaUtils";

/**
 * Gets the Someday Maybe file path for a given area (without .md).
 * Returns path WITHOUT .md for backwards-compatible callers that add it.
 * Prefer using getAreaSomedayMaybePath() from areaUtils which includes .md.
 */
export function getSomedayMaybePath(area: string, settings: GeckoTaskSettings): string {
  return getAreaSomedayMaybePath(area, settings).replace(/\.md$/, "");
}

/**
 * Checks if a file is a Someday Maybe file (basename matches somedayMaybeFileName).
 */
export function isSomedayMaybeFile(
  filePath: string,
  settings: GeckoTaskSettings
): boolean {
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
  return basename === settings.somedayMaybeFileName;
}

/** @deprecated Use isSomedayMaybeFile instead */
export function isInSomedayMaybeFolder(
  filePath: string,
  settings: GeckoTaskSettings,
  _app: App
): boolean {
  return isSomedayMaybeFile(filePath, settings);
}
