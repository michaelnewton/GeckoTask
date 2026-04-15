"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStep2E = renderStep2E;
const WeeklyReviewService_1 = require("../../../services/WeeklyReviewService");
const TaskCard_1 = require("../components/TaskCard");
/**
 * Renders Step 2E: Review Waiting For.
 */
async function renderStep2E(host, app, settings, callbacks) {
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
    const allWaitingForTasks = await (0, WeeklyReviewService_1.fetchTasksByTag)(app, settings, settings.waitingForTag);
    // Filter out completed tasks
    const waitingForTasks = allWaitingForTasks.filter(task => !task.checked);
    if (waitingForTasks.length === 0) {
        host.createEl("p", {
            text: "No Waiting For tasks found."
        });
        return;
    }
    const countText = host.createEl("p");
    countText.setAttribute("data-weekly-review-count", "true");
    countText.textContent = `Found ${waitingForTasks.length} Waiting For task(s).`;
    const tasksList = host.createDiv({ cls: "weekly-review-tasks-list" });
    for (const task of waitingForTasks) {
        await (0, TaskCard_1.renderTaskCard)(tasksList, app, settings, task, callbacks, {
            isWaitingFor: true
        });
    }
}
