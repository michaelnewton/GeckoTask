import { App, ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from "obsidian";
import { TaskWorkSettings } from "../settings";
import { ReviewStep, WizardState, TaskReviewItem, ProjectReviewInfo } from "./WeeklyReviewPanelTypes";
import { IndexedTask } from "./TaskworkPanelTypes";
import { captureQuickTask } from "../ui/CaptureModal";
import { FilePickerModal } from "../ui/FilePickerModal";
import { PromptModal } from "../ui/PromptModal";
import { 
  fetchInboxTasks, 
  fetchTasksByTag, 
  fetchSomedayMaybeTasks, 
  fetchSomedayMaybeProjects,
  fetchNextActions, 
  fetchProjectsWithTasks 
} from "../services/WeeklyReviewService";
import { 
  parseTaskWithDescription, 
  formatTaskWithDescription, 
  Task 
} from "../models/TaskModel";
import { 
  normalizeInboxPath, 
  isInTasksFolder, 
  inferAreaFromPath, 
  isSpecialFile, 
  getAreaPath,
  getAreas
} from "../utils/areaUtils";
import { calculateNextOccurrence } from "../services/Recurrence";
import { parseNLDate } from "../services/NLDate";

/**
 * View type identifier for the Weekly Review panel.
 */
export const VIEW_TYPE_WEEKLY_REVIEW = "weekly-review-view";

/**
 * All review steps in order.
 */
const ALL_STEPS: ReviewStep[] = [
  "1A-collect-loose-ends",
  "1B-empty-head",
  "1C-process-inbox",
  "2A-review-next-actions",
  "2B-review-calendar-past",
  "2C-review-calendar-future",
  "2D-review-projects",
  "2E-review-waiting-for",
  "2F-review-someday-maybe",
  "3A-brainstorm"
];

/**
 * Side panel view for weekly review functionality.
 */
export class WeeklyReviewPanel extends ItemView {
  settings: TaskWorkSettings;
  container!: HTMLElement;
  wizardState: WizardState;
  currentStepIndex: number = 0;
  inboxTasks: IndexedTask[] = [];
  nextActions: IndexedTask[] = [];
  waitingForTasks: IndexedTask[] = [];
  somedayMaybeTasks: IndexedTask[] = [];
  projects: ProjectReviewInfo[] = [];
  somedayMaybeProjects: ProjectReviewInfo[] = [];

  /**
   * Creates a new Weekly Review panel.
   * @param leaf - Workspace leaf to attach to
   * @param settings - Plugin settings
   */
  constructor(leaf: WorkspaceLeaf, settings: TaskWorkSettings) {
    super(leaf);
    this.settings = settings;
    this.wizardState = {
      currentStep: ALL_STEPS[0],
      completedSteps: new Set(),
      reviewedTasks: new Set(),
      showReviewedTasks: false,
      reviewedProjects: new Set(),
      showReviewedProjects: false,
      reviewedSomedayMaybeProjects: new Set(),
      showReviewedSomedayMaybeProjects: false,
      notes: {
        looseEnds: {
          physicalItems: "",
          emailMessages: "",
          custom: {}
        },
        emptyHead: {
          worries: "",
          postponements: "",
          smallWins: ""
        },
        calendarPast: "",
        calendarFuture: "",
        brainstorm: ""
      }
    };
  }

  /**
   * Returns the view type identifier.
   * @returns View type string
   */
  getViewType(): string { return VIEW_TYPE_WEEKLY_REVIEW; }

  /**
   * Returns the display text for the view.
   * @returns Display text
   */
  getDisplayText(): string { return "Weekly Review"; }

  /**
   * Returns the icon name for the view.
   * @returns Icon name
   */
  getIcon(): string { return "calendar-clock"; }

  /**
   * Called when the view is opened. Sets up UI.
   */
  async onOpen() {
    this.container = this.contentEl;
    this.container.empty();
    this.container.addClass("weekly-review-panel");
    await this.renderCurrentStep();
  }

  /**
   * Called when the view is closed. Cleans up resources.
   */
  async onClose() {}

  /**
   * Renders the current step of the wizard.
   */
  private async renderCurrentStep() {
    this.container.empty();
    this.container.addClass("weekly-review-panel");

    // Header with title and progress
    const header = this.container.createDiv({ cls: "weekly-review-header" });
    header.createEl("h2", { text: "Weekly Review" });
    
    const progress = header.createDiv({ cls: "weekly-review-progress" });
    progress.createSpan({ text: `Step ${this.currentStepIndex + 1} of ${ALL_STEPS.length}` });

    // Step title with phase indicator
    const stepTitle = this.container.createDiv({ cls: "weekly-review-step-title" });
    const phase = this.getStepPhase(this.wizardState.currentStep);
    const phaseEl = stepTitle.createDiv({ cls: "weekly-review-phase" });
    phaseEl.createEl("span", { text: phase, cls: "weekly-review-phase-label" });
    stepTitle.createEl("h3", { text: this.getStepTitle(this.wizardState.currentStep) });

    // Step content
    const stepContent = this.container.createDiv({ cls: "weekly-review-step-content" });
    
    switch (this.wizardState.currentStep) {
      case "1A-collect-loose-ends":
        await this.renderStep1A(stepContent);
        break;
      case "1B-empty-head":
        await this.renderStep1B(stepContent);
        break;
      case "1C-process-inbox":
        await this.renderStep1C(stepContent);
        break;
      case "2A-review-next-actions":
        await this.renderStep2A(stepContent);
        break;
      case "2B-review-calendar-past":
        await this.renderStep2B(stepContent);
        break;
      case "2C-review-calendar-future":
        await this.renderStep2C(stepContent);
        break;
      case "2D-review-projects":
        await this.renderStep2D(stepContent);
        break;
      case "2E-review-waiting-for":
        await this.renderStep2E(stepContent);
        break;
      case "2F-review-someday-maybe":
        await this.renderStep2F(stepContent);
        break;
      case "3A-brainstorm":
        await this.renderStep3A(stepContent);
        break;
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

  /**
   * Gets the phase for a step (Get Clear, Get Current, or Get Creative).
   */
  private getStepPhase(step: ReviewStep): string {
    const phases: Record<ReviewStep, string> = {
      "1A-collect-loose-ends": "1. GET CLEAR",
      "1B-empty-head": "1. GET CLEAR",
      "1C-process-inbox": "1. GET CLEAR",
      "2A-review-next-actions": "2. GET CURRENT",
      "2B-review-calendar-past": "2. GET CURRENT",
      "2C-review-calendar-future": "2. GET CURRENT",
      "2D-review-projects": "2. GET CURRENT",
      "2E-review-waiting-for": "2. GET CURRENT",
      "2F-review-someday-maybe": "2. GET CURRENT",
      "3A-brainstorm": "3. GET CREATIVE"
    };
    return phases[step];
  }

  /**
   * Gets a unique identifier for a task.
   * @param task - The task to get an ID for
   * @returns Unique task ID string (path:line)
   */
  private getTaskId(task: IndexedTask): string {
    return `${task.path}:${task.line}`;
  }

  /**
   * Gets the title for a step.
   */
  private getStepTitle(step: ReviewStep): string {
    const titles: Record<ReviewStep, string> = {
      "1A-collect-loose-ends": "1-A) Collect Loose Ends",
      "1B-empty-head": "1-B) Empty Your Head",
      "1C-process-inbox": "1-C) Process Inbox",
      "2A-review-next-actions": "2-A) Review Next Actions",
      "2B-review-calendar-past": "2-B) Review Calendar (Past 2-3 weeks)",
      "2C-review-calendar-future": "2-C) Review Calendar (Next 2 weeks)",
      "2D-review-projects": "2-D) Review Projects",
      "2E-review-waiting-for": "2-E) Review Waiting For",
      "2F-review-someday-maybe": "2-F) Review Someday/Maybe",
      "3A-brainstorm": "3) Brainstorm / Creative Sweep"
    };
    return titles[step];
  }

  /**
   * Renders Step 1A: Collect Loose Ends.
   */
  private async renderStep1A(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Collect Loose Papers and Materials" });
    guidance.createEl("p", { 
      text: "Gather all accumulated business cards, receipts, and miscellaneous paper-based materials into your in-tray." 
    });
    
    host.createEl("p", { 
      text: "For each question below, add tasks to the Inbox as you think of them." 
    });

    // Physical items
    const physicalDiv = host.createDiv({ cls: "weekly-review-question" });
    physicalDiv.createEl("h4", { text: "1. Physical items" });
    physicalDiv.createEl("p", { 
      text: "Gather physical notes, receipts, scribbles into your inbox. Any tasks to add?" 
    });
    const physicalInput = physicalDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    physicalInput.placeholder = "Enter notes or tasks here...";
    physicalInput.value = this.wizardState.notes.looseEnds.physicalItems;
    physicalInput.addEventListener("input", (e) => {
      this.wizardState.notes.looseEnds.physicalItems = (e.target as HTMLTextAreaElement).value;
    });
    const physicalBtn = physicalDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    physicalBtn.addEventListener("click", async () => {
      const text = physicalInput.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        physicalInput.value = "";
        this.wizardState.notes.looseEnds.physicalItems = "";
      }
    });

    // Email/messages
    const emailDiv = host.createDiv({ cls: "weekly-review-question" });
    emailDiv.createEl("h4", { text: "2. Email/messages" });
    emailDiv.createEl("p", { 
      text: "Process email/messages (capture actions if needed). Any tasks to add?" 
    });
    const emailInput = emailDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    emailInput.placeholder = "Enter notes or tasks here...";
    emailInput.value = this.wizardState.notes.looseEnds.emailMessages;
    emailInput.addEventListener("input", (e) => {
      this.wizardState.notes.looseEnds.emailMessages = (e.target as HTMLTextAreaElement).value;
    });
    const emailBtn = emailDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    emailBtn.addEventListener("click", async () => {
      const text = emailInput.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        emailInput.value = "";
        this.wizardState.notes.looseEnds.emailMessages = "";
      }
    });

    // Custom collection points
    const customPoints = this.settings.customCollectionPoints || [];
    if (customPoints.length > 0) {
      let customIndex = 3; // Start numbering from 3 (after Physical items and Email/messages)
      for (const point of customPoints) {
        const customDiv = host.createDiv({ cls: "weekly-review-question" });
        customDiv.createEl("h4", { text: `${customIndex}. ${point}` });
        customDiv.createEl("p", { 
          text: `Process ${point} (capture actions if needed). Any tasks to add?` 
        });
        const customInput = customDiv.createEl("textarea", { 
          cls: "weekly-review-textarea" 
        });
        customInput.placeholder = "Enter notes or tasks here...";
        customInput.value = this.wizardState.notes.looseEnds.custom[point] || "";
        customInput.addEventListener("input", (e) => {
          this.wizardState.notes.looseEnds.custom[point] = (e.target as HTMLTextAreaElement).value;
        });
        const customBtn = customDiv.createEl("button", { 
          text: "Add to Inbox", 
          cls: "weekly-review-btn weekly-review-btn-action" 
        });
        customBtn.addEventListener("click", async () => {
          const text = customInput.value.trim();
          if (text) {
            await this.addTasksToInbox(text);
            customInput.value = "";
            this.wizardState.notes.looseEnds.custom[point] = "";
          }
        });
        customIndex++;
      }
    }
  }

  /**
   * Renders Step 1B: Empty Your Head.
   */
  private async renderStep1B(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Empty Your Head" });
    guidance.createEl("p", { 
      text: "Put in writing and process any uncaptured new projects, action items, waiting for's, someday maybe's, etc." 
    });
    
    host.createEl("p", { 
      text: "For each question below, add tasks to the Inbox as you think of them." 
    });

    // Worries
    const worriesDiv = host.createDiv({ cls: "weekly-review-question" });
    worriesDiv.createEl("h4", { text: "1. What am I worried about?" });
    const worriesInput = worriesDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    worriesInput.placeholder = "Enter worries or tasks here...";
    worriesInput.value = this.wizardState.notes.emptyHead.worries;
    worriesInput.addEventListener("input", (e) => {
      this.wizardState.notes.emptyHead.worries = (e.target as HTMLTextAreaElement).value;
    });
    const worriesBtn = worriesDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    worriesBtn.addEventListener("click", async () => {
      const text = worriesInput.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        worriesInput.value = "";
        this.wizardState.notes.emptyHead.worries = "";
      }
    });

    // Postponements
    const postponeDiv = host.createDiv({ cls: "weekly-review-question" });
    postponeDiv.createEl("h4", { text: "2. What do I keep postponing?" });
    const postponeInput = postponeDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    postponeInput.placeholder = "Enter postponed items or tasks here...";
    postponeInput.value = this.wizardState.notes.emptyHead.postponements;
    postponeInput.addEventListener("input", (e) => {
      this.wizardState.notes.emptyHead.postponements = (e.target as HTMLTextAreaElement).value;
    });
    const postponeBtn = postponeDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    postponeBtn.addEventListener("click", async () => {
      const text = postponeInput.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        postponeInput.value = "";
        this.wizardState.notes.emptyHead.postponements = "";
      }
    });

    // Small wins
    const winsDiv = host.createDiv({ cls: "weekly-review-question" });
    winsDiv.createEl("h4", { text: "3. What small wins are dangling?" });
    const winsInput = winsDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    winsInput.placeholder = "Enter small wins or tasks here...";
    winsInput.value = this.wizardState.notes.emptyHead.smallWins;
    winsInput.addEventListener("input", (e) => {
      this.wizardState.notes.emptyHead.smallWins = (e.target as HTMLTextAreaElement).value;
    });
    const winsBtn = winsDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    winsBtn.addEventListener("click", async () => {
      const text = winsInput.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        winsInput.value = "";
        this.wizardState.notes.emptyHead.smallWins = "";
      }
    });
  }

  /**
   * Renders Step 1C: Process Inbox.
   */
  private async renderStep1C(host: HTMLElement) {
    host.empty();

    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Get \"IN\" to Zero" });
    guidance.createEl("p", { 
      text: "Process completely all outstanding paper materials, journal and meeting notes, voicemails, dictation, and emails." 
    });
    
    const processGuidance = host.createDiv({ cls: "weekly-review-guidance" });
    processGuidance.createEl("h4", { text: "Processing Guidelines" });
    processGuidance.createEl("p", { 
      text: "2-Minute Rule: If a task takes less than 2 minutes, do it now (mark complete)." 
    });
    processGuidance.createEl("p", { 
      text: "Process vs Organize: First decide the outcome/next step (Process), then put it on the right list (Organize)." 
    });
    const processList = processGuidance.createEl("ul");
    processList.createEl("li", { 
      text: "Process = Decide: Do it, Delegate it, Defer it, or Delete it" 
    });
    processList.createEl("li", { 
      text: "Organize = Put it in the right place: Project, Someday/Maybe, Waiting For, or Archive" 
    });

    // Fetch inbox tasks
    this.inboxTasks = await fetchInboxTasks(this.app, this.settings);
    const uncompletedTasks = this.inboxTasks.filter(t => !t.checked);

    if (uncompletedTasks.length === 0) {
      host.createEl("p", { 
        text: "No uncompleted tasks in Inbox. Great job!" 
      });
      return;
    }

    host.createEl("p", { 
      text: `Found ${uncompletedTasks.length} uncompleted task(s) in Inbox.` 
    });

    const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
    for (const task of uncompletedTasks) {
      await this.renderTaskCard(tasksList, task, true);
    }
  }

  /**
   * Renders Step 2A: Review Next Actions.
   */
  private async renderStep2A(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Action Lists" });
    guidance.createEl("p", { 
      text: "Mark off completed actions. Review for reminders of further action steps to record." 
    });
    
    host.createEl("p", { 
      text: "Review each actionable task. Mark done, update, move, or delete as needed. Click 'Reviewed' if no changes are needed." 
    });

    this.nextActions = await fetchNextActions(this.app, this.settings);

    if (this.nextActions.length === 0) {
      host.createEl("p", { 
        text: "No actionable tasks found." 
      });
      return;
    }

    // Filter reviewed and unreviewed tasks
    const unreviewedTasks = this.nextActions.filter(t => 
      !this.wizardState.reviewedTasks.has(this.getTaskId(t))
    );
    const reviewedTasks = this.nextActions.filter(t => 
      this.wizardState.reviewedTasks.has(this.getTaskId(t))
    );

    // Controls for showing reviewed tasks and resetting
    const controls = host.createDiv({ cls: "weekly-review-step-controls" });
    controls.style.marginBottom = "12px";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.flexWrap = "wrap";

    if (reviewedTasks.length > 0) {
      const showReviewedBtn = controls.createEl("button", {
        text: this.wizardState.showReviewedTasks 
          ? `Hide ${reviewedTasks.length} Reviewed Task(s)` 
          : `Show ${reviewedTasks.length} Reviewed Task(s)`,
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      showReviewedBtn.addEventListener("click", () => {
        this.wizardState.showReviewedTasks = !this.wizardState.showReviewedTasks;
        this.renderCurrentStep();
      });
    }

    if (this.wizardState.reviewedTasks.size > 0) {
      const resetBtn = controls.createEl("button", {
        text: "Reset Review",
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      resetBtn.addEventListener("click", () => {
        this.wizardState.reviewedTasks.clear();
        this.wizardState.showReviewedTasks = false;
        this.renderCurrentStep();
      });
    }

    // Display counts
    const countText = host.createEl("p");
    if (unreviewedTasks.length > 0) {
      countText.textContent = `Found ${unreviewedTasks.length} unreviewed task(s).`;
      if (reviewedTasks.length > 0) {
        countText.textContent += ` ${reviewedTasks.length} task(s) marked as reviewed.`;
      }
    } else if (reviewedTasks.length > 0) {
      countText.textContent = `All ${reviewedTasks.length} task(s) have been reviewed.`;
    }

    // Render unreviewed tasks
    if (unreviewedTasks.length > 0) {
      const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
      for (const task of unreviewedTasks) {
        await this.renderTaskCard(tasksList, task, false);
      }
    }

    // Render reviewed tasks if toggled on
    if (this.wizardState.showReviewedTasks && reviewedTasks.length > 0) {
      const reviewedSection = host.createDiv({ cls: "weekly-review-reviewed-section" });
      reviewedSection.style.marginTop = "20px";
      reviewedSection.style.paddingTop = "20px";
      reviewedSection.style.borderTop = "1px solid var(--background-modifier-border)";
      
      reviewedSection.createEl("h4", { 
        text: `Reviewed Tasks (${reviewedTasks.length})`,
        cls: "weekly-review-reviewed-header"
      });
      
      const reviewedList = reviewedSection.createDiv({ cls: "weekly-review-tasks-list" });
      for (const task of reviewedTasks) {
        await this.renderTaskCard(reviewedList, task, false);
      }
    }
  }

  /**
   * Renders Step 2B: Review Calendar (Past).
   */
  private async renderStep2B(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Previous Calendar Data" });
    guidance.createEl("p", { 
      text: "Review past calendar in detail for remaining action items, reference data, etc., and transfer into the active system." 
    });
    
    host.createEl("p", { 
      text: "Review your calendar for the past 2-3 weeks. Were there any action items or follow-ups from meetings?" 
    });

    const inputDiv = host.createDiv({ cls: "weekly-review-question" });
    const input = inputDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    input.placeholder = "Enter follow-ups or tasks here...";
    input.value = this.wizardState.notes.calendarPast;
    input.addEventListener("input", (e) => {
      this.wizardState.notes.calendarPast = (e.target as HTMLTextAreaElement).value;
    });

    const addBtn = inputDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    addBtn.addEventListener("click", async () => {
      const text = input.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        input.value = "";
        this.wizardState.notes.calendarPast = "";
      }
    });
  }

  /**
   * Renders Step 2C: Review Calendar (Future).
   */
  private async renderStep2C(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Upcoming Calendar" });
    guidance.createEl("p", { 
      text: "Review upcoming calendar events—long and short term. Capture actions triggered." 
    });
    
    host.createEl("p", { 
      text: "Review your calendar for the next 2 weeks. What do you need to prepare for upcoming meetings, commitments, or events?" 
    });

    const inputDiv = host.createDiv({ cls: "weekly-review-question" });
    const input = inputDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    input.placeholder = "Enter prep tasks here...";
    input.value = this.wizardState.notes.calendarFuture;
    input.addEventListener("input", (e) => {
      this.wizardState.notes.calendarFuture = (e.target as HTMLTextAreaElement).value;
    });

    const addBtn = inputDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    addBtn.addEventListener("click", async () => {
      const text = input.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        input.value = "";
        this.wizardState.notes.calendarFuture = "";
      }
    });
  }

  /**
   * Renders Step 2D: Review Projects.
   */
  private async renderStep2D(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Project (and Larger Outcome) Lists" });
    guidance.createEl("p", { 
      text: "Evaluate status of projects, goals, and outcomes, one by one, ensuring at least one current action item on each. Browse through project plans, support material, and any other work-in-progress material to trigger new actions, completions, waiting for's, etc." 
    });
    
    host.createEl("p", { 
      text: "Review each project. Ensure each has a next action. Add tasks as needed. Click 'Reviewed' if no changes are needed." 
    });

    this.projects = await fetchProjectsWithTasks(this.app, this.settings);

    if (this.projects.length === 0) {
      host.createEl("p", { 
        text: "No projects found." 
      });
      return;
    }

    // Filter reviewed and unreviewed projects
    const unreviewedProjects = this.projects.filter(p => 
      !this.wizardState.reviewedProjects.has(p.path)
    );
    const reviewedProjects = this.projects.filter(p => 
      this.wizardState.reviewedProjects.has(p.path)
    );

    // Controls for showing reviewed projects and resetting
    const controls = host.createDiv({ cls: "weekly-review-step-controls" });
    controls.style.marginBottom = "12px";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.flexWrap = "wrap";

    if (reviewedProjects.length > 0) {
      const showReviewedBtn = controls.createEl("button", {
        text: this.wizardState.showReviewedProjects 
          ? `Hide ${reviewedProjects.length} Reviewed Project(s)` 
          : `Show ${reviewedProjects.length} Reviewed Project(s)`,
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      showReviewedBtn.addEventListener("click", () => {
        this.wizardState.showReviewedProjects = !this.wizardState.showReviewedProjects;
        this.renderCurrentStep();
      });
    }

    if (this.wizardState.reviewedProjects.size > 0) {
      const resetBtn = controls.createEl("button", {
        text: "Reset Review",
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      resetBtn.addEventListener("click", () => {
        this.wizardState.reviewedProjects.clear();
        this.wizardState.showReviewedProjects = false;
        this.renderCurrentStep();
      });
    }

    // Display counts
    const countText = host.createEl("p");
    if (unreviewedProjects.length > 0) {
      countText.textContent = `Found ${unreviewedProjects.length} unreviewed project(s).`;
      if (reviewedProjects.length > 0) {
        countText.textContent += ` ${reviewedProjects.length} project(s) marked as reviewed.`;
      }
    } else if (reviewedProjects.length > 0) {
      countText.textContent = `All ${reviewedProjects.length} project(s) have been reviewed.`;
    }

    // Render unreviewed projects
    if (unreviewedProjects.length > 0) {
      const projectsList = host.createDiv({ cls: "weekly-review-projects-list" });
      for (const project of unreviewedProjects) {
        await this.renderProjectCard(projectsList, project);
      }
    }

    // Render reviewed projects if toggled on
    if (this.wizardState.showReviewedProjects && reviewedProjects.length > 0) {
      const reviewedSection = host.createDiv({ cls: "weekly-review-reviewed-section" });
      reviewedSection.style.marginTop = "20px";
      reviewedSection.style.paddingTop = "20px";
      reviewedSection.style.borderTop = "1px solid var(--background-modifier-border)";
      
      reviewedSection.createEl("h4", { 
        text: `Reviewed Projects (${reviewedProjects.length})`,
        cls: "weekly-review-reviewed-header"
      });
      
      const reviewedList = reviewedSection.createDiv({ cls: "weekly-review-projects-list" });
      for (const project of reviewedProjects) {
        await this.renderProjectCard(reviewedList, project);
      }
    }
  }

  /**
   * Renders a project card with its tasks.
   */
  private async renderProjectCard(host: HTMLElement, project: ProjectReviewInfo) {
    const projectDiv = host.createDiv({ cls: "weekly-review-project" });
    const projectHeader = projectDiv.createDiv({ cls: "weekly-review-project-header" });
    projectHeader.createEl("h4", { 
      text: `${project.name}${project.area ? ` (${project.area})` : ""}` 
    });
    
    if (!project.hasNextAction) {
      const warning = projectHeader.createEl("span", { 
        text: "⚠️ No next action", 
        cls: "weekly-review-warning" 
      });
    }

    const addTaskBtn = projectHeader.createEl("button", { 
      text: "Add Task", 
      cls: "weekly-review-btn weekly-review-btn-small" 
    });
    addTaskBtn.addEventListener("click", async () => {
      await this.addTaskToProject(project.path);
      await this.renderCurrentStep(); // Refresh
    });

    // Reviewed button (only for step 2D)
    if (this.wizardState.currentStep === "2D-review-projects") {
      const reviewedBtn = projectHeader.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(reviewedBtn, "badge-check");
      const reviewedText = reviewedBtn.createEl("span", { 
        text: "Reviewed", 
        cls: "weekly-review-btn-text" 
      });
      reviewedBtn.setAttribute("aria-label", "Reviewed");
      reviewedBtn.addEventListener("click", async () => {
        this.wizardState.reviewedProjects.add(project.path);
        await this.renderCurrentStep(); // Re-render to hide the project
      });
    }

    if (project.tasks.length > 0) {
      const tasksList = projectDiv.createDiv({ cls: "weekly-review-tasks-list" });
      for (const task of project.tasks) {
        await this.renderTaskCard(tasksList, task, false);
      }
    } else {
      projectDiv.createEl("p", { 
        text: "No uncompleted tasks in this project." 
      });
    }
  }

  /**
   * Renders Step 2E: Review Waiting For.
   */
  private async renderStep2E(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Waiting For List" });
    guidance.createEl("p", { 
      text: "Record appropriate actions for any needed follow-up. Check off received ones." 
    });
    
    host.createEl("p", { 
      text: "Review each Waiting For task. Update, complete, or remove the tag as needed." 
    });

    this.waitingForTasks = await fetchTasksByTag(this.app, this.settings, "#WaitingFor");

    if (this.waitingForTasks.length === 0) {
      host.createEl("p", { 
        text: "No Waiting For tasks found." 
      });
      return;
    }

    host.createEl("p", { 
      text: `Found ${this.waitingForTasks.length} Waiting For task(s).` 
    });

    const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
    for (const task of this.waitingForTasks) {
      await this.renderTaskCard(tasksList, task, false, true);
    }
  }

  /**
   * Renders Step 2F: Review Someday/Maybe.
   */
  private async renderStep2F(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Review Someday Maybe List" });
    guidance.createEl("p", { 
      text: "Review for any projects which may now have become active, and transfer to \"Projects.\" Delete items no longer of interest." 
    });
    
    host.createEl("p", { 
      text: "Review each Someday/Maybe project. Activate (move to active project), delete, or edit as needed. Click 'Reviewed' if no changes are needed." 
    });

    this.somedayMaybeProjects = await fetchSomedayMaybeProjects(this.app, this.settings);

    if (this.somedayMaybeProjects.length === 0) {
      host.createEl("p", { 
        text: `No Someday/Maybe projects found in ${this.settings.somedayMaybeFolderName} folders.` 
      });
      return;
    }

    // Filter reviewed and unreviewed projects
    const unreviewedProjects = this.somedayMaybeProjects.filter(p => 
      !this.wizardState.reviewedSomedayMaybeProjects.has(p.path)
    );
    const reviewedProjects = this.somedayMaybeProjects.filter(p => 
      this.wizardState.reviewedSomedayMaybeProjects.has(p.path)
    );

    // Controls for showing reviewed projects and resetting
    const controls = host.createDiv({ cls: "weekly-review-step-controls" });
    controls.style.marginBottom = "12px";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.flexWrap = "wrap";

    if (reviewedProjects.length > 0) {
      const showReviewedBtn = controls.createEl("button", {
        text: this.wizardState.showReviewedSomedayMaybeProjects 
          ? `Hide ${reviewedProjects.length} Reviewed Project(s)` 
          : `Show ${reviewedProjects.length} Reviewed Project(s)`,
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      showReviewedBtn.addEventListener("click", () => {
        this.wizardState.showReviewedSomedayMaybeProjects = !this.wizardState.showReviewedSomedayMaybeProjects;
        this.renderCurrentStep();
      });
    }

    if (this.wizardState.reviewedSomedayMaybeProjects.size > 0) {
      const resetBtn = controls.createEl("button", {
        text: "Reset Review",
        cls: "weekly-review-btn weekly-review-btn-small"
      });
      resetBtn.addEventListener("click", () => {
        this.wizardState.reviewedSomedayMaybeProjects.clear();
        this.wizardState.showReviewedSomedayMaybeProjects = false;
        this.renderCurrentStep();
      });
    }

    // Display counts
    const countText = host.createEl("p");
    if (unreviewedProjects.length > 0) {
      countText.textContent = `Found ${unreviewedProjects.length} unreviewed Someday/Maybe project(s).`;
      if (reviewedProjects.length > 0) {
        countText.textContent += ` ${reviewedProjects.length} project(s) marked as reviewed.`;
      }
    } else if (reviewedProjects.length > 0) {
      countText.textContent = `All ${reviewedProjects.length} Someday/Maybe project(s) have been reviewed.`;
    }

    // Render unreviewed projects
    if (unreviewedProjects.length > 0) {
      const projectsList = host.createDiv({ cls: "weekly-review-projects-list" });
      for (const project of unreviewedProjects) {
        await this.renderSomedayMaybeProjectCard(projectsList, project);
      }
    }

    // Render reviewed projects if toggled on
    if (this.wizardState.showReviewedSomedayMaybeProjects && reviewedProjects.length > 0) {
      const reviewedSection = host.createDiv({ cls: "weekly-review-reviewed-section" });
      reviewedSection.style.marginTop = "20px";
      reviewedSection.style.paddingTop = "20px";
      reviewedSection.style.borderTop = "1px solid var(--background-modifier-border)";
      
      reviewedSection.createEl("h4", { 
        text: `Reviewed Someday/Maybe Projects (${reviewedProjects.length})`,
        cls: "weekly-review-reviewed-header"
      });
      
      const reviewedList = reviewedSection.createDiv({ cls: "weekly-review-projects-list" });
      for (const project of reviewedProjects) {
        await this.renderSomedayMaybeProjectCard(reviewedList, project);
      }
    }
  }

  /**
   * Renders a Someday/Maybe project card with its tasks.
   */
  private async renderSomedayMaybeProjectCard(host: HTMLElement, project: ProjectReviewInfo) {
    const projectDiv = host.createDiv({ cls: "weekly-review-project" });
    const projectHeader = projectDiv.createDiv({ cls: "weekly-review-project-header" });
    projectHeader.createEl("h4", { 
      text: `${project.name}${project.area ? ` (${project.area})` : ""}` 
    });

    // Activate button
    const activateBtn = projectHeader.createEl("button", { 
      cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
    });
    setIcon(activateBtn, "activity");
    const activateText = activateBtn.createEl("span", { 
      text: "Activate", 
      cls: "weekly-review-btn-text" 
    });
    activateBtn.setAttribute("aria-label", "Activate");
    activateBtn.addEventListener("click", async () => {
      await this.activateSomedayMaybeProject(project);
      await this.renderCurrentStep(); // Refresh
    });

    // Reviewed button (only for step 2F)
    if (this.wizardState.currentStep === "2F-review-someday-maybe") {
      const reviewedBtn = projectHeader.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(reviewedBtn, "badge-check");
      const reviewedText = reviewedBtn.createEl("span", { 
        text: "Reviewed", 
        cls: "weekly-review-btn-text" 
      });
      reviewedBtn.setAttribute("aria-label", "Reviewed");
      reviewedBtn.addEventListener("click", async () => {
        this.wizardState.reviewedSomedayMaybeProjects.add(project.path);
        await this.renderCurrentStep(); // Re-render to hide the project
      });
    }

    if (project.tasks.length > 0) {
      const tasksList = projectDiv.createDiv({ cls: "weekly-review-tasks-list" });
      for (const task of project.tasks) {
        await this.renderTaskCard(tasksList, task, false, false, true);
      }
    } else {
      projectDiv.createEl("p", { 
        text: "No uncompleted tasks in this project." 
      });
    }
  }

  /**
   * Renders a task card with action buttons.
   */
  private async renderTaskCard(
    host: HTMLElement, 
    task: IndexedTask, 
    isInbox: boolean = false,
    isWaitingFor: boolean = false,
    isSomedayMaybe: boolean = false
  ) {
    const card = host.createDiv({ cls: "weekly-review-task-card" });
    
    // Task title and metadata
    const taskInfo = card.createDiv({ cls: "weekly-review-task-info" });
    taskInfo.createEl("div", { 
      text: task.title, 
      cls: "weekly-review-task-title" 
    });
    
    if (task.description) {
      taskInfo.createEl("div", { 
        text: task.description.substring(0, 100) + (task.description.length > 100 ? "..." : ""), 
        cls: "weekly-review-task-description" 
      });
    }

    const metadata = taskInfo.createDiv({ cls: "weekly-review-task-metadata" });
    if (task.due) {
      metadata.createEl("span", { 
        text: `Due: ${task.due}`, 
        cls: "weekly-review-task-due" 
      });
    }
    if (task.priority) {
      metadata.createEl("span", { 
        text: `Priority: ${task.priority}`, 
        cls: "weekly-review-task-priority" 
      });
    }
    if (task.project) {
      metadata.createEl("span", { 
        text: `Project: ${task.project}`, 
        cls: "weekly-review-task-project" 
      });
    }

    // Action buttons
    const actions = card.createDiv({ cls: "weekly-review-task-actions" });

    if (isInbox) {
      // Mark complete (2-minute rule) - icon with text on desktop
      const completeBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(completeBtn, "square-check");
      const completeText = completeBtn.createEl("span", { 
        text: "Complete", 
        cls: "weekly-review-btn-text" 
      });
      completeBtn.setAttribute("aria-label", "Complete");
      completeBtn.addEventListener("click", async () => {
        await this.completeTask(task);
        await this.renderCurrentStep();
      });

      // Move to Someday/Maybe
      const somedayBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(somedayBtn, "moon");
      const somedayText = somedayBtn.createEl("span", { 
        text: "Someday", 
        cls: "weekly-review-btn-text" 
      });
      somedayBtn.setAttribute("aria-label", "Someday/Maybe");
      somedayBtn.addEventListener("click", async () => {
        await this.moveTaskToSomedayMaybe(task);
        await this.renderCurrentStep();
      });

      // Assign to project
      const projectBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(projectBtn, "folder");
      const projectText = projectBtn.createEl("span", { 
        text: "Move", 
        cls: "weekly-review-btn-text" 
      });
      projectBtn.setAttribute("aria-label", "Move");
      projectBtn.addEventListener("click", async () => {
        await this.moveTaskToProject(task);
        await this.renderCurrentStep();
      });

      // Edit button (icon with text on desktop)
      const editBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(editBtn, "pencil");
      const editText = editBtn.createEl("span", { 
        text: "Edit", 
        cls: "weekly-review-btn-text" 
      });
      editBtn.setAttribute("aria-label", "Edit");
      editBtn.addEventListener("click", async () => {
        await captureQuickTask(this.app, this.settings, task);
        await this.renderCurrentStep();
      });

      // Delete (icon with text on desktop)
      const deleteBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-danger weekly-review-btn-icon" 
      });
      setIcon(deleteBtn, "trash-2");
      const deleteText = deleteBtn.createEl("span", { 
        text: "Delete", 
        cls: "weekly-review-btn-text" 
      });
      deleteBtn.setAttribute("aria-label", "Delete");
      deleteBtn.addEventListener("click", async () => {
        await this.deleteTask(task);
        await this.renderCurrentStep();
      });
    } else {
      // Edit button (icon with text on desktop)
      const editBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(editBtn, "pencil");
      const editText = editBtn.createEl("span", { 
        text: "Edit", 
        cls: "weekly-review-btn-text" 
      });
      editBtn.setAttribute("aria-label", "Edit");
      editBtn.addEventListener("click", async () => {
        await captureQuickTask(this.app, this.settings, task);
        await this.renderCurrentStep();
      });
    }

    if (!isInbox) {
      // Complete button
      const completeBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(completeBtn, "square-check");
      const completeText = completeBtn.createEl("span", { 
        text: "Complete", 
        cls: "weekly-review-btn-text" 
      });
      completeBtn.setAttribute("aria-label", "Complete");
      completeBtn.addEventListener("click", async () => {
        await this.completeTask(task);
        await this.renderCurrentStep();
      });

      // Move button
      const moveBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(moveBtn, "folder");
      const moveText = moveBtn.createEl("span", { 
        text: "Move", 
        cls: "weekly-review-btn-text" 
      });
      moveBtn.setAttribute("aria-label", "Move");
      moveBtn.addEventListener("click", async () => {
        await this.moveTaskToProject(task);
        await this.renderCurrentStep();
      });

      // Delete button
      const deleteBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-danger weekly-review-btn-icon" 
      });
      setIcon(deleteBtn, "trash-2");
      const deleteText = deleteBtn.createEl("span", { 
        text: "Delete", 
        cls: "weekly-review-btn-text" 
      });
      deleteBtn.setAttribute("aria-label", "Delete");
      deleteBtn.addEventListener("click", async () => {
        await this.deleteTask(task);
        await this.renderCurrentStep();
      });

      // Update due date button (not shown in step 2A, 2D, 2E, or 2F)
      if (this.wizardState.currentStep !== "2A-review-next-actions" && 
          this.wizardState.currentStep !== "2D-review-projects" &&
          this.wizardState.currentStep !== "2E-review-waiting-for" &&
          this.wizardState.currentStep !== "2F-review-someday-maybe") {
        const dueBtn = actions.createEl("button", { 
          text: "Update Due", 
          cls: "weekly-review-btn weekly-review-btn-small" 
        });
        dueBtn.addEventListener("click", async () => {
          await this.updateTaskDueDate(task);
          await this.renderCurrentStep();
        });
      }

      // Reviewed button (only for step 2A - Review Next Actions)
      if (!isWaitingFor && !isSomedayMaybe && this.wizardState.currentStep === "2A-review-next-actions") {
        const reviewedBtn = actions.createEl("button", { 
          cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
        });
        setIcon(reviewedBtn, "badge-check");
        const reviewedText = reviewedBtn.createEl("span", { 
          text: "Reviewed", 
          cls: "weekly-review-btn-text" 
        });
        reviewedBtn.setAttribute("aria-label", "Reviewed");
        reviewedBtn.addEventListener("click", async () => {
          const taskId = this.getTaskId(task);
          this.wizardState.reviewedTasks.add(taskId);
          await this.renderCurrentStep(); // Re-render to hide the task
        });
      }
    }

    if (isWaitingFor) {
      // Remove Waiting For tag
      const removeTagBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(removeTagBtn, "x-circle");
      const removeTagText = removeTagBtn.createEl("span", { 
        text: "Not Waiting", 
        cls: "weekly-review-btn-text" 
      });
      removeTagBtn.setAttribute("aria-label", "Remove #WaitingFor");
      removeTagBtn.addEventListener("click", async () => {
        await this.removeTag(task, "#WaitingFor");
        await this.renderCurrentStep();
      });
    }

    if (isSomedayMaybe) {
      // Activate button
      const activateBtn = actions.createEl("button", { 
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
      });
      setIcon(activateBtn, "activity");
      const activateText = activateBtn.createEl("span", { 
        text: "Activate", 
        cls: "weekly-review-btn-text" 
      });
      activateBtn.setAttribute("aria-label", "Activate");
      activateBtn.addEventListener("click", async () => {
        await this.activateSomedayMaybeTask(task);
        await this.renderCurrentStep();
      });
    }
  }

  /**
   * Adds tasks to Inbox from text input.
   */
  private async addTasksToInbox(text: string) {
    // Split by newlines and create tasks
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const inboxPath = normalizeInboxPath(this.settings.inboxPath);
    
    for (const line of lines) {
      const task: Task = {
        checked: false,
        title: line.trim(),
        tags: [],
        raw: ""
      };
      
      const taskLines = formatTaskWithDescription(task);
      const inboxFile = this.app.vault.getAbstractFileByPath(inboxPath);
      if (inboxFile instanceof TFile) {
        const content = await this.app.vault.read(inboxFile);
        const updated = content.trim().length 
          ? content + "\n" + taskLines.join("\n") + "\n" 
          : taskLines.join("\n") + "\n";
        await this.app.vault.modify(inboxFile, updated);
      }
    }
    
    new Notice(`Added ${lines.length} task(s) to Inbox`);
  }

  /**
   * Completes a task.
   */
  private async completeTask(task: IndexedTask) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;

    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1;
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      parsed.checked = true;
      if (!parsed.completed) {
        const today = (window as any).moment().format("YYYY-MM-DD");
        parsed.completed = today;
      }

      // Handle recurring tasks
      let nextOccurrenceTask: Task | null = null;
      if (parsed.recur && parsed.recur.length > 0) {
        const today = new Date();
        const nextDue = calculateNextOccurrence(parsed.recur, today);
        if (nextDue) {
          nextOccurrenceTask = {
            ...parsed,
            checked: false,
            due: nextDue,
            completed: undefined,
            recur: parsed.recur,
          };
          delete nextOccurrenceTask.description;
        }
      }

      const updatedLines = formatTaskWithDescription(parsed);
      
      if (nextOccurrenceTask) {
        const nextOccurrenceLines = formatTaskWithDescription(nextOccurrenceTask);
        updatedLines.push("", ...nextOccurrenceLines);
      }
      
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });

    new Notice("Task completed");
  }

  /**
   * Deletes a task.
   */
  private async deleteTask(task: IndexedTask) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;

    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1;
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      
      return lines.join("\n");
    });

    new Notice("Task deleted");
  }

  /**
   * Moves a task to a project.
   */
  private async moveTaskToProject(task: IndexedTask) {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => isInTasksFolder(f.path, this.settings));

    const target = await new FilePickerModal(this.app, files).openAndGet();
    if (!target) return;

    await this.moveTask(task, target.path);
    new Notice(`Task moved to ${target.path}`);
  }

  /**
   * Moves a task to Someday/Maybe.
   */
  private async moveTaskToSomedayMaybe(task: IndexedTask) {
    // Determine area from task
    const areas = getAreas(this.app, this.settings);
    const area = task.area || (areas.length > 0 ? areas[0] : undefined);
    if (!area) {
      new Notice("No area found for task");
      return;
    }

    const somedayMaybeFolderName = this.settings.somedayMaybeFolderName;
    const somedayMaybePath = `${getAreaPath(area, this.settings)}/${somedayMaybeFolderName}.md`;
    
    // Check if file exists, create if not
    let somedayMaybeFile = this.app.vault.getAbstractFileByPath(somedayMaybePath);
    if (!somedayMaybeFile) {
      somedayMaybeFile = await this.app.vault.create(somedayMaybePath, `# ${somedayMaybeFolderName}\n\n`);
    }

    if (!(somedayMaybeFile instanceof TFile)) {
      new Notice(`Failed to create ${somedayMaybeFolderName} file`);
      return;
    }

    await this.moveTask(task, somedayMaybePath);
    new Notice(`Task moved to ${somedayMaybeFolderName} (${area})`);
  }

  /**
   * Moves a task to a different file.
   */
  private async moveTask(task: IndexedTask, targetPath: string) {
    const sourceFile = this.app.vault.getAbstractFileByPath(task.path);
    if (!(sourceFile instanceof TFile)) return;

    let taskWithDescription: Task | null = null;
    
    await this.app.vault.process(sourceFile, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1;
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      taskWithDescription = {
        ...parsed,
        area: undefined,
        project: isSpecialFile(targetPath, this.settings) ? parsed.project : 
                 this.app.vault.getAbstractFileByPath(targetPath)?.basename
      };

      const numLinesToRemove = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToRemove);
      return lines.join("\n");
    });

    if (!taskWithDescription) return;

    const updatedLines = formatTaskWithDescription(taskWithDescription);
    const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
    if (!(targetFile instanceof TFile)) return;

    const targetContent = await this.app.vault.read(targetFile);
    const finalLines = updatedLines.join("\n");
    const updated = targetContent.trim().length 
      ? targetContent + "\n" + finalLines + "\n" 
      : finalLines + "\n";
    await this.app.vault.modify(targetFile, updated);
  }

  /**
   * Updates a task's due date.
   */
  private async updateTaskDueDate(task: IndexedTask) {
    const defaultValue = task.due ?? (this.settings.nlDateParsing ? "today" : "");
    const modal = new PromptModal(this.app, "Set due date (today / 2025-11-10)", defaultValue);
    const next = await modal.prompt();
    if (next == null || next.trim() === "") return;
    
    const parsed = this.settings.nlDateParsing ? (parseNLDate(next) ?? next) : next;
    await this.updateTaskField(task, "due", parsed);
  }

  /**
   * Updates a task field.
   */
  private async updateTaskField(task: IndexedTask, key: "due" | "priority" | "recur", value?: string) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;
    
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1;
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      if (key === "due") {
        parsed.due = value;
      } else if (key === "priority") {
        parsed.priority = value;
      } else if (key === "recur") {
        parsed.recur = value;
      }

      const updatedLines = formatTaskWithDescription(parsed);
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });
  }

  /**
   * Removes a tag from a task.
   */
  private async removeTag(task: IndexedTask, tag: string) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;
    
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const taskLineIdx = task.line - 1;
      const descEndIdx = (task.descriptionEndLine ?? task.line) - 1;
      
      if (taskLineIdx < 0 || taskLineIdx >= lines.length) return data;

      const { task: parsed } = parseTaskWithDescription(lines, taskLineIdx);
      if (!parsed) return data;

      const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
      parsed.tags = parsed.tags.filter(t => t !== normalizedTag);

      const updatedLines = formatTaskWithDescription(parsed);
      const numLinesToReplace = descEndIdx - taskLineIdx + 1;
      lines.splice(taskLineIdx, numLinesToReplace, ...updatedLines);
      
      return lines.join("\n");
    });

    new Notice(`Removed ${tag} tag`);
  }

  /**
   * Activates a Someday/Maybe task (moves to active project in same area).
   */
  private async activateSomedayMaybeTask(task: IndexedTask) {
    const area = task.area;
    if (!area) {
      new Notice("No area found for task");
      return;
    }

    // Get all project files in the same area (excluding Someday Maybe folder)
    const somedayMaybeFolderName = this.settings.somedayMaybeFolderName;
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => {
        if (!isInTasksFolder(f.path, this.settings)) return false;
        const fileArea = inferAreaFromPath(f.path, this.app, this.settings);
        if (fileArea !== area) return false;
        if (isSpecialFile(f.path, this.settings)) return false;
        // Exclude Someday Maybe folder
        const somedayMaybePath = `${getAreaPath(area, this.settings)}/${somedayMaybeFolderName}`;
        if (f.path.startsWith(somedayMaybePath + "/") || f.path === somedayMaybePath + ".md") {
          return false;
        }
        return true;
      });

    if (files.length === 0) {
      new Notice(`No active projects found in ${area} area`);
      return;
    }

    const target = await new FilePickerModal(this.app, files).openAndGet();
    if (!target) return;

    await this.moveTask(task, target.path);
    new Notice(`Task activated and moved to ${target.basename}`);
  }

  /**
   * Activates a Someday/Maybe project (moves all tasks to an active project in same area).
   */
  private async activateSomedayMaybeProject(project: ProjectReviewInfo) {
    const area = project.area;
    if (!area) {
      new Notice("No area found for project");
      return;
    }

    // Get all project files in the same area (excluding Someday Maybe folder)
    const somedayMaybeFolderName = this.settings.somedayMaybeFolderName;
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => {
        if (!isInTasksFolder(f.path, this.settings)) return false;
        const fileArea = inferAreaFromPath(f.path, this.app, this.settings);
        if (fileArea !== area) return false;
        if (isSpecialFile(f.path, this.settings)) return false;
        // Exclude Someday Maybe folder
        const somedayMaybePath = `${getAreaPath(area, this.settings)}/${somedayMaybeFolderName}`;
        if (f.path.startsWith(somedayMaybePath + "/") || f.path === somedayMaybePath + ".md") {
          return false;
        }
        return true;
      });

    if (files.length === 0) {
      new Notice(`No active projects found in ${area} area`);
      return;
    }

    const target = await new FilePickerModal(this.app, files).openAndGet();
    if (!target) return;

    // Move all tasks from the Someday Maybe project to the target project
    const sourceFile = this.app.vault.getAbstractFileByPath(project.path);
    if (!(sourceFile instanceof TFile)) {
      new Notice("Source project file not found");
      return;
    }

    // Read source file to get all tasks
    const sourceContent = await this.app.vault.read(sourceFile);
    const sourceLines = sourceContent.split("\n");
    
    // Find all task lines in the source file
    const cache = this.app.metadataCache.getCache(project.path);
    const lists = cache?.listItems;
    if (!lists || lists.length === 0) {
      new Notice("No tasks found in project");
      return;
    }

    // Collect all task line ranges (start and end lines for each task)
    const taskRanges: { startLine: number; endLine: number; lines: string[] }[] = [];
    
    for (const li of lists) {
      if (!li.task) continue;
      const lineNo = li.position?.start?.line ?? 0;
      if (lineNo < 0 || lineNo >= sourceLines.length) continue;
      
      const { task: parsed, endLine } = parseTaskWithDescription(sourceLines, lineNo);
      if (!parsed) continue;
      
      // Get all lines for this task (including description)
      const taskLines = sourceLines.slice(lineNo, endLine + 1);
      taskRanges.push({ startLine: lineNo, endLine, lines: taskLines });
    }

    if (taskRanges.length === 0) {
      new Notice("No tasks to move");
      return;
    }

    // Remove tasks from source file (in reverse order to maintain indices)
    await this.app.vault.process(sourceFile, (data) => {
      const lines = data.split("\n");
      // Sort by startLine descending to remove from end first
      const sortedRanges = [...taskRanges].sort((a, b) => b.startLine - a.startLine);
      
      for (const range of sortedRanges) {
        const numLines = range.endLine - range.startLine + 1;
        lines.splice(range.startLine, numLines);
      }
      return lines.join("\n");
    });

    // Add tasks to target file
    const targetContent = await this.app.vault.read(target);
    const tasksText = taskRanges.map(r => r.lines.join("\n")).join("\n\n");
    const updated = targetContent.trim().length 
      ? targetContent + "\n\n" + tasksText + "\n" 
      : tasksText + "\n";
    await this.app.vault.modify(target, updated);

    new Notice(`Project activated: ${taskRanges.length} task(s) moved to ${target.basename}`);
  }

  /**
   * Adds a task to a project.
   */
  private async addTaskToProject(projectPath: string) {
    await captureQuickTask(this.app, this.settings);
  }

  /**
   * Goes to the next step.
   */
  private goToNextStep() {
    if (this.currentStepIndex < ALL_STEPS.length - 1) {
      this.wizardState.completedSteps.add(this.wizardState.currentStep);
      this.currentStepIndex++;
      this.wizardState.currentStep = ALL_STEPS[this.currentStepIndex];
      this.renderCurrentStep();
    } else {
      // Finish review
      new Notice("Weekly Review completed!");
      this.currentStepIndex = 0;
      this.wizardState.currentStep = ALL_STEPS[0];
      this.wizardState.completedSteps.clear();
      this.renderCurrentStep();
    }
  }

  /**
   * Renders Step 3A: Brainstorm / Creative Sweep.
   */
  private async renderStep3A(host: HTMLElement) {
    host.empty();
    
    // Guidance text
    const guidance = host.createDiv({ cls: "weekly-review-guidance" });
    guidance.createEl("h4", { text: "Brainstorm / Creative Sweep" });
    guidance.createEl("p", { 
      text: "If I had an extra hour this week, what would move the needle?" 
    });
    guidance.createEl("p", { 
      text: "What's exciting me / bugging me?" 
    });
    
    host.createEl("p", { 
      text: "Be Creative and Courageous",
      cls: "weekly-review-emphasis"
    });
    
    host.createEl("p", { 
      text: "Any new, wonderful, hare-brained, creative, thought-provoking, risk-taking ideas to add into your system???" 
    });

    const inputDiv = host.createDiv({ cls: "weekly-review-question" });
    const input = inputDiv.createEl("textarea", { 
      cls: "weekly-review-textarea" 
    });
    input.placeholder = "Be Creative and Courageous\n\nAny new, wonderful, hare-brained, creative, thought-provoking, risk-taking ideas to add into your system???";
    input.value = this.wizardState.notes.brainstorm;
    input.addEventListener("input", (e) => {
      this.wizardState.notes.brainstorm = (e.target as HTMLTextAreaElement).value;
    });

    const addBtn = inputDiv.createEl("button", { 
      text: "Add to Inbox", 
      cls: "weekly-review-btn weekly-review-btn-action" 
    });
    addBtn.addEventListener("click", async () => {
      const text = input.value.trim();
      if (text) {
        await this.addTasksToInbox(text);
        input.value = "";
        this.wizardState.notes.brainstorm = "";
      }
    });
  }

  /**
   * Goes to the previous step.
   */
  private goToPreviousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.wizardState.currentStep = ALL_STEPS[this.currentStepIndex];
      this.renderCurrentStep();
    }
  }
}
