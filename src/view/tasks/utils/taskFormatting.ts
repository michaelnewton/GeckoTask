import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../TasksPanelTypes";
import { formatDate, diffInDays } from "../../../utils/dateUtils";

/**
 * Checks if a due date is overdue (older than today).
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @returns True if the date is overdue
 */
export function isOverdue(dueDate: string): boolean {
  return diffInDays(dueDate) < 0;
}

/**
 * Formats a due date for display.
 * Shows day name if within next 7 days, otherwise shortened format like "7th Nov".
 * @param dueDate - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string
 */
export function formatDueDate(dueDate: string): string {
  const daysDiff = diffInDays(dueDate);
  
  if (daysDiff < 0) {
    // Overdue - show shortened format
    return formatDate(dueDate, "Do MMM");
  } else if (daysDiff === 0) {
    return "Today";
  } else if (daysDiff <= 7) {
    // Within next 7 days - show day name
    return formatDate(dueDate, "dddd");
  } else {
    // Beyond 7 days - show shortened format
    return formatDate(dueDate, "Do MMM");
  }
}

/**
 * Gets the priority color class for styling.
 * Maps priority position in the user-defined array to escalating color classes.
 * @param priority - Priority value
 * @param settings - Plugin settings containing allowedPriorities
 * @returns CSS class name for priority color
 */
export function getPriorityColorClass(priority: string | undefined, settings: GeckoTaskSettings): string {
  if (!priority) return "priority-none";
  const idx = settings.allowedPriorities.indexOf(priority);
  if (idx < 0) return "priority-none";
  
  const totalPriorities = settings.allowedPriorities.length;
  if (totalPriorities === 0) return "priority-none";
  
  // Map based on position in array (last = highest priority)
  // Escalate colors from low → medium → high → urgent as index increases
  if (totalPriorities === 1) {
    // Single priority → medium
    return "priority-medium";
  } else if (totalPriorities === 2) {
    // Two priorities: [low, urgent]
    return idx === 0 ? "priority-low" : "priority-urgent";
  } else if (totalPriorities === 3) {
    // Three priorities: [low, medium, urgent]
    if (idx === 0) return "priority-low";
    if (idx === 1) return "priority-medium";
    return "priority-urgent";
  } else {
    // Four or more priorities: map proportionally
    // First → low, Last → urgent, distribute medium/high in between
    if (idx === 0) return "priority-low";
    if (idx === totalPriorities - 1) return "priority-urgent";
    
    // Map middle priorities proportionally across low → medium → high
    // Divide the range (excluding first and last) into segments
    const middleRange = totalPriorities - 2; // Exclude first and last
    const positionInMiddle = idx - 1; // Position within middle range (0-based)
    
    if (middleRange === 1) {
      // Only one middle priority → medium
      return "priority-medium";
    } else if (middleRange === 2) {
      // Two middle priorities → medium, high
      return positionInMiddle === 0 ? "priority-medium" : "priority-high";
    } else {
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
export function extractLabels(task: IndexedTask): string[] {
  // Return only hashtags from task tags
  return [...task.tags];
}

/**
 * Renders a description line as plain text.
 * @param container - Container element to render into
 * @param line - Description line text
 */
export function renderDescriptionLine(container: HTMLElement, line: string): void {
  container.textContent = line;
}

