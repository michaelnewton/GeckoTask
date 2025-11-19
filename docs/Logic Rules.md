
# Logic Rules

## 1. Task Name Rules
**Goal:** Short sentence that describes a **single, physical action** and starts with a verb.

**Implementation Note:** The plugin does not enforce these rules automatically. These are guidelines for users to follow when creating tasks. The plugin's health check feature may identify tasks that violate these rules (e.g., tasks with "and" in the title suggesting multiple actions).

### Logic Rules
1. **Must start with an action verb.**
    - IF name does not start with a verb  
        → THEN rewrite as `Verb + object`
    - Examples: “Call”, “Email”, “Review”, “Draft”, “Test”, “Book”, “Update”.
2. **Must describe one action only.**
    - IF name contains “and” / multiple distinct actions  
        → THEN split into multiple tasks.
3. **No vague names.**
    - IF name is a single noun (“Dentist”, “Xmas”) or vague phrase (“Work on report”)  
        → THEN rewrite to specify the exact action (“Call dentist to book check-up”).
4. **No outcome-style phrasing for tasks.**
    - IF name looks like a finished state (“Report completed”, “Dog door installed”)  
        → THEN convert that to a **project name** and make the task the next action.
## 2. Task Description Rules
**Goal:** Optional field for extra context, not a second task.

**Implementation Note:** The plugin supports multi-line descriptions stored as indented lines below the task. The plugin does not enforce that descriptions contain no actionable verbs - this is a user guideline.

### Logic Rules
1. **Description is for details, not actions.**
    - IF description includes new actionable verbs (“then call…”, “after that email…”)  
        → THEN those should become **separate tasks**, not description.
2. **Keep task name clean; put clutter in description.**
    - Put links, email quotes, explanation, assumptions in description.
3. **If description is empty but context is needed to understand the task.**
    - THEN move clarifying info from name into description and keep name short.
## 3. Task Due Date Rules
**Goal:** Only use due dates for _real_ deadlines or day-specific actions.
### Logic Rules
1. **Hard deadlines only.**
    - IF missing the date has external consequences (legal, client, event, booking, expiry)  
        → THEN set due date.
2. **Day-specific reminders.**
    - IF the task must happen on a specific day (e.g., "Bring Alex's form to school on Monday")  
        → THEN set that date.
3. **No "fake" motivational due dates.**
    - IF user wording is "I'd like to do this by…", "hopefully by…", "target date"  
        → THEN store as **optional target** or note – NOT a hard due date.
4. **If unclear, default: no due date.**

**Implementation Note:** The plugin supports a `scheduled:: YYYY-MM-DD` field (separate from `due::`) for tasks that are tied to a specific date but may not have a hard deadline. The scheduled field is now available in the GUI (capture modal, task display, and commands). Use `due::` for deadlines and `scheduled::` for day-specific actions or calendar items.

### Calendar Rules (Specific)
**Goal:** Calendar is sacred territory - only hard landscape items.
### Logic Rules
1. **Calendar contains ONLY three types of items:**
    - **Time-specific actions:** Appointments with specific times (e.g., "10:00-11:00 meet with Jim")
    - **Day-specific actions:** Must happen on that day, but not at specific time (e.g., "Call Rachel Tuesday")
    - **Day-specific information:** Useful to know on that day (directions, events, reminders)
2. **What does NOT go on calendar:**
    - IF task doesn't have hard deadline or day-specific requirement  
        → THEN do NOT put on calendar (use action lists instead)
    - Daily to-do lists should NOT be on calendar
3. **Calendar is sacred territory.**
    - IF something is on calendar  
        → THEN it must get done that day or be moved/changed
    - Calendar should be trusted as the "hard landscape" of the day
## 4. Task Priority Rules
(GTD doesn't love priority flags, but your system has **now / soon / later** style.)

**Implementation Note:** The plugin supports configurable priority values (default: `low`, `med`, `high`, `urgent`). Priority is stored as a field (`priority:: <value>`) and can be set via the capture modal, task display, or commands. Priority values are customizable in plugin settings.

### Logic Rules
1. **High priority (“now” / “focus” / equivalent):**
    - IF task is:
        - time-sensitive **and** within next 1–3 days, OR
        - critical for a project with upcoming deadline, OR
        - small and unblocked and you explicitly want it surfaced  
            → THEN mark as `priority = high`.
2. **Medium priority (“soon”):**
    - IF task is important but no immediate deadline  
        → THEN `priority = medium`.
3. **Low priority (“later / someday-ish”):**
    - IF task has no urgency and low impact  
        → THEN `priority = low` or move to project backlog / Someday/Maybe.
## 5. Task Tag/Label Rules
(e.g. `now`, `waitingfor`, `someday`, etc.)
Think of this as **status / lane**.

**Implementation Note:** The plugin uses a mix of tags and folder-based organization:
- **Tags:** `#WaitingFor` (configurable, default `#WaitingFor`) and `#t/now` (configurable, default `#t/now`) are implemented as tags
- **Folders:** `Someday Maybe/` folder per area (not a tag) - tasks in this folder are treated as someday/maybe items
- **Fields:** `scheduled:: YYYY-MM-DD` is a field (not a tag) for calendar/day-specific items
- **Not implemented:** `agenda`, `read/review`, and `reference` tags are not currently implemented in the plugin

### Core Status Tags
- `now` / `next` – do-able next actions (implemented as configurable tag, default `#t/now`)
- `waitingfor` – blocked on someone/something else (implemented as configurable tag, default `#WaitingFor`)
- `someday` – not committed yet (implemented as `Someday Maybe/` folder per area, not a tag)
- `scheduled` – tied to calendar or date (implemented as `scheduled:: YYYY-MM-DD` field, not a tag)
- `reference` – not really a task (should be converted) - **not implemented**
- `agenda` – requires real-time conversation with specific person or meeting - **not implemented**
- `read/review` – requires reading > 2 minutes - **not implemented**
### Logic Rules
1. **`waitingfor`:**
    - IF the task is blocked by another person, event, delivery, or decision  
        → THEN tag as `waitingfor` and include who/what in description.
    - **Implementation:** Use the configurable waiting-for tag (default `#WaitingFor`). The plugin has a "Waiting" tab that filters tasks with this tag.
2. **`now` / `next`:**
    - IF the task is:
        - actionable now
        - not blocked
        - and is the **next logical step** in a project or a standalone task  
            → THEN tag as `now`.
    - **Implementation:** Use the configurable now tag (default `#t/now`). Tasks with this tag appear in the "Now" tab along with tasks due today or overdue.
3. **`someday`:**
    - IF task is optional, idea-like, "would be nice"  
        → THEN move to Someday/Maybe or tag `someday`.
    - IF Someday/Maybe item becomes committed  
        → THEN move to Projects list
    - **Implementation:** Move tasks to the `Someday Maybe/` folder within the appropriate area (not a tag). The plugin treats files in this folder as someday/maybe items.
4. **`scheduled`:**
    - IF task is tied tightly to a date/time (meeting, travel, event)  
        → THEN ensure it's on calendar and set `scheduled:: YYYY-MM-DD` field.
    - **Implementation:** Use the `scheduled:: YYYY-MM-DD` field (not a tag). This field is available in the capture modal, task display, and can be set via command. Use this for day-specific actions that should appear on a calendar.
5. **`agenda`:**
    - IF action requires real-time conversation with specific person  
        → THEN add to that person's Agenda list (or tag as `agenda:[person]`)
    - IF action needs to be discussed in standing meeting  
        → THEN add to that meeting's Agenda list (or tag as `agenda:[meeting]`)
    - **Implementation:** Not currently implemented. As a workaround, you could use a custom tag like `#agenda:[person]` or create a project file for each person's agenda.
6. **`read/review`:**
    - IF item requires reading > 2 minutes  
        → THEN put in Read/Review stack/tray (or tag as `read/review`)
    - IF item is quick skim (< 2 minutes)  
        → THEN process immediately using 2-minute rule (don't tag)
    - **Implementation:** Not currently implemented. As a workaround, you could use a custom tag like `#read/review` or create a project file for reading items.
## 6. Project Name Rules
**Goal:** Name describes **completed outcome**.
### Logic Rules
1. **Outcome-based naming.**
    - IF project name doesn't reflect a finished state  
        → THEN rewrite to "Completed [outcome]".
2. **Avoid vague project names.**
    - IF project name is just a topic ("Website", "Pricing", "Canopy")  
        → THEN ask: "What do I want done?" and rewrite.

**Implementation Note:** In the plugin, projects are file-based. Each project is a `.md` file (e.g., `RouterRevamp.md`) in an area folder (e.g., `tasks/Work/`). The project name is derived from the file basename. Outcome-based naming is recommended but not enforced by the plugin. When creating a project file, consider using outcome-based names like "RouterRevampComplete" or "WebsiteLaunched" rather than just "RouterRevamp" or "Website".
## 7. Project Resources Rules
**Goal:** Keep all support material attached to the project, but separate from tasks.

**Implementation Note:** In the plugin, project files are `.md` files that can contain both tasks and support material. You can add notes, links, and other content above or below the tasks section in the project file. The plugin does not enforce separation - this is a user guideline.

### Logic Rules
1. **What counts as resources:**
    - Emails, screenshots, docs, notes, URLs, meeting notes.
2. **Where to store:**
    - IF item is directly supporting a project  
        → THEN link/store it under that project’s “Resources / Support” section.
    - ELSE IF item is generic knowledge  
        → THEN store in global **Reference** area.
3. **No actions in resources.**
    - IF a resource contains “we need to…”, “I should…”, “remember to…”  
        → THEN extract as tasks and leave the rest as reference.
## 8. References – When to Use, What to Store, Where

**Implementation Note:** A formal reference filing system is not currently implemented in the plugin. As a workaround, you can:
- Use a `#reference` tag on tasks that should be converted to reference items
- Create a separate folder structure outside the tasks folder for reference materials
- Store reference items in project files as support material (see Section 7)

### When to Use Reference
1. **Non-actionable but might be useful later.**
    - IF item has no next action but could be helpful for future decisions or work  
        → THEN store as reference.
2. **Information only.**
    - IF the user just needs to _know_ it, not _do_ anything  
        → Reference.
3. **Historical records.**
    - Meeting notes, past emails, config notes, logs.
### What to Sort
- Docs by **area / topic / project**
- Emails by **project/area**
- Links by **topic tags**
### Where
- IF tied to a specific project  
    → File under that project's support material.
- ELSE  
    → File under a general **Resources** or **Reference** section, grouped by area (Home, Work, Kids, etc.).
### Reference Filing System Requirements
**Goal:** Reference system must be fast, functional, and fun to use.
### Logic Rules
1. **Accessibility requirement.**
    - IF item requires no action but has potential value  
        → THEN file in reference system
    - Reference system must be accessible within 60 seconds
    - IF filing takes longer than 60 seconds  
        → THEN user will stack/accumulate instead of filing
2. **Easy creation.**
    - System must allow easy creation of new folders/files
    - IF creating new folder/file is difficult  
        → THEN user will resist filing
3. **Organization method.**
    - Use alphabetical or topic-based organization
    - One general-reference system (A-Z) is preferred over multiple systems
    - IF item requires more than 50 folders for one topic  
        → THEN consider separate section/drawer for that topic
4. **Storage space.**
    - Keep file drawers less than 75% full
    - IF drawer is overstuffed  
        → THEN user will unconsciously resist filing
    - Digital: Ensure sufficient storage space to avoid attention on storage limits
## 9. Weekly Review Rules
**Goal:** Ensure system is clean, current, and complete.

**Implementation Note:** The plugin includes a Weekly Review panel that guides users through the weekly review process. The panel includes steps for collecting loose ends, processing inbox, reviewing next actions, reviewing projects, reviewing waiting-for items, and reviewing someday/maybe items.

### Weekly Review Steps (Logic)
1. **Inbox zero:**
    - Process all inboxes using `classify_item()` rules.
2. **Review all projects:**
    - FOR each active project:
        - IF project has no clear outcome → fix name/outcome.
        - IF project has no next action → create one.
        - IF project is no longer relevant → mark as completed or archive.
3. **Review calendars (past + next week):**
    - Extract any follow-up actions from past days.
    - Add prep tasks for upcoming events.
4. **Review Waiting For list:**
    - FOR each waiting item:
        - IF overdue or aging → create follow-up action or ping.
5. **Review Someday/Maybe:**
    - Promote some to active projects/tasks.
    - Prune anything that’s no longer interesting.
## 10. Daily Review Rules
**Goal:** Short focus check for _today_.

**Implementation Note:** The plugin's "Now" tab shows tasks due today or overdue, plus tasks tagged with the now tag. This serves as a daily focus view. The plugin does not enforce a formal daily review process - this is a user guideline.

### Daily Review Steps (Logic)
1. **Review calendar for today + tomorrow.**
    - Ensure prep tasks exist (e.g. “Print forms”, “Pack costume”).
2. **Review “now/next” tasks.**
    - Filter by context (e.g., @work, @home).
    - Choose 3–5 key tasks as **today’s focus**.
3. **Check Waiting For briefly.**
    - IF something becomes unblocked today  
        → Add corresponding next action.
4. **Capture & clean quickly.**
    - Add any new tasks that came up that day.
## 11. "When Task Becomes Project" Rules (Extra, but important)

**Implementation Note:** The plugin does not automatically detect when a task should become a project. Users must manually create a project file and move tasks to it. The plugin's health check may identify tasks that look like projects (e.g., tasks with long titles or keywords suggesting multiple actions).

### Logic Rules
1. **More than one step = project.**
    - IF fulfilling the task requires multiple steps  
        → Convert task to project.
2. **Multi-day or multi-person = project.**
    - IF it spans multiple days or involves multiple people  
        → Project.
3. **If task keeps getting delayed.**
    - IF you keep avoiding it / rewriting it  
        → It's probably a fuzzy project → clarify outcome + create next action.
4. **Project definition (specific).**
    - Project = any desired result requiring more than one action step, accomplishable within one year
    - IF outcome requires only one action  
        → THEN it's a task, not a project
    - IF outcome requires multiple actions  
        → THEN it's a project
## 12. Processing Workflow Rules
**Goal:** Process items from "in" systematically and completely.

**Implementation Note:** The plugin provides an Inbox file (configurable, default `tasks/Inbox.md`) for capturing tasks quickly. The plugin does not enforce processing order or prevent putting items back in the inbox - these are user guidelines. The Weekly Review panel includes a step for processing the inbox.

### Logic Rules
1. **Process top item first.**
    - IF processing items from inbox/in-tray  
        → THEN always process the top item first (never skip items)
    - Process in order, even if lower items seem more important
2. **Process one item at a time.**
    - IF processing inbox  
        → THEN take out only one item at a time
    - Exception: IF user needs to shift focus temporarily to make decision  
        → THEN allow 2-3 items out, but process all within 1-2 minutes
3. **Never put anything back into "in".**
    - IF item has been picked up from "in"  
        → THEN it must be processed and moved elsewhere (never returned to "in")
    - One-way path: in → processed → organized
4. **Handle oversized items.**
    - IF item is too big to fit in in-tray  
        → THEN write a note on letter-size paper representing it and put note in in-tray
    - Date the note for reference
5. **The 2-Minute Rule.**
    - IF action takes less than 2 minutes  
        → THEN do it immediately (don't track it in system)
    - IF action takes 2+ minutes  
        → THEN track it in system (delegate or defer)
    - Note: 2 minutes is a guideline; can be adjusted to 1-5 minutes based on context
## 13. Actionable Decision Rules
**Goal:** Determine if item requires action and how to handle it.

**Implementation Note:** The plugin does not automatically classify items as actionable or non-actionable. Users must make these decisions when creating tasks. The plugin supports the workflow by providing tags (waiting-for) and folders (someday/maybe) for different categories.

### Logic Rules
1. **Is it actionable?**
    - IF item requires action  
        → THEN determine next action (see rule 2)
    - IF item requires no action  
        → THEN categorize as: trash, incubate, or reference
2. **Do It, Delegate It, or Defer It.**
    - IF next action takes < 2 minutes  
        → THEN do it now (use 2-minute rule)
    - IF next action takes 2+ minutes AND you're not the right person to do it  
        → THEN delegate it (track in Waiting For list with date and who/what)
    - IF next action takes 2+ minutes AND you are the right person  
        → THEN defer it (add to appropriate action list by context)
3. **Next action must be physical and visible.**
    - IF action is vague ("set meeting", "handle situation")  
        → THEN clarify to specific physical action ("Call John to schedule meeting", "Email Susan to get input on proposal")
    - IF action requires decision-making  
        → THEN identify physical activity to facilitate decision ("Call Susan to get input on proposal")
4. **Non-actionable categories.**
    - **Trash:** IF item has no potential future action or reference value  
        → THEN delete/trash it
    - **Incubate:** IF item needs no action now but might later  
        → THEN use Someday/Maybe OR calendar tickler for future date
    - **Reference:** IF item requires no action but has potential value  
        → THEN file in reference system
5. **Trash decision.**
    - IF unsure whether to keep item  
        → THEN apply user preference: "when in doubt, throw it out" OR "when in doubt, keep it"
## 14. Context Organization Rules
**Goal:** Organize actions by the context (tool/location/person) required to complete them.

**Implementation Note:** The plugin does not enforce context-based organization. Users can use tags (e.g., `#computer`, `#phone`, `#home`) to organize by context, but the plugin does not provide dedicated context filtering. The search/filter functionality can be used to filter by tags.

### Logic Rules
1. **Organize by required context.**
    - IF action requires specific tool/location  
        → THEN organize by context (@computer, @phone, @home, @errands, @office)
    - IF action can be done anywhere  
        → THEN use @anywhere context
    - IF action requires specific person for real-time conversation  
        → THEN use Agenda list for that person (not context tag)
2. **Common context categories.**
    - **@computer:** Actions requiring computer (drafting, research, data entry)
    - **@phone:** Actions requiring phone (calls, voice messages)
    - **@home:** Actions that can only be done at home
    - **@office:** Actions that can only be done at office
    - **@errands:** Actions requiring being out and about (shopping, bank, post office)
    - **@anywhere:** Actions that can be done anywhere (thinking, planning, reviewing)
3. **Context helps with energy and time matching.**
    - When in @computer context, review @computer list
    - When have phone available, review @phone list
    - When running errands, review @errands list
4. **Creative context sorting.**
    - User can create custom contexts based on their needs
    - Examples: @creative-writing, @before-trip, @brain-gone (simple tasks), @less-than-5-min
    - Contexts can be based on emotional reward, area of focus, or other criteria
5. **Context forces next-action clarity.**
    - Organizing by context requires determining the specific next physical action
    - IF action is vague  
        → THEN cannot determine context → must clarify action first
## 15. Delegation and Waiting For Rules
**Goal:** Track items delegated to others and ensure follow-up.

**Implementation Note:** The plugin supports waiting-for items via a configurable tag (default `#WaitingFor`). The plugin has a "Waiting" tab that shows all tasks with this tag. The plugin does not enforce date tracking on waiting-for items, but users should include the date and who/what in the task description. The Weekly Review panel includes a step for reviewing waiting-for items.

### Logic Rules
1. **When to delegate.**
    - IF next action takes 2+ minutes AND you're not the right person to do it  
        → THEN delegate it to appropriate person
    - IF next action is someone else's responsibility  
        → THEN track in Waiting For list
2. **Waiting For list requirements.**
    - Must include **date** when item was delegated/requested
    - Must include **who/what** is being waited for
    - Must include **what** is being waited for (deliverable, decision, response, etc.)
3. **Tracking delegated items.**
    - IF you delegate an action and care about the result  
        → THEN track it in Waiting For list
    - IF next action is on someone else's plate  
        → THEN track in Waiting For list (even if you didn't explicitly delegate)
4. **Follow-up logic.**
    - IF waiting item becomes overdue or aging  
        → THEN create follow-up action or ping
    - Review Waiting For list regularly (at least weekly)
    - IF waiting item becomes unblocked  
        → THEN add corresponding next action to appropriate list
5. **Date tracking importance.**
    - Always record date on everything delegated
    - Date is crucial for follow-up conversations ("I called and ordered that on March 12")
    - IF date is missing  
        → THEN add current date when creating Waiting For entry
