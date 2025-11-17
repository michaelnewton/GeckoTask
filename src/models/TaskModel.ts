import { parseNLDate } from "../services/NLDate";

/**
 * Represents a task with all its metadata fields.
 */
export interface Task {
  checked: boolean;
  title: string;
  description?: string; // Multi-line description stored on subsequent indented lines
  tags: string[];
  due?: string;
  scheduled?: string;
  priority?: string; // Dynamic from settings.allowedPriorities
  recur?: string; // Recurrence pattern (e.g., "every Tuesday", "every 10 days")
  project?: string;
  area?: string;
  completion?: string;
  origin_file?: string;
  origin_project?: string;
  origin_area?: string;
  raw: string;
  lineNo?: number; // optional: position in file for edits
}

const FIELD_KEYS = new Set([
  "due","scheduled","priority","recur","area","completion","origin_file","origin_project","origin_area"
]);

/**
 * Parses a task line into a Task object.
 * @param line - The task line to parse (e.g., "- [ ] Task title #tag priority:: high")
 * @returns Parsed Task object or null if line doesn't match task format
 */
export function parseTask(line: string): Task | null {
  const m = line.match(/^\s*-\s*\[( |x)\]\s+(.*)$/i);
  if (!m) return null;

  const checked = m[1].toLowerCase() === "x";
  let rest = m[2];

  // Check for recurrence emoji (🔁) - Tasks plugin format
  // Pattern: 🔁 followed by recurrence text (e.g., "🔁 every Tuesday")
  let recurPattern: string | undefined;
  const recurEmojiIndex = rest.indexOf("🔁");
  if (recurEmojiIndex !== -1) {
    // Extract text after 🔁 until we hit a field marker, tag, or end of string
    // Use the emoji length to properly skip it (handles surrogate pairs correctly)
    const emojiLength = "🔁".length;
    const afterEmoji = rest.substring(recurEmojiIndex + emojiLength).trim();
    // Find where the recurrence pattern ends (before a field or tag)
    const fieldOrTagMatch = afterEmoji.match(/^([^#]+?)(?:\s+(?:#|due::|scheduled::|priority::|recur::|area::|completion::|origin_file::|origin_project::|origin_area::)|$)/i);
    if (fieldOrTagMatch) {
      recurPattern = fieldOrTagMatch[1].trim();
      // Remove the emoji and pattern from the rest string for further parsing
      // Keep the field marker (e.g., "due::") in the rest string
      const beforeEmoji = rest.substring(0, recurEmojiIndex).trim();
      // Remove only the pattern part, keep the field marker and its value
      const patternLength = fieldOrTagMatch[1].length;
      const afterPattern = afterEmoji.substring(patternLength).trim();
      rest = (beforeEmoji + " " + afterPattern).trim();
    } else {
      // No field/tag after, so the rest is the recurrence pattern
      recurPattern = afterEmoji.trim();
      rest = rest.substring(0, recurEmojiIndex).trim();
    }
  }

  const tokens = rest.split(/\s+/);
  const tags: string[] = [];
  const fields: Record<string,string> = {};
  const titleParts: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    
    if (tok.startsWith("#")) {
      tags.push(tok);
      i++;
      continue;
    }
    
    // Check for field pattern: "key::" or "key::value" or "key:: value"
    const fm = tok.match(/^([a-z_]+)::(.*)$/i);
    if (fm && FIELD_KEYS.has(fm[1])) {
      const key = fm[1];
      let val = fm[2]; // value after :: in same token
      
      // If value is empty and there's a next token, use it as the value (handles "key:: value" format)
      if (!val && i + 1 < tokens.length) {
        const nextTok = tokens[i + 1];
        // Only use next token if it doesn't look like another field or tag
        if (!nextTok.includes("::") && !nextTok.startsWith("#")) {
          val = nextTok;
          i++; // Skip the next token since we used it
        }
      }
      
      // For recur field, handle multi-word values (e.g., "recur:: every Tuesday")
      if (key === "recur" && !val && i + 1 < tokens.length) {
        // Collect tokens until we hit a field, tag, or end
        const recurParts: string[] = [];
        let j = i + 1;
        while (j < tokens.length) {
          const nextTok = tokens[j];
          if (nextTok.includes("::") || nextTok.startsWith("#")) {
            break;
          }
          recurParts.push(nextTok);
          j++;
        }
        if (recurParts.length > 0) {
          val = recurParts.join(" ");
          i = j - 1; // Skip all consumed tokens
        }
      }
      
      // Only set field if it doesn't already exist (keep first occurrence, ignore duplicates)
      if (!(key in fields)) {
        fields[key] = val;
      }
      i++;
      continue;
    }
    
    titleParts.push(tok);
    i++;
  }

  const title = titleParts.join(" ").trim();
  
  // Convert natural language dates to ISO format
  const dueValue = fields["due"];
  const parsedDue = dueValue ? (parseNLDate(dueValue) ?? dueValue) : undefined;
  
  const t: Task = {
    checked,
    title,
    tags,
    due: parsedDue,
    scheduled: fields["scheduled"],
    priority: fields["priority"],
    recur: recurPattern || fields["recur"], // Prefer emoji format if found, otherwise field format
    // Note: project is not stored in metadata, it's derived from file basename
    // project: fields["project"],
    area: fields["area"],
    completion: fields["completion"],
    origin_file: fields["origin_file"],
    origin_project: fields["origin_project"],
    origin_area: fields["origin_area"],
    raw: line
  };
  return t;
}

/**
 * Formats a Task object back into a task line string.
 * @param t - The task to format
 * @returns Formatted task line string
 */
export function formatTask(t: Task): string {
  const box = t.checked ? "[x]" : "[ ]";
  const title = t.title.trim();
  const parts = [`- ${box} ${title}`];

  for (const tag of t.tags) parts.push(tag);

  // Format recurrence using Tasks plugin format (🔁 emoji) for compatibility
  if (t.recur && t.recur.length > 0) {
    parts.push(`🔁 ${t.recur}`);
  }

  const f = (k: string, v?: string) => { if (v && v.length) parts.push(`${k}:: ${v}`); };
  f("priority", t.priority as string);
  f("due", t.due);
  f("scheduled", t.scheduled);
  // Note: project is not stored in metadata, it's derived from file basename
  // f("project", t.project); // Removed - projects are file-based
  // Note: area is not stored in metadata, it's derived from folder structure
  // f("area", t.area); // Removed - areas are folder-based
  f("completion", t.completion);
  f("origin_file", t.origin_file);
  f("origin_project", t.origin_project);
  f("origin_area", t.origin_area);

  return parts.join("  ");
}

/**
 * Creates a new Task with a field updated.
 * @param t - The original task
 * @param key - The field key to update
 * @param value - The new value for the field (optional)
 * @returns New Task object with updated field
 */
export function withField(t: Task, key: keyof Task, value?: string): Task {
  return { ...t, [key]: value };
}

/**
 * Creates a canonical string representation of a task for hashing/comparison.
 * Normalizes fields and excludes volatile spacing/order.
 * @param t - The task to canonicalize
 * @returns Canonical string representation
 */
export function canonicalizeTaskForHash(t: Task): string {
  // Normalize booleans and fields; exclude volatile spacing/order.
  const tagStr = t.tags?.slice().sort().join("|") ?? "";
  const priority = t.priority ?? "";
  const due = t.due ?? "";
  const sched = t.scheduled ?? "";
  const recur = t.recur ?? "";
  const proj = t.project ?? "";
  const area = t.area ?? "";
  const completion = t.completion ?? ""; // include for archive uniqueness.
  return `${t.checked?'1':'0'}|${t.title.trim()}|${tagStr}|${priority}|${due}|${sched}|${recur}|${proj}|${area}|${completion}`;
}

/**
 * Computes a hash for a task line for matching purposes.
 * @param line - The task line to hash
 * @returns Hexadecimal hash string or null if line is not a valid task
 */
export function hashLine(line: string): string | null {
  const t = parseTask(line);
  if (!t) return null;
  const canon = canonicalizeTaskForHash(t);
  // Simple hash function (non-crypto, good enough for matching)
  let h = 0;
  for (let i = 0; i < canon.length; i++) h = (h*31 + canon.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/**
 * Parses a task line and reads subsequent indented lines as description.
 * @param lines - Array of all lines in the file
 * @param startLine - 0-based line number where the task starts
 * @returns Object with parsed task and end line number (0-based)
 */
export function parseTaskWithDescription(lines: string[], startLine: number): { task: Task | null, endLine: number } {
  const taskLine = lines[startLine];
  const task = parseTask(taskLine);
  if (!task) return { task: null, endLine: startLine };

  // Read subsequent indented lines as description
  let descriptionLines: string[] = [];
  let i = startLine + 1;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if line is indented (2+ spaces) and not empty
    if (line.match(/^\s{2,}/) && line.trim().length > 0) {
      // Check if it's still part of description (not a new task or section)
      // Stop if we hit a new task line or a heading
      if (line.match(/^\s*-\s*\[/) || line.match(/^#+\s/)) {
        break;
      }
      descriptionLines.push(line.trim());
      i++;
    } else if (line.trim().length === 0) {
      // Empty line - could be end of description or just spacing
      // Check next non-empty line to decide
      let nextNonEmpty = i + 1;
      while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim().length === 0) {
        nextNonEmpty++;
      }
      if (nextNonEmpty >= lines.length || 
          lines[nextNonEmpty].match(/^\s*-\s*\[/) || 
          lines[nextNonEmpty].match(/^#+\s/)) {
        // Next non-empty is a task or heading, so this empty line ends description
        break;
      }
      // Otherwise, it's just spacing within description
      descriptionLines.push("");
      i++;
    } else {
      // Non-indented, non-empty line - end of description
      break;
    }
  }

  if (descriptionLines.length > 0) {
    task.description = descriptionLines.join("\n");
  }

  return { task, endLine: i - 1 };
}

/**
 * Formats a task with its description as multiple lines.
 * @param t - The task to format
 * @returns Array of lines: [taskLine, ...descriptionLines]
 */
export function formatTaskWithDescription(t: Task): string[] {
  const taskLine = formatTask(t);
  const result: string[] = [taskLine];
  
  if (t.description) {
    // Split description into lines and indent each
    const descLines = t.description.split("\n");
    for (const line of descLines) {
      result.push(`  ${line}`);
    }
  }
  
  return result;
}
