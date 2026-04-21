import { formatISODate } from "../utils/dateUtils";
import { Task } from "../models/TaskModel";

/**
 * Service for parsing and calculating recurrence patterns for tasks.
 * Supports natural language patterns compatible with the Tasks plugin format.
 */

/**
 * Parses a recurrence pattern string and calculates the next occurrence date.
 * @param pattern - The recurrence pattern (e.g., "every Tuesday", "every 10 days", "every 2 weeks on Tuesday", "7th of every month", "1st of june every year", "every 4 weeks")
 * @param fromDate - The date to calculate from (typically completion date or current date)
 * @returns The next occurrence date as ISO string (YYYY-MM-DD), or null if pattern is invalid
 */
export function calculateNextOccurrence(pattern: string, fromDate: Date = new Date()): string | null {
  const normalized = pattern.trim().toLowerCase();
  
  // Handle "every N days"
  const daysMatch = normalized.match(/^every\s+(\d+)\s+days?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const next = new Date(fromDate);
    next.setDate(next.getDate() + days);
    return formatISODate(next);
  }
  
  // Handle "every day" or "daily"
  if (normalized === "every day" || normalized === "daily") {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 1);
    return formatISODate(next);
  }
  
  // Handle "every weekday" (Monday-Friday)
  if (normalized === "every weekday" || normalized === "weekdays") {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 1);
    // Skip weekends
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    return formatISODate(next);
  }
  
  // Handle "every week" or "weekly"
  if (normalized === "every week" || normalized === "weekly") {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 7);
    return formatISODate(next);
  }
  
  // Handle "every N weeks"
  const weeksMatch = normalized.match(/^every\s+(\d+)\s+weeks?$/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const next = new Date(fromDate);
    next.setDate(next.getDate() + (weeks * 7));
    return formatISODate(next);
  }
  
  // Handle "every N weeks on [day]"
  const weeksOnDayMatch = normalized.match(/^every\s+(\d+)\s+weeks?\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (weeksOnDayMatch) {
    const weeks = parseInt(weeksOnDayMatch[1], 10);
    const targetDay = parseDayOfWeek(weeksOnDayMatch[2]);
    const next = findNextDayOfWeek(fromDate, targetDay, weeks);
    return formatISODate(next);
  }
  
  // Handle "every [day]" (e.g., "every Tuesday")
  const dayMatch = normalized.match(/^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (dayMatch) {
    const targetDay = parseDayOfWeek(dayMatch[1]);
    const next = findNextDayOfWeek(fromDate, targetDay, 1);
    return formatISODate(next);
  }
  
  // Handle "every month" or "monthly"
  if (normalized === "every month" || normalized === "monthly") {
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + 1);
    return formatISODate(next);
  }
  
  // Handle "every N months"
  const monthsMatch = normalized.match(/^every\s+(\d+)\s+months?$/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + months);
    return formatISODate(next);
  }
  
  // Handle "every month on the [day]" (e.g., "every month on the 15th")
  const monthOnDayMatch = normalized.match(/^every\s+month\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?$/);
  if (monthOnDayMatch) {
    const dayOfMonth = parseInt(monthOnDayMatch[1], 10);
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
    return formatISODate(next);
  }
  
  // Handle "[day] of every month" (e.g., "7th of every month", "15th of every month")
  const dayOfEveryMonthMatch = normalized.match(/^(\d+)(?:st|nd|rd|th)?\s+of\s+every\s+month$/);
  if (dayOfEveryMonthMatch) {
    const dayOfMonth = parseInt(dayOfEveryMonthMatch[1], 10);
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
    return formatISODate(next);
  }
  
  // Handle "every year" or "yearly"
  if (normalized === "every year" || normalized === "yearly") {
    const next = new Date(fromDate);
    next.setFullYear(next.getFullYear() + 1);
    return formatISODate(next);
  }
  
  // Handle "every N years"
  const yearsMatch = normalized.match(/^every\s+(\d+)\s+years?$/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    const next = new Date(fromDate);
    next.setFullYear(next.getFullYear() + years);
    return formatISODate(next);
  }
  
  // Handle "[day] of [month] every year" (e.g., "1st of june every year", "15th of december every year")
  const yearlyDateMatch = normalized.match(/^(\d+)(?:st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+every\s+year$/);
  if (yearlyDateMatch) {
    const dayOfMonth = parseInt(yearlyDateMatch[1], 10);
    const monthName = yearlyDateMatch[2];
    const monthIndex = parseMonthName(monthName);
    if (monthIndex === null) {
      return null;
    }
    
    const currentYear = fromDate.getFullYear();
    
    // Create target date for this year
    const targetDateThisYear = new Date(currentYear, monthIndex, dayOfMonth);
    // Handle months with fewer days (e.g., Feb 30 -> Feb 28/29)
    const daysInTargetMonth = getDaysInMonth(targetDateThisYear);
    targetDateThisYear.setDate(Math.min(dayOfMonth, daysInTargetMonth));
    
    // If target date has already passed this year, move to next year
    let targetYear = currentYear;
    if (targetDateThisYear < fromDate) {
      targetYear = currentYear + 1;
    }
    
    const next = new Date(targetYear, monthIndex, Math.min(dayOfMonth, getDaysInMonth(new Date(targetYear, monthIndex, 1))));
    return formatISODate(next);
  }
  
  return null; // Pattern not recognized
}

/**
 * Parses a day of week string to a number (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 * @param dayStr - Day name (case-insensitive)
 * @returns Day number (0-6)
 */
function parseDayOfWeek(dayStr: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[dayStr.toLowerCase()] ?? 1;
}

/**
 * Finds the next occurrence of a specific day of week, N weeks from the given date.
 * @param fromDate - Starting date
 * @param targetDay - Target day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param weeks - Number of weeks to advance (default: 1)
 * @returns Date of the next occurrence
 */
function findNextDayOfWeek(fromDate: Date, targetDay: number, weeks: number = 1): Date {
  const currentDay = fromDate.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  
  // If it's the same day, advance by the specified number of weeks
  const daysToAdd = daysUntilTarget === 0 ? weeks * 7 : daysUntilTarget + ((weeks - 1) * 7);
  
  const next = new Date(fromDate);
  next.setDate(next.getDate() + daysToAdd);
  return next;
}

/**
 * Gets the number of days in a given month.
 * @param date - Date in the target month
 * @returns Number of days in that month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Parses a month name string to a month index (0 = January, 1 = February, ..., 11 = December).
 * @param monthStr - Month name (case-insensitive)
 * @returns Month index (0-11), or null if invalid
 */
function parseMonthName(monthStr: string): number | null {
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const normalized = monthStr.toLowerCase();
  return months[normalized] ?? null;
}


/**
 * Validates if a recurrence pattern is recognized.
 * @param pattern - The recurrence pattern to validate
 * @returns True if the pattern is recognized, false otherwise
 */
export function isValidRecurrencePattern(pattern: string): boolean {
  return calculateNextOccurrence(pattern) !== null;
}

/**
 * Calculates the scheduled and/or due dates for the next occurrence of a recurring task
 * Preserves the date type(s) from the existing task:
 * - If existing task has scheduled → next occurrence gets scheduled
 * - If existing task has due → next occurrence gets due
 * - If existing task has both → next occurrence gets both
 * - If existing task has neither → next occurrence gets scheduled only (default behavior)
 * @param recurPattern - The recurrence pattern (e.g., "every Tuesday", "every 10 days")
 * @param fromDate - The date to calculate from (typically completion date or current date)
 * @param existingTask - The existing task to determine which date types to preserve
 * @returns Object with scheduled and/or due dates as ISO strings (YYYY-MM-DD), or null if pattern is invalid
 */
export function calculateNextOccurrenceDates(
  recurPattern: string,
  fromDate: Date,
  existingTask: Task
): { scheduled?: string; due?: string } | null {
  const nextDate = calculateNextOccurrence(recurPattern, fromDate);
  if (!nextDate) {
    return null;
  }

  const hasScheduled = !!existingTask.scheduled;
  const hasDue = !!existingTask.due;

  // Date preservation rules:
  // - If existing has scheduled → next gets scheduled
  // - If existing has due → next gets due
  // - If existing has both → next gets both
  // - If existing has neither → next gets scheduled only (default behavior)
  const result: { scheduled?: string; due?: string } = {};

  if (hasScheduled) {
    result.scheduled = nextDate;
  }

  if (hasDue) {
    result.due = nextDate;
  }

  // If neither exists, default to scheduled (most recurring tasks use scheduled dates)
  if (!hasScheduled && !hasDue) {
    result.scheduled = nextDate;
  }

  return result;
}

