import { App, TFile, Notice, Editor, Modal, Setting } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTask, formatTask, parseTaskWithDescription, formatTaskWithDescription, Task } from "../models/TaskModel";
import { inferAreaFromPath, isInTasksFolder, getAreaPath, isSpecialFile, getAreas, isTasksFolderFile, getProjectDisplayName } from "../utils/areaUtils";
import { getAllEditorLines } from "../utils/editorUtils";
import { formatISODate } from "../utils/dateUtils";
import { FilePickerModal } from "../ui/FilePickerModal";

/**
 * Gets the task at the current cursor line in the editor, including description.
 * @param editor - The editor instance
 * @returns Task, line number, end line number, and all task lines
 */
async function getActiveLineTask(editor: Editor) {
  const lineNo = editor.getCursor().line;
  
  // Get all lines from the editor to parse task with description
  const lines = getAllEditorLines(editor);
  
  // Parse the task with its description
  const { task, endLine } = parseTaskWithDescription(lines, lineNo);
  return { task, lineNo, endLine, lines };
}

/**
 * Moves the task at the cursor to a different file via interactive file picker.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
export async function moveTaskAtCursorInteractive(app: App, editor: Editor, settings: GeckoTaskSettings) {
  const { task, lineNo, endLine, lines } = await getActiveLineTask(editor);
  if (!task) { new Notice("GeckoTask: No task on this line."); return; }

  // FilePickerModal will automatically get and sort files, so we can pass empty array
  const target = await new FilePickerModal(app, [], settings).openAndGet();
  if (!target) return;

  // Update task metadata (remove area:: and project:: since we're using folder/file-based structure)
  const updatedTask: Task = {
    ...task,
    area: undefined, // Don't store area in metadata, it's derived from folder
    project: undefined, // Don't store project in metadata, it's derived from file basename
  };
  
  // Format task with description
  const taskLines = formatTaskWithDescription(updatedTask);

  // Remove from current file (all lines including description)
  const curFile = app.workspace.getActiveFile();
  if (!curFile) return;
  
  const curFileContent = await app.vault.read(curFile);
  const curFileLines = curFileContent.split("\n");
  
  // Remove task line and all description lines
  const numLinesToRemove = endLine - lineNo + 1;
  curFileLines.splice(lineNo, numLinesToRemove);
  await app.vault.modify(curFile, curFileLines.join("\n"));

  // Append to target file
  const content = await app.vault.read(target);
  const finalLines = taskLines.join("\n");
  const updated = content.trim().length ? content + "\n" + finalLines + "\n" : finalLines + "\n";
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
              const created = formatISODate(today);
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

