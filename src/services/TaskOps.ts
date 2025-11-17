import { App, Editor, MarkdownView, Notice } from "obsidian";
import { Task, parseTask, formatTask, withField, parseTaskWithDescription, formatTaskWithDescription } from "../models/TaskModel";
import { GeckoTaskSettings } from "../settings";
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
export async function toggleCompleteAtCursor(editor: Editor, view: MarkdownView, settings: GeckoTaskSettings) {
  const ctx = getLineTask(editor);
  if (!ctx) { new Notice("GeckoTask: No task on this line."); return; }
  const currentLineNo = ctx.lineNo!;
  
  // Get all lines from the editor to parse task with description
  const totalLines = editor.lineCount();
  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(editor.getLine(i));
  }
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: Could not parse task."); return; }
  
  const checked = !parsed.checked;
  const today = new Date();
  const completion = checked ? iso(today) : undefined;

  // Update the task
  parsed.checked = checked;
  parsed.completion = completion;

  // Format the updated task with description
  const updatedLines = formatTaskWithDescription(parsed);
  const updatedText = updatedLines.join("\n");
  
  // Get the start and end positions of the task block
  const startLine = currentLineNo;
  const endLineNo = endLine;
  const startLineContent = editor.getLine(startLine);
  const endLineContent = editor.getLine(endLineNo);
  
  // Calculate positions: start at beginning of task line, end at end of last description line
  const startPos = { line: startLine, ch: 0 };
  const endPos = { line: endLineNo, ch: endLineContent.length };
  
  // Replace the entire task block (including description) with the updated version
  editor.replaceRange(updatedText, startPos, endPos);

  // If completing a recurring task, create the next occurrence
  if (checked && parsed.recur && parsed.recur.length > 0) {
    const nextDue = calculateNextOccurrence(parsed.recur, today);
    if (nextDue) {
      // Create new task with next occurrence
      const newTask: Task = {
        ...parsed,
        checked: false,
        due: nextDue,
        completion: undefined,
        recur: parsed.recur, // Keep the recurrence pattern
      };

      const newTaskLines = formatTaskWithDescription(newTask);
      
      // Insert on the line directly underneath the task
      // After replacing the task, the task ends at startLine + updatedLines.length - 1
      const taskEndLine = startLine + updatedLines.length - 1;
      const taskEndLineContent = editor.getLine(taskEndLine);
      const insertPos = { line: taskEndLine, ch: taskEndLineContent.length };
      
      // Insert the new task on the next line (directly underneath)
      const insertText = "\n" + newTaskLines.join("\n");
      
      editor.replaceRange(insertText, insertPos, insertPos);
      
      new Notice(`GeckoTask: Next occurrence scheduled for ${nextDue}`);
    } else {
      new Notice(`GeckoTask: Invalid recurrence pattern: ${parsed.recur}`);
    }
  }
}

/**
 * Sets a field value on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param key - The field key to set ("due", "priority", or "recur")
 * @param settings - Plugin settings
 */
export async function setFieldAtCursor(app: App, editor: Editor, key: "due"|"priority"|"recur", settings: GeckoTaskSettings) {
  const currentLineNo = editor.getCursor().line;
  
  // Get all lines from the editor to parse task with description
  const totalLines = editor.lineCount();
  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(editor.getLine(i));
  }
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: No task on this line."); return; }

  let promptText = `Set ${key}:`;
  let defaultValue = "";
  
  if (key === "due") {
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
  if (key === "due") {
    v = parseNLDate(v) ?? v;
  }

  // Update the task
  const updated = { ...parsed } as Task;
  // TypeScript doesn't support dynamic property assignment on typed objects,
  // but we know the key is valid (enforced by the function signature)
  (updated as any)[key] = v;

  // Format the updated task with description
  const updatedLines = formatTaskWithDescription(updated);
  const updatedText = updatedLines.join("\n");
  
  // Get the start and end positions of the task block
  const startLine = currentLineNo;
  const endLineNo = endLine;
  const startLineContent = editor.getLine(startLine);
  const endLineContent = editor.getLine(endLineNo);
  
  // Calculate positions: start at beginning of task line, end at end of last description line
  const startPos = { line: startLine, ch: 0 };
  const endPos = { line: endLineNo, ch: endLineContent.length };
  
  // Replace the entire task block (including description) with the updated version
  editor.replaceRange(updatedText, startPos, endPos);
}

/**
 * Adds or removes tags on the task at the cursor via user prompt.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
export async function addRemoveTagsAtCursor(app: App, editor: Editor, settings: GeckoTaskSettings) {
  const currentLineNo = editor.getCursor().line;
  
  // Get all lines from the editor to parse task with description
  const totalLines = editor.lineCount();
  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(editor.getLine(i));
  }
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: No task on this line."); return; }

  const currentTags = parsed.tags.join(" ");
  const modal = new PromptModal(app, "Add/remove tags (space-separated, prefix with - to remove):", currentTags);
  const input = await modal.prompt();
  if (input == null) return;

  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const tagsToAdd: string[] = [];
  const tagsToRemove: string[] = [];
  const existingTags = new Set(parsed.tags);

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

  // Update the task
  const updated = { ...parsed, tags: Array.from(existingTags) } as Task;
  
  // Format the updated task with description
  const updatedLines = formatTaskWithDescription(updated);
  const updatedText = updatedLines.join("\n");
  
  // Get the start and end positions of the task block
  const startLine = currentLineNo;
  const endLineNo = endLine;
  const startLineContent = editor.getLine(startLine);
  const endLineContent = editor.getLine(endLineNo);
  
  // Calculate positions: start at beginning of task line, end at end of last description line
  const startPos = { line: startLine, ch: 0 };
  const endPos = { line: endLineNo, ch: endLineContent.length };
  
  // Replace the entire task block (including description) with the updated version
  editor.replaceRange(updatedText, startPos, endPos);
}

/**
 * Normalizes the task line at the cursor to standard format.
 * @param editor - The editor instance
 */
export function normalizeTaskLine(editor: Editor) {
  const currentLineNo = editor.getCursor().line;
  
  // Get all lines from the editor to parse task with description
  const totalLines = editor.lineCount();
  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(editor.getLine(i));
  }
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: No task on this line."); return; }

  // Format the normalized task with description
  const normalizedLines = formatTaskWithDescription(parsed);
  const normalizedText = normalizedLines.join("\n");
  
  // Get the start and end positions of the task block
  const startLine = currentLineNo;
  const endLineNo = endLine;
  const startLineContent = editor.getLine(startLine);
  const endLineContent = editor.getLine(endLineNo);
  
  // Calculate positions: start at beginning of task line, end at end of last description line
  const startPos = { line: startLine, ch: 0 };
  const endPos = { line: endLineNo, ch: endLineContent.length };
  
  // Replace the entire task block (including description) with the normalized version
  editor.replaceRange(normalizedText, startPos, endPos);
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
