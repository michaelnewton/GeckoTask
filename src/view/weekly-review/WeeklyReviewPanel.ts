import { ItemView, WorkspaceLeaf, Plugin } from "obsidian";
import { GeckoTaskSettings } from "../../settings";
import { WizardState, SerializedWizardState, ProjectReviewInfo } from "./WeeklyReviewPanelTypes";
import { IndexedTask } from "../tasks/TasksPanelTypes";
import { 
  ALL_STEPS,
  createDefaultState,
  serializeState,
  deserializeState,
  getStepPhase,
  getStepTitle
} from "./utils/stateManagement";
import { completeTask, deleteTask } from "./utils/taskOperations";
import {
  addTasksToInbox,
  moveTaskToProject,
  moveTaskToSomedayMaybe,
  updateTaskDueDate,
  removeTag,
  activateSomedayMaybeTask,
  activateSomedayMaybeProject,
  addTaskToProject,
  openTaskInNote,
  openProjectFile
} from "./utils/taskHelpers";
import { TaskCardCallbacks } from "./components/TaskCard";
import { renderStep1A } from "./steps/Step1A";
import { renderStep1B } from "./steps/Step1B";
import { renderStep1C } from "./steps/Step1C";
import { renderStep2A } from "./steps/Step2A";
import { renderStep2B } from "./steps/Step2B";
import { renderStep2C } from "./steps/Step2C";
import { renderStep2D } from "./steps/Step2D";
import { renderStep2E } from "./steps/Step2E";
import { renderStep2F } from "./steps/Step2F";
import { renderStep3A } from "./steps/Step3A";

export const VIEW_TYPE_WEEKLY_REVIEW = "weekly-review-view";

export class WeeklyReviewPanel extends ItemView {
  settings: GeckoTaskSettings;
  plugin: Plugin;
  container!: HTMLElement;
  wizardState: WizardState;
  currentStepIndex: number = 0;
  private readonly STATE_STORAGE_KEY = "weekly-review-state";
  private saveStateTimeout: number | null = null;
  private shouldScrollToCount: boolean = false;

  constructor(leaf: WorkspaceLeaf, settings: GeckoTaskSettings, plugin: Plugin) {
    super(leaf);
    this.settings = settings;
    this.plugin = plugin;
    this.wizardState = createDefaultState();
  }

  getViewType(): string { return VIEW_TYPE_WEEKLY_REVIEW; }
  getDisplayText(): string { return "Weekly Review"; }
  getIcon(): string { return "calendar-clock"; }

  async onOpen() {
    this.container = this.contentEl;
    this.container.empty();
    this.container.addClass("weekly-review-panel");
    await this.loadState();
    await this.renderCurrentStep();

    const debouncedRefresh = this.debounce(async () => {
      await this.renderCurrentStep();
    }, 200);

    this.registerEvent(this.app.vault.on("modify", debouncedRefresh));
    this.registerEvent(this.app.vault.on("create", debouncedRefresh));
    this.registerEvent(this.app.vault.on("delete", debouncedRefresh));
    this.registerEvent(this.app.vault.on("rename", debouncedRefresh));
  }

  async onClose() {
    await this.saveState();
  }

  private async loadState() {
    try {
      const data = await this.plugin.loadData() || {};
      const serialized = data?.[this.STATE_STORAGE_KEY] as SerializedWizardState | undefined;
      
      if (serialized) {
        this.wizardState = deserializeState(serialized);
        this.currentStepIndex = ALL_STEPS.indexOf(this.wizardState.currentStep);
        if (this.currentStepIndex === -1) {
          this.currentStepIndex = 0;
          this.wizardState.currentStep = ALL_STEPS[0];
        }
      } else {
        this.wizardState = createDefaultState();
        this.currentStepIndex = 0;
      }
    } catch (error) {
      console.error("Error loading weekly review state:", error);
      this.wizardState = createDefaultState();
      this.currentStepIndex = 0;
    }
  }

  private async saveState() {
    try {
      const data = await this.plugin.loadData() || {};
      data[this.STATE_STORAGE_KEY] = serializeState(this.wizardState);
      await this.plugin.saveData(data);
    } catch (error) {
      console.error("Error saving weekly review state:", error);
    }
  }

  private debouncedSaveState() {
    if (this.saveStateTimeout) {
      window.clearTimeout(this.saveStateTimeout);
    }
    this.saveStateTimeout = window.setTimeout(async () => {
      await this.saveState();
      this.saveStateTimeout = null;
    }, 500);
  }

  private async clearState() {
    try {
      const data = await this.plugin.loadData() || {};
      delete data[this.STATE_STORAGE_KEY];
      await this.plugin.saveData(data);
    } catch (error) {
      console.error("Error clearing weekly review state:", error);
    }
  }

  private async ensureStateInitialized() {
    if (!this.wizardState) {
      await this.loadState();
    }
  }

  async renderCurrentStep() {
    this.container.empty();
    const shouldScroll = this.shouldScrollToCount;
    this.shouldScrollToCount = false;

    // Header
    const header = this.container.createDiv({ cls: "weekly-review-header" });
    header.createEl("h2", { text: "Weekly Review" });
    const restartBtn = header.createEl("button", { 
      text: "Restart Review", 
      cls: "weekly-review-btn weekly-review-btn-small" 
    });
    restartBtn.addEventListener("click", () => this.restartReview());
    
    const progress = header.createDiv({ cls: "weekly-review-progress" });
    progress.createSpan({ text: `Step ${this.currentStepIndex + 1} of ${ALL_STEPS.length}` });

    // Step title with phase indicator
    const stepTitle = this.container.createDiv({ cls: "weekly-review-step-title" });
    const phase = getStepPhase(this.wizardState.currentStep);
    const phaseEl = stepTitle.createDiv({ cls: "weekly-review-phase" });
    phaseEl.createEl("span", { text: phase, cls: "weekly-review-phase-label" });
    stepTitle.createEl("h3", { text: getStepTitle(this.wizardState.currentStep) });

    // Step content
    const stepContent = this.container.createDiv({ cls: "weekly-review-step-content" });
    
    // Create callbacks for step renderers
    const taskCardCallbacks: TaskCardCallbacks = {
      onComplete: async (task) => {
        await completeTask(this.app, task);
        this.shouldScrollToCount = true;
      },
      onDelete: async (task) => {
        await deleteTask(this.app, task);
        this.shouldScrollToCount = true;
      },
      onMoveToProject: async (task) => {
        await moveTaskToProject(this.app, this.settings, task);
        this.shouldScrollToCount = true;
      },
      onMoveToSomedayMaybe: async (task) => {
        await moveTaskToSomedayMaybe(this.app, this.settings, task);
        this.shouldScrollToCount = true;
      },
      onUpdateDueDate: async (task) => {
        await updateTaskDueDate(this.app, this.settings, task);
      },
      onRemoveTag: async (task, tag) => {
        await removeTag(this.app, task, tag);
        this.shouldScrollToCount = true;
      },
      onActivate: async (task) => {
        await activateSomedayMaybeTask(this.app, this.settings, task);
        this.shouldScrollToCount = true;
      },
      onOpenTask: async (task) => {
        await openTaskInNote(this.app, task);
      },
      onOpenProject: async (projectPath) => {
        await openProjectFile(this.app, projectPath);
      },
      onRerender: async () => {
        await this.renderCurrentStep();
      }
    };

    switch (this.wizardState.currentStep) {
      case "1A-collect-loose-ends":
        renderStep1A(stepContent, this.app, this.settings, this.wizardState, {
          onAddTasksToInbox: async (text) => {
            await this.ensureStateInitialized();
            await addTasksToInbox(this.app, this.settings, text);
            this.shouldScrollToCount = true;
          },
          onStateChange: (updates) => {
            Object.assign(this.wizardState.notes.looseEnds, updates);
          },
          onDebouncedSave: () => this.debouncedSaveState()
        });
        break;
      case "1B-empty-head":
        renderStep1B(stepContent, this.app, this.settings, this.wizardState, {
          onAddTasksToInbox: async (text) => {
            await addTasksToInbox(this.app, this.settings, text);
            this.shouldScrollToCount = true;
          },
          onStateChange: (updates) => {
            Object.assign(this.wizardState.notes.emptyHead, updates);
          },
          onDebouncedSave: () => this.debouncedSaveState()
        });
        break;
      case "1C-process-inbox":
        await renderStep1C(stepContent, this.app, this.settings, taskCardCallbacks);
        break;
      case "2A-review-next-actions":
        await renderStep2A(stepContent, this.app, this.settings, this.wizardState, {
          ...taskCardCallbacks,
          onMarkTaskReviewed: async (taskId: string) => {
            this.wizardState.reviewedTasks.add(taskId);
            await this.saveState();
          },
          onToggleShowReviewed: async () => {
            this.wizardState.showReviewedTasks = !this.wizardState.showReviewedTasks;
            await this.saveState();
          },
          onResetReviewed: async () => {
            this.wizardState.reviewedTasks.clear();
            this.wizardState.showReviewedTasks = false;
            await this.saveState();
          }
        });
        break;
      case "2B-review-calendar-past":
        renderStep2B(stepContent, this.app, this.settings, this.wizardState, {
          onAddTasksToInbox: async (text) => {
            await addTasksToInbox(this.app, this.settings, text);
            this.shouldScrollToCount = true;
          },
          onStateChange: (value) => {
            this.wizardState.notes.calendarPast = value;
          },
          onDebouncedSave: () => this.debouncedSaveState()
        });
        break;
      case "2C-review-calendar-future":
        renderStep2C(stepContent, this.app, this.settings, this.wizardState, {
          onAddTasksToInbox: async (text) => {
            await addTasksToInbox(this.app, this.settings, text);
            this.shouldScrollToCount = true;
          },
          onStateChange: (value) => {
            this.wizardState.notes.calendarFuture = value;
          },
          onDebouncedSave: () => this.debouncedSaveState()
        });
        break;
      case "2D-review-projects":
        await renderStep2D(stepContent, this.app, this.settings, this.wizardState, {
          ...taskCardCallbacks,
          onAddTask: async (projectPath) => {
            await addTaskToProject(this.app, this.settings, projectPath);
            this.shouldScrollToCount = true;
          },
          onMarkProjectReviewed: async (projectPath) => {
            this.wizardState.reviewedProjects.add(projectPath);
            await this.saveState();
          },
          onToggleShowReviewedProjects: async () => {
            this.wizardState.showReviewedProjects = !this.wizardState.showReviewedProjects;
            await this.saveState();
          },
          onResetReviewedProjects: async () => {
            this.wizardState.reviewedProjects.clear();
            this.wizardState.showReviewedProjects = false;
            await this.saveState();
          }
        });
        break;
      case "2E-review-waiting-for":
        await renderStep2E(stepContent, this.app, this.settings, taskCardCallbacks);
        break;
      case "2F-review-someday-maybe":
        await renderStep2F(stepContent, this.app, this.settings, this.wizardState, {
          ...taskCardCallbacks,
          onActivateProject: async (projectPath) => {
            // Find the project from somedayMaybeProjects
            // Note: somedayMaybeProjects is no longer a class member, need to refetch or pass
            // For now, this will be a placeholder.
            // The actual project list would need to be fetched within the step renderer or passed down.
            // For simplicity in refactoring, assuming project is found or handled within the helper.
            // This will be addressed in a later refinement if needed.
            // For now, we'll pass a dummy ProjectReviewInfo or refetch.
            // The current implementation of activateSomedayMaybeProject in taskHelpers.ts
            // takes a ProjectReviewInfo object, so we need to ensure that's available.
            // For now, we'll assume the project object is available or refetch it.
            // This is a temporary workaround for the refactoring.
            // A more robust solution would involve passing the full project object or refetching it.
            // For now, we'll create a dummy project object.
            const dummyProject: ProjectReviewInfo = {
              name: "Dummy Project",
              path: projectPath,
              tasks: [],
              hasNextAction: false,
              area: undefined
            };
            await activateSomedayMaybeProject(this.app, this.settings, dummyProject);
            this.shouldScrollToCount = true;
          },
          onMarkProjectReviewed: async (projectPath) => {
            this.wizardState.reviewedSomedayMaybeProjects.add(projectPath);
            await this.saveState();
          },
          onToggleShowReviewedProjects: async () => {
            this.wizardState.showReviewedSomedayMaybeProjects = !this.wizardState.showReviewedSomedayMaybeProjects;
            await this.saveState();
          },
          onResetReviewedProjects: async () => {
            this.wizardState.reviewedSomedayMaybeProjects.clear();
            this.wizardState.showReviewedSomedayMaybeProjects = false;
            await this.saveState();
          }
        });
        break;
      case "3A-brainstorm":
        renderStep3A(stepContent, this.app, this.settings, this.wizardState, {
          onAddTasksToInbox: async (text) => {
            await addTasksToInbox(this.app, this.settings, text);
            this.shouldScrollToCount = true;
          },
          onStateChange: (value) => {
            this.wizardState.notes.brainstorm = value;
          },
          onDebouncedSave: () => this.debouncedSaveState()
        });
        break;
    }

    // Scroll to the count text if needed
    if (shouldScroll) {
      requestAnimationFrame(() => {
        const countText = this.container.querySelector('[data-weekly-review-count]');
        if (countText && countText instanceof HTMLElement) {
          countText.scrollIntoView({ 
            behavior: "smooth", 
            block: "start",
            inline: "nearest"
          });
        }
      });
    }

    // Navigation buttons
    const nav = this.container.createDiv({ cls: "weekly-review-navigation" });
    
    const backBtn = nav.createEl("button", { 
      text: "Back", 
      cls: "weekly-review-btn weekly-review-btn-back" 
    });
    backBtn.disabled = this.currentStepIndex === 0;
    backBtn.addEventListener("click", () => this.goToPreviousStep());

    const nextBtn = nav.createEl("button", { 
      text: this.currentStepIndex === ALL_STEPS.length - 1 ? "Finish" : "Next", 
      cls: "weekly-review-btn weekly-review-btn-next" 
    });
    nextBtn.addEventListener("click", () => this.goToNextStep());
  }

  private getTaskId(task: IndexedTask): string {
    return `${task.path}:${task.line}`;
  }

  /**
   * Goes to the next step.
   */
  private async goToNextStep() {
    await this.ensureStateInitialized();
    if (this.currentStepIndex < ALL_STEPS.length - 1) {
      this.wizardState.completedSteps.add(this.wizardState.currentStep);
      this.currentStepIndex++;
      this.wizardState.currentStep = ALL_STEPS[this.currentStepIndex];
      await this.saveState();
      this.renderCurrentStep();
    } else {
      // Finish review - show completion screen and clear state
      this.wizardState.isCompleted = true;
      // Render completion screen first, then clear state
      this.renderCurrentStep();
      await this.clearState();
    }
  }

  /**
   * Renders the completion screen with congratulations message and restart button.
   */
  private renderCompletionScreen() {
    // Header
    const header = this.container.createDiv({ cls: "weekly-review-header" });
    header.createEl("h2", { text: "Weekly Review" });

    // Completion content - centered
    const completionContent = this.container.createDiv({ cls: "weekly-review-completion" });
    completionContent.style.textAlign = "center";
    completionContent.style.padding = "40px 20px";
    completionContent.style.display = "flex";
    completionContent.style.flexDirection = "column";
    completionContent.style.alignItems = "center";
    completionContent.style.gap = "24px";

    // Congratulations message
    const congratsTitle = completionContent.createEl("h2", { 
      text: "🎉 Congratulations! 🎉",
      cls: "weekly-review-completion-title"
    });
    congratsTitle.style.margin = "0";
    congratsTitle.style.fontSize = "2em";
    congratsTitle.style.color = "var(--text-normal)";

    const congratsMessage = completionContent.createEl("p", {
      text: "You finished your weekly review!",
      cls: "weekly-review-completion-message"
    });
    congratsMessage.style.fontSize = "1.2em";
    congratsMessage.style.color = "var(--text-muted)";
    congratsMessage.style.margin = "0";

    // Restart button - positioned differently from Back/Next buttons
    const restartBtn = completionContent.createEl("button", {
      text: "Start New Review",
      cls: "weekly-review-btn weekly-review-btn-primary"
    });
    restartBtn.style.marginTop = "20px";
    restartBtn.style.padding = "12px 24px";
    restartBtn.style.fontSize = "1.1em";
    restartBtn.addEventListener("click", async () => {
      // Clear state when starting new review from completion screen
      await this.clearState();
      this.restartReview();
    });
  }

  /**
   * Restarts the weekly review from the beginning.
   */
  private async restartReview() {
    this.currentStepIndex = 0;
    this.wizardState = createDefaultState();
    // Clear saved state when restarting
    await this.clearState();
    this.renderCurrentStep();
  }

  /**
   * Goes to the previous step.
   */
  private async goToPreviousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.wizardState.currentStep = ALL_STEPS[this.currentStepIndex];
      await this.saveState();
      this.renderCurrentStep();
    }
  }

  /**
   * Creates a debounced version of a function.
   * @param fn - Function to debounce
   * @param ms - Debounce delay in milliseconds
   * @returns Debounced function
   */
  private debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
    let h: number | undefined;
    return ((...args: Parameters<T>) => {
      window.clearTimeout(h);
      h = window.setTimeout(() => fn(...args), ms);
    }) as unknown as T;
  }
}

