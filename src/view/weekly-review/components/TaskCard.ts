import { App, setIcon } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { IndexedTask } from "../../tasks/TasksPanelTypes";
import { captureQuickTask } from "../../../ui/CaptureModal";

/**
 * Callbacks for task card actions.
 */
export interface TaskCardCallbacks {
  onComplete: (task: IndexedTask) => Promise<void>;
  onDelete: (task: IndexedTask) => Promise<void>;
  onMoveToProject: (task: IndexedTask) => Promise<void>;
  onMoveToSomedayMaybe: (task: IndexedTask) => Promise<void>;
  onUpdateDueDate: (task: IndexedTask) => Promise<void>;
  onRemoveTag: (task: IndexedTask, tag: string) => Promise<void>;
  onActivate: (task: IndexedTask) => Promise<void>;
  onOpenTask: (task: IndexedTask) => Promise<void>;
  onOpenProject: (projectPath: string) => Promise<void>;
  onRerender: () => Promise<void>;
}

/**
 * Renders a task card with action buttons.
 */
export async function renderTaskCard(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  task: IndexedTask,
  callbacks: TaskCardCallbacks,
  options: {
    isInbox?: boolean;
    isWaitingFor?: boolean;
    isSomedayMaybe?: boolean;
    currentStep?: string;
    showReviewedButton?: boolean;
  } = {}
): Promise<void> {
  const { isInbox = false, isWaitingFor = false, isSomedayMaybe = false, currentStep, showReviewedButton = false } = options;
  
  const card = host.createDiv({ cls: "weekly-review-task-card" });
  
  // Task title and metadata
  const taskInfo = card.createDiv({ cls: "weekly-review-task-info" });
  const taskTitle = taskInfo.createEl("div", { 
    text: task.title, 
    cls: "weekly-review-task-title" 
  });
  taskTitle.addClass("geckotask-linklike");
  taskTitle.addEventListener("click", () => callbacks.onOpenTask(task));
  
  if (task.description) {
    taskInfo.createEl("div", { 
      text: task.description.substring(0, 100) + (task.description.length > 100 ? "..." : ""), 
      cls: "weekly-review-task-description" 
    });
  }

  const metadata = taskInfo.createDiv({ cls: "weekly-review-task-metadata" });
  if (task.due) {
    const dueSpan = metadata.createEl("span", { 
      text: `Due: ${task.due}`, 
      cls: "weekly-review-task-due" 
    });
    dueSpan.addClass("geckotask-linklike");
    dueSpan.addEventListener("click", async () => {
      await callbacks.onUpdateDueDate(task);
      await callbacks.onRerender();
    });
  }
  if (task.priority) {
    metadata.createEl("span", { 
      text: `Priority: ${task.priority}`, 
      cls: "weekly-review-task-priority" 
    });
  }
  if (task.project) {
    const projectSpan = metadata.createEl("span", { 
      text: `Project: ${task.project}`, 
      cls: "weekly-review-task-project" 
    });
    projectSpan.addClass("geckotask-linklike");
    projectSpan.addEventListener("click", () => callbacks.onOpenProject(task.path));
  }

  // Action buttons
  const actions = card.createDiv({ cls: "weekly-review-task-actions" });

  if (isInbox) {
    // Mark complete
    const completeBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(completeBtn, "square-check");
    completeBtn.createEl("span", { 
      text: "Complete", 
      cls: "weekly-review-btn-text" 
    });
    completeBtn.setAttribute("aria-label", "Complete");
    completeBtn.addEventListener("click", async () => {
      await callbacks.onComplete(task);
      await callbacks.onRerender();
    });

    // Move to Someday/Maybe
    const somedayBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(somedayBtn, "moon");
    somedayBtn.createEl("span", { 
      text: "Someday", 
      cls: "weekly-review-btn-text" 
    });
    somedayBtn.setAttribute("aria-label", "Someday/Maybe");
    somedayBtn.addEventListener("click", async () => {
      await callbacks.onMoveToSomedayMaybe(task);
      await callbacks.onRerender();
    });

    // Assign to project
    const projectBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(projectBtn, "folder");
    projectBtn.createEl("span", { 
      text: "Move", 
      cls: "weekly-review-btn-text" 
    });
    projectBtn.setAttribute("aria-label", "Move");
    projectBtn.addEventListener("click", async () => {
      await callbacks.onMoveToProject(task);
      await callbacks.onRerender();
    });

    // Edit button
    const editBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(editBtn, "pencil");
    editBtn.createEl("span", { 
      text: "Edit", 
      cls: "weekly-review-btn-text" 
    });
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", async () => {
      await captureQuickTask(app, settings, task);
      await callbacks.onRerender();
    });

    // Delete
    const deleteBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-danger weekly-review-btn-icon" 
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.createEl("span", { 
      text: "Delete", 
      cls: "weekly-review-btn-text" 
    });
    deleteBtn.setAttribute("aria-label", "Delete");
    deleteBtn.addEventListener("click", async () => {
      await callbacks.onDelete(task);
      await callbacks.onRerender();
    });
  } else {
    // Edit button
    const editBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(editBtn, "pencil");
    editBtn.createEl("span", { 
      text: "Edit", 
      cls: "weekly-review-btn-text" 
    });
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", async () => {
      await captureQuickTask(app, settings, task);
      await callbacks.onRerender();
    });
  }

  if (!isInbox) {
    // Complete button
    const completeBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(completeBtn, "square-check");
    completeBtn.createEl("span", { 
      text: "Complete", 
      cls: "weekly-review-btn-text" 
    });
    completeBtn.setAttribute("aria-label", "Complete");
    completeBtn.addEventListener("click", async () => {
      await callbacks.onComplete(task);
      await callbacks.onRerender();
    });

    // Move button
    const moveBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(moveBtn, "folder");
    moveBtn.createEl("span", { 
      text: "Move", 
      cls: "weekly-review-btn-text" 
    });
    moveBtn.setAttribute("aria-label", "Move");
    moveBtn.addEventListener("click", async () => {
      await callbacks.onMoveToProject(task);
      await callbacks.onRerender();
    });

    // Delete button
    const deleteBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-danger weekly-review-btn-icon" 
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.createEl("span", { 
      text: "Delete", 
      cls: "weekly-review-btn-text" 
    });
    deleteBtn.setAttribute("aria-label", "Delete");
    deleteBtn.addEventListener("click", async () => {
      await callbacks.onDelete(task);
      await callbacks.onRerender();
    });

    // Update due date button (not shown in step 2A, 2D, 2E, or 2F)
    if (currentStep && 
        currentStep !== "2A-review-next-actions" && 
        currentStep !== "2D-review-projects" &&
        currentStep !== "2E-review-waiting-for" &&
        currentStep !== "2F-review-someday-maybe") {
      const dueBtn = actions.createEl("button", { 
        text: "Update Due", 
        cls: "weekly-review-btn weekly-review-btn-small" 
      });
      dueBtn.addEventListener("click", async () => {
        await callbacks.onUpdateDueDate(task);
        await callbacks.onRerender();
      });
    }

    // Reviewed button (only for step 2A - Review Next Actions)
    if (!isWaitingFor && !isSomedayMaybe && showReviewedButton) {
      const reviewedBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(reviewedBtn, "badge-check");
      reviewedBtn.createEl("span", { 
        text: "Reviewed", 
        cls: "weekly-review-btn-text" 
      });
      reviewedBtn.setAttribute("aria-label", "Reviewed");
      reviewedBtn.addEventListener("click", async () => {
        // This will be handled by the parent component
        await callbacks.onRerender();
      });
    }
  }

  if (isWaitingFor) {
    // Remove Waiting For tag
    const removeTagBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(removeTagBtn, "x-circle");
    removeTagBtn.createEl("span", { 
      text: "Not Waiting", 
      cls: "weekly-review-btn-text" 
    });
    removeTagBtn.setAttribute("aria-label", `Remove ${settings.waitingForTag}`);
    removeTagBtn.addEventListener("click", async () => {
      await callbacks.onRemoveTag(task, settings.waitingForTag);
      await callbacks.onRerender();
    });
  }

  if (isSomedayMaybe) {
    // Activate button
    const activateBtn = actions.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(activateBtn, "activity");
    activateBtn.createEl("span", { 
      text: "Activate", 
      cls: "weekly-review-btn-text" 
    });
    activateBtn.setAttribute("aria-label", "Activate");
    activateBtn.addEventListener("click", async () => {
      await callbacks.onActivate(task);
      await callbacks.onRerender();
    });
  }
}

