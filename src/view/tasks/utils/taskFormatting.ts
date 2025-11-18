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
 * Extracts all labels from a task (hashtags and @ labels from description).
 * @param task - The indexed task
 * @returns Array of label strings
 */
export function extractLabels(task: IndexedTask): string[] {
  const labels: string[] = [];
  
  // Add hashtags from task tags
  labels.push(...task.tags);
  
  // Extract @ labels from description
  if (task.description) {
    const labelPattern = /@[\w/-]+/g;
    const descLabels = task.description.match(labelPattern);
    if (descLabels) {
      // Add unique labels only
      descLabels.forEach((label: string) => {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      });
    }
  }
  
  return labels;
}

/**
 * Renders a description line, converting labels like "@ppl/Libby" into badges.
 * @param container - Container element to render into
 * @param line - Description line text
 * @param renderLabelsAsBadges - Whether to render labels as badges (default: true for titles, false for descriptions)
 */
export function renderDescriptionLine(container: HTMLElement, line: string, renderLabelsAsBadges: boolean = true): void {
  // Pattern to match labels like @ppl/Libby, @person/Name, @label, etc.
  // Matches @ followed by word characters, slashes, hyphens, and underscores
  const labelPattern = /(@[\w/-]+)/g;
  const parts: Array<{ text: string; isLabel: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = labelPattern.exec(line)) !== null) {
    // Add text before the label
    if (match.index > lastIndex) {
      parts.push({ text: line.substring(lastIndex, match.index), isLabel: false });
    }
    // Add the label
    parts.push({ text: match[1], isLabel: true });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last label
  if (lastIndex < line.length) {
    parts.push({ text: line.substring(lastIndex), isLabel: false });
  }

  // If no labels found, just add the text as-is
  if (parts.length === 0) {
    container.textContent = line;
    return;
  }

  // Render parts
  parts.forEach(part => {
    if (part.isLabel && renderLabelsAsBadges) {
      // Create a badge for the label (only in titles)
      container.createEl("span", { 
        text: part.text, 
        cls: "task-description-label" 
      });
    } else if (part.isLabel && !renderLabelsAsBadges) {
      // Just show label as plain text in descriptions (since they're shown in bottom left)
      container.appendText(part.text);
    } else if (part.text.length > 0) {
      // Add regular text (only if not empty)
      container.appendText(part.text);
    }
  });
}

