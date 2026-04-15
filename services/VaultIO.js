"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveTaskAtCursorInteractive = moveTaskAtCursorInteractive;
exports.createProjectFile = createProjectFile;
const obsidian_1 = require("obsidian");
const TaskModel_1 = require("../models/TaskModel");
const areaUtils_1 = require("../utils/areaUtils");
const editorUtils_1 = require("../utils/editorUtils");
const dateUtils_1 = require("../utils/dateUtils");
const FilePickerModal_1 = require("../ui/FilePickerModal");
/**
 * Gets the task at the current cursor line in the editor, including description.
 * @param editor - The editor instance
 * @returns Task, line number, end line number, and all task lines
 */
async function getActiveLineTask(editor) {
    const lineNo = editor.getCursor().line;
    // Get all lines from the editor to parse task with description
    const lines = (0, editorUtils_1.getAllEditorLines)(editor);
    // Parse the task with its description
    const { task, endLine } = (0, TaskModel_1.parseTaskWithDescription)(lines, lineNo);
    return { task, lineNo, endLine, lines };
}
/**
 * Moves the task at the cursor to a different file via interactive file picker.
 * @param app - Obsidian app instance
 * @param editor - The editor instance
 * @param settings - Plugin settings
 */
async function moveTaskAtCursorInteractive(app, editor, settings) {
    const { task, lineNo, endLine, lines } = await getActiveLineTask(editor);
    if (!task) {
        new obsidian_1.Notice("GeckoTask: No task on this line.");
        return;
    }
    // FilePickerModal will automatically get and sort files, so we can pass empty array
    const target = await new FilePickerModal_1.FilePickerModal(app, [], settings).openAndGet();
    if (!target)
        return;
    // Update task metadata (remove area:: and project:: since we're using folder/file-based structure)
    const updatedTask = {
        ...task,
        area: undefined, // Don't store area in metadata, it's derived from folder
        project: undefined, // Don't store project in metadata, it's derived from file basename
    };
    // Format task with description
    const taskLines = (0, TaskModel_1.formatTaskWithDescription)(updatedTask);
    // Remove from current file (all lines including description)
    const curFile = app.workspace.getActiveFile();
    if (!curFile)
        return;
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
    new obsidian_1.Notice(`GeckoTask: Moved task to ${target.path}`);
}
/**
 * Creates a new project file via interactive modal.
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @returns Created file or null if cancelled/error
 */
async function createProjectFile(app, settings) {
    return new Promise((resolve) => {
        const modal = new (class extends obsidian_1.Modal {
            constructor() {
                super(...arguments);
                this.area = "";
                this.projectName = "";
            }
            onOpen() {
                const { contentEl } = this;
                contentEl.empty();
                this.titleEl.setText("GeckoTask — Create Project File");
                // Only show area dropdown if there are areas configured
                const areas = (0, areaUtils_1.getAreas)(app, settings);
                if (areas.length > 0) {
                    this.area = areas[0]; // Set default to first area
                    new obsidian_1.Setting(contentEl)
                        .setName("Area")
                        .addDropdown(d => {
                        areas.forEach(a => d.addOption(a, a));
                        d.setValue(this.area);
                        d.onChange(v => this.area = v);
                    });
                }
                new obsidian_1.Setting(contentEl)
                    .setName("Project name")
                    .addText(t => t
                    .setPlaceholder("RouterRevamp")
                    .onChange(v => this.projectName = v));
                new obsidian_1.Setting(contentEl)
                    .addButton(b => b
                    .setButtonText("Create")
                    .setCta()
                    .onClick(async () => {
                    if (!this.projectName.trim()) {
                        new obsidian_1.Notice("GeckoTask: Project name required.");
                        return;
                    }
                    // Build path: tasksFolder/area/project.md or tasksFolder/project.md if no areas
                    const path = this.area
                        ? `${(0, areaUtils_1.getAreaPath)(this.area, settings)}/${this.projectName.trim()}.md`
                        : `${settings.tasksFolder}/${this.projectName.trim()}.md`;
                    // Check if file exists
                    const existing = app.vault.getAbstractFileByPath(path);
                    if (existing) {
                        new obsidian_1.Notice(`GeckoTask: File ${path} already exists.`);
                        this.close();
                        resolve(existing);
                        return;
                    }
                    // Create file
                    const today = new Date();
                    const created = (0, dateUtils_1.formatISODate)(today);
                    const content = `---
created: ${created}
---

# ${this.projectName.trim()}

**Outcome:** 

> Project notes here.

## Tasks
`;
                    try {
                        const file = await app.vault.create(path, content);
                        new obsidian_1.Notice(`GeckoTask: Created project file ${path}`);
                        this.close();
                        resolve(file);
                    }
                    catch (error) {
                        new obsidian_1.Notice(`GeckoTask: Failed to create file: ${error}`);
                        this.close();
                        resolve(null);
                    }
                }))
                    .addButton(b => b
                    .setButtonText("Cancel")
                    .onClick(() => {
                    this.close();
                    resolve(null);
                }));
            }
        })(app);
        modal.open();
    });
}
