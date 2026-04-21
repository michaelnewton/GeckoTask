import { Platform } from "obsidian";
import type GeckoTaskPlugin from "../main";
import { activateTasksView } from "../utils/viewUtils";

/**
 * If enabled in settings, retries opening the Tasks panel until the workspace is ready (desktop vs mobile delays).
 */
export function scheduleAutoOpenTasksPanel(plugin: GeckoTaskPlugin): void {
  if (!plugin.settings.autoOpenTasksPanel) return;

  let activationAttempted = false;
  let retryTimeoutId: number | null = null;
  const maxRetries = Platform.isMobileApp ? 20 : 15;
  let retryCount = 0;

  const tryActivatePanel = async () => {
    if (activationAttempted) return;

    retryCount++;
    try {
      await activateTasksView(plugin.app);
      activationAttempted = true;
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        const baseDelay = Platform.isMobileApp ? 300 : 200;
        const delay = Math.min(baseDelay * retryCount, Platform.isMobileApp ? 3000 : 2000);
        retryTimeoutId = window.setTimeout(tryActivatePanel, delay) as unknown as number;
        plugin.registerInterval(retryTimeoutId);
      } else {
        if (!Platform.isMobileApp) {
          console.warn("GeckoTask: Could not auto-open Tasks panel after retries:", error);
        }
      }
    }
  };

  const initialDelay = Platform.isMobileApp ? 1000 : 500;
  const initialTimeoutId = window.setTimeout(tryActivatePanel, initialDelay) as unknown as number;
  plugin.registerInterval(initialTimeoutId);

  plugin.registerEvent(
    plugin.app.workspace.on("layout-change", () => {
      if (!activationAttempted && retryCount < maxRetries) {
        const layoutTimeoutId = window.setTimeout(tryActivatePanel, Platform.isMobileApp ? 200 : 100) as unknown as number;
        plugin.registerInterval(layoutTimeoutId);
      }
    })
  );
}
