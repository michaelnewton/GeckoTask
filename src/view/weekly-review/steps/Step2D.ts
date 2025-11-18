import { App } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { ProjectReviewInfo, WizardState } from "../WeeklyReviewPanelTypes";
import { fetchProjectsWithTasks } from "../../../services/WeeklyReviewService";
import { renderProjectCard } from "../components/ProjectCard";
import { TaskCardCallbacks } from "../components/TaskCard";

/**
 * Renders Step 2D: Review Projects.
 */
export async function renderStep2D(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: TaskCardCallbacks & {
    onRerender: () => Promise<void>;
    onAddTask: (projectPath: string) => Promise<void>;
    onMarkProjectReviewed: (projectPath: string) => Promise<void>;
    onToggleShowReviewedProjects: () => Promise<void>;
    onResetReviewedProjects: () => Promise<void>;
  }
): Promise<void> {
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

  const projects = await fetchProjectsWithTasks(app, settings);

  if (projects.length === 0) {
    host.createEl("p", { 
      text: "No projects found." 
    });
    return;
  }

  // Filter reviewed and unreviewed projects
  const unreviewedProjects = projects.filter(p => 
    !wizardState.reviewedProjects.has(p.path)
  );
  const reviewedProjects = projects.filter(p => 
    wizardState.reviewedProjects.has(p.path)
  );

  // Controls for showing reviewed projects and resetting
  const controls = host.createDiv({ cls: "weekly-review-step-controls" });
  controls.style.marginBottom = "12px";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.flexWrap = "wrap";

  if (reviewedProjects.length > 0) {
    const showReviewedBtn = controls.createEl("button", {
      text: wizardState.showReviewedProjects 
        ? `Hide ${reviewedProjects.length} Reviewed Project(s)` 
        : `Show ${reviewedProjects.length} Reviewed Project(s)`,
      cls: "weekly-review-btn weekly-review-btn-small"
    });
    showReviewedBtn.addEventListener("click", async () => {
      await callbacks.onToggleShowReviewedProjects();
      await callbacks.onRerender();
    });
  }

  if (wizardState.reviewedProjects.size > 0) {
    const resetBtn = controls.createEl("button", {
      text: "Reset Review",
      cls: "weekly-review-btn weekly-review-btn-small"
    });
    resetBtn.addEventListener("click", async () => {
      await callbacks.onResetReviewedProjects();
      await callbacks.onRerender();
    });
  }

  // Display counts
  const countText = host.createEl("p");
  countText.setAttribute("data-weekly-review-count", "true");
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
      await renderProjectCard(projectsList, app, settings, project, {
        ...callbacks,
        onAddTask: callbacks.onAddTask,
        onMarkReviewed: async (projectPath: string) => {
          await callbacks.onMarkProjectReviewed(projectPath);
          await callbacks.onRerender();
        },
        onRerender: callbacks.onRerender
      }, {
        currentStep: "2D-review-projects",
        showReviewedButton: true
      });
    }
  }

  // Render reviewed projects if toggled on
  if (wizardState.showReviewedProjects && reviewedProjects.length > 0) {
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
      await renderProjectCard(reviewedList, app, settings, project, {
        ...callbacks,
        onAddTask: callbacks.onAddTask,
        onMarkReviewed: async () => {},
        onRerender: callbacks.onRerender
      }, {
        currentStep: "2D-review-projects",
        showReviewedButton: false
      });
    }
  }
}

