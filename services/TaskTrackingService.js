"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskId = getTaskId;
exports.hashTaskContent = hashTaskContent;
exports.getTaskTracking = getTaskTracking;
exports.updateTaskTracking = updateTaskTracking;
exports.calculateTaskAge = calculateTaskAge;
exports.calculateDaysSinceModified = calculateDaysSinceModified;
exports.calculateDaysSinceReviewed = calculateDaysSinceReviewed;
exports.markTaskReviewed = markTaskReviewed;
exports.updateTaskPath = updateTaskPath;
const TRACKING_STORAGE_KEY = "geckotask-task-tracking";
/**
 * Generates a unique ID for a task based on path and line number.
 * @param task - The task to generate an ID for
 * @returns Unique task ID string (path:line)
 */
function getTaskId(task) {
    return `${task.path}:${task.line}`;
}
/**
 * Hashes task content to detect changes.
 * @param task - The task to hash
 * @returns Hash string
 */
function hashTaskContent(task) {
    // Create a canonical representation of the task
    const parts = [
        task.title,
        task.description || "",
        (task.tags || []).join("|"),
        task.priority || "",
        task.due || "",
        task.recur || "",
        task.checked ? "1" : "0"
    ];
    const canonical = parts.join("|");
    // Simple hash function (non-crypto, good enough for change detection)
    let h = 0;
    for (let i = 0; i < canonical.length; i++) {
        h = ((h << 5) - h + canonical.charCodeAt(i)) >>> 0;
    }
    return h.toString(16);
}
/**
 * Gets today's date as YYYY-MM-DD string.
 * @returns ISO date string
 */
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
/**
 * Calculates the number of days between two dates.
 * @param dateStr1 - First date (YYYY-MM-DD)
 * @param dateStr2 - Second date (YYYY-MM-DD), defaults to today
 * @returns Number of days, or null if dates are invalid
 */
function daysBetween(dateStr1, dateStr2 = getTodayString()) {
    try {
        const date1 = new Date(dateStr1);
        const date2 = new Date(dateStr2);
        if (isNaN(date1.getTime()) || isNaN(date2.getTime()))
            return null;
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    catch {
        return null;
    }
}
/**
 * Loads task tracking data from plugin storage.
 * @param plugin - Plugin instance
 * @returns Task tracking data
 */
async function getTaskTracking(plugin) {
    try {
        const data = await plugin.loadData();
        return data?.[TRACKING_STORAGE_KEY] || {};
    }
    catch (error) {
        console.error("Error loading task tracking data:", error);
        return {};
    }
}
/**
 * Saves task tracking data to plugin storage.
 * @param plugin - Plugin instance
 * @param tracking - Task tracking data to save
 */
async function saveTaskTracking(plugin, tracking) {
    try {
        const data = await plugin.loadData() || {};
        data[TRACKING_STORAGE_KEY] = tracking;
        await plugin.saveData(data);
    }
    catch (error) {
        console.error("Error saving task tracking data:", error);
    }
}
/**
 * Updates task tracking data for all tasks.
 * Detects new tasks and content changes.
 * @param plugin - Plugin instance
 * @param tasks - All current tasks
 */
async function updateTaskTracking(plugin, tasks) {
    const tracking = await getTaskTracking(plugin);
    const today = getTodayString();
    let hasChanges = false;
    // Process all current tasks
    for (const task of tasks) {
        const taskId = getTaskId(task);
        const contentHash = hashTaskContent(task);
        const existing = tracking[taskId];
        if (!existing) {
            // New task - add to tracking
            tracking[taskId] = {
                firstSeen: today,
                lastModified: today,
                contentHash
            };
            hasChanges = true;
        }
        else if (existing.contentHash !== contentHash) {
            // Task content changed - update lastModified
            tracking[taskId] = {
                ...existing,
                lastModified: today,
                contentHash
            };
            hasChanges = true;
        }
        // If task exists and hash matches, no changes needed
    }
    // Remove tracking for tasks that no longer exist
    const currentTaskIds = new Set(tasks.map(t => getTaskId(t)));
    for (const taskId in tracking) {
        if (!currentTaskIds.has(taskId)) {
            delete tracking[taskId];
            hasChanges = true;
        }
    }
    if (hasChanges) {
        await saveTaskTracking(plugin, tracking);
    }
}
/**
 * Calculates the age of a task in days since first seen.
 * @param taskTracking - Task tracking data
 * @param taskId - Task ID
 * @returns Number of days since first seen, or null if not tracked
 */
function calculateTaskAge(taskTracking, taskId) {
    const tracked = taskTracking[taskId];
    if (!tracked)
        return null;
    return daysBetween(tracked.firstSeen);
}
/**
 * Calculates days since last modified.
 * @param taskTracking - Task tracking data
 * @param taskId - Task ID
 * @returns Number of days since last modified, or null if not tracked
 */
function calculateDaysSinceModified(taskTracking, taskId) {
    const tracked = taskTracking[taskId];
    if (!tracked)
        return null;
    return daysBetween(tracked.lastModified);
}
/**
 * Calculates days since last reviewed.
 * @param taskTracking - Task tracking data
 * @param taskId - Task ID
 * @returns Number of days since last reviewed, or null if not tracked/reviewed
 */
function calculateDaysSinceReviewed(taskTracking, taskId) {
    const tracked = taskTracking[taskId];
    if (!tracked?.lastReviewed)
        return null;
    return daysBetween(tracked.lastReviewed);
}
/**
 * Marks a task as reviewed in the health panel.
 * @param plugin - Plugin instance
 * @param taskId - Task ID to mark as reviewed
 */
async function markTaskReviewed(plugin, taskId) {
    const tracking = await getTaskTracking(plugin);
    const today = getTodayString();
    if (tracking[taskId]) {
        tracking[taskId] = {
            ...tracking[taskId],
            lastReviewed: today
        };
        await saveTaskTracking(plugin, tracking);
    }
}
/**
 * Updates task tracking when a task is moved to a new path.
 * @param plugin - Plugin instance
 * @param oldTaskId - Old task ID (oldPath:line)
 * @param newTaskId - New task ID (newPath:line)
 */
async function updateTaskPath(plugin, oldTaskId, newTaskId) {
    const tracking = await getTaskTracking(plugin);
    if (tracking[oldTaskId]) {
        // Move tracking data to new ID
        tracking[newTaskId] = tracking[oldTaskId];
        delete tracking[oldTaskId];
        await saveTaskTracking(plugin, tracking);
    }
}
