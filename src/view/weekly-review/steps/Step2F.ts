import { App, setIcon } from "obsidian";
import { GeckoTaskSettings } from "../../../settings";
import { ProjectReviewInfo, WizardState } from "../WeeklyReviewPanelTypes";
import { fetchSomedayMaybeProjects } from "../../../services/WeeklyReviewService";
import { renderTaskCard, TaskCardCallbacks } from "../components/TaskCard";

/**
 * Renders a Someday/Maybe project card with its tasks.
 */
async function renderSomedayMaybeProjectCard(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  project: ProjectReviewInfo,
  callbacks: TaskCardCallbacks & {
    onRerender: () => Promise<void>;
    onActivateProject: (projectPath: string) => Promise<void>;
    onMarkProjectReviewed: (projectPath: string) => Promise<void>;
  }
): Promise<void> {
  const projectDiv = host.createDiv({ cls: "weekly-review-project" });
  const projectHeader = projectDiv.createDiv({ cls: "weekly-review-project-header" });
  const projectName = projectHeader.createEl("h4", { 
    text: `${project.name}${project.area ? ` (${project.area})` : ""}` 
  });
  projectName.style.cursor = "pointer";
  projectName.style.textDecoration = "underline";
  projectName.addEventListener("click", () => callbacks.onOpenProject(project.path));

  // Button container
  const buttonContainer = projectHeader.createDiv({ cls: "weekly-review-project-buttons" });
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "6px";
  buttonContainer.style.alignItems = "center";

  // Activate button
  const activateBtn = buttonContainer.createEl("button", { 
    cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
  });
  setIcon(activateBtn, "activity");
  activateBtn.createEl("span", { 
    text: "Activate", 
    cls: "weekly-review-btn-text" 
  });
  activateBtn.setAttribute("aria-label", "Activate");
  activateBtn.addEventListener("click", async () => {
    await callbacks.onActivateProject(project.path);
    await callbacks.onRerender();
  });

  // Reviewed button
  const reviewedBtn = buttonContainer.createEl("button", { 
    cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon" 
  });
  setIcon(reviewedBtn, "badge-check");
  reviewedBtn.createEl("span", { 
    text: "Reviewed", 
    cls: "weekly-review-btn-text" 
  });
  reviewedBtn.setAttribute("aria-label", "Reviewed");
  reviewedBtn.addEventListener("click", async () => {
    await callbacks.onMarkProjectReviewed(project.path);
    await callbacks.onRerender();
  });

  if (project.tasks.length > 0) {
    const tasksList = projectDiv.createDiv({ cls: "weekly-review-tasks-list" });
    for (const task of project.tasks) {
      await renderTaskCard(tasksList, app, settings, task, callbacks, {
        isSomedayMaybe: true
      });
    }
  } else {
    projectDiv.createEl("p", { 
      text: "No uncompleted tasks in this project." 
    });
  }
}

/**
 * Renders Step 2F: Review Someday/Maybe.
 */
export async function renderStep2F(
  host: HTMLElement,
  app: App,
  settings: GeckoTaskSettings,
  wizardState: WizardState,
  callbacks: TaskCardCallbacks & {
    onRerender: () => Promise<void>;
    onActivateProject: (projectPath: string) => Promise<void>;
    onMarkProjectReviewed: (projectPath: string) => Promise<void>;
    onToggleShowReviewedProjects: () => Promise<void>;
    onResetReviewedProjects: () => Promise<void>;
  }
): Promise<void> {
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

  const somedayMaybeProjects = await fetchSomedayMaybeProjects(app, settings);

  if (somedayMaybeProjects.length === 0) {
    host.createEl("p", { 
      text: `No Someday/Maybe projects found in ${settings.somedayMaybeFolderName} folders.` 
    });
    return;
  }

  // Filter reviewed and unreviewed projects
  const unreviewedProjects = somedayMaybeProjects.filter(p => 
    !wizardState.reviewedSomedayMaybeProjects.has(p.path)
  );
  const reviewedProjects = somedayMaybeProjects.filter(p => 
    wizardState.reviewedSomedayMaybeProjects.has(p.path)
  );

  // Controls for showing reviewed projects and resetting
  const controls = host.createDiv({ cls: "weekly-review-step-controls" });
  controls.style.marginBottom = "12px";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.flexWrap = "wrap";

  if (reviewedProjects.length > 0) {
    const showReviewedBtn = controls.createEl("button", {
      text: wizardState.showReviewedSomedayMaybeProjects 
        ? `Hide ${reviewedProjects.length} Reviewed Project(s)` 
        : `Show ${reviewedProjects.length} Reviewed Project(s)`,
      cls: "weekly-review-btn weekly-review-btn-small"
    });
    showReviewedBtn.addEventListener("click", async () => {
      await callbacks.onToggleShowReviewedProjects();
      await callbacks.onRerender();
    });
  }

  if (wizardState.reviewedSomedayMaybeProjects.size > 0) {
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
      await renderSomedayMaybeProjectCard(projectsList, app, settings, project, callbacks);
    }
  }

  // Render reviewed projects if toggled on
  if (wizardState.showReviewedSomedayMaybeProjects && reviewedProjects.length > 0) {
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
      await renderSomedayMaybeProjectCard(reviewedList, app, settings, project, callbacks);
    }
  }
}

