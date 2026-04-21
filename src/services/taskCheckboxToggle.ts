import { Editor, MarkdownView, Notice } from "obsidian";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "../models/TaskModel";
import { calculateNextOccurrenceDates } from "./Recurrence";
import { formatISODateTime } from "../utils/dateUtils";
import { getAllEditorLines, replaceTaskBlock } from "../utils/editorUtils";

/**
 * Handles checkbox toggle in the editor: completion metadata and recurring next occurrence.
 */
export async function handleTaskCheckboxToggle(
  editor: Editor,
  _view: MarkdownView,
  lineNo: number
): Promise<void> {
  const lines = getAllEditorLines(editor);

  const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
  if (!parsed) return;

  const today = new Date();
  let needsUpdate = false;
  let justAddedCompletedDate = false;

  if (parsed.checked) {
    if (!parsed.completion) {
      parsed.completion = formatISODateTime(today);
      needsUpdate = true;
      justAddedCompletedDate = true;
    }
  } else {
    if (parsed.completion) {
      parsed.completion = undefined;
      needsUpdate = true;
    }
  }

  let updatedLines: string[] | null = null;
  if (needsUpdate) {
    updatedLines = formatTaskWithDescription(parsed);
    const updatedText = updatedLines.join("\n");
    replaceTaskBlock(editor, lineNo, endLine, updatedText);
  }

  if (parsed.recur && parsed.recur.length > 0 && parsed.checked && parsed.completion && justAddedCompletedDate) {
    const nextDates = calculateNextOccurrenceDates(parsed.recur, today, parsed);
    if (nextDates) {
      const newTask: Task = {
        ...parsed,
        checked: false,
        scheduled: nextDates.scheduled,
        due: nextDates.due,
        completion: undefined,
        recur: parsed.recur,
      };

      const newTaskLines = formatTaskWithDescription(newTask);

      const taskEndLine = updatedLines ? lineNo + updatedLines.length - 1 : endLine;
      const taskEndLineContent = editor.getLine(taskEndLine);
      const insertPos = { line: taskEndLine, ch: taskEndLineContent.length };

      const insertText = "\n" + newTaskLines.join("\n");
      editor.replaceRange(insertText, insertPos, insertPos);

      const dateParts: string[] = [];
      if (nextDates.scheduled) dateParts.push(`scheduled: ${nextDates.scheduled}`);
      if (nextDates.due) dateParts.push(`due: ${nextDates.due}`);
      const dateMsg = dateParts.join(", ");
      new Notice(`GeckoTask: Next occurrence ${dateMsg}`);
    }
  }
}
