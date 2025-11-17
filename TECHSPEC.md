# Obsidian Plugin Tech Spec — "GeckoTask" (Custom Tasks + Dataview)

**Owner:** Matt  
**Scope:** Single Obsidian plugin that manages task capture, metadata, movement, archiving, and UI actions, while **Dataview** handles list/table rendering.  
**Goal:** Replace Todoist with Markdown-first tasks that are easy to edit on iOS/macOS/desktop, sync via Obsidian Sync/Syncthing/Git, and remain user-friendly.

---

## 1) Objectives & Non-Goals

### Objectives

* Plain-Markdown tasks (`- [ ] ...`) with consistent **inline metadata** readable by **Dataview**.
* **Areas** (folder-based, e.g., `tasks/Work/`, `tasks/Personal/`) and **Projects** (per-project files) with **Inbox** support.
* Fast capture (command palette / hotkeys / modal), easy **move between projects**.
* **Archiving** completed tasks with source context kept.
* **GeckoTask Panel** side view for browsing, filtering, and managing tasks.
* A few opinionated **commands/UI actions** (no heavy UI framework).
* **Multi-line descriptions** stored as indented lines below task lines.

### Non-Goals

* Not re-implementing Dataview (we rely on it for displays).
* Not building a full web UI—**everything** happens inside Obsidian.
* No complex kanban/board views in v1 (Dataview tables/lists are enough).
* No ULID/ID tracking per task (not implemented in v1).

---

## 2) Vault Layout & Conventions

```
/
├── tasks/
│   ├── Inbox.md                    # Single inbox for all areas
│   ├── Work/
│   │   ├── <ProjectA>.md
│   │   └── <ProjectB>.md
│   ├── Personal/
│   │   └── <ProjectX>.md
│   └── General.md                  # General tasks (no project shown)
├── Archive/
│   ├── Completed-YYYY.md           # Monthly or quarterly archives
└── Dashboards/
    └── Tasks.md
```

* **Base folder:** `tasks/` (configurable via settings).
* **Areas:** folder-based under `tasks/` (e.g., `tasks/Work/`, `tasks/Personal/`).
* **Per-project files:** one Markdown file per active project within area folders or directly under `tasks/`.
* **Inbox:** single inbox file at `tasks/Inbox.md` (configurable path).
* **General tasks file:** `tasks/General.md` (configurable name) for tasks without a project.
* **Archive:** plugin moves completed tasks here on schedule or command.

---

## 3) Task Format & Metadata Schema

### Task Line (single source of truth)

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15  project:: RouterRevamp
```

**Rules**

* Everything stays on **one line** for easy grep/edit and mobile compatibility.
* Fields: `due::`, `scheduled::` (optional, not used in UI), `priority:: <string>` (configurable list),
  `recur:: <pattern>` or `🔁 <pattern>` (recurrence pattern, Tasks plugin compatible), `tags` via `#hashtag`.
* **@ Labels:** Tasks can include @ labels (e.g., `@ppl/Libby`, `@person/Name`) in titles or descriptions. These are automatically styled in markdown preview and extracted for display in the GeckoTask Panel.
* **Area is NOT stored in metadata** — it's derived from folder structure.
* **Project is NOT stored in metadata for regular project files** — it's derived from the file basename (e.g., `tasks/Work/RouterRevamp.md` → project: `RouterRevamp`). For special files (Inbox, General), project is undefined.
* On completion, append `completion:: YYYY-MM-DD`.
* **Recurring tasks:** When a recurring task is completed, the plugin automatically creates the next occurrence with an updated due date.
* **Multi-line descriptions** are stored as indented lines (2+ spaces) below the task line.

**Example with description:**

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15  project:: RouterRevamp
  This is a multi-line description.
  It can span multiple lines.
  Empty lines are preserved for spacing.
```

**Rationale:** Inline metadata is the most robust with Dataview and mobile editing. Folder-based areas simplify organization and avoid metadata duplication.

---

## 4) Core Workflows

### A) Capture

* **Trigger:** Command Palette → "GeckoTask: Quick Add Task"
* **UI:** Modal with fields: *Title*, Description (optional, multi-line), Area (optional dropdown; if none, goes to inbox), Project (file picker), Due (natural language), Priority, Tags.
* **Write to:** Selected project file or inbox; append as a new task line with optional description.

### B) Move Task Between Projects

* **Trigger:** Cursor on a task → "GeckoTask: Move Task (pick project)" or from GeckoTask Panel → "Move" button
* **UI:** Quick picker of target project file within tasks folder structure.
* **Action:** Cut task line and description lines, paste at end of target file, preserve metadata, update `project::` if needed. Area is inferred from target folder.

### C) Complete & Archive

* **Complete:** Toggle `[ ]` → `[x]` via command or GeckoTask Panel checkbox. Plugin appends `completion:: YYYY-MM-DD`.
* **Recurring tasks:** When a recurring task is completed, the plugin automatically creates the next occurrence with the calculated next due date based on the recurrence pattern.
* **Archive policy:**
  * **Manual:** "GeckoTask: Archive Completed in Current File"
  * **Global:** "GeckoTask: Archive All Completed (older than N days)" (configurable)
* **Archive requirements:** Only tasks that are both checked (`[x]`) and have a `completion::` field are archived.
* **Archive format:** Move lines to `Archive/Completed-YYYY.md`, append `origin_file::`, `origin_project::`, `origin_area::` if missing.

### D) Edit Metadata Quickly

* Commands: "Set Due (at cursor)", "Set Priority (at cursor)", "Set Recurrence (at cursor)", "Add/Remove Tags (at cursor)", "Set Project (at cursor)". Operate on the task under cursor.
* **GeckoTask Panel:** Click badges to edit due date, priority, recurrence, title (inline editing). Click description icon to toggle description visibility.

### E) GeckoTask Panel

* **Trigger:** Command Palette → "GeckoTask: Open GeckoTask Panel" or ribbon icon
* **Features:**
  * Browse all open tasks in tasks folder structure
  * Filter by area, project, priority, due date (today, 7d, overdue, none), search query
  * Toggle completion via checkbox
  * Edit title inline
  * Edit due date and priority via clickable badges
  * Open task in note (scrolls to line)
  * Move task to different project

---

## 5) Dataview Dashboards (Examples)

Create `Dashboards/Tasks.md`:

````markdown
# Task Dashboard

## Today
```dataview
task from "tasks"
where !completed and due = date(today)
sort priority desc, due asc
```

## Next 7 Days (Work)

```dataview
task from "tasks/Work"
where !completed and due <= date(today) + dur(7 days)
sort due asc
```

## Overdue (All)

```dataview
task from "tasks"
where !completed and due < date(today)
sort due asc
```

## By Project (Work)

```dataview
table file.link as Project, rows
from "tasks/Work"
where !completed
group by project
```
````

> **Note:** The plugin guarantees consistent inline fields so Dataview queries remain simple and fast.

---

## 6) Commands (v1)

* **GeckoTask: Open GeckoTask Panel** (opens side panel)
* **GeckoTask: Quick Add Task** (modal)
* **GeckoTask: Complete/Uncomplete Task at Cursor** (toggle + add `completion::`)
* **GeckoTask: Move Task (pick project)** (quick picker)
* **GeckoTask: Set Due (at cursor)** (natural-language parse → ISO date)
* **GeckoTask: Set Priority (at cursor)**
* **GeckoTask: Set Recurrence (at cursor)** (set recurrence pattern like "every Tuesday", "every 10 days")
* **GeckoTask: Add/Remove Tags (at cursor)**
* **GeckoTask: Set Project (at cursor)**
* **GeckoTask: Archive Completed in Current File**
* **GeckoTask: Archive All Completed (older than N days)**
* **GeckoTask: Create Project File** (scaffold with frontmatter)
* **GeckoTask: Normalize Task Line (at cursor)** (ensure metadata order & spacing)

Hotkeys configurable in Obsidian.

---

## 7) Settings UI (v1)

* **Tasks folder:** Base folder for all tasks (default: `tasks`)
* **Areas:** Comma-separated list of area folder names (e.g., `Work, Personal`). Leave empty for no areas.
* **Inbox path:** Path to single inbox file (default: `tasks/Inbox`, without .md extension)
* **General tasks file:** File name for general tasks without project (default: `General`, without .md extension)
* **Archive file pattern:** `Archive/Completed-YYYY.md` (YYYY replaced with year)
* **Archive threshold:** `N` days (default 7)
* **Natural language due parsing:** on/off (default on)
* **Allowed priorities:** Comma-separated list (default: `low, med, high, urgent`)
* **Due date ranges:** Comma-separated list of configurable due date ranges for filter dropdown (default: `7d, 14d, 30d, 60d, 90d`)

---

## 8) Architecture

### Tech

* **TypeScript**, Obsidian Plugin API.
* **No external UI framework** (use Obsidian `Modal`, `Setting`, `Notice`, `ItemView`).
* **No ULID library** (not implemented in v1).

### Key Modules

* `main.ts`
  * Plugin entry point, lifecycle management, command registration
* `TaskModel.ts`
  * `parseTask(line: string): Task | null`
  * `formatTask(task: Task): string`
  * `parseTaskWithDescription(lines: string[], startLine: number): { task: Task | null, endLine: number }`
  * `formatTaskWithDescription(task: Task): string[]`
  * `withField(task: Task, key: keyof Task, value?: string): Task`
* `VaultIO.ts`
  * `moveTaskAtCursorInteractive(app, editor, settings)`
  * `createProjectFile(app, settings)`
* `TaskOps.ts`
  * `toggleCompleteAtCursor(editor, view, settings)` - handles recurring task regeneration
  * `setFieldAtCursor(app, editor, key, settings)` - supports "recur" key
  * `addRemoveTagsAtCursor(app, editor, settings)`
  * `normalizeTaskLine(editor)`
* `Recurrence.ts`
  * `calculateNextOccurrence(pattern, fromDate)` - calculates next occurrence date from recurrence pattern
  * `isValidRecurrencePattern(pattern)` - validates recurrence patterns
* `CaptureModal.ts`
  * `captureQuickTask(app, settings)` — UI modal for task capture
* `Archive.ts`
  * `archiveCompletedInFile(app, file, settings)`
  * `archiveAllCompletedInVault(app, settings)`
* `NLDate.ts`
  * `parseNLDate(input: string): string | undefined` — minimal date parsing ("today", "tomorrow", "next mon", "in 3d")
* `TasksPanel.ts`
  * `TasksPanel` — side panel view for browsing and managing tasks
* `areaUtils.ts`
  * `inferAreaFromPath(filePath, settings): string | undefined`
  * `isInTasksFolder(filePath, settings): boolean`
  * `getAreaPath(area, settings): string`
  * `normalizeInboxPath(path): string`
  * `isSpecialFile(filePath, settings): boolean`
* `settings.ts`
  * `GeckoTaskSettings` interface and `GeckoTaskSettingTab`

### Interfaces

```ts
export interface Task {
  checked: boolean;           // [ ] or [x]
  title: string;              // free text before fields/tags
  description?: string;       // Multi-line description stored on subsequent indented lines
  tags: string[];             // #tag
  due?: string;               // YYYY-MM-DD
  scheduled?: string;         // YYYY-MM-DD (optional, not used in UI)
  priority?: string;          // Dynamic from settings.allowedPriorities
  recur?: string;             // Recurrence pattern (e.g., "every Tuesday", "every 10 days")
  project?: string;
  area?: string;              // NOT stored in metadata, derived from folder
  completed?: string;         // YYYY-MM-DD
  origin_file?: string;       // set at archive time if missing
  origin_project?: string;    // set at archive time if missing
  origin_area?: string;       // set at archive time if missing
  raw: string;                // original line for diffing
  lineNo?: number;            // optional: position in file for edits
}

export interface GeckoTaskSettings {
  tasksFolder: string;                // e.g., "tasks"
  areas: string[];                     // e.g., ["Work","Personal"] - folder names under tasksFolder
  inboxPath: string;                   // e.g., "tasks/Inbox" - single inbox (without .md)
  generalTasksFile: string;            // e.g., "General" - file name for general tasks
  archivePattern: string;              // "Archive/Completed-YYYY.md"
  archiveOlderThanDays: number;        // 7
  allowedPriorities: string[];         // ["low","med","high","urgent"]
  nlDateParsing: boolean;              // true
  dueDateRanges: string[];             // ["7d", "14d", "30d", "60d", "90d"] - configurable due date ranges for filter dropdown
}
```

---

## 9) File Scaffolds

**New Project file template**

```markdown
---
area: Work
project: RouterRevamp
created: 2025-11-07
---

# RouterRevamp

> Project notes here.

## Tasks
<!-- New tasks appended below -->
```

**Inbox template**

```markdown
# Inbox

<!-- New tasks appended below -->
```

**General tasks file template**

```markdown
# General Tasks

<!-- New tasks appended below -->
```

---

## 10) Archiving Details

* Archive file chosen via pattern `Archive/Completed-YYYY.md` (YYYY replaced with current year).
* **Archive requirements:** Only tasks that are both checked (`[x]`) and have a `completion::` field are archived.
* When archiving a task, ensure it includes:
  * `completion:: YYYY-MM-DD` (if missing, set now)
  * `origin_file:: <path>`
  * `origin_project:: <project>`
  * `origin_area:: <area>` (inferred from folder)
* Remove original line and description lines from source file.

---

## 11) Sync Considerations

* **Obsidian Sync / Syncthing / Git** are all compatible.
* Avoid background watchers beyond Obsidian's own events.
* GeckoTask Panel auto-refreshes on vault changes (debounced).

---

## 12) Performance & Safety

* Parse only the current file when invoking actions; avoid scanning entire vault except when the user explicitly runs a global command (archive all) or GeckoTask Panel reindexes.
* Every write:
  * Read file → transform specific line(s) by position → write back.
  * Use `vault.process()` for atomic edits where possible.
* GeckoTask Panel indexes files in tasks folder structure and caches task metadata.

---

## 13) Edge Cases

* **Conflicts (simultaneous edits):** Best effort—operate on latest file content; if target line not found by position, re-scan and prompt to resolve.
* **Cross-area moves:** Area is inferred from target folder; `project::` updated if target is not a special file.
* **Multi-line descriptions:** Preserved when moving, archiving, or editing tasks.

---

## 14) Acceptance Criteria

* Capture modal creates tasks with requested fields in the correct file.
* Move command relocates the exact task (by position) preserving metadata and description.
* Complete command toggles checkbox and sets `completion::` date if newly completed.
* Archive (file & global) moves completed tasks and appends origin fields.
* GeckoTask Panel displays all open tasks with filtering and editing capabilities.
* Dataview examples in §5 render correctly with no extra configuration.
* Settings allow changing tasks folder, areas, inbox path, and archive pattern.
* Works on iOS/desktop with plain Markdown editing (no desktop-only dependencies).

---

## 15) Implementation Status

✅ **Implemented:**
1. Plugin entry, settings tab, commands
2. `TaskModel`, `VaultIO`, `TaskOps`, `Archive`, `NLDate`, `Recurrence`, `areaUtils`
3. Capture modal → append to inbox/project
4. Complete toggle → add `completion::` date
5. Recurring tasks → automatic next occurrence generation on completion
6. Move by position → target project
7. Archive in current file → archive all
8. Settings & validation
9. GeckoTask Panel side view with filtering and editing

❌ **Not Implemented:**
* ULID/ID tracking per task
* Scheduled field in UI
* Per-area inboxes (uses single inbox)

---

## 16) GeckoTask Panel Details

The Tasks Panel (`TasksPanel.ts`) provides a side view for managing tasks:

* **Indexing:** Scans all markdown files in tasks folder structure, parses tasks with descriptions
* **Tabs:** Two tabs available:
  * "Today" - Shows tasks due today or overdue (due filter hidden)
  * "All Tasks" - Shows all tasks with full filtering options
* **Filtering:** By area, project, priority, due date window, search query
  * **Due date filters:** Fixed options (any, today, overdue, none), configurable day ranges from settings (e.g., 7d, 14d, 30d, 60d, 90d), and relative periods (this-week, next-week, this-month, next-month)
  * **Search:** Searches task titles and tags
* **Sorting:** By due date (asc), priority rank (from settings order), area, project, title
* **Actions:**
  * Checkbox to toggle completion (handles recurring task regeneration)
  * Click title to edit inline
  * Click due badge to set/change due date
  * Click priority badge to set/change priority (dropdown selector)
  * Click recurrence badge (🔁) to set/change recurrence pattern
  * Click description icon (📄) to toggle description visibility
  * "Edit" button to open full edit modal
  * "Open" button to open task in note (scrolls to line)
  * "Move" button to move task to different project
* **Recurrence display:** Shows recurrence pattern (🔁) badge for recurring tasks
* **Description support:** Multi-line descriptions can be toggled visible/hidden via icon
* **@ Label extraction:** Extracts @ labels from both task tags and descriptions for display
* **Mobile features:** Touch device detection, tap-to-reveal action buttons on mobile
* **Auto-refresh:** Debounced refresh on vault changes

---

## 17) Example Dataview Snippets (ready to paste)

**All active tasks (both areas)**

````markdown
```dataview
task from "tasks"
where !completed
sort due asc
```
````

**Work + Today**

````markdown
```dataview
task from "tasks/Work"
where !completed and due = date(today)
sort priority desc, due asc
```
````

**Archive audit (by origin)**

````markdown
```dataview
table completed, origin_area, origin_project, origin_file
from "Archive"
where completed
sort completed desc
```
````

---

## 18) Build & Dev Notes

* **Build:** `npm install && npm run build`
* **Dev:** `npm run dev` (watch mode)
* **Release:** zip `manifest.json`, `main.js`, `styles.css` (if any)
* **Dependencies:** keep zero or minimal; no heavy UI libs.
* **Package manager:** npm (required for this project)

## 20) Markdown Styling

The plugin automatically styles task metadata and @ labels in markdown files:

* **Markdown Preview:** Task metadata fields (e.g., `priority::`, `due::`) and @ labels (e.g., `@ppl/Libby`) are wrapped in styled spans for visual distinction
* **Source/Editing Mode:** CodeMirror decorations are applied to task metadata fields in source view
* **Styling class:** Files in the tasks folder structure receive the `mod-geckotask-styled` class for CSS targeting
* **Styling scope:** Only files within the configured tasks folder structure are styled

---

## 19) Notes on Design Decisions

* **Folder-based areas:** Areas are inferred from folder structure rather than stored in metadata. This simplifies organization and avoids metadata duplication.
* **Folder-based projects:** Projects are inferred from file basename for regular project files, not stored in metadata. This avoids metadata duplication and keeps tasks simple.
* **Single inbox:** One inbox file for all areas, with optional area selection during capture.
* **General tasks file:** Special file name for tasks without a project (similar to inbox).
* **Multi-line descriptions:** Supported via indented lines below task line for richer task context.
* **@ Labels:** Support for @ labels (e.g., `@ppl/Libby`) in titles and descriptions, styled in markdown preview and extracted for panel display.
* **No ULID/ID:** Not implemented in v1; tasks are identified by file path and line number.
* **GeckoTask Panel:** Provides rich UI for task management without requiring Dataview knowledge.
* **Styling:** Task metadata fields and @ labels are automatically styled in both markdown preview and source/editing mode for better visual distinction.
