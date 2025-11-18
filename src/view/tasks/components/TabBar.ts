import { TabType } from "../TasksPanelTypes";

/**
 * Renders the tab navigation UI.
 * @param host - Container element to render into
 * @param currentTab - Currently active tab
 * @param onTabChange - Callback when tab is clicked
 */
export function renderTabBar(
  host: HTMLElement,
  currentTab: TabType,
  onTabChange: (tab: TabType) => void
): void {
  host.empty();
  host.addClass("geckotask-tabs-container");

  const todayTab = host.createDiv({ 
    cls: `geckotask-tab ${currentTab === "today-overdue" ? "geckotask-tab-active" : ""}`
  });
  todayTab.setText("Now");
  todayTab.addEventListener("click", () => {
    onTabChange("today-overdue");
  });

  const nextActionsTab = host.createDiv({ 
    cls: `geckotask-tab ${currentTab === "next-actions" ? "geckotask-tab-active" : ""}`
  });
  nextActionsTab.setText("Next");
  nextActionsTab.addEventListener("click", () => {
    onTabChange("next-actions");
  });

  const inboxTab = host.createDiv({ 
    cls: `geckotask-tab ${currentTab === "inbox" ? "geckotask-tab-active" : ""}`
  });
  inboxTab.setText("Inbox");
  inboxTab.addEventListener("click", () => {
    onTabChange("inbox");
  });

  const waitingForTab = host.createDiv({ 
    cls: `geckotask-tab ${currentTab === "waiting-for" ? "geckotask-tab-active" : ""}`
  });
  waitingForTab.setText("Waiting");
  waitingForTab.addEventListener("click", () => {
    onTabChange("waiting-for");
  });

  const allTab = host.createDiv({ 
    cls: `geckotask-tab ${currentTab === "all" ? "geckotask-tab-active" : ""}`
  });
  allTab.setText("All Tasks");
  allTab.addEventListener("click", () => {
    onTabChange("all");
  });
}

