/**
 * Parses natural language date strings into ISO date format (YYYY-MM-DD).
 * Supports "today", "tomorrow", "next [day]", "in N days", and ISO dates.
 * @param input - Natural language date string
 * @returns ISO date string or undefined if parsing fails
 */
export function parseNLDate(input: string): string | undefined {
    const s = input.trim().toLowerCase();
    const d = new Date();
  
    if (s === "today") return iso(d);
    if (s === "tomorrow") { d.setDate(d.getDate() + 1); return iso(d); }
  
    const nextMatch = s.match(/^next\s+(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (nextMatch) {
      const target = dayIndex(nextMatch[1]);
      const cur = d.getDay();
      let delta = (target - cur + 7) % 7;
      if (delta === 0) delta = 7;
      d.setDate(d.getDate() + delta);
      return iso(d);
    }
  
    const inMatch = s.match(/^in\s+(\d+)\s*d(ays?)?$/);
    if (inMatch) {
      d.setDate(d.getDate() + Number(inMatch[1]));
      return iso(d);
    }
  
    // Fallback: if looks like yyyy-mm-dd, accept.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return undefined;
  }
  
  /**
   * Formats a date as ISO string (YYYY-MM-DD).
   * @param d - The date to format
   * @returns ISO date string
   */
  function iso(d: Date): string {
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${d.getFullYear()}-${m}-${day}`;
  }
  
  /**
   * Converts a day name string to day index (0=Sunday, 6=Saturday).
   * @param s - Day name (e.g., "mon", "monday")
   * @returns Day index (0-6) or 0 if not recognized
   */
  function dayIndex(s: string): number {
    const map: Record<string,number> = {
      sun:0,sunday:0, mon:1,monday:1, tue:2,tuesday:2, wed:3,wednesday:3,
      thu:4,thursday:4, fri:5,friday:5, sat:6,saturday:6
    };
    return map[s] ?? 0;
  }
  