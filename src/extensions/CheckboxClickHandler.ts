import { App, Editor, MarkdownView, TFile } from "obsidian";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { GeckoTaskSettings } from "../settings";
import { isInTasksFolder } from "../utils/areaUtils";

/**
 * Creates a CodeMirror ViewPlugin that intercepts checkbox clicks to handle recurring tasks.
 * @param app - The Obsidian app instance
 * @param settings - Plugin settings
 * @param onCheckboxToggle - Callback function to handle checkbox toggle
 * @returns ViewPlugin instance
 */
export function createCheckboxClickHandler(
  app: App,
  settings: GeckoTaskSettings,
  onCheckboxToggle: (editor: Editor, view: MarkdownView, lineNo: number) => Promise<void>
) {
  return ViewPlugin.fromClass(
    class {
      private view: EditorView;
      private clickHandler: ((e: MouseEvent) => void) | null = null;

      constructor(view: EditorView) {
        this.view = view;
        this.setupClickHandler(view);
      }

      update(update: ViewUpdate) {
        // Re-setup click handler if view changed
        if (update.viewportChanged || update.docChanged) {
          this.setupClickHandler(update.view);
        }
      }

      private setupClickHandler(view: EditorView) {
        // Remove existing handler if any
        if (this.clickHandler) {
          const dom = this.view.dom;
          if (dom) {
            dom.removeEventListener("click", this.clickHandler);
          }
        }

        this.view = view;
        const dom = view.dom;
        if (!dom) return;

        // Find the MarkdownView associated with this editor
        let markdownView: MarkdownView | null = null;
        app.workspace.iterateAllLeaves((leaf) => {
          if (leaf.view instanceof MarkdownView && leaf.view.editor) {
            const editorView = (leaf.view.editor as any).cm as EditorView | undefined;
            if (editorView === view) {
              markdownView = leaf.view;
              return false; // Stop iteration
            }
          }
        });

        if (!markdownView) return;

        const file = markdownView.file;
        if (!file || !isInTasksFolder(file.path, settings)) {
          return;
        }

        // Create click handler
        this.clickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          
          // Check if click is on a checkbox pattern in the editor
          // In CodeMirror, checkboxes are rendered as text, so we need to find the position
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos === null) return;

          // Get the line number
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          
          // Check if this line contains a task checkbox
          const taskMatch = lineText.match(/^\s*-\s*\[([ x])\]\s+/i);
          if (!taskMatch) return;

          // Get the editor instance from MarkdownView
          const editor = markdownView!.editor;
          if (!editor) return;

          // Use a small delay to let Obsidian's default checkbox toggle happen first
          setTimeout(async () => {
            // Now check if the task is recurring and was just completed
            await onCheckboxToggle(editor, markdownView!, line.number - 1);
          }, 50);
        };

        // Add handler
        dom.addEventListener("click", this.clickHandler);
      }

      destroy() {
        // Cleanup
        if (this.clickHandler) {
          const dom = this.view.dom;
          if (dom) {
            dom.removeEventListener("click", this.clickHandler!);
          }
        }
      }
    }
  );
}

