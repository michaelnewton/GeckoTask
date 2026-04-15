import { App, AbstractInputSuggest, Modal, Setting, Notice, TFile } from "obsidian";
import { GeckoTaskSettings } from "../settings";
import { parseNLDate } from "../services/NLDate";
import { formatTask, formatTaskWithDescription, Task, parseTaskWithDescription } from "../models/TaskModel";
import { isInTasksFolder, normalizeInboxPath, isSpecialFile, isTasksFolderFile, getProjectDisplayName, getSortedProjectFiles } from "../utils/areaUtils";
import { IndexedTask } from "../view/tasks/TasksPanelTypes";
import { createProjectFile } from "../services/VaultIO";
import { validateTaskTitle, validateTaskDescription, validateTaskDueDate, validateTaskScheduled, validateTaskTags, ValidationResult } from "../services/ValidationService";


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

/**
 * Retrieves the vault's cached tags, normalized and sorted for display.
 * @param app - Obsidian app instance
 * @returns Sorted array of unique tags (with leading '#')
 */
function getVaultTags(app: App): string[] {
  const cache = app.metadataCache.getTags() ?? {};
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

  selectSuggestion(suggestion: string, evt: MouseEvent | KeyboardEvent): void {
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
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param existingTask - Optional existing task to edit
 * @param projectPath - Optional project path to pre-fill
 * @returns Promise that resolves when modal is closed
 */
export async function captureQuickTask(app: App, settings: GeckoTaskSettings, existingTask?: IndexedTask, projectPath?: string) {
  const mdFiles = app.vault.getMarkdownFiles();
  const isEditMode = !!existingTask;

  return new Promise<void>((resolve) => {
    const modal = new (class extends Modal {
      draft: Draft = {
        title: existingTask?.title || "",
        description: existingTask?.description,
        projectPath: existingTask?.path || projectPath || normalizeInboxPath(settings.inboxPath),
        due: existingTask?.due,
        scheduled: existingTask?.scheduled,
        priority: existingTask?.priority,
        tags: existingTask?.tags || [],
        recur: existingTask?.recur
      };
      availableTags: string[] = [];
      tagsInputElement: HTMLInputElement | null = null;
      tagSuggest: CaptureTagSuggest | null = null;
      
      /**
       * Validates that a date string is in ISO format (YYYY-MM-DD).
       * @param dateStr - Date string to validate
       * @returns True if valid ISO date format, false otherwise
       */
      private isValidISODate(dateStr: string): boolean {
        // Check format matches YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return false;
        }
        // Validate that it's a real date (not invalid like 2025-13-45)
        const date = new Date(dateStr);
        const [year, month, day] = dateStr.split("-").map(Number);
        return date.getFullYear() === year &&
               date.getMonth() + 1 === month &&
               date.getDate() === day;
      }

      /**
       * Handles saving the task when Enter is pressed.
       */
      private async handleSave() {
        if (!this.draft.title.trim()) { 
          new Notice("Title required."); 
          return; 
        }
        
        // Validate due date if provided
        if (this.draft.due && this.draft.due.trim()) {
          // Try to parse the due date
          const parsedDue = parseNLDate(this.draft.due.trim());
          
          if (!parsedDue) {
            new Notice(`GeckoTask: Could not parse due date "${this.draft.due}". Please use a valid date format (e.g., "today", "2025-11-25", "tomorrow").`);
            return;
          }
          
          // Validate that the parsed date is in valid ISO format
          if (!this.isValidISODate(parsedDue)) {
            new Notice(`GeckoTask: Invalid due date format "${parsedDue}". Expected format: YYYY-MM-DD (e.g., "2025-11-25").`);
            return;
          }
          
          // Update draft with the validated ISO date
          this.draft.due = parsedDue;
        }
        
        // Validate scheduled date if provided
        if (this.draft.scheduled && this.draft.scheduled.trim()) {
          // Try to parse the scheduled date
          const parsedScheduled = parseNLDate(this.draft.scheduled.trim());
          
          if (!parsedScheduled) {
            new Notice(`GeckoTask: Could not parse scheduled date "${this.draft.scheduled}". Please use a valid date format (e.g., "today", "2025-11-25", "tomorrow").`);
            return;
          }
          
          // Validate that the parsed date is in valid ISO format
          if (!this.isValidISODate(parsedScheduled)) {
            new Notice(`GeckoTask: Invalid scheduled date format "${parsedScheduled}". Expected format: YYYY-MM-DD (e.g., "2025-11-25").`);
            return;
          }
          
          // Update draft with the validated ISO date
          this.draft.scheduled = parsedScheduled;
        }
        
        if (isEditMode && existingTask) {
          await updateTask(app, existingTask, this.draft, settings);
        } else {
          await appendTask(app, this.draft, settings);
        }
        this.close();
        resolve();
      }
      
      /**
       * Renders validation feedback below an element.
       * @param container - Container element to add feedback to
       * @param results - Validation results to display
       */
      private renderValidationFeedback(container: HTMLElement, results: ValidationResult[]): void {
        // Remove existing validation feedback
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
          
          let icon = "";
          if (result.severity === "warning") {
            icon = "⚠️ ";
          } else if (result.severity === "error") {
            icon = "❌ ";
          } else {
            icon = "ℹ️ ";
          }
          
          feedbackEl.textContent = icon + result.message;
          
          if (result.suggestion) {
            const suggestionEl = feedbackContainer.createDiv({
              cls: `geckotask-validation-${result.severity} geckotask-validation-suggestion`
            });
            suggestionEl.textContent = `💡 ${result.suggestion}`;
            suggestionEl.style.fontSize = "0.85em";
            suggestionEl.style.marginTop = "2px";
            suggestionEl.style.opacity = "0.8";
          }
        }
      }

      /**
       * Debounce helper for validation.
       */
      private debounceValidation<T extends (...args: any[]) => void>(
        func: T,
        wait: number
      ): (...args: Parameters<T>) => void {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        return (...args: Parameters<T>) => {
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
          t.inputEl.style.width = "100%";
          t.onChange(v => this.draft.title = v);
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
          
          // Add debounced validation
          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskTitle(value);
            this.renderValidationFeedback(titleContainer, results);
          }, 300);
          
          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });
          
          // Initial validation
          if (this.draft.title) {
            const results = validateTaskTitle(this.draft.title);
            this.renderValidationFeedback(titleContainer, results);
          }
        });

        const normalizedInboxPath = normalizeInboxPath(settings.inboxPath);

        new Setting(contentEl).setName("Project").addDropdown(d => {
          const CREATE_NEW_PROJECT_VALUE = "__CREATE_NEW_PROJECT__";
          
          /**
           * Populates the dropdown with current project options.
           */
          const populateOptions = () => {
            // Get sorted project files (Inbox first, then areas alphabetically)
            const sortedFiles = getSortedProjectFiles(app, settings);
            
            // Clear existing options
            const currentValue = d.selectEl.value || this.draft.projectPath;
            d.selectEl.empty();
            
            // Add "Create new project" option first
            d.addOption(CREATE_NEW_PROJECT_VALUE, "➕ Create new project");
            
            // Add files in sorted order (Inbox first, then areas alphabetically)
            for (const file of sortedFiles) {
              d.addOption(file.path, getProjectDisplayName(file.path, app, settings));
            }
            
            // Restore the selected value if it still exists, otherwise use draft path or inbox
            const sortedPaths = sortedFiles.map(f => f.path);
            if (currentValue === CREATE_NEW_PROJECT_VALUE) {
              // If "Create new project" was selected, keep it selected
              d.setValue(CREATE_NEW_PROJECT_VALUE);
            } else if (sortedPaths.includes(currentValue)) {
              d.setValue(currentValue);
            } else {
              // If draft path exists and is valid, use it; otherwise use inbox
              const valueToUse = this.draft.projectPath && sortedPaths.includes(this.draft.projectPath)
                ? this.draft.projectPath 
                : (normalizedInboxPath && sortedPaths.includes(normalizedInboxPath) ? normalizedInboxPath : sortedPaths[0] || "");
              if (valueToUse) {
                d.setValue(valueToUse);
                this.draft.projectPath = valueToUse;
              }
            }
          };
          
          // Initial population
          populateOptions();
          d.selectEl.style.width = "100%";
          
          d.onChange(async (v) => {
            if (v === CREATE_NEW_PROJECT_VALUE) {
              // Open create project modal
              const newFile = await createProjectFile(app, settings);
              if (newFile) {
                // Update draft with new project path
                this.draft.projectPath = newFile.path;
                // Refresh options to include the new project
                populateOptions();
                // Select the newly created project
                d.setValue(newFile.path);
              } else {
                // User cancelled - restore previous selection
                populateOptions();
                d.setValue(this.draft.projectPath || normalizedInboxPath);
              }
            } else {
              this.draft.projectPath = v;
            }
          });
          
          // Refresh options when dropdown is clicked/focused
          d.selectEl.addEventListener("mousedown", populateOptions);
          d.selectEl.addEventListener("focus", populateOptions);
        });

        // Description field (textarea for multi-line)
        // Use fewer rows on mobile for more compact display
        const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0 || 
                        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        const descSetting = new Setting(contentEl).setName("Description (optional)");
        const descContainer = descSetting.settingEl;
        descSetting.addTextArea(t => {
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
          
          // Add debounced validation
          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskDescription(value);
            this.renderValidationFeedback(descContainer, results);
          }, 300);
          
          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLTextAreaElement).value;
            debouncedValidate(value);
          });
          
          // Initial validation
          if (this.draft.description) {
            const results = validateTaskDescription(this.draft.description);
            this.renderValidationFeedback(descContainer, results);
          }
        });

        // Helper function to check if a tag is present
        const hasTag = (tag: string): boolean => {
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          return (this.draft.tags || []).some(t => t.toLowerCase() === normalizedTag.toLowerCase());
        };

        // Helper function to toggle a tag
        const toggleTag = (tag: string) => {
          const currentTags = this.draft.tags || [];
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          const tagIndex = currentTags.findIndex(t => t.toLowerCase() === normalizedTag.toLowerCase());
          
          if (tagIndex >= 0) {
            // Remove tag
            currentTags.splice(tagIndex, 1);
          } else {
            // Add tag
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
          t.inputEl.style.width = "100%";
          this.tagsInputElement = t.inputEl;
          t.onChange(v => {
            this.draft.tags = v.split(/\s+/).filter(Boolean);
            // Update button states when tags change
            updateButtonStates();
          });
          // Handle Enter key to save
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
        // Quick add buttons for plugin-defined tags (placed after tags input)
        const quickTagButtonsContainer = contentEl.createDiv({ cls: "geckotask-quick-tag-buttons" });
        quickTagButtonsContainer.style.marginTop = "8px";
        quickTagButtonsContainer.style.marginBottom = "8px";
        quickTagButtonsContainer.style.display = "flex";
        quickTagButtonsContainer.style.gap = "8px";
        quickTagButtonsContainer.style.flexWrap = "wrap";

        // Helper function to create a tag chip button
        const createTagChip = (tag: string): HTMLElement => {
          const tagContainer = quickTagButtonsContainer.createEl("span", { 
            cls: "task-tag-container geckotask-quick-tag-chip" 
          });
          tagContainer.style.cursor = "pointer";
          
          const tagIcon = tagContainer.createEl("span", { cls: "task-tag-icon" });
          tagIcon.textContent = "🏷️";
          
          const tagText = tagContainer.createEl("span", { cls: "task-tag-text" });
          tagText.textContent = tag;
          
          return tagContainer;
        };

        // Create tag chips for "now" and "waiting for" tags
        const nowTagChip = createTagChip(settings.nowTag);
        const waitingForTagChip = createTagChip(settings.waitingForTag);

        // Function to update button states
        const updateButtonStates = () => {
          const nowActive = hasTag(settings.nowTag);
          if (nowActive) {
            nowTagChip.style.background = "var(--interactive-active)";
            nowTagChip.style.color = "var(--text-on-accent)";
          } else {
            nowTagChip.style.background = "var(--background-modifier-border)";
            nowTagChip.style.color = "var(--text-muted)";
          }

          const waitingActive = hasTag(settings.waitingForTag);
          if (waitingActive) {
            waitingForTagChip.style.background = "var(--interactive-active)";
            waitingForTagChip.style.color = "var(--text-on-accent)";
          } else {
            waitingForTagChip.style.background = "var(--background-modifier-border)";
            waitingForTagChip.style.color = "var(--text-muted)";
          }
        };

        // Set initial button states
        updateButtonStates();

        // Add click handlers
        nowTagChip.addEventListener("click", () => {
          toggleTag(settings.nowTag);
          // Update the input field
          if (this.tagsInputElement) {
            this.tagsInputElement.value = (this.draft.tags || []).join(" ");
            // Trigger onChange to update draft
            this.tagsInputElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateButtonStates();
        });

        waitingForTagChip.addEventListener("click", () => {
          toggleTag(settings.waitingForTag);
          // Update the input field
          if (this.tagsInputElement) {
            this.tagsInputElement.value = (this.draft.tags || []).join(" ");
            // Trigger onChange to update draft
            this.tagsInputElement.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateButtonStates();
        });

        const dueSetting = new Setting(contentEl).setName("Due");
        const dueContainer = dueSetting.settingEl;
        dueSetting.addText(t => {
          t.setPlaceholder("today / 2025-11-15");
          t.setValue(this.draft.due || "");
          t.inputEl.style.width = "100%";
          t.onChange(v => {
            if (v) {
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
          
          // Add debounced validation
          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskDueDate(value, this.draft.title);
            this.renderValidationFeedback(dueContainer, results);
          }, 300);
          
          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });
          
          // Initial validation
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
          t.inputEl.style.width = "100%";
          t.onChange(v => {
            if (v) {
              const parsed = parseNLDate(v);
              this.draft.scheduled = parsed || v;
            } else {
              this.draft.scheduled = v;
            }
          });
          // Handle Enter key to save
          t.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
              evt.preventDefault();
              this.handleSave();
            }
          });
          
          // Add debounced validation
          const debouncedValidate = this.debounceValidation((value: string) => {
            const results = validateTaskScheduled(value);
            this.renderValidationFeedback(scheduledContainer, results);
          }, 300);
          
          t.inputEl.addEventListener("input", (evt) => {
            const value = (evt.target as HTMLInputElement).value;
            debouncedValidate(value);
          });
          
          // Initial validation
          if (this.draft.scheduled) {
            const results = validateTaskScheduled(this.draft.scheduled);
            this.renderValidationFeedback(scheduledContainer, results);
          }
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

        new Setting(contentEl).setName("Priority").addDropdown(d => {
          // Add empty option for "none"
          d.addOption("", "(none)");
          for (const p of settings.allowedPriorities) d.addOption(p, p);
          d.setValue(this.draft.priority || "");
          d.selectEl.style.width = "100%";
          d.onChange(v => this.draft.priority = v || undefined);
        });

        new Setting(contentEl)
          .addButton(b => b.setButtonText(isEditMode ? "Save" : "Add").setCta().onClick(async () => {
            await this.handleSave();
          }))
          .addButton(b => b.setButtonText("Cancel").onClick(() => { this.close(); resolve(); }));
      }

      onClose() {
        this.tagSuggest?.close();
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
async function appendTask(app: App, d: Draft, settings: GeckoTaskSettings) {
  const file = app.vault.getAbstractFileByPath(d.projectPath);
  if (!file || !(file instanceof TFile)) {
    new Notice(`GeckoTask: File not found ${d.projectPath}`);
    return;
  }
  const prev = await app.vault.read(file);

  // Infer project name from file path (basename, unless it's a special file like Inbox or Single Action)
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
    scheduled: d.scheduled,
    priority: d.priority,
    recur: d.recur,
    project: undefined, // Don't store project in metadata, it's derived from file basename
    area: undefined, // Don't store area in metadata, it's derived from folder
    raw: ""
  };

  // Format task with description (returns array of lines)
  const taskLines = formatTaskWithDescription(task);
  // Remove trailing newlines from existing content to avoid extra blank lines
  const normalizedPrev = prev.replace(/\n+$/, "");
  const next = normalizedPrev.length 
    ? normalizedPrev + "\n" + taskLines.join("\n") + "\n" 
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
async function updateTask(app: App, existingTask: IndexedTask, d: Draft, settings: GeckoTaskSettings) {
  const sourceFile = app.vault.getAbstractFileByPath(existingTask.path);
  if (!(sourceFile instanceof TFile)) {
    new Notice(`GeckoTask: File not found ${existingTask.path}`);
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
    new Notice(`GeckoTask: Task line out of bounds`);
    return;
  }

  // Parse current task with description
  const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
  if (!parsed) {
    new Notice(`GeckoTask: Failed to parse task`);
    return;
  }

  // Preserve checked status and create updated task
  const taskWithDescription: Task = {
    ...parsed,
    checked: parsed.checked,
    title: d.title,
    description: d.description,
    due: d.due,
    scheduled: d.scheduled,
    priority: d.priority,
    recur: d.recur,
    // Normalize tags (ensure they start with #)
    tags: (d.tags ?? []).map(t => t.startsWith("#") ? t : "#" + t),
  };

  // If moving, update project based on target file
  if (isMoving) {
    const targetFile = app.vault.getAbstractFileByPath(targetPath);
    if (!(targetFile instanceof TFile)) {
      new Notice(`GeckoTask: Target file not found ${targetPath}`);
      return;
    }

    // Note: project is derived from file basename, not stored in metadata
    // No need to update project field
    taskWithDescription.area = undefined; // Don't store area in metadata, it's derived from folder

    // Remove task from source file
    const numLinesToRemove = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToRemove);
    await app.vault.modify(sourceFile, lines.join("\n"));

    // Format task with description and append to target file
    const updatedLines = formatTaskWithDescription(taskWithDescription);
    const targetContent = await app.vault.read(targetFile);
    const finalLines = updatedLines.join("\n");
    // Remove trailing newlines from existing content to avoid extra blank lines
    const normalizedTarget = targetContent.replace(/\n+$/, "");
    const updated = normalizedTarget.length 
      ? normalizedTarget + "\n" + finalLines + "\n" 
      : finalLines + "\n";
    await app.vault.modify(targetFile, updated);

    new Notice(`GeckoTask: Task moved and updated`);
  } else {
    // Update task in place
    const updatedLines = formatTaskWithDescription(taskWithDescription);
    
    // Replace task line and description lines
    const numLinesToReplace = descEndIdx - taskLineIdx + 1;
    lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
    await app.vault.modify(sourceFile, lines.join("\n"));

    new Notice(`GeckoTask: Task updated`);
  }
}
