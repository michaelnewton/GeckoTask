import { App, Notice, TFile } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../../tasks/TasksPanelTypes";
import { formatISODateTime } from "../../../utils/dateUtils";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "../../../models/TaskModel";
import { calculateNextOccurrenceDates } from "../../../services/Recurrence";

/**
 * Completes a task and handles recurrence if applicable.
 */
export async function completeTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;

  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) return data;

    parsed.checked = true;
    if (!parsed.completion) {
      const today = formatISODateTime(new Date());
      parsed.completion = today;
    }

    // Handle recurring tasks
    let nextOccurrenceTask: Task | null = null;
    if (parsed.recur && parsed.recur.length > 0) {
      const today = new Date();
      const nextDates = calculateNextOccurrenceDates(parsed.recur, today, parsed);
      if (nextDates) {
        nextOccurrenceTask = {
          ...parsed,
          checked: false,
          scheduled: nextDates.scheduled,
          due: nextDates.due,
          completion: undefined,
          recur: parsed.recur,
        };
      }
    }

    const updatedLines = formatTaskWithDescription(parsed);
    
    if (nextOccurrenceTask) {
      const nextOccurrenceLines = formatTaskWithDescription(nextOccurrenceTask);
      updatedLines.push(...nextOccurrenceLines);
    }
    
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });

  new Notice("Task completed");
}

/**
 * Deletes a task from its file.
 */
export async function deleteTask(app: App, task: IndexedTask): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;

  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    
    return lines.join("\n");
  });

  new Notice("Task deleted");
}

