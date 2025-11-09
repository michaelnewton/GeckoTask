import { App, TFile, SuggestModal, Notice, Editor, Modal, Setting } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTask, formatTask, Task } from "../models/TaskModel";
import { inferAreaFromPath, isInTasksFolder, getAreaPath, isSpecialFile, getAreas, isTasksFolderFile } from "../utils/areaUtils";

/**
 * Gets the task at the current cursor line in the editor.
 * @param editor - The editor instance
 * @returns Task, line number, and raw line text
 */
async function getActiveLineTask(editor: Editor) {
  const lineNo = editor.getCursor().line;
  const line = editor.getLine(lineNo);
  const task = parseTask(line);
  return { task, lineNo, line };
}

/**
 * Moves the task at the cursor to a different file via interactive file picker.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
export async function moveTaskAtCursorInteractive(app: App, editor: Editor, settings: GeckoTaskSettings) {
  const { task, lineNo, line } = await getActiveLineTask(editor);
  if (!task) { new Notice("GeckoTask: No task on this line."); return; }

  // Filter files to only those in tasks folder structure, excluding tasks folder file
  const files = app.vault.getMarkdownFiles()
    .filter(f => isInTasksFolder(f.path, settings))
    .filter(f => !isTasksFolderFile(f.path, settings));

  const target = await new FilePickerModal(app, files).openAndGet();
  if (!target) return;

  // Infer new area and project from target file
  const newArea = inferAreaFromPath(target.path, app, settings);
  const newProject = target.basename;

  // Update task metadata (remove area:: and project:: since we're using folder/file-based structure)
  const updatedTask: Task = {
    ...task,
    area: undefined, // Don't store area in metadata, it's derived from folder
    project: undefined, // Don't store project in metadata, it's derived from file basename
  };
  const updatedLine = formatTask(updatedTask);

  // remove from current file
  const curFile = app.workspace.getActiveFile();
  if (!curFile) return;
  await replaceLineInFile(app, curFile, lineNo, ""); // delete line

  // append to target
  const content = await app.vault.read(target);
  const finalLine = updatedLine;
  const updated = content.trim().length ? content + "\n" + finalLine + "\n" : finalLine + "\n";
  await app.vault.modify(target, updated);

  new Notice(`GeckoTask: Moved task to ${target.path}`);
}

/**
 * Creates a new project file via interactive modal.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Created file or null if cancelled/error
 */
export async function createProjectFile(app: App, settings: GeckoTaskSettings): Promise<TFile | null> {
  return new Promise((resolve) => {
    const modal = new (class extends Modal {
      area: string = "";
      projectName: string = "";

      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("GeckoTask — Create Project File");

        // Only show area dropdown if there are areas configured
        const areas = getAreas(app, settings);
        if (areas.length > 0) {
          this.area = areas[0]; // Set default to first area
          new Setting(contentEl)
            .setName("Area")
            .addDropdown(d => {
              areas.forEach(a => d.addOption(a, a));
              d.setValue(this.area);
              d.onChange(v => this.area = v);
            });
        }

        new Setting(contentEl)
          .setName("Project name")
          .addText(t => t
            .setPlaceholder("RouterRevamp")
            .onChange(v => this.projectName = v)
          );

        new Setting(contentEl)
          .addButton(b => b
            .setButtonText("Create")
            .setCta()
            .onClick(async () => {
              if (!this.projectName.trim()) {
                new Notice("GeckoTask: Project name required.");
                return;
              }

              // Build path: tasksFolder/area/project.md or tasksFolder/project.md if no areas
              const path = this.area 
                ? `${getAreaPath(this.area, settings)}/${this.projectName.trim()}.md`
                : `${settings.tasksFolder}/${this.projectName.trim()}.md`;

              // Check if file exists
              const existing = app.vault.getAbstractFileByPath(path);
              if (existing) {
                new Notice(`GeckoTask: File ${path} already exists.`);
                this.close();
                resolve(existing as TFile);
                return;
              }

              // Create file with frontmatter
              const today = new Date();
              const created = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              const frontmatter = this.area 
                ? `area: ${this.area}\n`
                : "";
              const content = `---
${frontmatter}project: ${this.projectName.trim()}
created: ${created}
---

# ${this.projectName.trim()}

> Project notes here.

## Tasks
<!-- New tasks appended below -->
`;

              try {
                const file = await app.vault.create(path, content);
                new Notice(`GeckoTask: Created project file ${path}`);
                this.close();
                resolve(file);
              } catch (error) {
                new Notice(`GeckoTask: Failed to create file: ${error}`);
                this.close();
                resolve(null);
              }
            })
          )
          .addButton(b => b
            .setButtonText("Cancel")
            .onClick(() => {
              this.close();
              resolve(null);
            })
          );
      }
    })(app);
    modal.open();
  });
}

/**
 * Modal for picking a file from a list of suggestions.
 */
class FilePickerModal extends SuggestModal<TFile> {
  files: TFile[];

  /**
   * Creates a new file picker modal.
   * @param app - Obsidian app instance
   * @param files - List of files to choose from
   */
  constructor(app: App, files: TFile[]) {
    super(app);
    this.files = files;
  }
  /**
   * Filters files based on query string.
   * @param query - Search query
   * @returns Filtered list of files
   */
  getSuggestions(query: string): TFile[] {
    return this.files.filter(f => f.path.toLowerCase().includes(query.toLowerCase()));
  }

  /**
   * Renders a file suggestion in the list.
   * @param f - The file to render
   * @param el - The element to render into
   */
  renderSuggestion(f: TFile, el: HTMLElement) { el.setText(f.path); }

  /**
   * Called when a file is chosen from the list.
   * @param f - The chosen file
   */
  onChooseSuggestion(f: TFile) { this.result = f; this.close(); }

  result: TFile | null = null;

  /**
   * Opens the modal and returns the selected file.
   * @returns Selected file or null if cancelled
   */
  async openAndGet(): Promise<TFile | null> { this.open(); return new Promise(res => {
    const stop = () => { this.onClose = () => { res(this.result); }; };
    stop();
  }); }
}

/**
 * Replaces or deletes a line in a file.
 * @param app - Obsidian app instance
 * @param file - The file to modify
 * @param lineNo - 0-based line number to replace
 * @param replacement - New line content (empty string deletes the line)
 */
async function replaceLineInFile(app: App, file: TFile, lineNo: number, replacement: string) {
  const content = await app.vault.read(file);
  const lines = content.split("\n");
  if (lineNo < 0 || lineNo >= lines.length) return;
  if (replacement === "") lines.splice(lineNo, 1);
  else lines[lineNo] = replacement;
  await app.vault.modify(file, lines.join("\n"));
}
