"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNLDate = parseNLDate;
const dateUtils_1 = require("../utils/dateUtils");
/**
 * Gets the moment.js instance if available.
 * @returns Moment.js instance or undefined
 */
function getMoment() {
    return window.moment;
}
/**
 * Validates that a date string is in ISO format (YYYY-MM-DD) and represents a valid date.
 * @param dateStr - Date string to validate
 * @returns True if valid ISO date format, false otherwise
 */
function isValidISODate(dateStr) {
    // Check format matches YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false;
    }
    // Validate that it's a real date (not invalid like 2025-13-45)
    const date = new Date(dateStr);
    const [year, month, day] = dateStr.split("-").map(Number);
    return date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        date.getDate() === day;
}
/**
 * Attempts to parse a date string using moment.js (if available) or native Date.
 * @param input - Date string to parse
 * @returns ISO date string or undefined if parsing fails
 */
function tryParseDate(input) {
    const originalInput = input.trim();
    // Try moment.js first (if available) - it's very flexible with date formats
    const moment = getMoment();
    if (moment) {
        try {
            const parsed = moment(originalInput);
            if (parsed.isValid()) {
                const isoDate = parsed.format("YYYY-MM-DD");
                if (isValidISODate(isoDate)) {
                    return isoDate;
                }
            }
        }
        catch (e) {
            // moment parsing failed, continue to native Date
        }
    }
    // Fallback to native Date constructor
    try {
        const date = new Date(originalInput);
        // Check if date is valid (not NaN)
        if (!isNaN(date.getTime())) {
            const isoDate = (0, dateUtils_1.formatISODate)(date);
            if (isValidISODate(isoDate)) {
                return isoDate;
            }
        }
    }
    catch (e) {
        // Native Date parsing failed
    }
    return undefined;
}
/**
 * Parses natural language date strings into ISO date format (YYYY-MM-DD).
 * Supports "today", "tomorrow", "next [day]", "[day]" (bare day names), "in N days",
 * ISO dates (YYYY-MM-DD), and various other formats like "24 nov 2025", "nov 24 2025", etc.
 * @param input - Natural language date string
 * @returns ISO date string or undefined if parsing fails
 */
function parseNLDate(input) {
    const s = input.trim().toLowerCase();
    const d = new Date();
    if (s === "today")
        return (0, dateUtils_1.formatISODate)(d);
    if (s === "tomorrow") {
        d.setDate(d.getDate() + 1);
        return (0, dateUtils_1.formatISODate)(d);
    }
    const nextMatch = s.match(/^next\s+(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (nextMatch) {
        const target = dayIndex(nextMatch[1]);
        const cur = d.getDay();
        let delta = (target - cur + 7) % 7;
        if (delta === 0)
            delta = 7;
        d.setDate(d.getDate() + delta);
        return (0, dateUtils_1.formatISODate)(d);
    }
    // Handle bare day names (e.g., "sunday", "friday")
    // If the day hasn't passed this week, use this week's occurrence; otherwise use next week's
    const bareDayMatch = s.match(/^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (bareDayMatch) {
        const target = dayIndex(bareDayMatch[1]);
        const cur = d.getDay();
        let delta = (target - cur + 7) % 7;
        // If delta is 0, it's today, so return today
        if (delta === 0) {
            return (0, dateUtils_1.formatISODate)(d);
        }
        // If the target day is earlier in the week (e.g., today is Friday, target is Monday), go to next week
        // Note: We need to check if the day has already passed this week
        // If target < cur, the day has already passed, so add 7 days
        if (target < cur) {
            delta += 7;
        }
        d.setDate(d.getDate() + delta);
        return (0, dateUtils_1.formatISODate)(d);
    }
    const inMatch = s.match(/^in\s+(\d+)\s*d(ays?)?$/);
    if (inMatch) {
        d.setDate(d.getDate() + Number(inMatch[1]));
        return (0, dateUtils_1.formatISODate)(d);
    }
    // Check if it's already in ISO format (yyyy-mm-dd)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        if (isValidISODate(s)) {
            return s;
        }
        return undefined;
    }
    // Try parsing with moment.js or native Date for other formats
    // This will handle formats like "24 nov 2025", "nov 24 2025", "24/11/2025", etc.
    return tryParseDate(input);
}
/**
 * Converts a day name string to day index (0=Sunday, 6=Saturday).
 * @param s - Day name (e.g., "mon", "monday")
 * @returns Day index (0-6) or 0 if not recognized
 */
function dayIndex(s) {
    const map = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
        thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
    };
    return map[s] ?? 0;
}
