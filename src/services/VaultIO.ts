import { App, TFile, TFolder, Notice, Editor, Modal, Setting, normalizePath } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseTaskWithDescription, formatTaskWithDescription, Task } from "../models/TaskModel";
import { getSpaces, getProjectTasksFilePath, isInInboxFolder } from "../utils/areaUtils";
import { getAllEditorLines } from "../utils/editorUtils";
import { formatISODate } from "../utils/dateUtils";
import { FilePickerModal } from "../ui/FilePickerModal";

/**
 * Gets the task at the current cursor line in the editor, including description.
 */
async function getActiveLineTask(editor: Editor, settings: GeckoTaskSettings) {
  const lineNo = editor.getCursor().line;
  const lines = getAllEditorLines(editor);
  const { task, endLine } = parseTaskWithDescription(lines, lineNo, {
    nlDateParsing: settings.nlDateParsing
  });
  return { task, lineNo, endLine, lines };
}

/**
 * Moves the task at the cursor to a different file via interactive file picker.
 */
export async function moveTaskAtCursorInteractive(app: App, editor: Editor, settings: GeckoTaskSettings) {
  const { task, lineNo, endLine } = await getActiveLineTask(editor, settings);
  if (!task) { new Notice("GeckoTask: No task on this line."); return; }

  const target = await new FilePickerModal(app, [], settings).openAndGet();
  if (!target) return;

  const updatedTask: Task = {
    ...task,
    space: undefined,
    project: undefined,
  };

  const taskLines = formatTaskWithDescription(updatedTask);

  const curFile = app.workspace.getActiveFile();
  if (!curFile) return;
  const sourceIsInbox = isInInboxFolder(curFile.path, settings);

  const curFileContent = await app.vault.read(curFile);
  const curFileLines = curFileContent.split("\n");

  const numLinesToRemove = endLine - lineNo + 1;
  curFileLines.splice(lineNo, numLinesToRemove);
  await app.vault.modify(curFile, curFileLines.join("\n"));

  const content = await app.vault.read(target);
  const finalLines = taskLines.join("\n");
  const updated = content.trim().length ? content + "\n" + finalLines + "\n" : finalLines + "\n";
  await app.vault.modify(target, updated);

  if (sourceIsInbox) {
    const sourceContentAfterMove = await app.vault.read(curFile);
    if (sourceContentAfterMove.trim().length === 0) {
      await app.vault.delete(curFile);
    }
  }

  new Notice(`GeckoTask: Moved task to ${target.path}`);
}

/**
 * Creates a new project directory with _tasks.md inside.
 */
export async function createProjectFile(app: App, settings: GeckoTaskSettings): Promise<TFile | null> {
  return new Promise((resolve) => {
    const modal = new (class extends Modal {
      space: string = "";
      projectName: string = "";

      onOpen() {
        this.modalEl.addClass("geckotask-modal");
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("GeckoTask — Create Project");

        const spaces = getSpaces(app, settings);
        if (spaces.length > 0) {
          this.space = spaces[0];
          new Setting(contentEl)
            .setName("Space")
            .addDropdown(d => {
              spaces.forEach(s => d.addOption(s, s));
              d.setValue(this.space);
              d.onChange(v => this.space = v);
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
              if (!this.space) {
                new Notice("GeckoTask: Space required. Configure space paths in settings.");
                return;
              }

              const projectName = this.projectName.trim();
              const projectDir = normalizePath(`${this.space}/${settings.projectsSubfolder}/${projectName}`);
              const taskFilePath = getProjectTasksFilePath(this.space, projectName, settings);

              // Check if file already exists
              const existing = app.vault.getAbstractFileByPath(taskFilePath);
              if (existing) {
                new Notice(`GeckoTask: Project ${taskFilePath} already exists.`);
                this.close();
                resolve(existing as TFile);
                return;
              }

              try {
                // Create intermediate directories
                await ensureFolder(app, normalizePath(`${this.space}/${settings.projectsSubfolder}`));
                await ensureFolder(app, projectDir);

                const today = new Date();
                const created = formatISODate(today);
                const content = `---
created: ${created}
---

# ${projectName}

**Outcome:**

> Project notes here.

## Tasks
`;

                const file = await app.vault.create(taskFilePath, content);
                new Notice(`GeckoTask: Created project ${taskFilePath}`);
                this.close();
                resolve(file);
              } catch (error) {
                new Notice(`GeckoTask: Failed to create project: ${error}`);
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
 * Ensures a folder exists, creating it and any parent folders if needed.
 */
async function ensureFolder(app: App, path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  const existing = app.vault.getAbstractFileByPath(normalizedPath);
  if (existing instanceof TFolder) return;
  await app.vault.createFolder(normalizedPath);
}
