import { App, Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { GeckoTaskSettings, DEFAULT_SETTINGS, GeckoTaskSettingTab } from "./settings";
import { TasksPanel, VIEW_TYPE_TASKS } from "./view/tasks/TasksPanel";
import { WeeklyReviewPanel, VIEW_TYPE_WEEKLY_REVIEW } from "./view/weekly-review/WeeklyReviewPanel";
import { HealthPanel, VIEW_TYPE_HEALTH } from "./view/health/HealthPanel";
import { isInTasksFolder, inferAreaFromPath, isSpecialFile } from "./utils/areaUtils";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "./models/TaskModel";
import { calculateNextOccurrenceDates } from "./services/Recurrence";
import { IndexedTask } from "./view/tasks/TasksPanelTypes";
import { formatISODateTime } from "./utils/dateUtils";
import { getAllEditorLines, replaceTaskBlock } from "./utils/editorUtils";
import { registerCommands } from "./commands";
import { 
  activateTasksView, 
  activateWeeklyReviewView as activateWeeklyReviewViewUtil, 
  activateHealthView as activateHealthViewUtil 
} from "./utils/viewUtils";
import { styleTaskFieldsInMarkdown, updateMarkdownViewStyling } from "./styling/MarkdownStyler";
import { createTaskFieldDecorator } from "./extensions/TaskFieldDecorator";
import { createCheckboxClickHandler } from "./extensions/CheckboxClickHandler";

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
    this.registerView(VIEW_TYPE_HEALTH, (leaf: WorkspaceLeaf) => new HealthPanel(leaf, this.settings, this));

    // Register all commands
    registerCommands(this);

    // Style task metadata fields in markdown preview (only for files in tasks folder)
    this.registerMarkdownPostProcessor((element, context) => {
      // Check if the file is in the tasks folder
      if (context.sourcePath && isInTasksFolder(context.sourcePath, this.settings)) {
        // Style task metadata fields (priority::, due::, etc.)
        // Use a small delay to ensure DOM is fully rendered
        this.registerInterval(window.setTimeout(() => {
          styleTaskFieldsInMarkdown(element);
        }, 0));
      }
    });

    // Style task metadata fields in source/editing mode using CodeMirror decorations
    this.registerEditorExtension(
      createTaskFieldDecorator(this.app, this.settings)
    );

    // Intercept checkbox clicks to handle recurring tasks
    this.registerEditorExtension(
      createCheckboxClickHandler(this.app, this.settings, (editor, view, lineNo) => 
        this.handleCheckboxToggle(editor, view, lineNo)
      )
    );

    // Add/remove styling class to markdown views based on file location
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        updateMarkdownViewStyling(this.app, this.settings, file);
      })
    );

    // Also update when active leaf changes (e.g., switching between files)
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          updateMarkdownViewStyling(this.app, this.settings, leaf.view.file);
          // Also update after a short delay to ensure content is rendered
          this.registerInterval(window.setTimeout(() => updateMarkdownViewStyling(this.app, this.settings, leaf.view.file), 100));
        }
      })
    );

    // Update when view mode changes (source <-> preview)
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.app.workspace.iterateAllLeaves((leaf) => {
          if (leaf.view instanceof MarkdownView) {
            updateMarkdownViewStyling(this.app, this.settings, leaf.view.file);
          }
        });
      })
    );

    // Update styling for initially open files
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        updateMarkdownViewStyling(this.app, this.settings, leaf.view.file);
      }
    });

    // Also update after a delay to catch any views that load later
    this.registerInterval(window.setTimeout(() => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView) {
          updateMarkdownViewStyling(this.app, this.settings, leaf.view.file);
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
   */
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
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
    await activateTasksView(this.app);
  }

  /**
   * Activates or reveals the Weekly Review panel view.
   */
  async activateWeeklyReviewView() {
    await activateWeeklyReviewViewUtil(this.app);
  }

  /**
   * Activates or reveals the Health Check panel view.
   */
  async activateHealthView() {
    await activateHealthViewUtil(this.app);
  }

  /**
   * Handles checkbox toggle for all tasks.
   * Adds/removes completed tag and handles recurring task next occurrences.
   * @param editor - The editor instance
   * @param view - The markdown view
   * @param lineNo - The line number (0-based)
   */
  private async handleCheckboxToggle(editor: Editor, view: MarkdownView, lineNo: number) {
    // Get all lines from the editor
    const lines = getAllEditorLines(editor);

    // Parse the task with its description
    const { task: parsed, endLine } = parseTaskWithDescription(lines, lineNo);
    if (!parsed) return;

    const today = new Date();
    let needsUpdate = false;
    let justAddedCompletedDate = false;

    // Handle completion status changes
    if (parsed.checked) {
      // Task is checked - add completed date if not present
      if (!parsed.completion) {
        parsed.completion = formatISODateTime(today);
        needsUpdate = true;
        justAddedCompletedDate = true;
      }
    } else {
      // Task is unchecked - remove completed date if present
      if (parsed.completion) {
        parsed.completion = undefined;
        needsUpdate = true;
      }
    }

    // If we need to update the task, do so
    let updatedLines: string[] | null = null;
    if (needsUpdate) {
      // Format the updated task with description
      updatedLines = formatTaskWithDescription(parsed);
      const updatedText = updatedLines.join("\n");
      
      // Replace the entire task block (including description) with the updated version
      replaceTaskBlock(editor, lineNo, endLine, updatedText);
    }

    // Handle recurring tasks: create next occurrence when completed
    // Only create next occurrence if we just added the completed date (first time completing)
    // This prevents duplicate occurrences when re-checking already completed recurring tasks
    if (parsed.recur && parsed.recur.length > 0 && parsed.checked && parsed.completion && justAddedCompletedDate) {
      const nextDates = calculateNextOccurrenceDates(parsed.recur, today, parsed);
      if (nextDates) {
        // Create new task with next occurrence (preserve date types based on GTD rules)
        const newTask: Task = {
          ...parsed,
          checked: false,
          scheduled: nextDates.scheduled,
          due: nextDates.due,
          completion: undefined,
          recur: parsed.recur,
        };
        
        const newTaskLines = formatTaskWithDescription(newTask);
        
        // Insert on the line directly underneath the task
        // If we updated the task, use the updated line count, otherwise use the original endLine
        const taskEndLine = updatedLines 
          ? lineNo + updatedLines.length - 1 
          : endLine;
        const taskEndLineContent = editor.getLine(taskEndLine);
        const insertPos = { line: taskEndLine, ch: taskEndLineContent.length };
        
        // Insert the new task on the next line (directly underneath)
        const insertText = "\n" + newTaskLines.join("\n");
        
        editor.replaceRange(insertText, insertPos, insertPos);
        
        // Build notice message based on which dates were set
        const dateParts: string[] = [];
        if (nextDates.scheduled) dateParts.push(`scheduled: ${nextDates.scheduled}`);
        if (nextDates.due) dateParts.push(`due: ${nextDates.due}`);
        const dateMsg = dateParts.join(", ");
        new Notice(`GeckoTask: Next occurrence ${dateMsg}`);
      }
    }
  }

  /**
   * Gets the task at the cursor position and converts it to IndexedTask format.
   * @param editor - The editor instance
   * @param file - The file containing the task
   * @returns IndexedTask if a task is found at the cursor, null otherwise
   */
  getTaskAtCursor(editor: Editor, file: TFile): IndexedTask | null {
    const lineNo = editor.getCursor().line;
    
    // Get all lines from the editor to parse task with description
    const lines = getAllEditorLines(editor);
    
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
      scheduled: parsed.scheduled,
      recur: parsed.recur,
      checked: parsed.checked,
      descriptionEndLine: endLine + 1 // 1-based, inclusive
    };
  }
}

// Export the plugin class type for use in other modules
export type { GeckoTaskPlugin };
