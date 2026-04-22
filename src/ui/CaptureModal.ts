import { App, AbstractInputSuggest, Modal, Setting, Notice, TFile, normalizePath } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { isValidISODate, normalizeDateInputForWrite, resolveTaskDateField } from "../services/NLDate";
import { formatTaskWithDescription, Task, parseTaskWithDescription } from "../models/TaskModel";
import { isInInboxFolder, getSortedProjectFiles, getProjectDisplayName } from "../utils/areaUtils";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";
import { createProjectFile } from "../services/VaultIO";
import { validateTaskTitle, validateTaskDescription, validateTaskDueDate, validateTaskScheduled, ValidationResult } from "../services/ValidationService";
import { ConfirmationModal } from "./ConfirmationModal";


/**
 * Draft task data collected from the capture modal.
 */
interface Draft {
  title: string;
  description?: string; // Multi-line description
  projectPath: string;
  due?: string;
  scheduled?: string;
  priority?: string;
  tags?: string[];
  recur?: string;
}

interface TagsMetadataCache {
  getTags?: () => Record<string, unknown>;
}

/**
 * Retrieves the vault's cached tags, normalized and sorted for display.
 */
function getVaultTags(app: App): string[] {
  const cache = (app.metadataCache as TagsMetadataCache).getTags?.() ?? {};
  const rawTags = Object.keys(cache)
    .map(tag => tag.trim())
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(rawTags));
  return uniqueTags.sort((a, b) => a.localeCompare(b));
}

interface TagToken {
  start: number;
  end: number;
  text: string;
}

class CaptureTagSuggest extends AbstractInputSuggest<string> {
  private readonly inputEl: HTMLInputElement;
  private readonly getTags: () => string[];
  private readonly onSelectTag: (tag: string, token: TagToken) => void;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    getTags: () => string[],
    onSelectTag: (tag: string, token: TagToken) => void
  ) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.getTags = getTags;
    this.onSelectTag = onSelectTag;
    this.limit = 15;
  }

  protected getSuggestions(_query: string): string[] {
    const token = this.getActiveToken();
    const prefix = token.text.replace(/^#+/, "").toLowerCase();
    const allTags = this.getTags();
    if (!prefix) {
      return allTags.slice(0, this.limit);
    }
    const normalizedPrefix = prefix.startsWith("#") ? prefix : `#${prefix}`;
    return allTags
      .filter(tag => {
        const lower = tag.toLowerCase();
        return lower.startsWith(normalizedPrefix) || lower.startsWith(prefix);
      })
      .slice(0, this.limit);
  }

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    el.setText(suggestion);
  }

  selectSuggestion(suggestion: string, _evt: MouseEvent | KeyboardEvent): void {
    const token = this.getActiveToken();
    this.onSelectTag(suggestion, token);
    this.close();
  }

  private getActiveToken(): TagToken {
    const value = this.inputEl.value;
    const startSelection = this.inputEl.selectionStart ?? value.length;
    const endSelection = this.inputEl.selectionEnd ?? value.length;
    const cursorPosition = Math.max(startSelection, endSelection);
    const tokenStart = this.getTokenStart(value, Math.min(startSelection, endSelection));
    const tokenEnd = this.getTokenEnd(value, cursorPosition);
    return {
      start: tokenStart,
      end: tokenEnd,
      text: value.slice(tokenStart, tokenEnd)
    };
  }

  private getTokenStart(value: string, position: number): number {
    let idx = position;
    while (idx > 0 && !/\s/.test(value[idx - 1])) {
      idx--;
    }
    return idx;
  }

  private getTokenEnd(value: string, position: number): number {
    let idx = position;
    while (idx < value.length && !/\s/.test(value[idx])) {
      idx++;
    }
    return idx;
  }
}

/**
 * Opens a modal to quickly capture a new task or edit an existing one.
 */
export async function captureQuickTask(app: App, settings: GeckoTaskSettings, existingTask?: IndexedTask, projectPath?: string) {
  const isEditMode = !!existingTask;

  return new Promise<void>((resolve) => {
    const modal = new (class extends Modal {
      draft: Draft = {
        title: existingTask?.title || "",
        description: existingTask?.description,
        projectPath: existingTask?.path || projectPath || "__INBOX__",
        due: existingTask?.due,
        scheduled: existingTask?.scheduled,
        priority: existingTask?.priority,
        tags: existingTask?.tags || [],
        recur: existingTask?.recur
      };
      availableTags: string[] = [];
      tagsInputElement: HTMLInputElement | null = null;
      tagSuggest: CaptureTagSuggest | null = null;

      private async handleSave() {
        if (!this.draft.title.trim()) {
          new Notice("Title required.");
          return;
        }

        // Validate due date if provided
        if (this.draft.due && this.draft.due.trim()) {
          const normalizedDue = normalizeDateInputForWrite(this.draft.due.trim(), settings.nlDateParsing);
          if (normalizedDue === null) {
            new Notice("GeckoTask: When natural language date parsing is off, use YYYY-MM-DD for due dates.");
            return;
          }
          if (normalizedDue !== undefined && !isValidISODate(normalizedDue)) {
            new Notice(`GeckoTask: Invalid due date format "${normalizedDue}".`);
            return;
          }
          if (normalizedDue !== undefined) this.draft.due = normalizedDue;
        }

        // Validate scheduled date if provided
        if (this.draft.scheduled && this.draft.scheduled.trim()) {
          const normalizedSched = normalizeDateInputForWrite(this.draft.scheduled.trim(), settings.nlDateParsing);
          if (normalizedSched === null) {
            new Notice("GeckoTask: When natural language date parsing is off, use YYYY-MM-DD for scheduled dates.");
            return;
          }
          if (normalizedSched !== undefined && !isValidISODate(normalizedSched)) {
            new Notice(`GeckoTask: Invalid scheduled date format "${normalizedSched}".`);
            return;
          }
          if (normalizedSched !== undefined) this.draft.scheduled = normalizedSched;
        }

        if (isEditMode && existingTask) {
          await updateTask(app, existingTask, this.draft, settings);
        } else {
          await appendTask(app, this.draft, settings);
        }
        this.close();
        resolve();
      }

      private async handleDelete() {
        if (!isEditMode || !existingTask) return;
        const confirmed = await new ConfirmationModal(
          app,
          "Delete Task",
          "Are you sure you want to delete this task?",
          `Task: ${existingTask.title}`
        ).prompt();
        if (!confirmed) return;

        await deleteTask(app, existingTask);
        this.close();
        resolve();
      }

      private renderValidationFeedback(container: HTMLElement, results: ValidationResult[]): void {
        const existing = container.querySelector(".geckotask-validation-container");
        if (existing) {
          existing.remove();
        }

        if (results.length === 0) {
          return;
        }

        const feedbackContainer = container.createDiv({ cls: "geckotask-validation-container" });

        for (const result of results) {
          const feedbackEl = feedbackContainer.createDiv({
            cls: `geckotask-validation-${result.severity}`
          });
          const icon = result.severity === "warning" ? "⚠️ " : result.severity === "error" ? "❌ " : "ℹ️ ";
          feedbackEl.textContent = icon + result.message;

          if (result.suggestion) {
            const suggestionEl = feedbackContainer.createDiv({
              cls: `geckotask-validation-${result.severity} geckotask-validation-suggestion`
            });
            suggestionEl.textContent = `💡 ${result.suggestion}`;
            suggestionEl.addClass("geckotask-validation-suggestion-subtle");
          }
        }
      }

      private debounceValidation<TArgs extends unknown[]>(
        func: (...args: TArgs) => void,
        wait: number
      ): (...args: TArgs) => void {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        return (...args: TArgs) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => func(...args), wait);
        };
      }

      onOpen() {
        this.modalEl.addClass("geckotask-modal");
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(isEditMode ? "GeckoTask — Quick Edit" : "GeckoTask — Quick Add");

        this.availableTags = getVaultTags(app);
        const quickTags = [settings.nowTag, settings.waitingForTag];
        for (const tag of quickTags) {
          if (!tag) continue;
          if (!this.availableTags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
            this.availableTags.push(tag);
          }
        }
        this.availableTags.sort((a, b) => a.localeCompare(b));
        this.tagsInputElement = null;
        this.tagSuggest = null;

        const titleSetting = new Setting(contentEl).setName("Title");
        const titleContainer = titleSetting.settingEl;
        titleSetting.addText(t => {
          t.setValue(this.draft.title);
          t.inputEl.addClass("geckotask-w-full");
          t.onChange(v => this.draft.title = v);
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });

          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskTitle(value);
            this.renderValidationFeedback(titleContainer, results);
          }, 300);

          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });

          if (this.draft.title) {
            const results = validateTaskTitle(this.draft.title);
            this.renderValidationFeedback(titleContainer, results);
          }
        });

        const INBOX_VALUE = "__INBOX__";

        new Setting(contentEl).setName("Project").addDropdown(d => {
          const CREATE_NEW_PROJECT_VALUE = "__CREATE_NEW_PROJECT__";

          const populateOptions = () => {
            const sortedFiles = getSortedProjectFiles(app, settings);
            const currentValue = d.selectEl.value || this.draft.projectPath;
            d.selectEl.empty();

            // Inbox option first
            d.addOption(INBOX_VALUE, "📥 Inbox");

            // Add "Create new project" option
            d.addOption(CREATE_NEW_PROJECT_VALUE, "➕ Create new project");

            // Add task files
            for (const file of sortedFiles) {
              // Skip inbox files — we already have the Inbox option
              if (isInInboxFolder(file.path, settings)) continue;
              d.addOption(file.path, getProjectDisplayName(file.path, app, settings));
            }

            // Restore selection
            const sortedPaths = sortedFiles.map(f => f.path);
            if (currentValue === CREATE_NEW_PROJECT_VALUE) {
              d.setValue(CREATE_NEW_PROJECT_VALUE);
            } else if (currentValue === INBOX_VALUE || (!currentValue && !this.draft.projectPath.startsWith("/"))) {
              d.setValue(this.draft.projectPath === INBOX_VALUE ? INBOX_VALUE : (sortedPaths.includes(this.draft.projectPath) ? this.draft.projectPath : INBOX_VALUE));
            } else if (sortedPaths.includes(currentValue)) {
              d.setValue(currentValue);
            } else {
              const valueToUse = this.draft.projectPath && sortedPaths.includes(this.draft.projectPath)
                ? this.draft.projectPath
                : INBOX_VALUE;
              d.setValue(valueToUse);
              this.draft.projectPath = valueToUse;
            }
          };

          populateOptions();
          d.selectEl.addClass("geckotask-w-full");

          d.onChange(async (v) => {
            if (v === CREATE_NEW_PROJECT_VALUE) {
              const newFile = await createProjectFile(app, settings);
              if (newFile) {
                this.draft.projectPath = newFile.path;
                populateOptions();
                d.setValue(newFile.path);
              } else {
                populateOptions();
                d.setValue(this.draft.projectPath || INBOX_VALUE);
              }
            } else {
              this.draft.projectPath = v;
            }
          });

          d.selectEl.addEventListener("mousedown", populateOptions);
          d.selectEl.addEventListener("focus", populateOptions);
        });

        // Description field
        const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0 ||
                        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        const descSetting = new Setting(contentEl).setName("Description (optional)");
        const descContainer = descSetting.settingEl;
        descSetting.addTextArea(t => {
          t.setPlaceholder("Multi-line description...");
          t.setValue(this.draft.description || "");
          t.inputEl.rows = isMobile ? 2 : 4;
          t.inputEl.addClass("geckotask-w-full");
          t.onChange(v => this.draft.description = v.trim() || undefined);
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
              evt.preventDefault();
              this.handleSave();
            }
          });

          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskDescription(value);
            this.renderValidationFeedback(descContainer, results);
          }, 300);

          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLTextAreaElement).value;
            debouncedValidate(value);
          });

          if (this.draft.description) {
            const results = validateTaskDescription(this.draft.description);
            this.renderValidationFeedback(descContainer, results);
          }
        });

        // Tag helpers
        const hasTag = (tag: string): boolean => {
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          return (this.draft.tags || []).some(t => t.toLowerCase() === normalizedTag.toLowerCase());
        };

        const toggleTag = (tag: string) => {
          const currentTags = this.draft.tags || [];
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          const tagIndex = currentTags.findIndex(t => t.toLowerCase() === normalizedTag.toLowerCase());

          if (tagIndex >= 0) {
            currentTags.splice(tagIndex, 1);
          } else {
            currentTags.push(normalizedTag);
          }

          this.draft.tags = currentTags;
        };

        const addToAvailableTags = (tag: string) => {
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          if (!this.availableTags.some(existing => existing.toLowerCase() === normalizedTag.toLowerCase())) {
            this.availableTags.push(normalizedTag);
            this.availableTags.sort((a, b) => a.localeCompare(b));
          }
        };

        const handleTagSelection = (tag: string, token: TagToken) => {
          const input = this.tagsInputElement;
          if (!input) return;
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          addToAvailableTags(normalizedTag);
          const before = input.value.slice(0, token.start);
          const after = input.value.slice(token.end);
          const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
          input.value = `${before}${normalizedTag}${needsTrailingSpace ? " " : ""}${after}`;
          const cursorPos = before.length + normalizedTag.length + (needsTrailingSpace ? 1 : 0);
          input.setSelectionRange(cursorPos, cursorPos);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          updateButtonStates();
        };

        const tagsSetting = new Setting(contentEl).setName("Tags (space-separated)");
        tagsSetting.addText(t => {
          t.setPlaceholder("#work #bug");
          t.setValue((this.draft.tags || []).join(" "));
          t.inputEl.addClass("geckotask-w-full");
          this.tagsInputElement = t.inputEl;
          t.onChange(v => {
            this.draft.tags = v.split(/\s+/).filter(Boolean);
            updateButtonStates();
          });
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
          this.tagSuggest = new CaptureTagSuggest(
            app,
            t.inputEl,
            () => this.availableTags,
            (tag, token) => handleTagSelection(tag, token)
          );
        });

        // Quick tag buttons
        const quickTagButtonsContainer = contentEl.createDiv({ cls: "geckotask-quick-tag-buttons" });
        quickTagButtonsContainer.addClass("geckotask-quick-tag-buttons-layout");

        const createTagChip = (tag: string): HTMLElement => {
          const tagContainer = quickTagButtonsContainer.createEl("span", {
            cls: "task-tag-container geckotask-quick-tag-chip"
          });
          tagContainer.addClass("geckotask-clickable");

          const tagIcon = tagContainer.createEl("span", { cls: "task-tag-icon" });
          tagIcon.textContent = "🏷️";

          const tagText = tagContainer.createEl("span", { cls: "task-tag-text" });
          tagText.textContent = tag;

          return tagContainer;
        };

        const nowTagChip = createTagChip(settings.nowTag);
        const waitingForTagChip = createTagChip(settings.waitingForTag);

        const updateButtonStates = () => {
          const nowActive = hasTag(settings.nowTag);
          nowTagChip.toggleClass("geckotask-quick-tag-chip-active", nowActive);
          nowTagChip.toggleClass("geckotask-quick-tag-chip-inactive", !nowActive);

          const waitingActive = hasTag(settings.waitingForTag);
          waitingForTagChip.toggleClass("geckotask-quick-tag-chip-active", waitingActive);
          waitingForTagChip.toggleClass("geckotask-quick-tag-chip-inactive", !waitingActive);
        };

        updateButtonStates();

        nowTagChip.addEventListener("click", () => {
          toggleTag(settings.nowTag);
          if (this.tagsInputElement) {
            this.tagsInputElement.value = (this.draft.tags || []).join(" ");
            this.tagsInputElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateButtonStates();
        });

        waitingForTagChip.addEventListener("click", () => {
          toggleTag(settings.waitingForTag);
          if (this.tagsInputElement) {
            this.tagsInputElement.value = (this.draft.tags || []).join(" ");
            this.tagsInputElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateButtonStates();
        });

        const dueSetting = new Setting(contentEl).setName("Due");
        const dueContainer = dueSetting.settingEl;
        dueSetting.addText(t => {
          t.setPlaceholder("today / 2025-11-15");
          t.setValue(this.draft.due || "");
          t.inputEl.addClass("geckotask-w-full");
          t.onChange(v => {
            if (v && v.trim()) {
              this.draft.due = resolveTaskDateField(v.trim(), settings.nlDateParsing) ?? v.trim();
            } else {
              this.draft.due = undefined;
            }
          });
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });

          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskDueDate(value, this.draft.title);
            this.renderValidationFeedback(dueContainer, results);
          }, 300);

          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });

          if (this.draft.due) {
            const results = validateTaskDueDate(this.draft.due, this.draft.title);
            this.renderValidationFeedback(dueContainer, results);
          }
        });

        const scheduledSetting = new Setting(contentEl).setName("Scheduled");
        const scheduledContainer = scheduledSetting.settingEl;
        scheduledSetting.addText(t => {
          t.setPlaceholder("today / 2025-11-15");
          t.setValue(this.draft.scheduled || "");
          t.inputEl.addClass("geckotask-w-full");
          t.onChange(v => {
            if (v && v.trim()) {
              this.draft.scheduled = resolveTaskDateField(v.trim(), settings.nlDateParsing) ?? v.trim();
            } else {
              this.draft.scheduled = undefined;
            }
          });
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });

          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskScheduled(value);
            this.renderValidationFeedback(scheduledContainer, results);
          }, 300);

          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });

          if (this.draft.scheduled) {
            const results = validateTaskScheduled(this.draft.scheduled);
            this.renderValidationFeedback(scheduledContainer, results);
          }
        });

        new Setting(contentEl).setName("Recurrence (optional)").addText(t => {
          t.setPlaceholder("every Tuesday / every 10 days");
          t.setValue(this.draft.recur || "");
          t.inputEl.addClass("geckotask-w-full");
          t.onChange(v => this.draft.recur = v.trim() || undefined);
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
        });

        new Setting(contentEl).setName("Priority").addDropdown(d => {
          d.addOption("", "(none)");
          for (const p of settings.allowedPriorities) d.addOption(p, p);
          d.setValue(this.draft.priority || "");
          d.selectEl.addClass("geckotask-w-full");
          d.onChange(v => this.draft.priority = v || undefined);
        });

        const actionSetting = new Setting(contentEl);

        if (isEditMode) {
          actionSetting.settingEl.addClass("geckotask-quick-edit-actions");
          actionSetting
            .addButton(b => {
              b
                .setButtonText("Delete")
                .setWarning()
                .onClick(async () => {
                  await this.handleDelete();
                });
              b.buttonEl.addClass("geckotask-quick-edit-delete-btn");
            })
            .addButton(b => b.setButtonText("Save").setCta().onClick(async () => {
              await this.handleSave();
            }))
            .addButton(b => b.setButtonText("Cancel").onClick(() => { this.close(); resolve(); }));
        } else {
          actionSetting
            .addButton(b => b.setButtonText("Add").setCta().onClick(async () => {
              await this.handleSave();
            }))
            .addButton(b => b.setButtonText("Cancel").onClick(() => { this.close(); resolve(); }));
        }
      }

      onClose() {
        this.tagSuggest?.close();
      }
    })(app);

    modal.open();
  });
}

/**
 * Creates a new file in the Inbox folder with the task, or appends to an existing project/area file.
 */
async function appendTask(app: App, d: Draft, settings: GeckoTaskSettings) {
  const INBOX_VALUE = "__INBOX__";
  const tags = (d.tags ?? []).map(t => t.startsWith("#") ? t : "#" + t);

  const task: Task = {
    checked: false,
    title: d.title,
    description: d.description,
    tags: tags,
    due: d.due,
    scheduled: d.scheduled,
    priority: d.priority,
    recur: d.recur,
    project: undefined,
    space: undefined,
    raw: ""
  };

  const taskLines = formatTaskWithDescription(task);

  if (d.projectPath === INBOX_VALUE) {
    // Create a new file in the Inbox folder
    const inboxFolder = normalizePath(settings.inboxFolderName);
    const slug = slugify(d.title);
    const filePath = normalizePath(`${inboxFolder}/${slug}.md`);

    // Ensure inbox folder exists
    const existingFolder = app.vault.getAbstractFileByPath(inboxFolder);
    if (!existingFolder) {
      await app.vault.createFolder(inboxFolder);
    }

    // Check if file already exists, if so append a number
    let finalPath = filePath;
    let counter = 1;
    while (app.vault.getAbstractFileByPath(finalPath)) {
      finalPath = normalizePath(`${inboxFolder}/${slug}-${counter}.md`);
      counter++;
    }

    const content = taskLines.join("\n") + "\n";
    await app.vault.create(finalPath, content);
    new Notice(`GeckoTask: Added to Inbox`);
  } else {
    // Append to existing project/area tasks file
    const file = app.vault.getAbstractFileByPath(normalizePath(d.projectPath));
    if (!file || !(file instanceof TFile)) {
      new Notice(`GeckoTask: File not found ${d.projectPath}`);
      return;
    }
    const prev = await app.vault.read(file);
    const normalizedPrev = prev.replace(/\n+$/, "");
    const next = normalizedPrev.length
      ? normalizedPrev + "\n" + taskLines.join("\n") + "\n"
      : taskLines.join("\n") + "\n";
    await app.vault.modify(file, next);
  }
}

/**
 * Slugifies a title for use as a filename.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Updates an existing task in the file.
 */
async function updateTask(app: App, existingTask: IndexedTask, d: Draft, settings: GeckoTaskSettings) {
  const INBOX_VALUE = "__INBOX__";
  const sourceFile = app.vault.getAbstractFileByPath(existingTask.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice(`GeckoTask: File not found ${existingTask.path}`);
    return;
  }

  const targetPath = d.projectPath;
  const isMoving = targetPath !== existingTask.path;
  const sourceIsInbox = isInInboxFolder(sourceFile.path, settings);

  const sourceContent = await app.vault.read(sourceFile);
  const lines = sourceContent.split("\n");
  const taskLineIdx = existingTask.line - 1;
  const descEndIdx = (existingTask.descriptionEndLine ?? existingTask.line) - 1;

  if (taskLineIdx < 0 || taskLineIdx >= lines.length) {
    new Notice(`GeckoTask: Task line out of bounds`);
    return;
  }

  const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx, {
    nlDateParsing: settings.nlDateParsing
  });
  if (!parsed) {
    new Notice(`GeckoTask: Failed to parse task`);
    return;
  }

  const taskWithDescription: Task = {
    ...parsed,
    checked: parsed.checked,
    title: d.title,
    description: d.description,
    due: d.due,
    scheduled: d.scheduled,
    priority: d.priority,
    recur: d.recur,
    tags: (d.tags ?? []).map(t => t.startsWith("#") ? t : "#" + t),
  };

  if (isMoving) {
    if (targetPath === INBOX_VALUE) {
      // Move to inbox: create new file in Inbox folder
      taskWithDescription.space = undefined;

      // Remove from source
      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      await app.vault.modify(sourceFile, lines.join("\n"));

      // Create new inbox file
      const inboxFolder = normalizePath(settings.inboxFolderName);
      const slug = slugify(d.title);
      let finalPath = normalizePath(`${inboxFolder}/${slug}.md`);
      let counter = 1;
      while (app.vault.getAbstractFileByPath(finalPath)) {
        finalPath = normalizePath(`${inboxFolder}/${slug}-${counter}.md`);
        counter++;
      }

      const existingFolder = app.vault.getAbstractFileByPath(inboxFolder);
      if (!existingFolder) {
        await app.vault.createFolder(inboxFolder);
      }

      const updatedLines = formatTaskWithDescription(taskWithDescription);
      await app.vault.create(finalPath, updatedLines.join("\n") + "\n");

      if (sourceIsInbox) {
        const sourceContentAfterMove = await app.vault.read(sourceFile);
        if (sourceContentAfterMove.trim().length === 0) {
          await app.vault.delete(sourceFile);
        }
      }

      new Notice(`GeckoTask: Task moved to Inbox`);
    } else {
      // Move to a different project/area file
      const targetFile = app.vault.getAbstractFileByPath(targetPath);
      if (!(targetFile instanceof TFile)) {
        new Notice(`GeckoTask: Target file not found ${targetPath}`);
        return;
      }

      taskWithDescription.space = undefined;

      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      await app.vault.modify(sourceFile, lines.join("\n"));

      const updatedLines = formatTaskWithDescription(taskWithDescription);
      const targetContent = await app.vault.read(targetFile);
      const finalLines = updatedLines.join("\n");
      const normalizedTarget = targetContent.replace(/\n+$/, "");
      const updated = normalizedTarget.length
        ? normalizedTarget + "\n" + finalLines + "\n"
        : finalLines + "\n";
      await app.vault.modify(targetFile, updated);

      if (sourceIsInbox) {
        const sourceContentAfterMove = await app.vault.read(sourceFile);
        if (sourceContentAfterMove.trim().length === 0) {
          await app.vault.delete(sourceFile);
        }
      }

      new Notice(`GeckoTask: Task moved and updated`);
    }
  } else {
    // Update task in place
    const updatedLines = formatTaskWithDescription(taskWithDescription);
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    await app.vault.modify(sourceFile, lines.join("\n"));
    new Notice(`GeckoTask: Task updated`);
  }
}

/**
 * Deletes an existing task from its source file.
 */
async function deleteTask(app: App, existingTask: IndexedTask) {
  const sourceFile = app.vault.getAbstractFileByPath(existingTask.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice(`GeckoTask: File not found ${existingTask.path}`);
    return;
  }

  await app.vault.process(sourceFile, (data) => {
    const lines = data.split("\n");
    const taskLineIdx = existingTask.line - 1;
    const descEndIdx = (existingTask.descriptionEndLine ?? existingTask.line) - 1;

    if (taskLineIdx < 0 || taskLineIdx >= lines.length) {
      return data;
    }

    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    return lines.join("\n");
  });

  new Notice("GeckoTask: Task deleted");
}
