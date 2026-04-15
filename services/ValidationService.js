"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTaskTitle = validateTaskTitle;
exports.validateTaskDescription = validateTaskDescription;
exports.validateTaskDueDate = validateTaskDueDate;
exports.validateTaskScheduled = validateTaskScheduled;
exports.validateTaskTags = validateTaskTags;
exports.validateProjectName = validateProjectName;
/**
 * Strong action verbs that represent clear, physical "next actions" in GTD.
 *
 * These are verbs that describe visible physical actions you can take in the world.
 * Good GTD task titles start with these verbs followed by a concrete object.
 *
 * Examples: "Call dentist", "Review proposal", "Draft report", "Buy groceries"
 */
const STRONG_ACTION_VERBS = new Set([
    // Communication
    "call", "email", "send", "notify", "inform", "ask", "request", "invite",
    "announce", "share", "publish", "post", "message", "text", "chat",
    "discuss", "talk", "speak", "present", "show", "display", "demonstrate",
    // Creation/Modification
    "create", "write", "draft", "edit", "modify", "change", "update", "add",
    "remove", "delete", "build", "make", "construct", "produce", "generate",
    "design", "develop", "compose", "draw", "paint", "sketch",
    // Decision-support / Review (concrete review actions, not decisions)
    "review", "check", "confirm", "verify", "validate", "choose", "select",
    "approve", "reject", "deny", "evaluate", "assess", "analyze", "examine", "inspect",
    // Physical actions
    "eat", "drink", "cook", "bake", "wash", "dry", "fold", "put", "take",
    "give", "get", "walk", "run", "exercise", "stretch", "lift", "carry",
    "grab", "push", "pull", "throw", "catch",
    // Home/Errands
    "clean", "tidy", "vacuum", "mop", "sweep", "pack", "unpack", "charge",
    // Work/Professional
    "plan", "prepare", "research", "learn", "study", "practice", "apply",
    "submit", "file", "test", "debug", "deploy", "release", "launch",
    "organize", "arrange", "sort", "categorize", "prioritize",
    // Financial
    "buy", "order", "pay", "refund", "return", "sell", "purchase", "spend",
    "save", "store", "invest",
    // Movement/Transport
    "move", "transfer", "pick", "drop", "deliver", "collect", "gather",
    "visit", "attend", "join", "leave", "go", "come", "arrive", "depart",
    // Tech/Digital
    "install", "fix", "repair", "backup", "restore", "sync", "upload",
    "download", "copy", "paste", "archive", "export", "import", "scan", "print",
    // Scheduling/Time
    "schedule", "meet", "book", "cancel", "reschedule", "postpone",
    "start", "begin", "continue", "resume", "pause", "stop", "end",
    "complete", "finish",
    // Teaching (concrete teaching actions)
    "teach", "train", "instruct", "explain", "remind",
    // Search/Discovery
    "find", "search", "look", "seek", "discover", "explore", "investigate",
    // Media/Entertainment
    "watch", "listen", "play", "read", "view", "stream",
    // Other concrete actions
    "set", "solve", "resolve", "close", "open", "lock", "unlock",
    "turn", "switch", "press", "click", "upgrade", "downgrade",
    "replace", "assemble", "disassemble"
]);
/**
 * Weak verbs that represent cognitive states, vague actions, or decisions without clear physical actions.
 *
 * Tasks starting with these verbs should trigger a warning suggesting the user
 * rewrite them as concrete physical actions.
 *
 * Examples of bad tasks:
 * - "Decide Xmas costume" → Better: "Review costume options and pick one"
 * - "Remember uniforms" → Better: "Add uniforms to shopping list"
 * - "Use checklist" → Better: "Print deployment checklist"
 * - "Try OSEP lab" → Better: "Start first OSEP lab exercise"
 */
const WEAK_VERBS = new Set([
    // Decision verbs (without clear action)
    "decide", "opt", "prefer", "vote", "elect",
    // Cognitive states
    "understand", "remember", "recall", "forget",
    // Vague helper verbs
    "help", "assist", "support", "use", "utilize",
    "manage", "maintain", "keep", "hold",
    "try", "attempt", "handle"
]);
/**
 * Vague patterns that suggest the task needs more specificity.
 */
const VAGUE_PATTERNS = [
    /^work\s+on\s+/i,
    /^handle\s+/i,
    /^deal\s+with\s+/i,
    /^look\s+into\s+/i,
    /^figure\s+out\s+/i,
    /^think\s+about\s+/i,
    /^consider\s+/i,
    /^check\s+on\s+/i,
    /^sort\s+out\s+/i,
    /^fix\s+up\s+/i,
    /^make\s+sure\s+/i,
    /^ensure\s+/i,
    /^get\s+ready\s+for\s+/i,
    /^prepare\s+for\s+/i,
    /^follow\s+up\s+on\s+/i,
    /^do\s+/i,
    /^get\s+/i,
    /^start\s+(?!.*\b(draft|write|call|email|file|document|project)\b)/i,
    /^continue\s+/i
];
/**
 * Outcome-style patterns (past tense or completed state).
 */
const OUTCOME_PATTERNS = [
    // Simple “state is done” words
    /\b(completed?|finished|done|resolved|solved)\b/i,
    // Common “already happened” verbs for tasks
    /\b(installed|fixed|delivered|shipped|sent|paid|booked|confirmed|approved|signed|implemented|configured|deployed|launched)\b/i,
    // Noun + past participle style: "Report completed", "Dog door installed"
    /\b\w+\s+(completed?|finished|done|installed|fixed|resolved|solved|delivered|shipped|sent|paid|booked|confirmed|approved|signed|implemented|configured|deployed|launched)\b/i,
    // Passive/perfect forms: "was installed", "has been shipped"
    // Note: \w+ed matches past participles, but also matches words like "red", "bed"
    // This is acceptable as false positives are rare and the pattern catches important cases
    /\b(was|were|is|are|has been|have been|had been)\s+\w+ed\b/i,
    // Adjective-style outcomes: "X is complete", "All done", "All set"
    /\b(is|are|looks|seems)\s+(complete|finished|done|all done|all set|ready)\b/i,
    /\b(complete|finished|done|all done|all set|ready)\b$/i
];
/**
 * Patterns that suggest multiple actions when followed by a verb.
 *
 * These patterns are checked to see if they're followed by an action verb,
 * which indicates multiple actions in a single task title.
 *
 * Examples that should trigger:
 * - "Call Pete, ask about Xmas plan" (comma + verb)
 * - "Review costume, then choose final one" (comma + then + verb)
 * - "Pack bag and grab charger" (and + verb)
 * - "Email Libby after confirming details" (after + verb)
 *
 * Examples that should NOT trigger:
 * - "Review T-shirt design, version 2" (comma + noun)
 * - "Email Libby, CC Sammy" (comma + acronym/noun)
 * - "Buy 2x shirts, size M" (comma + descriptor)
 */
const MULTIPLE_ACTION_PATTERNS = [
    // Conjunctions followed by potential verb: "and call", "then email", "also check"
    /\b(and|then|also|plus)\s+([a-z]+)/i,
    // Comma followed by potential verb: ", call", ", email"
    /,\s*([a-z]+)/i,
    // Multi-step signal words followed by potential verb: "after call", "before sending", "next review"
    /\b(after|before|next|follow\s+up\s+by)\s+([a-z]+)/i
];
/**
 * Action-sequencing phrases in descriptions that suggest separate tasks.
 *
 * These patterns capture the next verb after sequencing words/phrases.
 * They detect when descriptions contain multiple actions that should be
 * split into separate tasks.
 *
 * Examples that should trigger:
 * - "then call", "and then email"
 * - "after that call", "afterwards email"
 * - "next call", "follow up by calling"
 * - "finally send", "lastly email"
 *
 * All patterns capture the verb in group 1 for consistent processing.
 */
const DESCRIPTION_ACTION_PATTERNS = [
    // "then call", "and then email" - catches both standalone and "and then"
    /\b(?:and\s+then|then)\s+([a-z]+)/i,
    // "after that call", "afterwards email"
    /\bafter\s+that\s+([a-z]+)/i,
    /\bafterwards\s+([a-z]+)/i,
    // "next call", "next email"
    /\bnext\s+([a-z]+)/i,
    // "follow up by calling/emailing"
    /\bfollow\s+up\s+by\s+([a-z]+)/i,
    // "finally call", "lastly email" - often last step in a mini-process
    /\b(?:finally|lastly)\s+([a-z]+)/i
];
/**
 * Validates a task title against Logic Rules.
 * @param title - Task title to validate
 * @returns Array of validation results
 */
function validateTaskTitle(title) {
    const results = [];
    if (!title || title.trim().length === 0) {
        return results; // Empty title is handled elsewhere
    }
    const trimmed = title.trim();
    const words = trimmed.split(/\s+/);
    const firstWord = words[0].toLowerCase();
    // Rule 1.1: Must start with action verb
    if (!STRONG_ACTION_VERBS.has(firstWord)) {
        // Check if it's a weak verb (cognitive/vague) - these need special warning
        if (WEAK_VERBS.has(firstWord)) {
            results.push({
                rule: "1.1",
                severity: "warning",
                message: `Task starts with a weak verb ("${firstWord}") that hides the real action`,
                suggestion: "Rewrite with a concrete physical action, e.g. 'Review...', 'Call...', 'Draft...', 'Add...'"
            });
        }
        else {
            // Check if it's a common pattern like "Review X" or "Draft Y"
            const isCommonPattern = /^(review|draft|check|read|write|call|email|send|schedule|meet|buy|order)\s+/i.test(trimmed);
            if (!isCommonPattern) {
                results.push({
                    rule: "1.1",
                    severity: "warning",
                    message: "Task name should start with an action verb",
                    suggestion: `Try: "${getSuggestedVerb(trimmed)} ${trimmed}"`
                });
            }
        }
    }
    // Rule 1.2: Must describe one action only
    // Check for multiple action patterns (conjunctions, commas, multi-step signals followed by verbs)
    for (const pattern of MULTIPLE_ACTION_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            // Extract the potential verb (different patterns capture in different positions)
            // Pattern 1 (and|then|also|plus): match[1] = conjunction, match[2] = verb
            // Pattern 2 (comma): match[1] = verb
            // Pattern 3 (after|before|next|follow up by): match[1] = signal word, match[2] = verb
            // If match has 3+ elements (full match + 2+ groups), verb is in [2]
            // If match has 2 elements (full match + 1 group), verb is in [1]
            const verbIndex = match.length >= 3 ? 2 : 1;
            const potentialVerb = match[verbIndex]?.toLowerCase();
            if (potentialVerb && (STRONG_ACTION_VERBS.has(potentialVerb) || WEAK_VERBS.has(potentialVerb))) {
                results.push({
                    rule: "1.2",
                    severity: "warning",
                    message: "Task contains multiple actions",
                    suggestion: "Split into separate tasks"
                });
                break; // Only need to flag once
            }
        }
    }
    // Also check for semicolons (always suggests multiple steps)
    if (trimmed.includes(";")) {
        results.push({
            rule: "1.2",
            severity: "warning",
            message: "Task contains semicolon suggesting multiple steps",
            suggestion: "Consider splitting into separate tasks"
        });
    }
    // Rule 1.3: No vague names
    for (const pattern of VAGUE_PATTERNS) {
        if (pattern.test(trimmed)) {
            results.push({
                rule: "1.3",
                severity: "warning",
                message: "Task name is vague (e.g., 'Work on X', 'Handle Y')",
                suggestion: "Specify the exact action: 'Call dentist to book check-up' instead of 'Work on dentist'"
            });
            break;
        }
    }
    // Check for single noun (1-2 words, no verb)
    if (words.length <= 2 && !STRONG_ACTION_VERBS.has(firstWord) && !WEAK_VERBS.has(firstWord)) {
        // Might be a single noun like "Dentist" or "Xmas"
        results.push({
            rule: "1.3",
            severity: "warning",
            message: "Task name appears to be a single noun or vague phrase",
            suggestion: `Specify the exact action: "Call dentist to book check-up" instead of "${trimmed}"`
        });
    }
    // Rule 1.4: No outcome-style phrasing
    for (const pattern of OUTCOME_PATTERNS) {
        if (pattern.test(trimmed)) {
            results.push({
                rule: "1.4",
                severity: "warning",
                message: "Task name looks like a finished state (e.g., 'Report completed', 'Dog door installed')",
                suggestion: "Convert to a project name and make the task the next action"
            });
            break;
        }
    }
    return results;
}
/**
 * Validates a task description against Logic Rules.
 * @param description - Task description to validate
 * @returns Array of validation results
 */
function validateTaskDescription(description) {
    const results = [];
    if (!description || description.trim().length === 0) {
        return results;
    }
    // Rule 2.1: Description is for details, not actions
    for (const pattern of DESCRIPTION_ACTION_PATTERNS) {
        if (pattern.test(description)) {
            const match = description.match(pattern);
            if (match && (STRONG_ACTION_VERBS.has(match[1].toLowerCase()) || WEAK_VERBS.has(match[1].toLowerCase()))) {
                results.push({
                    rule: "2.1",
                    severity: "warning",
                    message: "Description includes actionable verbs (e.g., 'then call...', 'after that email...')",
                    suggestion: "These should become separate tasks, not part of the description"
                });
                break;
            }
        }
    }
    // Also check for multiple actions in description (similar to title validation)
    // Use the same patterns as title validation
    for (const pattern of MULTIPLE_ACTION_PATTERNS) {
        const match = description.match(pattern);
        if (match) {
            // Extract the potential verb (different patterns capture in different positions)
            // Pattern 1 (and|then|also|plus): match[1] = conjunction, match[2] = verb
            // Pattern 2 (comma): match[1] = verb
            // Pattern 3 (after|before|next|follow up by): match[1] = signal word, match[2] = verb
            const verbIndex = match.length >= 3 ? 2 : 1;
            const potentialVerb = match[verbIndex]?.toLowerCase();
            if (potentialVerb && (STRONG_ACTION_VERBS.has(potentialVerb) || WEAK_VERBS.has(potentialVerb))) {
                results.push({
                    rule: "2.1",
                    severity: "warning",
                    message: "Description contains multiple actions",
                    suggestion: "These should become separate tasks, not part of the description"
                });
                break; // Only need to flag once
            }
        }
    }
    // Check for semicolons suggesting multiple steps
    if (description.includes(";")) {
        results.push({
            rule: "2.1",
            severity: "warning",
            message: "Description contains semicolon suggesting multiple steps",
            suggestion: "These should become separate tasks, not part of the description"
        });
    }
    // Check for action verbs followed by objects in description
    const lines = description.split("\n");
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0)
            continue;
        // Check if line starts with action verb
        const firstWord = trimmedLine.split(/\s+/)[0].toLowerCase();
        if ((STRONG_ACTION_VERBS.has(firstWord) || WEAK_VERBS.has(firstWord)) && trimmedLine.length > firstWord.length + 5) {
            // Has verb and object, might be an action
            results.push({
                rule: "2.1",
                severity: "info",
                message: "Description contains action verbs - ensure these aren't separate tasks",
                suggestion: "If this describes a separate action, create a new task instead"
            });
            break;
        }
    }
    return results;
}
/**
 * Validates a task due date against Logic Rules.
 * @param due - Due date value (ISO format or natural language)
 * @param title - Task title for context
 * @returns Array of validation results
 */
function validateTaskDueDate(due, title) {
    const results = [];
    if (!due || due.trim().length === 0) {
        return results;
    }
    // Rule 3.2: Suggest using scheduled:: for day-specific actions
    // We can't automatically determine if it's a hard deadline vs day-specific,
    // so we show this as info when due date is set
    if (title) {
        const titleLower = title.toLowerCase();
        // Check for day-specific patterns
        const daySpecificPatterns = [
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
            /\b(bring|take|pick up|drop off)\s+/i,
            /\b(on|for)\s+\w+\s+(morning|afternoon|evening|day)\b/i
        ];
        for (const pattern of daySpecificPatterns) {
            if (pattern.test(titleLower)) {
                results.push({
                    rule: "3.2",
                    severity: "info",
                    message: "This looks like a day-specific action",
                    suggestion: "Consider using 'scheduled::' instead of 'due::' for day-specific items without hard deadlines"
                });
                break;
            }
        }
    }
    return results;
}
/**
 * Validates a task scheduled date.
 * @param scheduled - Scheduled date value (ISO format or natural language)
 * @returns Array of validation results
 */
function validateTaskScheduled(scheduled) {
    const results = [];
    if (!scheduled || scheduled.trim().length === 0) {
        return results;
    }
    // Basic format validation is handled by parseNLDate in CaptureModal
    // This is a placeholder for future rule-based validation
    return results;
}
/**
 * Validates task tags against Logic Rules.
 * @param tags - Array of tag strings
 * @param waitingForTag - The waiting-for tag to check for
 * @returns Array of validation results
 */
function validateTaskTags(tags, waitingForTag) {
    const results = [];
    if (!tags || tags.length === 0) {
        return results;
    }
    // Rule 5.1: Waiting-for tag should include who/what in description
    // We can't check description here, but we can note the tag is present
    const hasWaitingFor = tags.some(tag => tag.toLowerCase() === waitingForTag.toLowerCase() ||
        tag.toLowerCase() === waitingForTag.replace("#", "").toLowerCase());
    if (hasWaitingFor) {
        results.push({
            rule: "5.1",
            severity: "info",
            message: "Task is tagged as waiting-for",
            suggestion: "Ensure the description includes who/what you're waiting for"
        });
    }
    return results;
}
/**
 * Validates a project name against Logic Rules.
 * @param name - Project name to validate
 * @returns Array of validation results
 */
function validateProjectName(name) {
    const results = [];
    if (!name || name.trim().length === 0) {
        return results;
    }
    const trimmed = name.trim();
    // Rule 6.1: Outcome-based naming
    // Check if name doesn't reflect a finished state
    const outcomePatterns = [
        /\b(complete|completed|finished|done|launched|installed|implemented|delivered)\b/i
    ];
    let hasOutcome = false;
    for (const pattern of outcomePatterns) {
        if (pattern.test(trimmed)) {
            hasOutcome = true;
            break;
        }
    }
    if (!hasOutcome && trimmed.length > 0) {
        // Check if it's just a topic (single word or vague)
        const words = trimmed.split(/\s+/);
        if (words.length <= 2 && !hasOutcome) {
            results.push({
                rule: "6.1",
                severity: "info",
                message: "Project name might benefit from outcome-based naming",
                suggestion: `Consider: "Completed ${trimmed}" or "${trimmed}Launched" to reflect finished state`
            });
        }
    }
    // Rule 6.2: Avoid vague project names
    const vagueProjectPatterns = [
        /^(website|pricing|canopy|project|task|work)$/i
    ];
    for (const pattern of vagueProjectPatterns) {
        if (pattern.test(trimmed)) {
            results.push({
                rule: "6.2",
                severity: "warning",
                message: "Project name is vague (just a topic)",
                suggestion: "Ask: 'What do I want done?' and rewrite with specific outcome"
            });
            break;
        }
    }
    return results;
}
/**
 * Gets a suggested action verb for a task title based on context.
 * Uses keyword matching to infer the most appropriate action verb.
 * @param title - Current task title
 * @returns Suggested verb
 */
function getSuggestedVerb(title) {
    const lower = title.toLowerCase();
    const words = lower.split(/\s+/);
    // Communication & People
    if (lower.match(/\b(dentist|doctor|therapist|lawyer|accountant|plumber|electrician|contractor|client|customer|vendor|supplier|contact|person|someone|anyone)\b/)) {
        return "Call";
    }
    if (lower.match(/\b(email|message|text|sms|notification|announcement|update|newsletter)\b/)) {
        return "Send";
    }
    if (lower.match(/\b(meeting|appointment|call|conference|interview|call|zoom|teams|skype)\b/)) {
        return "Schedule";
    }
    if (lower.match(/\b(invite|invitation|rsvp|event|party|gathering)\b/)) {
        return "Invite";
    }
    if (lower.match(/\b(question|ask|inquiry|request|help|assistance)\b/)) {
        return "Ask";
    }
    // Documents & Writing
    if (lower.match(/\b(report|document|memo|letter|note|summary|brief|proposal|plan|outline|draft|manuscript|article|blog|post|content)\b/)) {
        return "Draft";
    }
    if (lower.match(/\b(edit|revision|rewrite|proofread|grammar|spelling)\b/)) {
        return "Edit";
    }
    if (lower.match(/\b(review|read|examine|check|verify|validate|audit)\b/)) {
        return "Review";
    }
    // Purchases & Shopping
    if (lower.match(/\b(buy|purchase|order|shop|shopping|groceries|items|products|supplies|materials|equipment|tools)\b/)) {
        return "Buy";
    }
    if (lower.match(/\b(return|refund|exchange|warranty)\b/)) {
        return "Return";
    }
    if (lower.match(/\b(pay|payment|invoice|bill|fee|cost|price|expense)\b/)) {
        return "Pay";
    }
    // Travel & Transportation
    if (lower.match(/\b(travel|trip|vacation|holiday|flight|ticket|hotel|booking|reservation|airline|airport)\b/)) {
        return "Book";
    }
    if (lower.match(/\b(pickup|pick up|collect|grab|get|fetch)\b/)) {
        return "Pick";
    }
    if (lower.match(/\b(deliver|delivery|ship|package|parcel|mail)\b/)) {
        return "Deliver";
    }
    // Home & Maintenance
    if (lower.match(/\b(clean|cleaning|tidy|organize|declutter|laundry|wash|dishes|vacuum|mop|sweep)\b/)) {
        return "Clean";
    }
    if (lower.match(/\b(repair|fix|broken|damaged|maintenance|service|install|installation|setup|set up)\b/)) {
        return "Fix";
    }
    if (lower.match(/\b(cook|dinner|lunch|breakfast|meal|recipe|food|bake|prepare)\b/)) {
        return "Cook";
    }
    if (lower.match(/\b(pack|unpack|bag|luggage|suitcase|move|moving|relocate)\b/)) {
        return "Pack";
    }
    // Work & Professional
    if (lower.match(/\b(project|task|work|assignment|job|deadline|milestone)\b/)) {
        return "Plan";
    }
    if (lower.match(/\b(research|study|learn|investigate|explore|analyze|analysis)\b/)) {
        return "Research";
    }
    if (lower.match(/\b(present|presentation|pitch|demo|demonstration|show)\b/)) {
        return "Present";
    }
    if (lower.match(/\b(interview|candidate|hiring|recruit|recruitment)\b/)) {
        return "Interview";
    }
    if (lower.match(/\b(training|teach|learn|course|workshop|seminar)\b/)) {
        return "Attend";
    }
    // Technology & Digital
    if (lower.match(/\b(software|app|application|program|code|script|update|upgrade|install|download)\b/)) {
        return "Install";
    }
    if (lower.match(/\b(backup|save|store|archive|export|import|sync|synchronize)\b/)) {
        return "Backup";
    }
    if (lower.match(/\b(test|testing|qa|quality|bug|debug|error|issue)\b/)) {
        return "Test";
    }
    if (lower.match(/\b(deploy|deployment|release|launch|publish|go live)\b/)) {
        return "Deploy";
    }
    if (lower.match(/\b(website|site|page|url|domain|hosting)\b/)) {
        return "Update";
    }
    // Health & Fitness
    if (lower.match(/\b(exercise|workout|gym|run|jog|walk|yoga|stretch|fitness|health)\b/)) {
        return "Exercise";
    }
    if (lower.match(/\b(appointment|checkup|exam|medical|health|doctor|dentist)\b/)) {
        return "Schedule";
    }
    // Financial & Legal
    if (lower.match(/\b(tax|return|filing|irs|accountant|financial|budget|expense)\b/)) {
        return "File";
    }
    if (lower.match(/\b(contract|agreement|legal|document|sign|signature)\b/)) {
        return "Review";
    }
    if (lower.match(/\b(invest|investment|savings|retirement|401k|portfolio)\b/)) {
        return "Review";
    }
    // Education & Learning
    if (lower.match(/\b(read|book|article|chapter|paper|study|learn|course|class)\b/)) {
        return "Read";
    }
    if (lower.match(/\b(watch|video|movie|film|tutorial|webinar|stream)\b/)) {
        return "Watch";
    }
    if (lower.match(/\b(listen|podcast|audio|music|audiobook)\b/)) {
        return "Listen";
    }
    // Decision & Selection
    if (lower.match(/\b(choose|select|pick|decide|option|choice|preference|decision)\b/)) {
        return "Choose";
    }
    if (lower.match(/\b(compare|comparison|options|alternatives|versus|vs)\b/)) {
        return "Compare";
    }
    // Organization & Planning
    if (lower.match(/\b(organize|sort|arrange|categorize|prioritize|list|inventory)\b/)) {
        return "Organize";
    }
    if (lower.match(/\b(plan|planning|strategy|roadmap|timeline|schedule)\b/)) {
        return "Plan";
    }
    // Search & Discovery
    if (lower.match(/\b(find|search|look|seek|discover|locate|missing|lost)\b/)) {
        return "Find";
    }
    // Default suggestions based on common patterns
    // If title is very short (1-2 words), suggest common verbs
    if (words.length <= 2) {
        const commonVerbs = ["Review", "Check", "Update", "Complete", "Finish"];
        // Use title length to pick a suggestion (simple hash)
        const index = title.length % commonVerbs.length;
        return commonVerbs[index];
    }
    // Default for longer titles
    return "Review";
}
