import { App, Editor, MarkdownView, Notice } from "obsidian";
import { Task, parseTask, formatTask, withField } from "../models/TaskModel";
import { TaskWorkSettings } from "../settings";
import { parseNLDate } from "./NLDate";
import { PromptModal } from "../ui/PromptModal";
import { calculateNextOccurrence } from "./Recurrence";


/**
 * Gets the task at the current cursor line in the editor.
 * @param editor - The editor instance
 * @returns Task and line number, or null if no task found
 */
function getLineTask(editor: Editor): { task: Task, lineNo: number } | null {
  const lineNo = editor.getCursor().line;
  const line = editor.getLine(lineNo);
  const task = parseTask(line);
  if (!task) return null;
  task.lineNo = lineNo;
  return { task, lineNo };
}

/**
 * Toggles the completion status of the task at the cursor.
 * If the task is recurring and being completed, creates a new occurrence.
 * @param editor - The editor instance
 * @param view - The markdown view
 * @param settings - Plugin settings
 */
export async function toggleCompleteAtCursor(editor: Editor, view: MarkdownView, settings: TaskWorkSettings) {
  const ctx = getLineTask(editor);
  if (!ctx) { new Notice("TaskWork: No task on this line."); return; }
  const t = ctx.task;
  const checked = !t.checked;
  const today = new Date();
  const completed = checked ? iso(today) : undefined;

  const updated = withField({ ...t, checked }, "completed", completed);
  const line = formatTask(updated);
  editor.setLine(ctx.lineNo!, line);

  // If completing a recurring task, create the next occurrence
  if (checked && t.recur && t.recur.length > 0) {
    const nextDue = calculateNextOccurrence(t.recur, today);
    if (nextDue) {
      // Create new task with next occurrence
      const newTask: Task = {
        ...t,
        checked: false,
        due: nextDue,
        completed: undefined,
        recur: t.recur, // Keep the recurrence pattern
      };

      // Remove description from the new task (don't duplicate it)
      delete newTask.description;

      const newTaskLine = formatTask(newTask);
      
      // Insert the new task on the next line
      const insertLine = ctx.lineNo! + 1;
      const currentLine = editor.getLine(ctx.lineNo!);
      const nextLine = editor.getLine(insertLine);
      
      // Determine if we need a newline before the new task
      const needsNewline = nextLine.trim().length > 0;
      const insertText = needsNewline ? `\n${newTaskLine}` : newTaskLine;
      
      // Insert at the end of the current line (after the completed task)
      const insertPos = { line: ctx.lineNo!, ch: currentLine.length };
      editor.replaceRange(insertText, insertPos, insertPos);
      
      new Notice(`TaskWork: Next occurrence scheduled for ${nextDue}`);
    } else {
      new Notice(`TaskWork: Invalid recurrence pattern: ${t.recur}`);
    }
  }
}

/**
 * Sets a field value on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param key - The field key to set ("due", "priority", "project", or "recur")
 * @param settings - Plugin settings
 */
export async function setFieldAtCursor(app: App, editor: Editor, key: "due"|"priority"|"project"|"recur", settings: TaskWorkSettings) {
  const ctx = getLineTask(editor);
  if (!ctx) { new Notice("TaskWork: No task on this line."); return; }

  let promptText = `Set ${key}:`;
  let defaultValue = "";
  
  if (key === "due" && settings.nlDateParsing) {
    defaultValue = "today";
  } else if (key === "priority") {
    defaultValue = settings.allowedPriorities[0] || "";
  } else if (key === "recur") {
    defaultValue = "every Tuesday";
    promptText = "Set recurrence (e.g., 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'):";
  }

  const modal = new PromptModal(app, promptText, defaultValue);
  const value = await modal.prompt();
  if (value == null) return;

  let v = value.trim();
  if (key === "due" && settings.nlDateParsing) {
    v = parseNLDate(v) ?? v;
  }

  const updated = { ...ctx.task } as Task;
  (updated as any)[key] = v;
  editor.setLine(ctx.lineNo!, formatTask(updated));
}

/**
 * Adds or removes tags on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
export async function addRemoveTagsAtCursor(app: App, editor: Editor, settings: TaskWorkSettings) {
  const ctx = getLineTask(editor);
  if (!ctx) { new Notice("TaskWork: No task on this line."); return; }

  const currentTags = ctx.task.tags.join(" ");
  const modal = new PromptModal(app, "Add/remove tags (space-separated, prefix with - to remove):", currentTags);
  const input = await modal.prompt();
  if (input == null) return;

  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const tagsToAdd: string[] = [];
  const tagsToRemove: string[] = [];
  const existingTags = new Set(ctx.task.tags);

  for (const tok of tokens) {
    if (tok.startsWith("-")) {
      const tag = tok.substring(1);
      if (tag.startsWith("#")) {
        tagsToRemove.push(tag);
      } else {
        tagsToRemove.push("#" + tag);
      }
    } else {
      const tag = tok.startsWith("#") ? tok : "#" + tok;
      tagsToAdd.push(tag);
    }
  }

  // Remove tags
  for (const tag of tagsToRemove) {
    existingTags.delete(tag);
  }

  // Add tags
  for (const tag of tagsToAdd) {
    existingTags.add(tag);
  }

  const updated = { ...ctx.task, tags: Array.from(existingTags) } as Task;
  editor.setLine(ctx.lineNo!, formatTask(updated));
}

/**
 * Normalizes the task line at the cursor to standard format.
 * @param editor - The editor instance
 */
export function normalizeTaskLine(editor: Editor) {
  const ctx = getLineTask(editor);
  if (!ctx) { new Notice("TaskWork: No task on this line."); return; }

  const normalized = formatTask(ctx.task);
  editor.setLine(ctx.lineNo!, normalized);
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
