import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../TasksPanelTypes";
import { PromptModal } from "../../../ui/PromptModal";
import { FilePickerModal } from "../../../ui/FilePickerModal";
import { captureQuickTask } from "../../../ui/CaptureModal";
import { parseNLDate } from "../../../services/NLDate";
import { formatDueDate, isOverdue, getPriorityColorClass, extractLabels, renderDescriptionLine } from "../utils/taskFormatting";
import { updateTaskField, moveTask, openTaskInNote } from "../utils/taskOperations";
import { TFile } from "obsidian";

/**
 * Callbacks for task item actions.
 */
export interface TaskItemCallbacks {
  onToggle: (task: IndexedTask, checked: boolean) => Promise<void>;
  onUpdateField: (task: IndexedTask, key: "due" | "priority" | "recur", value?: string) => Promise<void>;
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
 * @param isTouchDevice - Whether the device supports touch input
 */
export function renderTaskItem(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  callbacks: TaskItemCallbacks,
  isTouchDevice: boolean
): void {
  const card = host.createDiv({ cls: "geckotask-card" });
  
  // Mobile tap-to-reveal: toggle action buttons on card tap
  // Only add this on touch devices (mobile)
  if (isTouchDevice) {
    card.addEventListener("click", (e) => {
      // Don't toggle if clicking on interactive elements
      const target = e.target as HTMLElement;
      const isInteractive = target.closest("input, button, .task-checkbox, .task-recur-icon, .task-due-container, .task-description-icon, .task-priority-container, .geckotask-action-btn, .task-title, .task-title-container");
      
      if (!isInteractive) {
        // Toggle this card and close others
        const wasExpanded = card.classList.contains("task-card-expanded");
        // Close all cards first
        host.querySelectorAll(".geckotask-card").forEach((c) => {
          c.classList.remove("task-card-expanded");
        });
        // Toggle this card if it wasn't already expanded
        if (!wasExpanded) {
          card.classList.add("task-card-expanded");
        }
      }
    });
  }

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

  // Bottom row: Due date + Priority + Tags on left, Project on right
  const bottomRow = card.createDiv({ cls: "task-card-bottom" });
  
  // Left side: Due date + Priority + Tags
  const leftSide = bottomRow.createDiv({ cls: "task-card-bottom-left" });
  
  // Due date (with calendar icon)
  if (task.due) {
    const dueContainer = leftSide.createDiv({ cls: "task-due-container" });
    const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
    dueIcon.innerHTML = "📅";
    const dueText = dueContainer.createEl("span", { cls: "task-due-text" });
    dueText.textContent = formatDueDate(task.due);
    // Apply red styling if overdue
    if (isOverdue(task.due)) {
      dueText.addClass("task-due-text-overdue");
    }
    dueContainer.style.cursor = "pointer";
    dueContainer.addEventListener("click", async () => {
      const defaultValue = task.due ?? "today";
      const modal = new PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue);
      const next = await modal.prompt();
      if (next == null || next.trim() === "") return;
      const parsed = parseNLDate(next) ?? next;
      await callbacks.onUpdateField(task, "due", parsed);
    });
  } else {
    const dueContainer = leftSide.createDiv({ cls: "task-due-container task-due-empty" });
    const dueIcon = dueContainer.createEl("span", { cls: "task-due-icon" });
    dueIcon.innerHTML = "📅";
    const dueText = dueContainer.createEl("span", { cls: "task-due-text" });
    dueText.textContent = "Set due";
    dueContainer.style.cursor = "pointer";
    dueContainer.style.opacity = "0.6";
    dueContainer.addEventListener("click", async () => {
      const defaultValue = "today";
      const modal = new PromptModal(app, "Set due date (today / 2025-11-10)", defaultValue);
      const next = await modal.prompt();
      if (next == null || next.trim() === "") return;
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
  
  // Tags/labels (with tag icon) - extract from both tags and description
  const allLabels = extractLabels(task);
  if (allLabels.length > 0) {
    allLabels.forEach(label => {
      const tagContainer = leftSide.createEl("span", { cls: "task-tag-container" });
      const tagIcon = tagContainer.createEl("span", { cls: "task-tag-icon" });
      tagIcon.textContent = "🏷️";
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
    // Don't render labels as badges in description (they're shown in bottom left)
    const descLines = task.description.split("\n");
    descLines.forEach((line, idx) => {
      if (line.trim().length > 0) {
        const lineEl = descEl.createDiv({ cls: "task-description-line" });
        renderDescriptionLine(lineEl, line, false); // false = don't render labels as badges
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

  // Action buttons (shown on hover)
  const actionRow = card.createDiv({ cls: "task-card-actions" });
  
  // Edit button
  const editBtn = actionRow.createEl("button", { 
    text: "Edit", 
    cls: "geckotask-action-btn geckotask-action-btn-edit"
  });
  editBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await callbacks.onEdit(task);
  });

  // Move button
  const moveBtn = actionRow.createEl("button", { 
    text: "Move", 
    cls: "geckotask-action-btn geckotask-action-btn-move"
  });
  moveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await callbacks.onMove(task);
  });

  // Open Note button
  const openBtn = actionRow.createEl("button", { 
    text: "Open", 
    cls: "geckotask-action-btn geckotask-action-btn-primary"
  });
  openBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await callbacks.onOpen(task);
  });
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
  
  // Replace the div with the input
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let isFinishing = false;
  const finishEditing = async () => {
    // Prevent multiple calls
    if (isFinishing) return;
    isFinishing = true;

    // Check if input is still in the DOM
    if (!input.parentElement) {
      return;
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

