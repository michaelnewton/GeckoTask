import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../TasksPanelTypes";
import { PromptModal } from "../../../ui/PromptModal";
import { FilePickerModal } from "../../../ui/FilePickerModal";
import { captureQuickTask } from "../../../ui/CaptureModal";
import { parseNLDate } from "../../../services/NLDate";
import { formatDueDate, formatScheduledDate, isOverdue, getPriorityColorClass, extractLabels, renderDescriptionLine } from "../utils/taskFormatting";
import { updateTaskField, moveTask, openTaskInNote } from "../utils/taskOperations";
import { TFile } from "obsidian";
import { validateTaskTitle, ValidationResult } from "../../../services/ValidationService";

/**
 * Callbacks for task item actions.
 */
export interface TaskItemCallbacks {
  onToggle: (task: IndexedTask, checked: boolean) => Promise<void>;
  onUpdateField: (task: IndexedTask, key: "due" | "scheduled" | "priority" | "recur", value?: string) => Promise<void>;
  onUpdateTitle: (task: IndexedTask, newTitle: string) => Promise<void>;
  onMove: (task: IndexedTask) => Promise<void>;
  onOpen: (task: IndexedTask) => Promise<void>;
  onEdit: (task: IndexedTask) => Promise<void>;
  onRerender: () => void;
}

/**
 * Renders an individual task card.
 * @param host - Container element to render into
 * @param app - Obsidian app instance
 * @param settings - Plugin settings
 * @param task - The task to render
 * @param callbacks - Callbacks for task actions
 */
export function renderTaskItem(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  callbacks: TaskItemCallbacks
): void {
  const card = host.createDiv({ cls: "geckotask-card" });
  
  // Top row: Checkbox + Recurring icon + Title
  const topRow = card.createDiv({ cls: "task-card-top" });
  const cb = topRow.createEl("input", { type: "checkbox", cls: "task-checkbox" });
  cb.checked = false;
  
  // Add priority color class to checkbox
  const priorityClass = getPriorityColorClass(task.priority, settings);
  cb.classList.add(priorityClass);
  
  cb.addEventListener("change", async () => {
    await callbacks.onToggle(task, cb.checked);
  });
  
  // Recurring task icon (icon only, no text)
  if (task.recur) {
    const recurIcon = topRow.createDiv({ cls: "task-recur-icon" });
    recurIcon.innerHTML = "🔁";
    recurIcon.title = `Recurring: ${task.recur}`;
    recurIcon.style.cursor = "pointer";
    recurIcon.addEventListener("click", async (e) => {
      e.stopPropagation();
      const modal = new PromptModal(
        app, 
        "Set recurrence", 
        task.recur || "",
        "Examples: 'every Tuesday', 'every 10 days', 'every 2 weeks on Tuesday'"
      );
      const value = await modal.prompt();
      if (value != null) {
        await callbacks.onUpdateField(task, "recur", value.trim() || undefined);
      }
    });
  }
  
  const titleContainer = topRow.createDiv({ cls: "task-title-container" });
  const title = titleContainer.createEl("div", { cls: "task-title" });
  title.style.cursor = "pointer";
  renderDescriptionLine(title, task.title);
  title.addEventListener("click", () => {
    startEditingTitle(title, task, callbacks);
  });

  // Action icons container (top right)
  const actionIconsContainer = topRow.createDiv({ cls: "task-card-top-icons" });
  
  // Edit icon
  const editIcon = actionIconsContainer.createEl("span", { cls: "task-action-icon task-action-icon-edit" });
  editIcon.innerHTML = "✏️";
  editIcon.title = "Edit";
  editIcon.style.cursor = "pointer";
  editIcon.addEventListener("click", async (e) => {
    e.stopPropagation();
    await callbacks.onEdit(task);
  });

  // Open icon
  const openIcon = actionIconsContainer.createEl("span", { cls: "task-action-icon task-action-icon-open" });
  openIcon.innerHTML = "🔗";
  openIcon.title = "Open note";
  openIcon.style.cursor = "pointer";
  openIcon.addEventListener("click", async (e) => {
    e.stopPropagation();
    await callbacks.onOpen(task);
  });

  // Bottom row: Scheduled date + Due date + Priority + Tags on left, Project on right
  const bottomRow = card.createDiv({ cls: "task-card-bottom" });
  
  // Left side: Scheduled date + Due date + Priority + Tags
  const leftSide = bottomRow.createDiv({ cls: "task-card-bottom-left" });
  
  // Scheduled date (with start icon)
  if (task.scheduled) {
    const scheduledContainer = leftSide.createDiv({ cls: "task-scheduled-container" });
    const scheduledIcon = scheduledContainer.createEl("span", { cls: "task-scheduled-icon" });
    scheduledIcon.innerHTML = "▶️";
    const scheduledText = scheduledContainer.createEl("span", { cls: "task-scheduled-text" });
    scheduledText.textContent = formatScheduledDate(task.scheduled);
    scheduledContainer.style.cursor = "pointer";
    scheduledContainer.addEventListener("click", async () => {
      const defaultValue = task.scheduled ?? "today";
      const modal = new PromptModal(app, "Set scheduled date (today / 2025-11-10)", defaultValue, undefined, "scheduled", task.title);
      const next = await modal.prompt();
      if (next == null) return; // User cancelled
      if (next.trim() === "") {
        // User wants to clear the scheduled date
        await callbacks.onUpdateField(task, "scheduled", undefined);
        return;
      }
      const parsed = parseNLDate(next) ?? next;
      await callbacks.onUpdateField(task, "scheduled", parsed);
    });
  } else {
    const scheduledContainer = leftSide.createDiv({ cls: "task-scheduled-container task-scheduled-empty" });
    const scheduledIcon = scheduledContainer.createEl("span", { cls: "task-scheduled-icon" });
    scheduledIcon.innerHTML = "▶️";
    scheduledContainer.style.cursor = "pointer";
    scheduledContainer.style.opacity = "0.6";
    scheduledContainer.addEventListener("click", async () => {
      const defaultValue = "today";
      const modal = new PromptModal(app, "Set scheduled date (today / 2025-11-10)", defaultValue, undefined, "scheduled", task.title);
      const next = await modal.prompt();
      if (next == null) return; // User cancelled
      if (next.trim() === "") {
        // User wants to clear the scheduled date
        await callbacks.onUpdateField(task, "scheduled", undefined);
        return;
      }
      const parsed = parseNLDate(next) ?? next;
      await callbacks.onUpdateField(task, "scheduled", parsed);
    });
  }
  
  // Due date (with deadline icon)
  if (task.due) {
    const dueContainer = leftSide.createDiv({ cls: "task-due-container" });
    const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
    dueIcon.innerHTML = "🏁";
    const dueText = dueContainer.createEl("span", { cls: "task-due-text" });
    dueText.textContent = formatDueDate(task.due);
    // Apply red styling if overdue
    if (isOverdue(task.due)) {
      dueText.addClass("task-due-text-overdue");
    }
    dueContainer.style.cursor = "pointer";
    dueContainer.addEventListener("click", async () => {
      const defaultValue = task.due ?? "today";
      const modal = new PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue, undefined, "due", task.title);
      const next = await modal.prompt();
      if (next == null) return; // User cancelled
      if (next.trim() === "") {
        // User wants to clear the due date
        await callbacks.onUpdateField(task, "due", undefined);
        return;
      }
      const parsed = parseNLDate(next) ?? next;
      await callbacks.onUpdateField(task, "due", parsed);
    });
  } else {
    const dueContainer = leftSide.createDiv({ cls: "task-due-container task-due-empty" });
    const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
    dueIcon.innerHTML = "📅";
    dueContainer.style.cursor = "pointer";
    dueContainer.style.opacity = "0.6";
    dueContainer.addEventListener("click", async () => {
      const defaultValue = "today";
      const modal = new PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue, undefined, "due", task.title);
      const next = await modal.prompt();
      if (next == null) return; // User cancelled
      if (next.trim() === "") {
        // User wants to clear the due date
        await callbacks.onUpdateField(task, "due", undefined);
        return;
      }
      const parsed = parseNLDate(next) ?? next;
      await callbacks.onUpdateField(task, "due", parsed);
    });
  }
  
  // Priority (with priority icon) - styled as pill/badge with color
  const priorityColorClass = getPriorityColorClass(task.priority, settings);
  const priorityContainer = leftSide.createDiv({ 
    cls: `task-priority-container ${priorityColorClass}${!task.priority ? " task-priority-empty" : ""}` 
  });
  const priorityIcon = priorityContainer.createEl("span", { cls: "task-priority-icon" });
  // Show exclamation marks based on index (index 0 = !, index 1 = !!, etc.)
  if (task.priority) {
    const priorityIdx = settings.allowedPriorities.indexOf(task.priority);
    priorityIcon.innerHTML = "!".repeat(priorityIdx >= 0 ? priorityIdx + 1 : 1);
  } else {
    priorityIcon.innerHTML = "!";
  }
  
  // Tags/labels - extract from both tags and description
  const allLabels = extractLabels(task);
  if (allLabels.length > 0) {
    allLabels.forEach(label => {
      const tagContainer = leftSide.createEl("span", { cls: "task-tag-container" });
      const tagText = tagContainer.createEl("span", { cls: "task-tag-text" });
      tagText.textContent = label;
    });
  }
  
  // Description icon (if description exists) - on same line as labels/tags
  if (task.description) {
    const descIcon = leftSide.createEl("span", { 
      text: "📄", 
      cls: "task-description-icon" 
    });
    descIcon.title = "Show description";
    descIcon.style.cursor = "pointer";
  }
  
  // Right side: Project (or Area if in Single Action file)
  const rightSide = bottomRow.createDiv({ cls: "task-card-bottom-right" });
  // Check if this task is in the Single Action file
  const basename = task.path.split("/").pop()?.replace(/\.md$/, "") || "";
  const isSingleActionFile = basename === settings.singleActionFile;
  
  if (isSingleActionFile && task.area) {
    // Show Area instead of project for Single Action file
    const areaContainer = rightSide.createDiv({ cls: "task-project-container" });
    const areaText = areaContainer.createEl("span", { cls: "task-project-text" });
    areaText.textContent = `# ${task.area}`;
  } else if (task.project) {
    // Show project for other files
    const projectContainer = rightSide.createDiv({ cls: "task-project-container" });
    const projectText = projectContainer.createEl("span", { cls: "task-project-text" });
    projectText.textContent = `# ${task.project}`;
  }

  // Description row (if exists) - hidden by default
  if (task.description) {
    const descRow = card.createDiv({ cls: "task-card-description task-description-hidden" });
    const descEl = descRow.createDiv({ cls: "task-description" });
    // Preserve line breaks - split by newlines and render each line
    const descLines = task.description.split("\n");
    descLines.forEach((line: string, idx: number) => {
      if (line.trim().length > 0) {
        const lineEl = descEl.createDiv({ cls: "task-description-line" });
        renderDescriptionLine(lineEl, line);
      } else if (idx < descLines.length - 1) {
        // Empty line for spacing
        descEl.createEl("div", { cls: "task-description-empty" });
      }
    });
    
    // Find the description icon we created earlier and add click handler
    const descIcon = leftSide.querySelector(".task-description-icon") as HTMLElement;
    if (descIcon) {
      // Toggle description visibility on icon click
      descIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        descRow.classList.toggle("task-description-hidden");
        descIcon.textContent = descRow.classList.contains("task-description-hidden") ? "📄" : "📄▼";
        descIcon.title = descRow.classList.contains("task-description-hidden") ? "Show description" : "Hide description";
      });
    }
  }

}

/**
 * Renders validation feedback for inline editing.
 * @param container - Container element (parent of input)
 * @param results - Validation results to display
 */
function renderInlineValidationFeedback(container: HTMLElement, results: ValidationResult[]): void {
  // Remove existing validation feedback
  const existing = container.querySelector(".geckotask-validation-container");
  if (existing) {
    existing.remove();
  }
  
  if (results.length === 0) {
    return;
  }
  
  const feedbackContainer = container.createDiv({ cls: "geckotask-validation-container" });
  feedbackContainer.style.position = "absolute";
  feedbackContainer.style.zIndex = "1000";
  feedbackContainer.style.background = "var(--background-primary)";
  feedbackContainer.style.border = "1px solid var(--background-modifier-border)";
  feedbackContainer.style.borderRadius = "4px";
  feedbackContainer.style.padding = "6px 8px";
  feedbackContainer.style.marginTop = "4px";
  feedbackContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
  feedbackContainer.style.maxWidth = "400px";
  
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
function debounceValidation<T extends (...args: any[]) => void>(
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

/**
 * Starts inline editing of a task title.
 * @param titleEl - The title element to replace with input
 * @param task - The indexed task being edited
 * @param callbacks - Task item callbacks
 */
function startEditingTitle(titleEl: HTMLElement, task: IndexedTask, callbacks: TaskItemCallbacks): void {
  // Get the original title text (from the task, not from rendered element)
  const currentText = task.title;
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentText;
  input.className = "task-title-edit";
  input.style.width = "100%";
  input.style.padding = "2px 4px";
  
  // Get parent container for validation feedback
  const parentContainer = titleEl.parentElement;
  
  // Replace the div with the input
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // Add debounced validation
  const debouncedValidate = debounceValidation((value: string) => {
    if (parentContainer) {
      const results = validateTaskTitle(value);
      renderInlineValidationFeedback(parentContainer, results);
    }
  }, 300);
  
  // Initial validation
  if (parentContainer) {
    const results = validateTaskTitle(currentText);
    renderInlineValidationFeedback(parentContainer, results);
  }
  
  // Add input listener for validation
  input.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    debouncedValidate(value);
  });

  let isFinishing = false;
  const finishEditing = async () => {
    // Prevent multiple calls
    if (isFinishing) return;
    isFinishing = true;

    // Check if input is still in the DOM
    if (!input.parentElement) {
      return;
    }

    // Clear validation feedback
    if (parentContainer) {
      const existing = parentContainer.querySelector(".geckotask-validation-container");
      if (existing) {
        existing.remove();
      }
    }

    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentText) {
      // Remove event listeners before rerender removes the element
      input.removeEventListener("blur", finishEditing);
      await callbacks.onUpdateTitle(task, newTitle);
    } else {
      // Restore original if cancelled or empty
      // Check again if input is still in the DOM
      if (!input.parentElement) {
        return;
      }
      const newTitleEl = document.createElement("div");
      newTitleEl.className = "task-title";
      newTitleEl.style.cursor = "pointer";
      renderDescriptionLine(newTitleEl, currentText);
      newTitleEl.addEventListener("click", () => {
        startEditingTitle(newTitleEl, task, callbacks);
      });
      input.replaceWith(newTitleEl);
    }
  };

  const handleEscape = () => {
    // Check if input is still in the DOM
    if (!input.parentElement) {
      return;
    }
    
    // Clear validation feedback
    if (parentContainer) {
      const existing = parentContainer.querySelector(".geckotask-validation-container");
      if (existing) {
        existing.remove();
      }
    }
    
    const newTitleEl = document.createElement("div");
    newTitleEl.className = "task-title";
    newTitleEl.style.cursor = "pointer";
    renderDescriptionLine(newTitleEl, currentText);
    newTitleEl.addEventListener("click", () => {
      startEditingTitle(newTitleEl, task, callbacks);
    });
    input.replaceWith(newTitleEl);
  };

  input.addEventListener("blur", finishEditing);
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await finishEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEscape();
    }
  });
}

