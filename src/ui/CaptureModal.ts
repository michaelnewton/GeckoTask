import { App, Modal, Setting, Notice } from "obsidian";
import { TaskWorkSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { formatTask, formatTaskWithDescription, Task } from "../models/TaskModel";
import { isInTasksFolder, normalizeInboxPath, isSpecialFile } from "../utils/areaUtils";


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
}

/**
 * Opens a modal to quickly capture a new task.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Promise that resolves when modal is closed
 */
export async function captureQuickTask(app: App, settings: TaskWorkSettings) {
  const mdFiles = app.vault.getMarkdownFiles();

  return new Promise<void>((resolve) => {
    const modal = new (class extends Modal {
      draft: Draft = {
        title: "",
        projectPath: normalizeInboxPath(settings.inboxPath)
      };
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("TaskWork — Quick Add");

        new Setting(contentEl).setName("Title").addText(t =>
          t.onChange(v => this.draft.title = v)
        );

        // Description field (textarea for multi-line)
        new Setting(contentEl).setName("Description (optional)").addTextArea(t => {
          t.setPlaceholder("Multi-line description...");
          t.inputEl.rows = 4;
          t.onChange(v => this.draft.description = v.trim() || undefined);
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
          d.onChange(v => this.draft.projectPath = v);
        });

        new Setting(contentEl).setName("Due").addText(t =>
          t.setPlaceholder("today / 2025-11-15").onChange(v => {
            if (settings.nlDateParsing && v) {
              const parsed = parseNLDate(v);
              this.draft.due = parsed || v;
            } else {
              this.draft.due = v;
            }
          })
        );

        new Setting(contentEl).setName("Priority").addDropdown(d => {
          for (const p of settings.allowedPriorities) d.addOption(p, p);
          d.onChange(v => this.draft.priority = v);
        });

        new Setting(contentEl).setName("Tags (space-separated)").addText(t =>
          t.setPlaceholder("#work #bug").onChange(v => this.draft.tags = v.split(/\s+/).filter(Boolean))
        );

        new Setting(contentEl)
          .addButton(b => b.setButtonText("Add").setCta().onClick(async () => {
            if (!this.draft.title.trim()) { new Notice("Title required."); return; }
            await appendTask(app, this.draft, settings);
            this.close();
            resolve();
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
  if (!file || !(file as any).stat) {
    new Notice(`TaskWork: File not found ${d.projectPath}`);
    return;
  }
  const tfile = file as any;
  const prev = await app.vault.read(tfile);

  // Infer project name from file path (basename, unless it's a special file like Inbox or General)
  const projectName = isSpecialFile(d.projectPath, settings) ? undefined : tfile.basename;
  
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
    project: projectName,
    area: undefined, // Don't store area in metadata, it's derived from folder
    raw: ""
  };

  // Format task with description (returns array of lines)
  const taskLines = formatTaskWithDescription(task);
  const next = prev.trim().length 
    ? prev + "\n" + taskLines.join("\n") + "\n" 
    : taskLines.join("\n") + "\n";
  await app.vault.modify(tfile, next);
}
