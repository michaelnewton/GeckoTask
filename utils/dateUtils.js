"use strict";
/**
 * Utility functions for date formatting and manipulation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatISODate = formatISODate;
exports.formatISODateTime = formatISODateTime;
exports.formatDate = formatDate;
exports.getMomentNow = getMomentNow;
exports.parseMomentDate = parseMomentDate;
exports.diffInDays = diffInDays;
exports.startOf = startOf;
exports.endOf = endOf;
exports.add = add;
/**
 * Formats a date as ISO string (YYYY-MM-DD).
 * @param date - The date to format
 * @returns ISO date string
 */
function formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
/**
 * Formats a date/time as an ISO string (YYYY-MM-DDTHH:mm:ss).
 * @param date - The date/time to format
 * @returns ISO date/time string
 */
function formatISODateTime(date) {
    const pad = (value) => String(value).padStart(2, "0");
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${formatISODate(date)}T${hours}:${minutes}:${seconds}`;
}
/**
 * Gets the moment.js instance if available.
 * @returns Moment.js instance or undefined
 */
function getMoment() {
    return window.moment;
}
/**
 * Formats a date using moment.js format string.
 * Falls back to ISO format if moment.js is not available.
 * @param date - Date string or Date object
 * @param format - Moment.js format string (e.g., "YYYY-MM-DD", "Do MMM", "dddd")
 * @returns Formatted date string
 */
function formatDate(date, format) {
    const moment = getMoment();
    if (moment) {
        return moment(date).format(format);
    }
    // Fallback to ISO format if moment is not available
    const d = typeof date === "string" ? new Date(date) : date;
    if (format === "YYYY-MM-DD") {
        return formatISODate(d);
    }
    // Basic fallback - just return ISO
    return formatISODate(d);
}
/**
 * Gets the current date/time using moment.js.
 * @returns Moment.js object or current Date
 */
function getMomentNow() {
    const moment = getMoment();
    if (moment) {
        return moment();
    }
    return new Date();
}
/**
 * Parses a date string using moment.js.
 * @param dateString - Date string to parse
 * @returns Moment.js object or Date
 */
function parseMomentDate(dateString) {
    const moment = getMoment();
    if (moment) {
        return moment(dateString);
    }
    return new Date(dateString);
}
/**
 * Calculates the difference in days between two dates.
 * @param date1 - First date (string or Date)
 * @param date2 - Second date (string or Date, defaults to today)
 * @returns Difference in days (negative if date1 is before date2)
 */
function diffInDays(date1, date2) {
    const moment = getMoment();
    if (moment) {
        const d1 = moment(date1);
        const d2 = date2 ? moment(date2) : moment().startOf("day");
        return d1.diff(d2, "days");
    }
    // Fallback using native Date
    const d1 = typeof date1 === "string" ? new Date(date1) : date1;
    const d2 = date2
        ? (typeof date2 === "string" ? new Date(date2) : date2)
        : new Date();
    const diffTime = d1.getTime() - d2.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
/**
 * Gets the start of a period (day, week, month, year).
 * @param period - Period type: "day", "week", "month", "year"
 * @param date - Optional date to use (defaults to today)
 * @returns ISO date string for the start of the period
 */
function startOf(period, date) {
    const moment = getMoment();
    if (moment) {
        const d = date ? moment(date) : moment();
        return d.startOf(period).format("YYYY-MM-DD");
    }
    // Fallback using native Date
    const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
    const result = new Date(d);
    if (period === "day") {
        result.setHours(0, 0, 0, 0);
    }
    else if (period === "week") {
        const day = result.getDay();
        const diff = result.getDate() - day;
        result.setDate(diff);
        result.setHours(0, 0, 0, 0);
    }
    else if (period === "month") {
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
    }
    else if (period === "year") {
        result.setMonth(0, 1);
        result.setHours(0, 0, 0, 0);
    }
    return formatISODate(result);
}
/**
 * Gets the end of a period (day, week, month, year).
 * @param period - Period type: "day", "week", "month", "year"
 * @param date - Optional date to use (defaults to today)
 * @returns ISO date string for the end of the period
 */
function endOf(period, date) {
    const moment = getMoment();
    if (moment) {
        const d = date ? moment(date) : moment();
        return d.endOf(period).format("YYYY-MM-DD");
    }
    // Fallback using native Date
    const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
    const result = new Date(d);
    if (period === "day") {
        result.setHours(23, 59, 59, 999);
    }
    else if (period === "week") {
        const day = result.getDay();
        const diff = result.getDate() - day + 6;
        result.setDate(diff);
        result.setHours(23, 59, 59, 999);
    }
    else if (period === "month") {
        result.setMonth(result.getMonth() + 1, 0);
        result.setHours(23, 59, 59, 999);
    }
    else if (period === "year") {
        result.setMonth(11, 31);
        result.setHours(23, 59, 59, 999);
    }
    return formatISODate(result);
}
/**
 * Adds a specified amount to a date.
 * @param amount - Amount to add
 * @param unit - Unit: "days", "weeks", "months", "years"
 * @param date - Optional date to use (defaults to today)
 * @returns ISO date string
 */
function add(amount, unit, date) {
    const moment = getMoment();
    if (moment) {
        const d = date ? moment(date) : moment();
        return d.add(amount, unit).format("YYYY-MM-DD");
    }
    // Fallback using native Date
    const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
    const result = new Date(d);
    if (unit === "days") {
        result.setDate(result.getDate() + amount);
    }
    else if (unit === "weeks") {
        result.setDate(result.getDate() + (amount * 7));
    }
    else if (unit === "months") {
        result.setMonth(result.getMonth() + amount);
    }
    else if (unit === "years") {
        result.setFullYear(result.getFullYear() + amount);
    }
    return formatISODate(result);
}
