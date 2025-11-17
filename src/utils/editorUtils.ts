import { Editor } from "obsidian";

/**
 * Utility functions for editor operations.
 */

/**
 * Gets all lines from an editor as an array.
 * @param editor - The editor instance
 * @returns Array of all lines in the editor
 */
export function getAllEditorLines(editor: Editor): string[] {
  const totalLines = editor.lineCount();
  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    lines.push(editor.getLine(i));
  }
  return lines;
}

/**
 * Replaces a task block (including description) in the editor.
 * @param editor - The editor instance
 * @param startLine - 0-based line number where task starts
 * @param endLine - 0-based line number where task ends (inclusive)
 * @param replacementText - The text to replace the task block with
 */
export function replaceTaskBlock(
  editor: Editor,
  startLine: number,
  endLine: number,
  replacementText: string
): void {
  const endLineContent = editor.getLine(endLine);
  const startPos = { line: startLine, ch: 0 };
  const endPos = { line: endLine, ch: endLineContent.length };
  editor.replaceRange(replacementText, startPos, endPos);
}

