import { App, Editor, MarkdownView, Notice } from "obsidian";
import { Task, parseTask, formatTask, withField, parseTaskWithDescription, formatTaskWithDescription } from "../models/TaskModel";
import { GeckoTaskSettings } from "../settings";
import { parseNLDate } from "./NLDate";
import { PromptModal } from "../ui/PromptModal";
import { calculateNextOccurrence } from "./Recurrence";
import { formatISODate } from "../utils/dateUtils";
import { getAllEditorLines, replaceTaskBlock } from "../utils/editorUtils";


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
  const lines = getAllEditorLines(editor);
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: Could not parse task."); return; }
  
  const checked = !parsed.checked;
  const today = new Date();
  const completion = checked ? formatISODate(today) : undefined;

  // Update the task
  parsed.checked = checked;
  parsed.completion = completion;

  // Format the updated task with description
  const updatedLines = formatTaskWithDescription(parsed);
  const updatedText = updatedLines.join("\n");
  
  // Replace the entire task block (including description) with the updated version
  replaceTaskBlock(editor, currentLineNo, endLine, updatedText);

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
      // After replacing the task, the task ends at currentLineNo + updatedLines.length - 1
      const taskEndLine = currentLineNo + updatedLines.length - 1;
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
  const lines = getAllEditorLines(editor);
  
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

  // Update the task with type-safe field assignment
  const updated: Task = { ...parsed };
  if (key === "due") {
    updated.due = v || undefined;
  } else if (key === "priority") {
    updated.priority = v || undefined;
  } else if (key === "recur") {
    updated.recur = v || undefined;
  }

  // Format the updated task with description
  const updatedLines = formatTaskWithDescription(updated);
  const updatedText = updatedLines.join("\n");
  
  // Replace the entire task block (including description) with the updated version
  replaceTaskBlock(editor, currentLineNo, endLine, updatedText);
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
  const lines = getAllEditorLines(editor);
  
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
  
  // Replace the entire task block (including description) with the updated version
  replaceTaskBlock(editor, currentLineNo, endLine, updatedText);
}

/**
 * Normalizes the task line at the cursor to standard format.
 * @param editor - The editor instance
 */
export function normalizeTaskLine(editor: Editor) {
  const currentLineNo = editor.getCursor().line;
  
  // Get all lines from the editor to parse task with description
  const lines = getAllEditorLines(editor);
  
  // Parse the task with its description
  const { task: parsed, endLine } = parseTaskWithDescription(lines, currentLineNo);
  if (!parsed) { new Notice("GeckoTask: No task on this line."); return; }

  // Format the normalized task with description
  const normalizedLines = formatTaskWithDescription(parsed);
  const normalizedText = normalizedLines.join("\n");
  
  // Replace the entire task block (including description) with the normalized version
  replaceTaskBlock(editor, currentLineNo, endLine, normalizedText);
}

