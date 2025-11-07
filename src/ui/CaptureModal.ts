import { App, Modal, Setting, Notice } from "obsidian";
import { TaskWorkSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { formatTask, formatTaskWithDescription, Task } from "../models/TaskModel";
import { isInTasksFolder, getAreaPath, normalizeInboxPath, isSpecialFile } from "../utils/areaUtils";


/**
 * Draft task data collected from the capture modal.
 */
interface Draft {
  title: string;
  description?: string; // Multi-line description
  area: string;
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
  const areas = settings.areas;
  const mdFiles = app.vault.getMarkdownFiles();

  return new Promise<void>((resolve) => {
    const modal = new (class extends Modal {
      draft: Draft = {
        title: "",
        area: "", // No area by default - will go to inbox
        projectPath: normalizeInboxPath(settings.inboxPath)
      };
      updateProjectPaths: () => void = () => {}; // Placeholder, will be set in onOpen
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

        // Only show area dropdown if there are areas configured
        // If no area is selected, task will go to inbox
        if (areas.length > 0) {
          new Setting(contentEl).setName("Area (optional)").addDropdown(d => {
            // Add "(none)" option for inbox
            d.addOption("", "(none - goes to inbox)");
            areas.forEach(a => d.addOption(a, a));
            d.setValue(this.draft.area);
            d.onChange(v => {
              this.draft.area = v;
              // If no area selected, ensure inbox is selected
              if (!v) {
                this.draft.projectPath = normalizeInboxPath(settings.inboxPath);
              }
              // Update project path to show files in selected area
              this.updateProjectPaths();
            });
          });
        }

        // Get all files in tasks folder structure
        const projectPaths = mdFiles
          .map(f => f.path)
          .filter(p => isInTasksFolder(p, settings));

        const projectSelect = new Setting(contentEl).setName("Project file");
        const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
        const projectDropdown = projectSelect.addDropdown(d => {
          // Add inbox as default option
          d.addOption(normalizedInboxPath, normalizedInboxPath);
          // Add other project files
          for (const p of projectPaths) {
            if (p !== normalizedInboxPath) {
              d.addOption(p, p);
            }
          }
          d.setValue(this.draft.projectPath);
          d.onChange(v => this.draft.projectPath = v);
        });

        // Method to update project paths based on selected area
        this.updateProjectPaths = () => {
          const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);
          const filteredPaths = projectPaths.filter(p => {
            if (p === normalizedInboxPath) return true; // Always include inbox
            if (this.draft.area) {
              const areaPath = getAreaPath(this.draft.area, settings);
              return p.startsWith(areaPath + "/");
            }
            // If no area selected, only show inbox (tasks without area go to inbox)
            return false;
          });
          
          // Rebuild dropdown
          const dropdown = projectSelect.controlEl.querySelector("select") as HTMLSelectElement;
          if (dropdown) {
            // Clear existing options
            while (dropdown.firstChild) {
              dropdown.removeChild(dropdown.firstChild);
            }
            // Add inbox option
            const inboxOpt = document.createElement("option");
            inboxOpt.value = normalizedInboxPath;
            inboxOpt.text = normalizedInboxPath;
            dropdown.appendChild(inboxOpt);
            // Add filtered project files
            for (const p of filteredPaths) {
              if (p !== normalizedInboxPath) {
                const opt = document.createElement("option");
                opt.value = p;
                opt.text = p;
                dropdown.appendChild(opt);
              }
            }
            // Set value
            if (filteredPaths.includes(this.draft.projectPath) || this.draft.projectPath === normalizedInboxPath) {
              dropdown.value = this.draft.projectPath;
            } else {
              dropdown.value = normalizedInboxPath;
              this.draft.projectPath = normalizedInboxPath;
            }
          }
        };

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
