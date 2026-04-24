import { App, Notice, TFile, MarkdownView } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../../tasks/TasksPanelTypes";
import { ProjectReviewInfo } from "../WeeklyReviewPanelTypes";
import { Task, parseTaskWithDescription, formatTaskWithDescription } from "../../../models/TaskModel";
import { normalizeDateInputForWrite } from "../../../services/NLDate";
import {
  getInboxFolderPath,
  isInInboxFolder,
  inferSpaceFromPath,
  isAreaTasksFile,
  isSomedayMaybeFile,
  getSpaces,
  getSortedProjectFiles,
  getAreaSomedayMaybePath,
  inferProjectFromPath
} from "../../../utils/areaUtils";
import { FilePickerModal } from "../../../ui/FilePickerModal";
import { PromptModal } from "../../../ui/PromptModal";
import { captureQuickTask } from "../../../ui/CaptureModal";

/**
 * Adds tasks to Inbox by creating a new file in the Inbox folder for each task.
 */
export async function addTasksToInbox(
  app: App,
  settings: GeckoTaskSettings,
  text: string
): Promise<void> {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const inboxFolder = getInboxFolderPath(settings);

  // Ensure inbox folder exists
  const existingFolder = app.vault.getAbstractFileByPath(inboxFolder);
  if (!existingFolder) {
    await app.vault.createFolder(inboxFolder);
  }

  for (const line of lines) {
    const task: Task = {
      checked: false,
      title: line.trim(),
      tags: [],
      raw: ""
    };

    const taskLines = formatTaskWithDescription(task);
    const slug = slugify(line.trim());
    let filePath = `${inboxFolder}/${slug}.md`;
    let counter = 1;
    while (app.vault.getAbstractFileByPath(filePath)) {
      filePath = `${inboxFolder}/${slug}-${counter}.md`;
      counter++;
    }

    await app.vault.create(filePath, taskLines.join("\n") + "\n");
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
  const target = await new FilePickerModal(app, [], settings).openAndGet();
  if (!target) return;

  await moveTask(app, settings, task, target.path);
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
  const spaces = getSpaces(app, settings);
  let smPath: string | undefined;

  if (spaces.length === 0) {
    const inferredArea = inferAreaFromPathNoSpaces(task.path, settings);
    if (!inferredArea) {
      new Notice("No root path found for task. Move the task from a valid task file.");
      return;
    }
    smPath = getAreaSomedayMaybePath(inferredArea, settings);
  } else {
    const space = task.space || spaces[0];
    if (!space) {
      new Notice("No space found for task. Configure space paths in settings.");
      return;
    }

    // Determine target: if the task has a project, use project-level; otherwise PARA area-level
    const projectInfo = inferProjectFromPath(task.path, settings);
    if (projectInfo?.project) {
      smPath = `${space}/${settings.projectsSubfolder}/${projectInfo.project}/${settings.somedayMaybeFileName}.md`;
    } else {
      smPath = getAreaSomedayMaybePath(space, settings);
    }
  }

  // Ensure file exists
  let smFile = app.vault.getAbstractFileByPath(smPath);
  if (!smFile) {
    // Ensure parent directory exists
    const dirParts = smPath.split("/");
    dirParts.pop(); // remove filename
    const dirPath = dirParts.join("/");
    const dir = app.vault.getAbstractFileByPath(dirPath);
    if (!dir) {
      await app.vault.createFolder(dirPath);
    }
    smFile = await app.vault.create(smPath, `# Someday/Maybe\n\n`);
  }

  if (!(smFile instanceof TFile)) {
    new Notice(`Failed to create Someday/Maybe file`);
    return;
  }

  await moveTask(app, settings, task, smPath);
  new Notice(`Task moved to Someday/Maybe (${smPath})`);
}

/**
 * Moves a task to a different file.
 */
async function moveTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  targetPath: string
): Promise<void> {
  const sourceFile = app.vault.getAbstractFileByPath(task.path);
  if (!(sourceFile instanceof TFile)) return;
  const sourceIsInbox = isInInboxFolder(sourceFile.path, settings);

  let taskWithDescription: Task | null = null;

  await app.vault.process(sourceFile, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = task.line - 1;
    const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;

    if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) return data;

    taskWithDescription = {
      ...parsed,
      space: undefined,
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
  const normalizedTarget = targetContent.replace(/\n+$/, "");
  const updated = normalizedTarget.length
    ? normalizedTarget + "\n" + finalLines + "\n"
    : finalLines + "\n";
  await app.vault.modify(targetFile, updated);

  if (sourceIsInbox) {
    const sourceContentAfterMove = await app.vault.read(sourceFile);
    if (sourceContentAfterMove.trim().length === 0) {
      await app.vault.delete(sourceFile);
    }
  }
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

  const normalized = normalizeDateInputForWrite(next.trim(), settings.nlDateParsing);
  if (normalized === null) {
    new Notice("GeckoTask: When natural language date parsing is off, use YYYY-MM-DD for due dates.");
    return;
  }
  await updateTaskField(app, settings, task, "due", normalized ?? undefined);
}

/**
 * Updates a task field.
 */
async function updateTaskField(
  app: App,
  settings: GeckoTaskSettings,
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

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
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
  settings: GeckoTaskSettings,
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

    const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
      nlDateParsing: settings.nlDateParsing
    });
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
 * Activates a Someday/Maybe task (moves to an active project in the same scope).
 */
export async function activateSomedayMaybeTask(
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask
): Promise<void> {
  const spaces = getSpaces(app, settings);
  const noSpacesMode = spaces.length === 0;
  const space = task.space;
  const rootScope = noSpacesMode ? inferAreaFromPathNoSpaces(task.path, settings) : undefined;
  if (!space && !rootScope) {
    new Notice("No scope found for task. Configure space paths or use valid task file paths.");
    return;
  }

  // Get all project task files in the same scope.
  const sortedFiles = getSortedProjectFiles(app, settings);
  const scopedProjectFiles = sortedFiles.filter(f => {
    if (isInInboxFolder(f.path, settings)) return false;
    if (isSomedayMaybeFile(f.path, settings)) return false;
    if (isAreaTasksFileInMode(f.path, settings, noSpacesMode)) return false;
    if (noSpacesMode) {
      const fileRootScope = inferAreaFromPathNoSpaces(f.path, settings);
      return !!rootScope && fileRootScope === rootScope;
    }
    const fileSpace = inferSpaceFromPath(f.path, app, settings);
    return fileSpace === space;
  });

  if (scopedProjectFiles.length === 0) {
    const scope = noSpacesMode ? (rootScope || "scope") : `${space} space`;
    new Notice(`No active projects found in ${scope}`);
    return;
  }

  const target = await new FilePickerModal(app, scopedProjectFiles, settings).openAndGet();
  if (!target) return;

  await moveTask(app, settings, task, target.path);
  new Notice(`Task activated and moved to ${target.basename}`);
}

/**
 * Activates a Someday/Maybe project (moves all tasks to an active project in the same scope).
 */
export async function activateSomedayMaybeProject(
  app: App,
  settings: GeckoTaskSettings,
  project: ProjectReviewInfo
): Promise<void> {
  const spaces = getSpaces(app, settings);
  const noSpacesMode = spaces.length === 0;
  const space = project.space;
  const rootScope = noSpacesMode ? inferAreaFromPathNoSpaces(project.path, settings) : undefined;
  if (!space && !rootScope) {
    new Notice("No scope found for project. Configure space paths or use valid task file paths.");
    return;
  }

  // Get all project task files in the same scope.
  const sortedFiles = getSortedProjectFiles(app, settings);
  const scopedProjectFiles = sortedFiles.filter(f => {
    if (isInInboxFolder(f.path, settings)) return false;
    if (isSomedayMaybeFile(f.path, settings)) return false;
    if (isAreaTasksFileInMode(f.path, settings, noSpacesMode)) return false;
    if (noSpacesMode) {
      const fileRootScope = inferAreaFromPathNoSpaces(f.path, settings);
      return !!rootScope && fileRootScope === rootScope;
    }
    const fileSpace = inferSpaceFromPath(f.path, app, settings);
    return fileSpace === space;
  });

  if (scopedProjectFiles.length === 0) {
    const scope = noSpacesMode ? (rootScope || "scope") : `${space} space`;
    new Notice(`No active projects found in ${scope}`);
    return;
  }

  const target = await new FilePickerModal(app, scopedProjectFiles, settings).openAndGet();
  if (!target) return;

  const sourceFile = app.vault.getAbstractFileByPath(project.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice("Source project file not found");
    return;
  }

  const sourceContent = await app.vault.read(sourceFile);
  const sourceLines = sourceContent.split("\n");

  const cache = app.metadataCache.getCache(project.path);
  const lists = cache?.listItems;
  if (!lists || lists.length === 0) {
    new Notice("No tasks found in project");
    return;
  }

  const taskRanges: { startLine: number; endLine: number; lines: string[] }[] = [];

  for (const li of lists) {
    if (!li.task) continue;
    const lineNo = li.position?.start?.line ?? 0;
    if (lineNo < 0 || lineNo >= sourceLines.length) continue;

    const { task: parsed, endLine } = parseTaskWithDescription(sourceLines, lineNo, {
      nlDateParsing: settings.nlDateParsing
    });
    if (!parsed) continue;

    const taskLines = sourceLines.slice(lineNo, endLine + 1);
    taskRanges.push({ startLine: lineNo, endLine, lines: taskLines });
  }

  if (taskRanges.length === 0) {
    new Notice("No tasks to move");
    return;
  }

  await app.vault.process(sourceFile, (data) => {
    const lines = data.split("\n");
    const sortedRanges = [...taskRanges].sort((a, b) => b.startLine - a.startLine);

    for (const range of sortedRanges) {
      const numLines = range.endLine - range.startLine + 1;
      lines.splice(range.startLine, numLines);
    }
    return lines.join("\n");
  });

  const targetContent = await app.vault.read(target);
  const tasksText = taskRanges.map(r => r.lines.join("\n")).join("\n\n");
  const normalizedTarget = targetContent.replace(/\n+$/, "");
  const updated = normalizedTarget.length
    ? normalizedTarget + "\n\n" + tasksText + "\n"
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

  const view = leaf.view;
  if (view instanceof MarkdownView && view.editor) {
    const editor = view.editor;
    const line = Math.max(0, task.line - 1);
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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function inferAreaFromPathNoSpaces(path: string, settings: GeckoTaskSettings): string | undefined {
  const projectsMarker = `/${settings.projectsSubfolder}/`;
  const areaMarker = `/${settings.areaTasksSubfolder}/`;

  const projectIdx = path.indexOf(projectsMarker);
  if (projectIdx > 0) {
    return path.slice(0, projectIdx);
  }

  const areaIdx = path.indexOf(areaMarker);
  if (areaIdx > 0) {
    return path.slice(0, areaIdx);
  }

  return undefined;
}

function isAreaTasksFileInMode(filePath: string, settings: GeckoTaskSettings, noSpacesMode: boolean): boolean {
  if (!noSpacesMode) {
    return isAreaTasksFile(filePath, settings);
  }
  const marker = `/${settings.areaTasksSubfolder}/`;
  const idx = filePath.indexOf(marker);
  if (idx <= 0) return false;
  return filePath.endsWith(`/${settings.tasksFileName}.md`);
}
