import { App, Platform, WorkspaceLeaf } from "obsidian";
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
  
  // First, check if the view already exists
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASKS).first();
  
  if (!leaf) {
    // Try to get or create a right leaf (works on both desktop and mobile, though mobile may handle it differently)
    try {
      // Try to get existing right leaf first
      let rightLeaf = workspace.getRightLeaf(false);
      
      // If no right leaf exists, try to create one
      // On mobile, this may create an overlay/modal instead of a sidebar
      if (!rightLeaf) {
        rightLeaf = workspace.getRightLeaf(true);
      }
      
      if (!rightLeaf) {
        throw new Error("Could not get or create right leaf");
      }
      
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_TASKS, active: true });
    } catch (error) {
      // Workspace layout might not be ready yet, or on mobile the API might work differently
      throw error;
    }
  }
  
  // Reveal the leaf (on mobile, this may open as an overlay)
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

