"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTasksView = activateTasksView;
exports.activateWeeklyReviewView = activateWeeklyReviewView;
exports.activateHealthView = activateHealthView;
const TasksPanel_1 = require("../view/tasks/TasksPanel");
const WeeklyReviewPanel_1 = require("../view/weekly-review/WeeklyReviewPanel");
const HealthPanel_1 = require("../view/health/HealthPanel");
/**
 * Activates or reveals the Tasks panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
async function activateTasksView(app) {
    const { workspace } = app;
    let leaf = workspace.getLeavesOfType(TasksPanel_1.VIEW_TYPE_TASKS).first();
    if (!leaf) {
        const rightLeaf = workspace.getRightLeaf(false);
        if (!rightLeaf)
            return; // Can't create view if no leaf available
        leaf = rightLeaf;
        await leaf.setViewState({ type: TasksPanel_1.VIEW_TYPE_TASKS, active: true });
    }
    workspace.revealLeaf(leaf);
}
/**
 * Activates or reveals the Weekly Review panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
async function activateWeeklyReviewView(app) {
    const { workspace } = app;
    let leaf = workspace.getLeavesOfType(WeeklyReviewPanel_1.VIEW_TYPE_WEEKLY_REVIEW).first();
    if (!leaf) {
        const rightLeaf = workspace.getRightLeaf(false);
        if (!rightLeaf)
            return; // Can't create view if no leaf available
        leaf = rightLeaf;
        await leaf.setViewState({ type: WeeklyReviewPanel_1.VIEW_TYPE_WEEKLY_REVIEW, active: true });
    }
    workspace.revealLeaf(leaf);
}
/**
 * Activates or reveals the Health Check panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
async function activateHealthView(app) {
    const { workspace } = app;
    let leaf = workspace.getLeavesOfType(HealthPanel_1.VIEW_TYPE_HEALTH).first();
    if (!leaf) {
        const rightLeaf = workspace.getRightLeaf(false);
        if (!rightLeaf)
            return; // Can't create view if no leaf available
        leaf = rightLeaf;
        await leaf.setViewState({ type: HealthPanel_1.VIEW_TYPE_HEALTH, active: true });
    }
    workspace.revealLeaf(leaf);
}
