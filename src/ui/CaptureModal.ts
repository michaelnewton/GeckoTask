import { App, Modal, Setting, Notice, TFile } from "obsidian";
import { TaskWorkSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { formatTask, formatTaskWithDescription, Task, parseTaskWithDescription } from "../models/TaskModel";
import { isInTasksFolder, normalizeInboxPath, isSpecialFile } from "../utils/areaUtils";
import { IndexedTask } from "../view/TaskworkPanelTypes";


/**
 * Draft task data collected from the capture modal.
 */
interface Draft {
  title: string;
  description?: string; // Multi-line description
  projectPath: string;
  due?: string;
  priority?: string;
  tags?: string[];
  recur?: string;
}

/**
 * Opens a modal to quickly capture a new task or edit an existing one.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param existingTask - Optional existing task to edit
 * @returns Promise that resolves when modal is closed
 */
export async function captureQuickTask(app: App, settings: TaskWorkSettings, existingTask?: IndexedTask) {
  const mdFiles = app.vault.getMarkdownFiles();
  const isEditMode = !!existingTask;

  return new Promise<void>((resolve) => {
    const modal = new (class extends Modal {
      draft: Draft = {
        title: existingTask?.title || "",
        description: existingTask?.description,
        projectPath: existingTask?.path || normalizeInboxPath(settings.inboxPath),
        due: existingTask?.due,
        priority: existingTask?.priority,
        tags: existingTask?.tags || [],
        recur: existingTask?.recur
      };
      
      /**
       * Handles saving the task when Enter is pressed.
       */
      private async handleSave() {
        if (!this.draft.title.trim()) { 
          new Notice("Title required."); 
          return; 
        }
        if (isEditMode && existingTask) {
          await updateTask(app, existingTask, this.draft, settings);
        } else {
          await appendTask(app, this.draft, settings);
        }
        this.close();
        resolve();
      }
      
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(isEditMode ? "TaskWork — Quick Edit" : "TaskWork — Quick Add");

        new Setting(contentEl).setName("Title").addText(t => {
          t.setValue(this.draft.title);
          t.inputEl.style.width = "100%";
          t.onChange(v => this.draft.title = v);
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        // Description field (textarea for multi-line)
        // Use fewer rows on mobile for more compact display
        const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0 || 
                        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        new Setting(contentEl).setName("Description (optional)").addTextArea(t => {
          t.setPlaceholder("Multi-line description...");
          t.setValue(this.draft.description || "");
          t.inputEl.rows = isMobile ? 2 : 4; // Reduced rows on mobile
          t.inputEl.style.width = "100%";
          t.onChange(v => this.draft.description = v.trim() || undefined);
          // Handle Ctrl+Enter (or Cmd+Enter on Mac) to save, Enter alone creates new line
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        // Get all files in tasks folder structure
        const projectPaths = mdFiles
          .map(f => f.path)
          .filter(p => isInTasksFolder(p, settings));

        const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
        new Setting(contentEl).setName("Project").addDropdown(d => {
          // Helper to remove .md extension for display
          const displayPath = (path: string) => path.endsWith(".md") ? path.slice(0, -3) : path;
          
          // Add inbox as default option
          d.addOption(normalizedInboxPath, displayPath(normalizedInboxPath));
          // Add other project files
          for (const p of projectPaths) {
            if (p !== normalizedInboxPath) {
              d.addOption(p, displayPath(p));
            }
          }
          d.setValue(this.draft.projectPath);
          d.selectEl.style.width = "100%";
          d.onChange(v => this.draft.projectPath = v);
        });

        new Setting(contentEl).setName("Due").addText(t => {
          t.setPlaceholder("today / 2025-11-15");
          t.setValue(this.draft.due || "");
          t.inputEl.style.width = "100%";
          t.onChange(v => {
            if (settings.nlDateParsing && v) {
              const parsed = parseNLDate(v);
              this.draft.due = parsed || v;
            } else {
              this.draft.due = v;
            }
          });
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        new Setting(contentEl).setName("Priority").addDropdown(d => {
          // Add empty option for "none"
          d.addOption("", "(none)");
          for (const p of settings.allowedPriorities) d.addOption(p, p);
          d.setValue(this.draft.priority || "");
          d.selectEl.style.width = "100%";
          d.onChange(v => this.draft.priority = v || undefined);
        });

        new Setting(contentEl).setName("Recurrence (optional)").addText(t => {
          t.setPlaceholder("every Tuesday / every 10 days");
          t.setValue(this.draft.recur || "");
          t.inputEl.style.width = "100%";
          t.onChange(v => this.draft.recur = v.trim() || undefined);
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        new Setting(contentEl).setName("Tags (space-separated)").addText(t => {
          t.setPlaceholder("#work #bug");
          t.setValue((this.draft.tags || []).join(" "));
          t.inputEl.style.width = "100%";
          t.onChange(v => this.draft.tags = v.split(/\s+/).filter(Boolean));
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        new Setting(contentEl)
          .addButton(b => b.setButtonText(isEditMode ? "Save" : "Add").setCta().onClick(async () => {
            await this.handleSave();
          }))
          .addButton(b => b.setButtonText("Cancel").onClick(() => { this.close(); resolve(); }));
      }
    })(app);

    modal.open();
  });
}

/**
 * Appends a task to the specified project file.
 * @param app - Obsidian app instance
 * @param d - Draft task data
 * @param settings - Plugin settings
 */
async function appendTask(app: App, d: Draft, settings: TaskWorkSettings) {
  const file = app.vault.getAbstractFileByPath(d.projectPath);
  if (!file || !(file instanceof TFile)) {
    new Notice(`TaskWork: File not found ${d.projectPath}`);
    return;
  }
  const prev = await app.vault.read(file);

  // Infer project name from file path (basename, unless it's a special file like Inbox or General)
  const projectName = isSpecialFile(d.projectPath, settings) ? undefined : file.basename;
  
  // Normalize tags (ensure they start with #)
  const tags = (d.tags ?? []).map(t => t.startsWith("#") ? t : "#" + t);

  // Create task object and format using formatTaskWithDescription for consistency
  // Note: area is not stored in metadata, it's derived from folder structure
  const task: Task = {
    checked: false,
    title: d.title,
    description: d.description,
    tags: tags,
    due: d.due,
    priority: d.priority,
    recur: d.recur,
    project: projectName,
    area: undefined, // Don't store area in metadata, it's derived from folder
    raw: ""
  };

  // Format task with description (returns array of lines)
  const taskLines = formatTaskWithDescription(task);
  const next = prev.trim().length 
    ? prev + "\n" + taskLines.join("\n") + "\n" 
    : taskLines.join("\n") + "\n";
  await app.vault.modify(file, next);
}

/**
 * Updates an existing task in the file.
 * @param app - Obsidian app instance
 * @param existingTask - The existing task to update
 * @param d - Draft task data with updated values
 * @param settings - Plugin settings
 */
async function updateTask(app: App, existingTask: IndexedTask, d: Draft, settings: TaskWorkSettings) {
  const sourceFile = app.vault.getAbstractFileByPath(existingTask.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice(`TaskWork: File not found ${existingTask.path}`);
    return;
  }

  // Check if task is being moved to a different file
  const targetPath = d.projectPath;
  const isMoving = targetPath !== existingTask.path;

  // Read the source file to get the current task
  const sourceContent = await app.vault.read(sourceFile);
  const lines = sourceContent.split("\n");
  const taskLineIdx = existingTask.line - 1; // 0-based
  const descEndIdx = (existingTask.descriptionEndLine ?? existingTask.line) - 1;
  
  if (taskLineIdx < 0 || taskLineIdx >= lines.length) {
    new Notice(`TaskWork: Task line out of bounds`);
    return;
  }

  // Parse current task with description
  const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
  if (!parsed) {
    new Notice(`TaskWork: Failed to parse task`);
    return;
  }

  // Preserve checked status and create updated task
  const taskWithDescription: Task = {
    ...parsed,
    checked: parsed.checked,
    title: d.title,
    description: d.description,
    due: d.due,
    priority: d.priority,
    recur: d.recur,
    // Normalize tags (ensure they start with #)
    tags: (d.tags ?? []).map(t => t.startsWith("#") ? t : "#" + t),
  };

  // If moving, update project based on target file
  if (isMoving) {
    const targetFile = app.vault.getAbstractFileByPath(targetPath);
    if (!(targetFile instanceof TFile)) {
      new Notice(`TaskWork: Target file not found ${targetPath}`);
      return;
    }

    // Update project based on target file
    const projectName = isSpecialFile(targetPath, settings) ? taskWithDescription.project : targetFile.basename;
    taskWithDescription.project = projectName;
    taskWithDescription.area = undefined; // Don't store area in metadata, it's derived from folder

    // Remove task from source file
    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    await app.vault.modify(sourceFile, lines.join("\n"));

    // Format task with description and append to target file
    const updatedLines = formatTaskWithDescription(taskWithDescription);
    const targetContent = await app.vault.read(targetFile);
    const finalLines = updatedLines.join("\n");
    const updated = targetContent.trim().length 
      ? targetContent + "\n" + finalLines + "\n" 
      : finalLines + "\n";
    await app.vault.modify(targetFile, updated);

    new Notice(`TaskWork: Task moved and updated`);
  } else {
    // Update task in place
    const updatedLines = formatTaskWithDescription(taskWithDescription);
    
    // Replace task line and description lines
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    await app.vault.modify(sourceFile, lines.join("\n"));

    new Notice(`TaskWork: Task updated`);
  }
}
