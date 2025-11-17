import { App, Notice, TFile, MarkdownView } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../../TasksPanelTypes";
import { ProjectReviewInfo } from "../../WeeklyReviewPanelTypes";
import { Task, parseTaskWithDescription, formatTaskWithDescription } from "../../../models/TaskModel";
import { formatISODate } from "../../../utils/dateUtils";
import { calculateNextOccurrence } from "../../../services/Recurrence";
import { parseNLDate } from "../../../services/NLDate";
import { normalizeInboxPath } from "../../../utils/areaUtils";
import { getSomedayMaybePath, isInSomedayMaybeFolder } from "../../../utils/somedayMaybeUtils";
import { inferAreaFromPath, isInTasksFolder, isTasksFolderFile, getAreas } from "../../../utils/areaUtils";
import { FilePickerModal } from "../../../ui/FilePickerModal";
import { PromptModal } from "../../../ui/PromptModal";
import { captureQuickTask } from "../../../ui/CaptureModal";

/**
 * Adds tasks to Inbox from text input.
 */
export async function addTasksToInbox(
  app: App,
  settings: GeckoTaskSettings,
  text: string
): Promise<void> {
  // Split by newlines and create tasks
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const inboxPath = normalizeInboxPath(settings.inboxPath);
  
  for (const line of lines) {
    const task: Task = {
      checked: false,
      title: line.trim(),
      tags: [],
      raw: ""
    };
    
    const taskLines = formatTaskWithDescription(task);
    const inboxFile = app.vault.getAbstractFileByPath(inboxPath);
    if (inboxFile instanceof TFile) {
      const content = await app.vault.read(inboxFile);
      const updated = content.trim().length 
        ? content + "\n" + taskLines.join("\n") + "\n" 
        : taskLines.join("\n") + "\n";
      await app.vault.modify(inboxFile, updated);
    }
  }
  
  new Notice(`Added ${lines.length} task(s) to Inbox`);
}

/**
 * Moves a task to a project.
 */
export async function moveTaskToProject(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  // FilePickerModal will automatically get and sort files
  const target = await new FilePickerModal(app, [], settings).openAndGet();
  if (!target) return;

  await moveTask(app, task, target.path);
  new Notice(`Task moved to ${target.path}`);
}

/**
 * Moves a task to Someday/Maybe.
 */
export async function moveTaskToSomedayMaybe(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  // Determine area from task
  const areas = getAreas(app, settings);
  const area = task.area || (areas.length > 0 ? areas[0] : undefined);
  if (!area) {
    new Notice("No area found for task");
    return;
  }

  const somedayMaybePath = getSomedayMaybePath(area, settings) + ".md";
  
  // Check if file exists, create if not
  let somedayMaybeFile = app.vault.getAbstractFileByPath(somedayMaybePath);
  if (!somedayMaybeFile) {
    somedayMaybeFile = await app.vault.create(somedayMaybePath, `# ${settings.somedayMaybeFolderName}\n\n`);
  }

  if (!(somedayMaybeFile instanceof TFile)) {
    new Notice(`Failed to create ${settings.somedayMaybeFolderName} file`);
    return;
  }

  await moveTask(app, task, somedayMaybePath);
  new Notice(`Task moved to ${settings.somedayMaybeFolderName} (${area})`);
}

/**
 * Moves a task to a different file.
 */
async function moveTask(app: App, task: IndexedTask, targetPath: string): Promise<void> {
  const sourceFile = app.vault.getAbstractFileByPath(task.path);
  if (!(sourceFile instanceof TFile)) return;

  let taskWithDescription: Task | null = null;
  
  await app.vault.process(sourceFile, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
    if (!parsed) return data;

    taskWithDescription = {
      ...parsed,
      area: undefined,
      project: undefined
    };

    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    return lines.join("\n");
  });

  if (!taskWithDescription) return;

  const updatedLines = formatTaskWithDescription(taskWithDescription);
  const targetFile = app.vault.getAbstractFileByPath(targetPath);
  if (!(targetFile instanceof TFile)) return;

  const targetContent = await app.vault.read(targetFile);
  const finalLines = updatedLines.join("\n");
  const updated = targetContent.trim().length 
    ? targetContent + "\n" + finalLines + "\n" 
    : finalLines + "\n";
  await app.vault.modify(targetFile, updated);
}

/**
 * Updates a task's due date.
 */
export async function updateTaskDueDate(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const defaultValue = task.due ?? "today";
  const modal = new PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue);
  const next = await modal.prompt();
  if (next == null || next.trim() === "") return;
  
  const parsed = parseNLDate(next) ?? next;
  await updateTaskField(app, task, "due", parsed);
}

/**
 * Updates a task field.
 */
async function updateTaskField(
  app: App,
  task: IndexedTask,
  key: "due" | "priority" | "recur",
  value?: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;
  
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
    if (!parsed) return data;

    if (key === "due") {
      parsed.due = value;
    } else if (key === "priority") {
      parsed.priority = value;
    } else if (key === "recur") {
      parsed.recur = value;
    }

    const updatedLines = formatTaskWithDescription(parsed);
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });
}

/**
 * Removes a tag from a task.
 */
export async function removeTag(
  app: App,
  task: IndexedTask,
  tag: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!(file instanceof TFile)) return;
  
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
    
    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
    if (!parsed) return data;

    const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
    parsed.tags = parsed.tags.filter(t => t !== normalizedTag);

    const updatedLines = formatTaskWithDescription(parsed);
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    
    return lines.join("\n");
  });

  new Notice(`Removed ${tag} tag`);
}

/**
 * Activates a Someday/Maybe task (moves to active project in same area).
 */
export async function activateSomedayMaybeTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const area = task.area;
  if (!area) {
    new Notice("No area found for task");
    return;
  }

  // Get all project files in the same area (excluding Someday Maybe folder)
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  const files = app.vault.getMarkdownFiles()
    .filter(f => {
      if (!isInTasksFolder(f.path, settings)) return false;
      if (isTasksFolderFile(f.path, settings)) return false;
      const fileArea = inferAreaFromPath(f.path, app, settings);
      if (fileArea !== area) return false;
      if (f.path === normalizedInboxPath) return false;
      if (isInSomedayMaybeFolder(f.path, settings, app)) {
        return false;
      }
      return true;
    });

  if (files.length === 0) {
    new Notice(`No active projects found in ${area} area`);
    return;
  }

  const target = await new FilePickerModal(app, files, settings).openAndGet();
  if (!target) return;

  await moveTask(app, task, target.path);
  new Notice(`Task activated and moved to ${target.basename}`);
}

/**
 * Activates a Someday/Maybe project (moves all tasks to an active project in same area).
 */
export async function activateSomedayMaybeProject(
  app: App,
  settings: GeckoTaskSettings,
  project: ProjectReviewInfo
): Promise<void> {
  const area = project.area;
  if (!area) {
    new Notice("No area found for project");
    return;
  }

  // Get all project files in the same area (excluding Someday Maybe folder)
  const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
  const files = app.vault.getMarkdownFiles()
    .filter(f => {
      if (!isInTasksFolder(f.path, settings)) return false;
      if (isTasksFolderFile(f.path, settings)) return false;
      const fileArea = inferAreaFromPath(f.path, app, settings);
      if (fileArea !== area) return false;
      if (f.path === normalizedInboxPath) return false;
      if (isInSomedayMaybeFolder(f.path, settings, app)) {
        return false;
      }
      return true;
    });

  if (files.length === 0) {
    new Notice(`No active projects found in ${area} area`);
    return;
  }

  const target = await new FilePickerModal(app, files, settings).openAndGet();
  if (!target) return;

  // Move all tasks from the Someday Maybe project to the target project
  const sourceFile = app.vault.getAbstractFileByPath(project.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice("Source project file not found");
    return;
  }

  // Read source file to get all tasks
  const sourceContent = await app.vault.read(sourceFile);
  const sourceLines = sourceContent.split("\n");
  
  // Find all task lines in the source file
  const cache = app.metadataCache.getCache(project.path);
  const lists = cache?.listItems;
  if (!lists || lists.length === 0) {
    new Notice("No tasks found in project");
    return;
  }

  // Collect all task line ranges
  const taskRanges: { startLine: number; endLine: number; lines: string[] }[] = [];
  
  for (const li of lists) {
    if (!li.task) continue;
    const lineNo = li.position?.start?.line ?? 0;
    if (lineNo < 0 || lineNo >= sourceLines.length) continue;
    
    const { task: parsed, endLine } = parseTaskWithDescription(sourceLines, lineNo);
    if (!parsed) continue;
    
    const taskLines = sourceLines.slice(lineNo, endLine + 1);
    taskRanges.push({ startLine: lineNo, endLine, lines: taskLines });
  }

  if (taskRanges.length === 0) {
    new Notice("No tasks to move");
    return;
  }

  // Remove tasks from source file
  await app.vault.process(sourceFile, (data) => {
    const lines = data.split("\n");
    const sortedRanges = [...taskRanges].sort((a, b) => b.startLine - a.startLine);
    
    for (const range of sortedRanges) {
      const numLines = range.endLine - range.startLine + 1;
      lines.splice(range.startLine, numLines);
    }
    return lines.join("\n");
  });

  // Add tasks to target file
  const targetContent = await app.vault.read(target);
  const tasksText = taskRanges.map(r => r.lines.join("\n")).join("\n\n");
  const updated = targetContent.trim().length 
    ? targetContent + "\n\n" + tasksText + "\n" 
    : tasksText + "\n";
  await app.vault.modify(target, updated);

  new Notice(`Project activated: ${taskRanges.length} task(s) moved to ${target.basename}`);
}

/**
 * Adds a task to a project.
 */
export async function addTaskToProject(
  app: App,
  settings: GeckoTaskSettings,
  projectPath: string
): Promise<void> {
  await captureQuickTask(app, settings, undefined, projectPath);
}

/**
 * Opens the note containing a task and scrolls to it.
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
 * Opens a project file.
 */
export async function openProjectFile(app: App, projectPath: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(projectPath);
  if (!(file instanceof TFile)) return;

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
}

