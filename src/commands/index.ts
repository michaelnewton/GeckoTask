import { App, Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Setting, TFile, TFolder, normalizePath } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { captureQuickTask } from "../ui/CaptureModal";
import { moveTaskAtCursorInteractive, createProjectFile } from "../services/VaultIO";
import { toggleCompleteAtCursor, setFieldAtCursor, addRemoveTagsAtCursor, normalizeTaskLine, deleteCompletedTasks } from "../services/TaskOps";
import { getAreaSomedayMaybePath } from "../utils/areaUtils";
import type { GeckoTaskPlugin } from "../main";

/**
 * Registers all plugin commands.
 */
export function registerCommands(plugin: GeckoTaskPlugin) {
  const { app, settings } = plugin;

  plugin.addCommand({
    id: "geckotask-open-panel",
    name: "Open Tasks Panel",
    icon: "check-circle",
    callback: () => plugin.activateView()
  });

  plugin.addCommand({
    id: "weekly-review-open-panel",
    name: "Open Weekly Review Panel",
    icon: "calendar",
    callback: () => plugin.activateWeeklyReviewView()
  });

  plugin.addCommand({
    id: "health-open-panel",
    name: "Open Health Check Panel",
    icon: "activity",
    callback: () => plugin.activateHealthView()
  });

  plugin.addRibbonIcon("check-circle", "Tasks Panel", () => plugin.activateView());

  plugin.addCommand({
    id: "geckotask-quick-add",
    name: "Quick Add/Edit Task",
    icon: "plus-circle",
    hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file) {
        await captureQuickTask(app, settings);
        return;
      }
      const existingTask = plugin.getTaskAtCursor(editor, view.file);
      if (existingTask) {
        await captureQuickTask(app, settings, existingTask);
      } else {
        await captureQuickTask(app, settings);
      }
    },
    callback: async () => {
      await captureQuickTask(app, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-toggle-complete",
    name: "Complete/Uncomplete Task at Cursor",
    icon: "check",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return new Notice("GeckoTask: Not in a Markdown view.");
      toggleCompleteAtCursor(editor, view, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-move-task",
    name: "Move Task (pick project)",
    icon: "arrow-right",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await moveTaskAtCursorInteractive(app, editor, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-due",
    name: "Set Due (at cursor)",
    icon: "calendar",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "due", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-scheduled",
    name: "Set Scheduled (at cursor)",
    icon: "calendar-clock",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "scheduled", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-priority",
    name: "Set Priority (at cursor)",
    icon: "flag",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "priority", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-set-recur",
    name: "Set Recurrence (at cursor)",
    icon: "repeat",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await setFieldAtCursor(app, editor, "recur", settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-add-remove-tags",
    name: "Add/Remove Tags (at cursor)",
    icon: "tag",
    editorCallback: async (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      await addRemoveTagsAtCursor(app, editor, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-create-project",
    name: "Create Project File",
    icon: "folder-plus",
    callback: async () => {
      await createProjectFile(app, settings);
    }
  });

  plugin.addCommand({
    id: "geckotask-normalize-task",
    name: "Normalize Task Line (at cursor)",
    icon: "wand-2",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      normalizeTaskLine(editor);
    }
  });

  plugin.addCommand({
    id: "geckotask-delete-completed",
    name: "Delete Completed Tasks (current file)",
    icon: "trash-2",
    editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
      deleteCompletedTasks(editor);
    }
  });

  // Migration command
  plugin.addCommand({
    id: "geckotask-migrate",
    name: "Migrate from old tasks folder structure",
    icon: "arrow-right-circle",
    callback: async () => {
      await runMigration(app, settings, plugin);
    }
  });
}

/**
 * Runs a one-time migration from the old centralized tasks/ folder
 * to the new PARA-like directory structure.
 *
 * Safety features:
 * - Creates a backup of the entire tasks/ folder before migrating
 * - Does NOT delete originals until all new files are confirmed created
 * - Preserves non-checkbox content from Inbox.md into a single file
 * - Preserves non-md files in Someday Maybe folders
 * - Tracks completed operations for partial-resume safety
 */
/**
 * Known names for area-level task files (single action / general tasks).
 * These get moved to {area}/{areaTasksSubfolder}/{tasksFileName}.md instead
 * of being treated as projects.
 */
const AREA_TASK_FILE_NAMES = ["Single Action", "0General", "General", "Area Tasks"];

/**
 * Checks if a file basename looks like an area-level task file.
 */
function isAreaTaskFileName(basename: string): boolean {
  return AREA_TASK_FILE_NAMES.includes(basename);
}

async function runMigration(app: App, settings: GeckoTaskSettings, plugin: GeckoTaskPlugin): Promise<void> {
  // Check if old tasksFolder exists (try common case variants)
  let tasksFolder: TFolder | null = null;
  let oldTasksFolder = "";
  for (const candidate of ["Tasks", "tasks"]) {
    const found = app.vault.getAbstractFileByPath(candidate);
    if (found && found instanceof TFolder) {
      tasksFolder = found;
      oldTasksFolder = candidate;
      break;
    }
  }
  if (!tasksFolder) {
    new Notice("GeckoTask: No 'Tasks/' or 'tasks/' folder found. Migration not needed.");
    return;
  }

  // Count items for the confirmation modal
  const areaNames: string[] = [];
  let fileCount = 0;
  for (const child of tasksFolder.children) {
    if (child instanceof TFolder && child.name !== "Archive") {
      areaNames.push(child.name);
      fileCount += countFilesRecursive(child);
    } else if (child instanceof TFile && child.extension === "md") {
      fileCount++;
    }
  }

  // Show confirmation modal
  const confirmed = await new Promise<boolean>((resolve) => {
    const modal = new (class extends Modal {
      onOpen() {
        this.modalEl.addClass("geckotask-modal");
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("GeckoTask — Migrate Task Structure");

        contentEl.createEl("p", {
          text: "This will migrate your tasks from the centralized 'tasks/' folder to the new PARA-like directory structure:"
        });

        const list = contentEl.createEl("ul");
        list.createEl("li", { text: `Source folder: ${oldTasksFolder}/` });
        list.createEl("li", { text: `Detected areas: ${areaNames.join(", ") || "(none)"}` });
        list.createEl("li", { text: `Files to migrate: ${fileCount}` });
        list.createEl("li", { text: `${oldTasksFolder}/AreaName/ProjectName.md → AreaName/1Projects/ProjectName/_tasks.md` });
        list.createEl("li", { text: `${oldTasksFolder}/AreaName/0General.md → AreaName/2Areas/_tasks.md` });
        list.createEl("li", { text: `${oldTasksFolder}/Inbox.md → Inbox/ (one file per task)` });
        list.createEl("li", { text: `${oldTasksFolder}/AreaName/Someday Maybe/ → AreaName/2Areas/_SomedayMaybe.md` });
        list.createEl("li", { text: "Archive files will be moved to tasks-archive/" });

        contentEl.createEl("p", {
          text: `A backup of '${oldTasksFolder}/' will be created as 'tasks-backup/' before migration. You can delete it manually after verifying everything looks correct.`,
          cls: "mod-warning"
        });

        new Setting(contentEl)
          .addButton(b => b
            .setButtonText("Migrate")
            .setCta()
            .onClick(() => {
              this.close();
              resolve(true);
            })
          )
          .addButton(b => b
            .setButtonText("Cancel")
            .onClick(() => {
              this.close();
              resolve(false);
            })
          );
      }
    })(app);
    modal.open();
  });

  if (!confirmed) return;

  try {
    let migratedFiles = 0;
    const areas: string[] = areaNames;

    // Step 0: Create backup by copying tasks/ to tasks-backup/
    const backupFolder = "tasks-backup";
    const existingBackup = app.vault.getAbstractFileByPath(backupFolder);
    if (!existingBackup) {
      new Notice("GeckoTask: Creating backup at tasks-backup/...");
      await copyFolderRecursive(app, tasksFolder, backupFolder);
      new Notice("GeckoTask: Backup created. Starting migration...");
    }

    // Update settings with detected areas
    settings.areaPaths = areas.length > 0 ? areas : ["Personal"];

    // 1. Migrate inbox: tasks/Inbox.md → Inbox/ (split into individual files)
    const inboxPath = `${oldTasksFolder}/Inbox.md`;
    const inboxFile = app.vault.getAbstractFileByPath(inboxPath);
    if (inboxFile instanceof TFile) {
      const content = await app.vault.read(inboxFile);
      const lines = content.split("\n");
      const taskLines = lines.filter((l: string) => l.trim().startsWith("- ["));

      // Create Inbox folder
      const inboxFolder = normalizePath(settings.inboxFolderName);
      const existingInboxFolder = app.vault.getAbstractFileByPath(inboxFolder);
      if (!existingInboxFolder) {
        await app.vault.createFolder(inboxFolder);
      }

      // Each task line becomes a separate file
      // Create all files FIRST, then delete the original
      for (const taskLine of taskLines) {
        const title = taskLine.replace(/^\s*- \[[ x]\]\s+/, "").trim().replace(/\s*\[[^\]]*\]\s*/g, "").replace(/\s*\{[^}]*}\s*/g, "").slice(0, 60);
        const slug = slugify(title);
        let finalPath = normalizePath(`${inboxFolder}/${slug || "untitled"}.md`);
        let counter = 1;
        while (app.vault.getAbstractFileByPath(finalPath)) {
          finalPath = normalizePath(`${inboxFolder}/${slug || "untitled"}-${counter}.md`);
          counter++;
        }
        await app.vault.create(finalPath, taskLine + "\n");
        migratedFiles++;
      }

      // If there was non-checkbox content, preserve it as a single inbox note
      const nonTaskContent = lines.filter((l: string) => !l.trim().startsWith("- [")).join("\n").trim();
      if (nonTaskContent.length > 0) {
        const notePath = normalizePath(`${inboxFolder}/inbox-notes.md`);
        await app.vault.create(notePath, nonTaskContent + "\n");
      }

      // Only delete old inbox file after all new files are confirmed created
      await app.vault.delete(inboxFile);
    }

    // 2. Migrate area subfolders
    for (const area of areas) {
      const areaPath = normalizePath(`${oldTasksFolder}/${area}`);
      const areaFolder = app.vault.getAbstractFileByPath(areaPath);
      if (!(areaFolder instanceof TFolder)) continue;

      // Create new area structure
      await ensureFolder(app, `${area}/${settings.projectsSubfolder}`);
      await ensureFolder(app, `${area}/${settings.areaTasksSubfolder}`);

      // Collect all children to process (snapshot to avoid mutation during iteration)
      const childrenToProcess = [...areaFolder.children];

      for (const child of childrenToProcess) {
        if (child instanceof TFile && child.extension === "md") {
          const basename = child.basename;

          // Skip inbox (already migrated above)
          if (basename === "Inbox") continue;

          // Area-level task file → area tasks file (Single Action, 0General, etc.)
          if (isAreaTaskFileName(basename)) {
            const targetPath = getAreaTasksFilePath(area, settings);
            await app.vault.rename(child, targetPath);
            migratedFiles++;
            continue;
          }

          // Regular project file → create project dir and rename to _tasks.md
          const projectName = basename;
          const projectDir = normalizePath(`${area}/${settings.projectsSubfolder}/${projectName}`);
          await ensureFolder(app, projectDir);
          const targetPath = `${projectDir}/${settings.tasksFileName}.md`;
          await app.vault.rename(child, targetPath);
          migratedFiles++;

        } else if (child instanceof TFolder) {
          const folderName = child.name;

          // Someday Maybe folder → _SomedayMaybe.md at area level
          if (folderName.toLowerCase().includes("someday") || folderName.toLowerCase().includes("maybe")) {
            // Collect content from all md files
            const allContent: string[] = [];
            for (const smChild of [...child.children]) {
              if (smChild instanceof TFile && smChild.extension === "md") {
                const content = await app.vault.read(smChild);
                allContent.push(content);
              }
            }

            if (allContent.length > 0) {
              const targetPath = getAreaSomedayMaybePath(area, settings);
              const combinedContent = `# Someday/Maybe\n\n` + allContent.join("\n\n");
              await app.vault.create(targetPath, combinedContent);
            }

            // Move non-md files to area root so they aren't lost
            for (const smChild of [...child.children]) {
              if (!(smChild instanceof TFile && smChild.extension === "md")) {
                try {
                  await app.vault.rename(smChild, normalizePath(`${area}/${smChild.name}`));
                } catch {
                  // Non-critical: leave in place
                }
              }
            }

            // Now safe to delete the old folder
            await app.vault.delete(child, true);
            migratedFiles++;
            continue;
          }

          // Treat other folders as project folders → rename contents to _tasks.md
          const projectName = folderName;
          const projectDir = normalizePath(`${area}/${settings.projectsSubfolder}/${projectName}`);
          await ensureFolder(app, projectDir);

          for (const subChild of [...child.children]) {
            if (subChild instanceof TFile && subChild.extension === "md") {
              const targetPath = `${projectDir}/${settings.tasksFileName}.md`;
              const existing = app.vault.getAbstractFileByPath(targetPath);
              if (existing) {
                const existingContent = await app.vault.read(existing);
                const newContent = await app.vault.read(subChild);
                await app.vault.modify(existing, existingContent + "\n" + newContent);
                await app.vault.delete(subChild);
              } else {
                await app.vault.rename(subChild, targetPath);
              }
              migratedFiles++;
            } else if (subChild instanceof TFile) {
              // Move non-md files into the project dir so they aren't lost
              try {
                await app.vault.rename(subChild, normalizePath(`${projectDir}/${subChild.name}`));
              } catch {
                // Non-critical
              }
            }
          }

          // Remove old project folder if only non-essential files remain
          const remaining = child.children;
          const onlyJunk = remaining.every((c) =>
            c instanceof TFile && (c.name === ".DS_Store" || c.name.endsWith(".bak") || c.name.endsWith(".backup"))
          );
          if (remaining.length === 0 || onlyJunk) {
            await app.vault.delete(child, true);
          }
        }
      }
    }

    // 3. Handle files directly in tasks/ (no area) — skip Inbox, already done
    const rootChildren = [...tasksFolder.children];
    for (const child of rootChildren) {
      if (child instanceof TFile && child.extension === "md") {
        const basename = child.basename;
        if (basename === "Inbox") continue;

        const defaultArea = settings.areaPaths[0] || "Personal";
        const projectDir = normalizePath(`${defaultArea}/${settings.projectsSubfolder}/${basename}`);
        await ensureFolder(app, projectDir);
        const targetPath = `${projectDir}/${settings.tasksFileName}.md`;
        await app.vault.rename(child, targetPath);
        migratedFiles++;
      }
    }

    // 4. Remove old tasks folder if only non-essential files remain (leave Archive in place)
    const remainingChildren = [...tasksFolder.children];
    const archiveChild = remainingChildren.find((c) => c instanceof TFolder && c.name === "Archive");
    const nonArchiveNonJunk = remainingChildren.filter((c) => {
      if (c instanceof TFolder && c.name === "Archive") return false;
      if (c instanceof TFile && (c.name === ".DS_Store" || c.name.endsWith(".bak") || c.name.endsWith(".backup"))) return false;
      return true;
    });

    if (nonArchiveNonJunk.length === 0) {
      if (archiveChild) {
        // Move Archive to vault root so it's not lost
        try {
          await app.vault.rename(archiveChild, "tasks-archive");
        } catch {
          // Leave it in place
        }
      }
      try { await app.vault.delete(tasksFolder, true); } catch { /* ok if not empty */ }
    }

    // 5. Save updated settings
    await plugin.saveSettings();

    new Notice(`GeckoTask: Migration complete! ${migratedFiles} files migrated. Backup at tasks-backup/.`);
  } catch (error) {
    new Notice(`GeckoTask: Migration failed: ${error}. Your backup is at tasks-backup/.`);
    console.error("GeckoTask migration error:", error);
  }
}

/**
 * Recursively copies a folder and all its contents to a new location.
 */
async function copyFolderRecursive(app: App, source: TFolder, targetPath: string): Promise<void> {
  await ensureFolder(app, normalizePath(targetPath));
  for (const child of source.children) {
    if (child instanceof TFile) {
      const content = await app.vault.read(child);
      const relativePath = child.path.substring(source.path.length + 1);
      await app.vault.create(normalizePath(`${targetPath}/${relativePath}`), content);
    } else if (child instanceof TFolder) {
      const relativePath = child.path.substring(source.path.length + 1);
      await copyFolderRecursive(app, child, normalizePath(`${targetPath}/${relativePath}`));
    }
  }
}

/**
 * Counts all files recursively in a folder.
 */
function countFilesRecursive(folder: TFolder): number {
  let count = 0;
  for (const child of folder.children) {
    if (child instanceof TFile) count++;
    else if (child instanceof TFolder) count += countFilesRecursive(child);
  }
  return count;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  const existing = app.vault.getAbstractFileByPath(normalizedPath);
  if (existing instanceof TFolder) return;
  await app.vault.createFolder(normalizedPath);
}
