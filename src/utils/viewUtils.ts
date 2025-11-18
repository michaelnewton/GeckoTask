import { App, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TASKS } from "../view/tasks/TasksPanel";
import { VIEW_TYPE_WEEKLY_REVIEW } from "../view/weekly-review/WeeklyReviewPanel";
import { VIEW_TYPE_HEALTH } from "../view/health/HealthPanel";

/**
 * Activates or reveals the Tasks panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
export async function activateTasksView(app: App): Promise<void> {
  const { workspace } = app;
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASKS).first();
  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (!rightLeaf) return; // Can't create view if no leaf available
    leaf = rightLeaf;
    await leaf.setViewState({ type: VIEW_TYPE_TASKS, active: true });
  }
  workspace.revealLeaf(leaf);
}

/**
 * Activates or reveals the Weekly Review panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
export async function activateWeeklyReviewView(app: App): Promise<void> {
  const { workspace } = app;
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEEKLY_REVIEW).first();
  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (!rightLeaf) return; // Can't create view if no leaf available
    leaf = rightLeaf;
    await leaf.setViewState({ type: VIEW_TYPE_WEEKLY_REVIEW, active: true });
  }
  workspace.revealLeaf(leaf);
}

/**
 * Activates or reveals the Health Check panel view.
 * @param app - The Obsidian app instance
 * @returns Promise that resolves when the view is activated
 */
export async function activateHealthView(app: App): Promise<void> {
  const { workspace } = app;
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_HEALTH).first();
  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (!rightLeaf) return; // Can't create view if no leaf available
    leaf = rightLeaf;
    await leaf.setViewState({ type: VIEW_TYPE_HEALTH, active: true });
  }
  workspace.revealLeaf(leaf);
}

