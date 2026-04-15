"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSomedayMaybePath = getSomedayMaybePath;
exports.isInSomedayMaybeFolder = isInSomedayMaybeFolder;
const areaUtils_1 = require("./areaUtils");
/**
 * Gets the Someday Maybe path for a given area.
 * @param area - The area name
 * @param settings - Plugin settings
 * @returns The full path to the Someday Maybe folder/file for the area
 */
function getSomedayMaybePath(area, settings) {
    return `${(0, areaUtils_1.getAreaPath)(area, settings)}/${settings.somedayMaybeFolderName}`;
}
/**
 * Checks if a file path is in a Someday Maybe folder.
 * @param filePath - The file path to check
 * @param settings - Plugin settings
 * @param app - Obsidian app instance
 * @returns True if the path is in a Someday Maybe folder
 */
function isInSomedayMaybeFolder(filePath, settings, app) {
    const somedayMaybeFolderName = settings.somedayMaybeFolderName;
    const areas = (0, areaUtils_1.getAreas)(app, settings);
    for (const area of areas) {
        const somedayMaybePath = getSomedayMaybePath(area, settings);
        if (filePath.startsWith(somedayMaybePath + "/") || filePath === somedayMaybePath + ".md") {
            return true;
        }
    }
    return false;
}
