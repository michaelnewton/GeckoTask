"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderProjectCard = renderProjectCard;
const obsidian_1 = require("obsidian");
const TaskCard_1 = require("./TaskCard");
/**
 * Renders a project card with tasks.
 */
async function renderProjectCard(host, app, settings, project, callbacks, options = {}) {
    const { currentStep, showReviewedButton = false } = options;
    const projectDiv = host.createDiv({ cls: "weekly-review-project" });
    const projectHeader = projectDiv.createDiv({ cls: "weekly-review-project-header" });
    const projectName = projectHeader.createEl("h4", {
        text: `${project.name}${project.area ? ` (${project.area})` : ""}`
    });
    projectName.style.cursor = "pointer";
    projectName.style.textDecoration = "underline";
    projectName.addEventListener("click", () => callbacks.onOpenProject(project.path));
    if (!project.hasNextAction) {
        const warning = projectHeader.createEl("span", {
            text: "⚠️ No next action",
            cls: "weekly-review-warning"
        });
    }
    // Button container
    const buttonContainer = projectHeader.createDiv({ cls: "weekly-review-project-buttons" });
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "6px";
    buttonContainer.style.alignItems = "center";
    // Add Task button
    const addTaskBtn = buttonContainer.createEl("button", {
        cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon"
    });
    (0, obsidian_1.setIcon)(addTaskBtn, "plus");
    addTaskBtn.createEl("span", {
        text: "Add Task",
        cls: "weekly-review-btn-text"
    });
    addTaskBtn.setAttribute("aria-label", "Add Task");
    addTaskBtn.addEventListener("click", async () => {
        await callbacks.onAddTask(project.path);
        await callbacks.onRerender();
    });
    // Reviewed button (only for step 2D)
    if (currentStep === "2D-review-projects" && showReviewedButton) {
        const reviewedBtn = buttonContainer.createEl("button", {
            cls: "weekly-review-btn weekly-review-btn-small weekly-review-btn-icon"
        });
        (0, obsidian_1.setIcon)(reviewedBtn, "badge-check");
        reviewedBtn.createEl("span", {
            text: "Reviewed",
            cls: "weekly-review-btn-text"
        });
        reviewedBtn.setAttribute("aria-label", "Reviewed");
        reviewedBtn.addEventListener("click", async () => {
            await callbacks.onMarkReviewed(project.path);
            await callbacks.onRerender();
        });
    }
    if (project.tasks.length > 0) {
        const tasksList = projectDiv.createDiv({ cls: "weekly-review-tasks-list" });
        for (const task of project.tasks) {
            await (0, TaskCard_1.renderTaskCard)(tasksList, app, settings, task, callbacks, {
                currentStep,
                showReviewedButton: false
            });
        }
    }
    else {
        projectDiv.createEl("p", {
            text: "No uncompleted tasks in this project."
        });
    }
}
