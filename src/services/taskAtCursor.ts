import { App, Editor, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTaskWithDescription } from "../models/TaskModel";
import { inferSpaceFromPath, inferProjectFromPath, isInInboxFolder } from "../utils/areaUtils";
import { getAllEditorLines } from "../utils/editorUtils";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";

/**
 * Returns the task at the editor cursor as an `IndexedTask`, or null if none.
 */
export function getIndexedTaskAtCursor(
  app: App,
  settings: GeckoTaskSettings,
  editor: Editor,
  file: TFile
): IndexedTask | null {
  const lineNo = editor.getCursor().line;

  const lines = getAllEditorLines(editor);

  const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo, {
    nlDateParsing: settings.nlDateParsing
  });
  if (!parsed) {
    return null;
  }

  const path = file.path;
  const raw = lines[lineNo].trim();
  const space = inferSpaceFromPath(path, app, settings);
  let project: string | undefined;
  if (isInInboxFolder(path, settings)) {
    project = undefined;
  } else {
    const projectInfo = inferProjectFromPath(path, settings);
    project = projectInfo?.project ?? undefined;
  }

  return {
    path,
    line: lineNo + 1,
    raw,
    title: parsed.title,
    description: parsed.description,
    tags: parsed.tags || [],
    space,
    project,
    priority: parsed.priority,
    due: parsed.due,
    scheduled: parsed.scheduled,
    recur: parsed.recur,
    checked: parsed.checked,
    descriptionEndLine: endLine + 1,
  };
}
