"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStep3A = renderStep3A;
/**
 * Renders Step 3A: Brainstorm / Creative Sweep.
 */
function renderStep3A(host, app, settings, wizardState, callbacks) {
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
    input.value = wizardState.notes.brainstorm;
    input.addEventListener("input", (e) => {
        const value = e.target.value;
        callbacks.onStateChange(value);
        callbacks.onDebouncedSave();
    });
    const addBtn = inputDiv.createEl("button", {
        text: "Add to Inbox",
        cls: "weekly-review-btn weekly-review-btn-action"
    });
    addBtn.addEventListener("click", async () => {
        const text = input.value.trim();
        if (text) {
            await callbacks.onAddTasksToInbox(text);
            input.value = "";
            callbacks.onStateChange("");
        }
    });
}
