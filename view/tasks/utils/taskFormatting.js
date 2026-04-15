"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOverdue = isOverdue;
exports.formatDueDate = formatDueDate;
exports.formatScheduledDate = formatScheduledDate;
exports.getPriorityColorClass = getPriorityColorClass;
exports.extractLabels = extractLabels;
exports.renderDescriptionLine = renderDescriptionLine;
const dateUtils_1 = require("../../../utils/dateUtils");
/**
 * Checks if a due date is overdue (older than today).
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @returns True if the date is overdue
 */
function isOverdue(dueDate) {
    return (0, dateUtils_1.diffInDays)(dueDate) < 0;
}
/**
 * Formats a due date for display.
 * Shows abbreviated day name (e.g., "Sat") if within next 7 days, otherwise shortened format like "7th Nov".
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string
 */
function formatDueDate(dueDate) {
    const daysDiff = (0, dateUtils_1.diffInDays)(dueDate);
    if (daysDiff < 0) {
        // Overdue - show shortened format
        return (0, dateUtils_1.formatDate)(dueDate, "Do MMM");
    }
    else if (daysDiff === 0) {
        return "Today";
    }
    else if (daysDiff <= 7) {
        // Within next 7 days - show abbreviated day name
        return (0, dateUtils_1.formatDate)(dueDate, "ddd");
    }
    else {
        // Beyond 7 days - show shortened format
        return (0, dateUtils_1.formatDate)(dueDate, "Do MMM");
    }
}
/**
 * Formats a scheduled date for display.
 * Shows abbreviated day name (e.g., "Sat") if within next 7 days, otherwise shortened format like "7th Nov".
 * @param scheduledDate - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string
 */
function formatScheduledDate(scheduledDate) {
    const daysDiff = (0, dateUtils_1.diffInDays)(scheduledDate);
    if (daysDiff < 0) {
        // Past - show shortened format
        return (0, dateUtils_1.formatDate)(scheduledDate, "Do MMM");
    }
    else if (daysDiff === 0) {
        return "Today";
    }
    else if (daysDiff <= 7) {
        // Within next 7 days - show abbreviated day name
        return (0, dateUtils_1.formatDate)(scheduledDate, "ddd");
    }
    else {
        // Beyond 7 days - show shortened format
        return (0, dateUtils_1.formatDate)(scheduledDate, "Do MMM");
    }
}
/**
 * Gets the priority color class for styling.
 * Maps priority position in the user-defined array to escalating color classes.
 * @param priority - Priority value
 * @param settings - Plugin settings containing allowedPriorities
 * @returns CSS class name for priority color
 */
function getPriorityColorClass(priority, settings) {
    if (!priority)
        return "priority-none";
    const idx = settings.allowedPriorities.indexOf(priority);
    if (idx < 0)
        return "priority-none";
    const totalPriorities = settings.allowedPriorities.length;
    if (totalPriorities === 0)
        return "priority-none";
    // Map based on position in array (last = highest priority)
    // Escalate colors from low → medium → high → urgent as index increases
    if (totalPriorities === 1) {
        // Single priority → medium
        return "priority-medium";
    }
    else if (totalPriorities === 2) {
        // Two priorities: [low, urgent]
        return idx === 0 ? "priority-low" : "priority-urgent";
    }
    else if (totalPriorities === 3) {
        // Three priorities: [low, medium, urgent]
        if (idx === 0)
            return "priority-low";
        if (idx === 1)
            return "priority-medium";
        return "priority-urgent";
    }
    else {
        // Four or more priorities: map proportionally
        // First → low, Last → urgent, distribute medium/high in between
        if (idx === 0)
            return "priority-low";
        if (idx === totalPriorities - 1)
            return "priority-urgent";
        // Map middle priorities proportionally across low → medium → high
        // Divide the range (excluding first and last) into segments
        const middleRange = totalPriorities - 2; // Exclude first and last
        const positionInMiddle = idx - 1; // Position within middle range (0-based)
        if (middleRange === 1) {
            // Only one middle priority → medium
            return "priority-medium";
        }
        else if (middleRange === 2) {
            // Two middle priorities → medium, high
            return positionInMiddle === 0 ? "priority-medium" : "priority-high";
        }
        else {
            // Three or more middle priorities → distribute across medium and high
            const mediumEnd = Math.floor(middleRange / 2);
            return positionInMiddle <= mediumEnd ? "priority-medium" : "priority-high";
        }
    }
}
/**
 * Extracts all tags from a task (hashtags only).
 * @param task - The indexed task
 * @returns Array of tag strings
 */
function extractLabels(task) {
    // Return only hashtags from task tags
    return [...task.tags];
}
/**
 * Renders a description line as plain text.
 * @param container - Container element to render into
 * @param line - Description line text
 */
function renderDescriptionLine(container, line) {
    container.textContent = line;
}
