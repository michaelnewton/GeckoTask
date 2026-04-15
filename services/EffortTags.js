"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRegex = void 0;
exports.stripExistingEffortTags = stripExistingEffortTags;
exports.getEffortTagFromLabel = getEffortTagFromLabel;
exports.applyEffortTagToLine = applyEffortTagToLine;
exports.estimateEffortRuleBased = estimateEffortRuleBased;
exports.estimateEffortWithLLM = estimateEffortWithLLM;
exports.taskRegex = /^(\s*[-*]\s+\[[ xX]\]\s+)(.*)$/;
const effortTagRegex = /\s*#e\/(?:low|medium|high)\b/gi;
/**
 * Removes any existing effort (#e/low|medium|high) tags from the task text.
 * @param text - The portion of the task line following the checkbox prefix
 * @returns Task text without effort tags
 */
function stripExistingEffortTags(text) {
    const cleaned = text.replace(effortTagRegex, "");
    return cleaned.replace(/\s{2,}/g, " ").trimEnd();
}
/**
 * Maps an effort label to the corresponding tag token (#e/level).
 * @param effort - Target effort level
 * @returns Effort tag string
 */
function getEffortTagFromLabel(effort) {
    return `#e/${effort}`;
}
/**
 * Ensures the task line carries exactly one effort tag, replacing previous values.
 * @param line - Entire markdown task line (with checkbox)
 * @param effort - Effort level to apply
 * @returns Task line with updated effort tag
 */
function applyEffortTagToLine(line, effort) {
    const match = exports.taskRegex.exec(line);
    if (!match)
        return line;
    const [, prefix, rest] = match;
    const trimmed = stripExistingEffortTags(rest).trim();
    const spaced = trimmed ? `${trimmed} ${getEffortTagFromLabel(effort)}` : getEffortTagFromLabel(effort);
    return `${prefix}${spaced.trimEnd()}`;
}
/**
 * Returns a deterministic rule-based effort estimate for the given task text.
 * @param taskText - Task description (without checkbox prefix)
 * @returns Effort level
 */
function estimateEffortRuleBased(taskText) {
    const trimmed = taskText.trim();
    const text = trimmed.toLowerCase();
    const lowKeywords = /\b(email|text|sms|msg|note|rename|tag)\b/;
    const lowShortAction = /\b(pay|file|print|open|check)\b/;
    if (text.length <= 35 && lowKeywords.test(text)) {
        return "low";
    }
    if (lowShortAction.test(text)) {
        return "low";
    }
    const appointmentPattern = /\b(make|book|schedule)\b.*\b(appointment|dentist|doctor|service|meeting)\b/;
    if (appointmentPattern.test(text)) {
        return "medium";
    }
    const callWithNumber = text.includes("call") && /\d{3,}/.test(text);
    if (callWithNumber) {
        return "medium";
    }
    const callAdmin = /\b(call|phone|ring)\b/.test(text);
    if (callAdmin && text.length <= 80) {
        return "medium";
    }
    const multiStepPattern = /\b(set up|setup|assemble|install|configure|migrate|write report|prepare slides|review document)\b/;
    const researchWords = /\b(research|investigate|compare|plan|design)\b/;
    if (multiStepPattern.test(text)) {
        if (researchWords.test(text)) {
            return "high";
        }
        return "medium";
    }
    if (researchWords.test(text)) {
        return "high";
    }
    if (text.length > 80) {
        return "high";
    }
    if (text.length <= 40) {
        return "low";
    }
    if (text.length <= 100) {
        return "medium";
    }
    return "high";
}
function logDebug(settings, message) {
    if (settings.debugLogging) {
        console.debug(`[EffortTags] ${message}`);
    }
}
/**
 * Calls the configured LLM endpoint to label task effort levels in batch.
 * @param tasks - Tasks to classify
 * @param settings - Plugin settings
 * @returns Predictions from the LLM (may be empty if the call fails)
 */
async function estimateEffortWithLLM(tasks, settings) {
    if (!settings.useLLMWhenAvailable || !settings.llmServerUrl || tasks.length === 0) {
        return [];
    }
    const payload = {
        model: settings.llmModel || undefined,
        messages: [
            {
                role: "system",
                content: [
                    "You classify tasks by effort.",
                    "",
                    "INPUT FORMAT:",
                    '- The user will send a single JSON object: { "tasks": [ { "index": number, "text": string }, ... ] }.',
                    '- Each task has a unique numeric "index" and a "text" description.',
                    "",
                    "WHAT TO DO:",
                    "- For each task, decide how much focused effort it will take for the user.",
                    "- Consider only the user's direct work.",
                    "- Ignore waiting time, shipping delays, approvals, other people, etc.",
                    "",
                    "EFFORT LEVELS:",
                    '- "low"    = quick, simple, one-step tasks, usually under 10 minutes.',
                    '- "medium" = small to moderate tasks that may involve a phone call or a few steps.',
                    '- "high"   = bigger or multi-step tasks likely to take 30+ minutes.',
                    "",
                    "OUTPUT FORMAT (VERY IMPORTANT):",
                    '- Respond with a JSON array only.',
                    '- Each element must be: { "index": number, "effort": "low" | "medium" | "high" }.',
                    '- The "index" must exactly match the corresponding input task index.',
                    '- Do NOT add any other properties.',
                    '- Do NOT include any explanations, comments, or markdown.',
                    '- The response must be valid JSON with double quotes and no trailing commas.'
                ].join(" ")
            },
            {
                role: "user",
                // tasks should be: { tasks: [{ index: number, text: string }, ...] }
                content: JSON.stringify({ tasks }, null, 2)
            }
        ]
    };
    if (!payload.model) {
        delete payload.model;
    }
    try {
        logDebug(settings, `Calling LLM with ${tasks.length} task(s)`);
        const response = await fetch(settings.llmServerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            logDebug(settings, `LLM responded with status ${response.status}`);
            return [];
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content ||
            data?.response ||
            data?.choices?.[0]?.content ||
            "";
        if (!content) {
            logDebug(settings, "LLM response did not include content");
            return [];
        }
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch (error) {
            logDebug(settings, `Failed to parse LLM JSON: ${error.message}`);
            return [];
        }
        if (!Array.isArray(parsed)) {
            logDebug(settings, "LLM response is not an array");
            return [];
        }
        const validResults = [];
        for (const entry of parsed) {
            if (typeof entry === "object" &&
                entry !== null &&
                typeof entry.index === "number" &&
                typeof entry.effort === "string") {
                const effort = entry.effort.toLowerCase();
                if (effort === "low" || effort === "medium" || effort === "high") {
                    validResults.push({ index: entry.index, effort });
                }
            }
        }
        logDebug(settings, `LLM returned ${validResults.length} valid prediction(s)`);
        return validResults;
    }
    catch (error) {
        logDebug(settings, `LLM request failed: ${error.message}`);
        return [];
    }
}
