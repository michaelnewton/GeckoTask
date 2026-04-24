import { App, TFile, Notice, MarkdownView } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../TasksPanelTypes";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "../../../models/TaskModel";
import { formatISODateTime } from "../../../utils/dateUtils";
import { calculateNextOccurrenceDates } from "../../../services/Recurrence";
import { isInInboxFolder, getAreaSomedayMaybePath, getSpaces, inferProjectFromPath } from "../../../utils/areaUtils";

function normalizeReferenceListPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) return trimmed;
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

function isReferenceListTarget(path: string, settings: GeckoTaskSettings): boolean {
  const target = normalizeReferenceListPath(path);
  return settings.referenceListPaths
    .map(normalizeReferenceListPath)
    .includes(target);
}

function toReferenceBulletLines(task: Task): string[] {
  const title = task.title.trim();
  const firstLine = `- ${title.length > 0 ? title : "(empty task)"}`;
  const lines = [firstLine];
  if (task.description) {
    const descriptionLines = task.description.split("\n");
    for (const line of descriptionLines) {
      lines.push(`  ${line}`);
    }
  }
  return lines;
}

/**
 * Toggles the completion status of a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to toggle
 * @param checked - New checked state
 * @returns Promise that resolves when task is updated
 */
export async function toggleTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  checked: boolean
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;

  let nextOccurrenceDue: string | null = null;
  let nextOccurrenceDates: { scheduled?: string; due?: string } | null = null;

  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = (task.line ?? 1) - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    // Parse the current task to preserve all fields including description
    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) return data;

    // Update checked status
    parsed.checked = checked;
    
    // Update completed date
    let nextOccurrenceTask: Task | null = null;
    if (checked) {
      if (!parsed.completion) {
        const today = formatISODateTime(new Date());
        parsed.completion = today;
      }
      
      // If recurring task, create next occurrence
      if (parsed.recur && parsed.recur.length > 0) {
        const today = new Date();
        const nextDates = calculateNextOccurrenceDates(parsed.recur, today, parsed);
        if (nextDates) {
          nextOccurrenceDates = nextDates;
          nextOccurrenceDue = nextDates.scheduled || nextDates.due || null;
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
    } else {
      parsed.completion = undefined;
    }

    // Format task with description
    const updatedLines = formatTaskWithDescription(parsed);
    
    // If we have a next occurrence, add it directly underneath the current task
    if (nextOccurrenceTask) {
      const nextOccurrenceLines = formatTaskWithDescription(nextOccurrenceTask);
      updatedLines.push(...nextOccurrenceLines);
    }
    
    // Replace task line and description lines
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });

  if (checked && nextOccurrenceDue && nextOccurrenceDates) {
    // Build notice message based on which dates were set
    const dateParts: string[] = [];
    const { scheduled, due } = nextOccurrenceDates;
    if (scheduled) dateParts.push(`scheduled: ${scheduled}`);
    if (due) dateParts.push(`due: ${due}`);
    const dateMsg = dateParts.join(", ");
    new Notice(`Task completed. Next occurrence ${dateMsg}`);
  } else {
    new Notice(`Task ${checked ? "completed" : "reopened"}`);
  }
}

/**
 * Updates a field value on a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to update
 * @param key - Field key to update ("due", "scheduled", "priority", or "recur")
 * @param value - New field value (optional)
 * @returns Promise that resolves when task is updated
 */
export async function updateTaskField(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  key: "due" | "scheduled" | "priority" | "recur",
  value?: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;
  
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = (task.line ?? 1) - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    // Parse the current task to preserve all fields including description
    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) return data;

    // Update the field
    if (key === "due") {
      parsed.due = value;
    } else if (key === "scheduled") {
      parsed.scheduled = value;
    } else if (key === "priority") {
      parsed.priority = value;
    } else if (key === "recur") {
      parsed.recur = value;
    }

    // Format task with description
    const updatedLines = formatTaskWithDescription(parsed);
    
    // Replace task line and description lines
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });
}

/**
 * Updates the title of a task.
 * @param app - Obsidian app instance
 * @param task - The indexed task to update
 * @param newTitle - New title text
 * @returns Promise that resolves when task is updated
 */
export async function updateTaskTitle(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  newTitle: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;
  
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = (task.line ?? 1) - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;
    
    // Parse the current task to preserve all fields including description
    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) return data;
    
    // Update the title
    parsed.title = newTitle;
    
    // Format task with description
    const updatedLines = formatTaskWithDescription(parsed);
    
    // Replace task line and description lines
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });
}

/**
 * Deletes a task and, for inbox files, deletes the file if no tasks remain.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param task - The indexed task to delete
 */
export async function deleteTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;

  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = (task.line ?? 1) - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;

    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    return lines.join("\n");
  });

  if (isInInboxFolder(file.path, settings)) {
    const updatedContent = await app.vault.read(file);
    const hasRemainingTasks = updatedContent
      .split("\n")
      .some(line => /^\s*-\s*\[[ x]\]\s+/i.test(line));

    if (!hasRemainingTasks) {
      await app.vault.delete(file);
      new Notice("Task deleted and empty inbox file removed");
      return;
    }
  }

  new Notice("Task deleted");
}

/**
 * Opens the note containing a task and scrolls to it.
 * @param app - Obsidian app instance
 * @param task - The indexed task to open
 * @returns Promise that resolves when file is opened
 */
export async function openTaskInNote(app: App, task: IndexedTask): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  
  // Scroll to the line
  const view = leaf.view;
  if (view instanceof MarkdownView && view.editor) {
    const editor = view.editor;
    const line = Math.max(0, task.line - 1); // 0-based
    editor.setCursor(line, 0);
    editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
  }
}

/**
 * Moves a task to a different file via file picker.
 * @param app - Obsidian app instance
 * @param task - The indexed task to move
 * @param targetFile - Target file to move task to
 * @returns Promise that resolves when task is moved
 */
export async function moveTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  targetFile: TFile
): Promise<void> {
  try {
    // Remove from current file (preserving description)
    const sourceFile = app.vault.getAbstractFileByPath(task.path);
    if (!(sourceFile instanceof TFile)) {
      new Notice("GeckoTask: Source file not found.");
      return;
    }
    const sourceIsInbox = isInInboxFolder(sourceFile.path, settings);

    let taskWithDescription: Task | null = null;
    await app.vault.process(sourceFile, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1; // 0-based
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      // Parse current task with description
      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
        nlDateParsing: settings.nlDateParsing
      });
      if (!parsed) return data;

      // Update task metadata (remove space:: and project:: since we're using folder/file-based structure)
      taskWithDescription = {
        ...parsed,
        space: undefined, // Don't store space in metadata, it's derived from folder
        project: undefined, // Don't store project in metadata, it's derived from file basename
      };

      // Remove task line and description lines
      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      return lines.join("\n");
    });

    if (!taskWithDescription) {
      new Notice("GeckoTask: Could not parse task to move.");
      return;
    }

    // Ensure target file exists and is accessible
    let finalTargetFile = app.vault.getAbstractFileByPath(targetFile.path);
    if (!finalTargetFile || !(finalTargetFile instanceof TFile)) {
      // If file doesn't exist, try to get it from the target object directly
      finalTargetFile = targetFile;
    }
    
    if (!finalTargetFile || !(finalTargetFile instanceof TFile)) {
      new Notice(`GeckoTask: Target file not found: ${targetFile.path}`);
      return;
    }

    const shouldWriteReferenceBullet = isReferenceListTarget(finalTargetFile.path, settings);
    const updatedLines = shouldWriteReferenceBullet
      ? toReferenceBulletLines(taskWithDescription)
      : formatTaskWithDescription(taskWithDescription);

    // Append to target file
    const targetContent = await app.vault.read(finalTargetFile);
    const finalLines = updatedLines.join("\n");
    const updated = targetContent.trim().length 
      ? targetContent + "\n" + finalLines + "\n" 
      : finalLines + "\n";
    await app.vault.modify(finalTargetFile, updated);

    if (sourceIsInbox) {
      const sourceContentAfterMove = await app.vault.read(sourceFile);
      if (sourceContentAfterMove.trim().length === 0) {
        await app.vault.delete(sourceFile);
      }
    }

    new Notice(`GeckoTask: Moved task to ${finalTargetFile.path}`);
  } catch (error) {
    new Notice(`GeckoTask: Error moving task: ${error}`);
    console.error("GeckoTask: Error moving task:", error);
  }
}

/**
 * Moves a task to Someday/Maybe from any task view context.
 * Project tasks go to project-level Someday/Maybe; non-project tasks go to area-level Someday/Maybe.
 */
export async function moveTaskToSomedayMaybe(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const spaces = getSpaces(app, settings);
  const noSpacesMode = spaces.length === 0;
  let targetPath: string | undefined;

  if (noSpacesMode) {
    const rootScope = inferRootScopeNoSpaces(task.path, settings);
    if (!rootScope) {
      new Notice("GeckoTask: Could not determine Someday/Maybe scope for this task.");
      return;
    }
    targetPath = getAreaSomedayMaybePath(rootScope, settings);
  } else {
    const projectInfo = inferProjectFromPath(task.path, settings);
    const space = task.space || projectInfo?.space || spaces[0];
    if (!space) {
      new Notice("GeckoTask: No space configured for Someday/Maybe.");
      return;
    }

    if (projectInfo?.project) {
      targetPath = `${space}/${settings.projectsSubfolder}/${projectInfo.project}/${settings.somedayMaybeFileName}.md`;
    } else {
      targetPath = getAreaSomedayMaybePath(space, settings);
    }
  }

  if (!targetPath) {
    new Notice("GeckoTask: Could not determine Someday/Maybe destination.");
    return;
  }

  let targetFile = app.vault.getAbstractFileByPath(targetPath);
  if (!targetFile) {
    const folderPath = targetPath.split("/").slice(0, -1).join("/");
    const existingFolder = app.vault.getAbstractFileByPath(folderPath);
    if (!existingFolder) {
      await app.vault.createFolder(folderPath);
    }
    targetFile = await app.vault.create(targetPath, "# Someday/Maybe\n\n");
  }

  if (!(targetFile instanceof TFile)) {
    new Notice("GeckoTask: Could not create Someday/Maybe file.");
    return;
  }

  await moveTask(app, settings, task, targetFile);
  new Notice(`GeckoTask: Moved task to Someday/Maybe (${targetFile.path})`);
}

function inferRootScopeNoSpaces(path: string, settings: GeckoTaskSettings): string | undefined {
  const projectsMarker = `/${settings.projectsSubfolder}/`;
  const areaMarker = `/${settings.areaTasksSubfolder}/`;

  const projectsIdx = path.indexOf(projectsMarker);
  if (projectsIdx > 0) {
    return path.slice(0, projectsIdx);
  }

  const areaIdx = path.indexOf(areaMarker);
  if (areaIdx > 0) {
    return path.slice(0, areaIdx);
  }

  return undefined;
}
