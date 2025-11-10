import { App, Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { GeckoTaskSettings, DEFAULT_SETTINGS, GeckoTaskSettingTab } from "./settings";
import { captureQuickTask } from "./ui/CaptureModal";
import { archiveAllCompletedInVault, archiveCompletedInFile } from "./services/Archive";
import { moveTaskAtCursorInteractive, createProjectFile } from "./services/VaultIO";
import { toggleCompleteAtCursor, setFieldAtCursor, addRemoveTagsAtCursor, normalizeTaskLine } from "./services/TaskOps";
import { TasksPanel, VIEW_TYPE_TASKS } from "./view/TasksPanel";
import { WeeklyReviewPanel, VIEW_TYPE_WEEKLY_REVIEW } from "./view/WeeklyReviewPanel";
import { isInTasksFolder, inferAreaFromPath, isSpecialFile } from "./utils/areaUtils";
import { ViewPlugin, Decoration, DecorationSet, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "./models/TaskModel";
import { calculateNextOccurrence } from "./services/Recurrence";
import { IndexedTask } from "./view/TasksPanelTypes";


/**
 * Main plugin class for GeckoTask - manages task lifecycle and commands.
 */
export default class GeckoTaskPlugin extends Plugin {
  // definite assignment (!), we set it in loadSettings()
  settings!: GeckoTaskSettings;

  /**
   * Called when the plugin is loaded. Registers commands, settings tab, and view.
   */
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GeckoTaskSettingTab(this.app, this));

    // Register the side panel views
    this.registerView(VIEW_TYPE_TASKS, (leaf: WorkspaceLeaf) => new TasksPanel(leaf, this.settings));
    this.registerView(VIEW_TYPE_WEEKLY_REVIEW, (leaf: WorkspaceLeaf) => new WeeklyReviewPanel(leaf, this.settings, this));

    /**
     * Opens the Tasks side panel for task management.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-open-panel",
      name: "Open Tasks Panel",
      callback: () => this.activateView()
    });

    /**
     * Opens the Weekly Review side panel.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "weekly-review-open-panel",
      name: "Open Weekly Review Panel",
      callback: () => this.activateWeeklyReviewView()
    });

    // Optional ribbon icon
    this.addRibbonIcon("check-circle", "Tasks Panel", () => this.activateView());

    /**
     * Opens a modal to quickly capture a new task or edit an existing task at the cursor.
     * If the cursor is on a task line, opens in edit mode; otherwise opens in add mode.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-quick-add",
      name: "Quick Add/Edit Task",
      editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) {
          // Not in a markdown view, just open add mode
          await captureQuickTask(this.app, this.settings);
          return;
        }

        // Try to get task at cursor
        const existingTask = this.getTaskAtCursor(editor, view.file);
        if (existingTask) {
          // Task found at cursor, open in edit mode
          await captureQuickTask(this.app, this.settings, existingTask);
        } else {
          // No task at cursor, open in add mode
          await captureQuickTask(this.app, this.settings);
        }
      },
      callback: async () => {
        // Fallback when not in editor - just open add mode
        await captureQuickTask(this.app, this.settings);
      }
    });

    /**
     * Toggles the completion status of the task at the cursor position.
     * Handles recurring tasks by creating the next occurrence when completed.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-toggle-complete",
      name: "Complete/Uncomplete Task at Cursor",
      editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return new Notice("GeckoTask: Not in a Markdown view.");
        toggleCompleteAtCursor(editor, view, this.settings);
      }
    });

    /**
     * Moves the task at the cursor to a different project file.
     * Prompts user to select the target project.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-move-task",
      name: "Move Task (pick project)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await moveTaskAtCursorInteractive(this.app, editor, this.settings);
      }
    });

    /**
     * Sets or updates the due date field for the task at the cursor.
     * Supports natural language date parsing if enabled.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-set-due",
      name: "Set Due (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "due", this.settings);
      }
    });

    /**
     * Sets or updates the priority field for the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-set-priority",
      name: "Set Priority (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "priority", this.settings);
      }
    });

    // Note: Project command removed - projects are now file-based only
    // Users should move tasks to different files to change projects

    /**
     * Sets or updates the recurrence pattern for the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-set-recur",
      name: "Set Recurrence (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await setFieldAtCursor(this.app, editor, "recur", this.settings);
      }
    });

    // Note: Area command removed - areas are now folder-based only
    // Users should move tasks to different folders to change areas

    /**
     * Adds or removes tags from the task at the cursor.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-add-remove-tags",
      name: "Add/Remove Tags (at cursor)",
      editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        await addRemoveTagsAtCursor(this.app, editor, this.settings);
      }
    });

    /**
     * Creates a new project file for organizing tasks.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-create-project",
      name: "Create Project File",
      callback: async () => {
        await createProjectFile(this.app, this.settings);
      }
    });

    /**
     * Normalizes the task line at the cursor to standard format.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-normalize-task",
      name: "Normalize Task Line (at cursor)",
      editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
        normalizeTaskLine(editor);
      }
    });

    /**
     * Archives all completed tasks in the current file.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-archive-file",
      name: "Archive Completed in Current File",
      editorCallback: async (_ed: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        const file = ctx instanceof MarkdownView ? ctx.file : ctx.file;
        if (!file) return new Notice("GeckoTask: No file in context.");
        const moved = await archiveCompletedInFile(this.app, file, this.settings);
        new Notice(`GeckoTask: Archived ${moved} completed task(s) from ${file.name}.`);
      }
    });

    /**
     * Archives all completed tasks across the vault that are older than the configured threshold.
     * Unregistered automatically on plugin unload.
     */
    this.addCommand({
      id: "geckotask-archive-global",
      name: "Archive All Completed (older than N days)",
      callback: async () => {
        const moved = await archiveAllCompletedInVault(this.app, this.settings);
        new Notice(`GeckoTask: Archived ${moved} completed task(s) across vault.`);
      }
    });

    // Style @ labels and task metadata fields in markdown preview (only for files in tasks folder)
    this.registerMarkdownPostProcessor((element, context) => {
      // Check if the file is in the tasks folder
      if (context.sourcePath && isInTasksFolder(context.sourcePath, this.settings)) {
        // Style @ labels by wrapping them in spans
        this.styleLabelsInMarkdown(element);
        // Style task metadata fields (priority::, due::, etc.)
        // Use a small delay to ensure DOM is fully rendered
        this.registerInterval(window.setTimeout(() => {
          this.styleTaskFieldsInMarkdown(element);
        }, 0));
      }
    });

    // Style task metadata fields in source/editing mode using CodeMirror decorations
    this.registerEditorExtension(
      this.createTaskFieldDecorator()
    );

    // Intercept checkbox clicks to handle recurring tasks
    this.registerEditorExtension(
      this.createCheckboxClickHandler()
    );

    // Add/remove styling class to markdown views based on file location
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.updateMarkdownViewStyling(file);
      })
    );

    // Also update when active leaf changes (e.g., switching between files)
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          this.updateMarkdownViewStyling(leaf.view.file);
          // Also update after a short delay to ensure content is rendered
          this.registerInterval(window.setTimeout(() => this.updateMarkdownViewStyling(leaf.view.file), 100));
        }
      })
    );

    // Update when view mode changes (source <-> preview)
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.app.workspace.iterateAllLeaves((leaf) => {
          if (leaf.view instanceof MarkdownView) {
            this.updateMarkdownViewStyling(leaf.view.file);
          }
        });
      })
    );

    // Update styling for initially open files
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        this.updateMarkdownViewStyling(leaf.view.file);
      }
    });

    // Also update after a delay to catch any views that load later
    this.registerInterval(window.setTimeout(() => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView) {
          this.updateMarkdownViewStyling(leaf.view.file);
        }
      });
    }, 500));
  }

  /**
   * Called when the plugin is unloaded. Cleans up resources.
   * Note: Obsidian automatically unregisters all commands, events, intervals, views,
   * and other registered resources when the plugin is unloaded. No explicit cleanup needed.
   */
  onunload() {
    // All registered resources (commands, events, intervals, views, etc.) are automatically
    // cleaned up by Obsidian's Plugin base class when the plugin is unloaded.
  }

  /**
   * Loads settings from storage, merging with defaults.
   * Handles migration from old areas array to areasEnabled boolean.
   */
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    
    // Migration: If old areas array exists and has items, enable areas
    // Remove the old areas property from settings
    if (loadedData && 'areas' in loadedData && Array.isArray(loadedData.areas) && loadedData.areas.length > 0) {
      this.settings.areasEnabled = true;
      // Remove old areas property
      delete (this.settings as any).areas;
      // Save migrated settings
      await this.saveSettings();
    } else if (loadedData && 'areas' in loadedData) {
      // Remove old areas property even if empty
      delete (this.settings as any).areas;
      await this.saveSettings();
    }
  }

  /**
   * Saves current settings to storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Activates or reveals the Tasks panel view.
   */
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASKS).first();
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return; // Can't create view if no leaf available
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_TASKS, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  /**
   * Activates or reveals the Weekly Review panel view.
   */
  async activateWeeklyReviewView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEEKLY_REVIEW).first();
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return; // Can't create view if no leaf available
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_WEEKLY_REVIEW, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  /**
   * Updates the styling class on markdown views based on whether the file is in the tasks folder.
   * @param file - The file to check, or null to remove styling from all views
   */
  private updateMarkdownViewStyling(file: TFile | null) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const viewEl = leaf.view.containerEl;
        const viewFile = leaf.view.file;
        
        // Check if this view's file is in the tasks folder
        if (viewFile && isInTasksFolder(viewFile.path, this.settings)) {
          // Add class to container
          viewEl.classList.add("mod-geckotask-styled");
          
          // Also add to content area if it exists (for better targeting)
          const contentEl = viewEl.querySelector(".markdown-source-view, .markdown-preview-view, .markdown-reading-view");
          if (contentEl) {
            contentEl.classList.add("mod-geckotask-styled");
          }
          
          // Also add to CodeMirror editor if it exists (for source view)
          if (leaf.view.editor) {
            const cmEditor = (leaf.view.editor as any).cm as EditorView | undefined;
            if (cmEditor) {
              const cmEl = cmEditor.dom;
              if (cmEl) {
                cmEl.classList.add("mod-geckotask-styled");
              }
            }
          }
        } else {
          // Remove class from container
          viewEl.classList.remove("mod-geckotask-styled");
          
          // Also remove from content area
          const contentEl = viewEl.querySelector(".markdown-source-view, .markdown-preview-view, .markdown-reading-view");
          if (contentEl) {
            contentEl.classList.remove("mod-geckotask-styled");
          }
          
          // Also remove from CodeMirror editor
          if (leaf.view.editor) {
            const cmEditor = (leaf.view.editor as any).cm as EditorView | undefined;
            if (cmEditor) {
              const cmEl = cmEditor.dom;
              if (cmEl) {
                cmEl.classList.remove("mod-geckotask-styled");
              }
            }
          }
        }
      }
    });
  }

  /**
   * Styles @ labels in markdown preview by wrapping them in spans.
   * Only processes text nodes that aren't already inside a geckotask-label span.
   * @param element - The markdown preview element
   */
  private styleLabelsInMarkdown(element: HTMLElement) {
    // Pattern to match labels like @ppl/Libby, @person/Name, @label, etc.
    const labelPattern = /(@[\w/-]+)/g;
    
    // Walk through all text nodes in the element
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      // Skip if already inside a geckotask-label span or inside a tag/link
      const parent = node.parentElement;
      if (parent?.classList.contains("geckotask-label") || 
          parent?.classList.contains("tag") ||
          parent?.classList.contains("geckotask-field") ||
          parent?.tagName === "A") {
        continue;
      }
      textNodes.push(node as Text);
    }
    
    // Process each text node
    textNodes.forEach((textNode) => {
      const text = textNode.textContent || "";
      const matches = Array.from(text.matchAll(labelPattern));
      
      if (matches.length === 0) return;
      
      // Create a document fragment to hold the replacements
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach((match) => {
        // Add text before the label
        if (match.index !== undefined && match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.index))
          );
        }
        
        // Create span for the label
        const labelSpan = document.createElement("span");
        labelSpan.className = "geckotask-label";
        labelSpan.textContent = match[0];
        fragment.appendChild(labelSpan);
        
        lastIndex = (match.index || 0) + match[0].length;
      });
      
      // Add remaining text after the last label
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace the text node with the fragment
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
  }

  /**
   * Styles task metadata fields (priority::, due::, etc.) in markdown preview by wrapping them in spans.
   * Only processes text nodes that aren't already inside a geckotask-field span.
   * @param element - The markdown preview element
   */
  private styleTaskFieldsInMarkdown(element: HTMLElement) {
    // Pattern to match task fields like "priority:: urgent", "due:: 2025-11-07", "recur:: every Tuesday", etc.
    // Matches: fieldname:: value (where fieldname is one of the allowed field keys)
    // Value can be single word or multiple words, but stops at next field, tag, newline, or end
    const fieldKeys = "(?:due|scheduled|priority|recur|area|completed|origin_file|origin_project|origin_area)";
    // Pattern: fieldname:: value (value stops at newline, next field/tag, or end)
    // Match value as one or more words (non-whitespace, non-hash, non-newline), separated by single spaces
    // Stop before newline, next field, tag, or end
    const fieldPattern = new RegExp(`\\b(${fieldKeys})::\\s*([^\\n\\s#]+(?: [^\\n\\s#]+)*?)(?=\\s+${fieldKeys}::|\\s+#|\\n|$)`, "gi");
    
    // Walk through all text nodes in the element
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      // Skip if already inside a geckotask-field span or inside a tag/link
      const parent = node.parentElement;
      if (parent?.classList.contains("geckotask-field") ||
          parent?.classList.contains("tag") ||
          parent?.classList.contains("geckotask-label") ||
          parent?.tagName === "A") {
        continue;
      }
      textNodes.push(node as Text);
    }
    
    // Process each text node
    textNodes.forEach((textNode) => {
      const text = textNode.textContent || "";
      
      // Reset regex lastIndex to ensure fresh matching
      fieldPattern.lastIndex = 0;
      const matches = Array.from(text.matchAll(fieldPattern));
      
      if (matches.length === 0) return;
      
      // Create a document fragment to hold the replacements
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach((match) => {
        // Add text before the field
        if (match.index !== undefined && match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.index))
          );
        }
        
        // Create span for the field
        const fieldSpan = document.createElement("span");
        fieldSpan.className = "geckotask-field";
        
        // Add the field key (e.g., "priority::")
        const keySpan = document.createElement("span");
        keySpan.className = "geckotask-field-key";
        keySpan.textContent = match[1] + "::";
        fieldSpan.appendChild(keySpan);
        
        // Add a space
        fieldSpan.appendChild(document.createTextNode(" "));
        
        // Add the field value (e.g., "urgent")
        const valueSpan = document.createElement("span");
        valueSpan.className = "geckotask-field-value";
        valueSpan.textContent = match[2].trim();
        fieldSpan.appendChild(valueSpan);
        
        fragment.appendChild(fieldSpan);
        
        lastIndex = (match.index || 0) + match[0].length;
      });
      
      // Add remaining text after the last field
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace the text node with the fragment
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
  }

  /**
   * Creates a CodeMirror ViewPlugin that decorates task metadata fields in source/editing mode.
   * @returns ViewPlugin instance
   */
  private createTaskFieldDecorator() {
    const plugin = this;
    
    return ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        private view: EditorView;

        constructor(view: EditorView) {
          this.view = view;
          this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
          // Rebuild decorations if document changed or viewport changed
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const builder = new RangeSetBuilder<Decoration>();
          
          // Get the file associated with this view by finding the MarkdownView
          // The editor view is part of a MarkdownView in Obsidian
          let file: TFile | null = null;
          
          // Try to find the file by iterating through all leaves
          plugin.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view instanceof MarkdownView && leaf.view.editor) {
              // Check if this editor's CodeMirror view matches
              const editorView = (leaf.view.editor as any).cm as EditorView | undefined;
              if (editorView === view) {
                file = leaf.view.file;
                return false; // Stop iteration
              }
            }
          });
          
          if (!file || !isInTasksFolder(file.path, plugin.settings)) {
            return builder.finish();
          }

          const { doc } = view.state;
          const text = doc.toString();
          
          // Pattern to match task fields like "priority:: urgent", "due:: 2025-11-07", etc.
          // Matches: fieldname:: value (where fieldname is one of the allowed field keys)
          // Value can be single word or multiple words, but stops at next field, tag, newline, or end
          // Match each field separately - value stops at whitespace before next field/tag or newline
          const fieldKeys = "(?:due|scheduled|priority|recur|area|completed|origin_file|origin_project|origin_area)";
          // Pattern: fieldname:: value (value stops at newline, next field/tag, or end)
          // Match value as one or more words (non-whitespace, non-hash, non-newline), separated by single spaces
          // Stop before newline, next field, tag, or end
          const fieldPattern = new RegExp(`\\b(${fieldKeys})::\\s*([^\\n\\s#]+(?: [^\\n\\s#]+)*?)(?=\\s+${fieldKeys}::|\\s+#|\\n|$)`, "gi");
          
          let match;
          while ((match = fieldPattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            
            // Create decoration with geckotask-field class
            const decoration = Decoration.mark({
              class: "geckotask-field",
              attributes: {
                "data-field-key": match[1],
                "data-field-value": match[2].trim()
              }
            });
            
            builder.add(start, end, decoration);
          }

          return builder.finish();
        }
      },
      {
        decorations: (v) => v.decorations,
      }
    );
  }

  /**
   * Creates a CodeMirror ViewPlugin that intercepts checkbox clicks to handle recurring tasks.
   * @returns ViewPlugin instance
   */
  private createCheckboxClickHandler() {
    const plugin = this;
    
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
          plugin.app.workspace.iterateAllLeaves((leaf) => {
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
          if (!file || !isInTasksFolder(file.path, plugin.settings)) {
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
              await plugin.handleCheckboxToggle(editor, markdownView!, line.number - 1);
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

  /**
   * Handles checkbox toggle for recurring tasks.
   * @param editor - The editor instance
   * @param view - The markdown view
   * @param lineNo - The line number (0-based)
   */
  private async handleCheckboxToggle(editor: Editor, view: MarkdownView, lineNo: number) {
    // Get all lines from the editor
    const totalLines = editor.lineCount();
    const lines: string[] = [];
    for (let i = 0; i < totalLines; i++) {
      lines.push(editor.getLine(i));
    }

    // Parse the task with its description
    const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
    if (!parsed) return;

    // Only handle if task is recurring and is now checked (completed)
    if (parsed.recur && parsed.recur.length > 0 && parsed.checked) {
      // Check if it already has a completed date (to avoid duplicate handling)
      if (!parsed.completed) {
        // This is a newly completed recurring task
        // Add completion date and create next occurrence
        const today = new Date();
        const completed = this.formatISODate(today);
        
        // Update the task with completion date
        parsed.completed = completed;
        
        // Format the updated task with description
        const updatedLines = formatTaskWithDescription(parsed);
        const updatedText = updatedLines.join("\n");
        
        // Get the start and end positions of the task block
        const startLine = lineNo;
        const endLineNo = endLine;
        const startLineContent = editor.getLine(startLine);
        const endLineContent = editor.getLine(endLineNo);
        
        // Calculate positions: start at beginning of task line, end at end of last description line
        const startPos = { line: startLine, ch: 0 };
        const endPos = { line: endLineNo, ch: endLineContent.length };
        
        // Replace the entire task block (including description) with the updated version
        editor.replaceRange(updatedText, startPos, endPos);
        
        // Create next occurrence
        const nextDue = calculateNextOccurrence(parsed.recur, today);
        if (nextDue) {
          // Create new task with next occurrence
          const newTask: Task = {
            ...parsed,
            checked: false,
            due: nextDue,
            completed: undefined,
            recur: parsed.recur,
          };
          
          const newTaskLines = formatTaskWithDescription(newTask);
          
          // Insert on the line directly underneath the task
          const taskEndLine = startLine + updatedLines.length - 1;
          const taskEndLineContent = editor.getLine(taskEndLine);
          const insertPos = { line: taskEndLine, ch: taskEndLineContent.length };
          
          // Insert the new task on the next line (directly underneath)
          const insertText = "\n" + newTaskLines.join("\n");
          
          editor.replaceRange(insertText, insertPos, insertPos);
          
          new Notice(`GeckoTask: Next occurrence scheduled for ${nextDue}`);
        }
      }
    }
  }

  /**
   * Formats a date as ISO string (YYYY-MM-DD).
   * @param d - The date to format
   * @returns ISO date string
   */
  private formatISODate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /**
   * Gets the task at the cursor position and converts it to IndexedTask format.
   * @param editor - The editor instance
   * @param file - The file containing the task
   * @returns IndexedTask if a task is found at the cursor, null otherwise
   */
  private getTaskAtCursor(editor: Editor, file: TFile): IndexedTask | null {
    const lineNo = editor.getCursor().line;
    
    // Get all lines from the editor to parse task with description
    const totalLines = editor.lineCount();
    const lines: string[] = [];
    for (let i = 0; i < totalLines; i++) {
      lines.push(editor.getLine(i));
    }
    
    // Parse the task with its description
    const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
    if (!parsed) {
      return null;
    }
    
    const path = file.path;
    const raw = lines[lineNo].trim();
    const area = inferAreaFromPath(path, this.app, this.settings);
    // Project is derived from file basename, not stored in metadata
    const project = isSpecialFile(path, this.settings) ? undefined : file.basename;
    
    return {
      path,
      line: lineNo + 1, // 1-based task line
      raw,
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags || [],
      area,
      project,
      priority: parsed.priority,
      due: parsed.due,
      recur: parsed.recur,
      checked: parsed.checked,
      descriptionEndLine: endLine + 1 // 1-based, inclusive
    };
  }

}
