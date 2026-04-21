# GeckoTask

GeckoTask is an Obsidian plugin that turns your notes into a complete task management system. It lets you quickly capture tasks, organize them by area and project, plan with due/scheduled dates and recurrence, and manage work through dedicated Tasks, Weekly Review, and Health Check panels. Everything is stored in plain Markdown files with inline fields (`due::`, `priority::`, `scheduled::`, `recur::`), so your tasks are easy to edit, portable across tools, and ready for Dataview queries.

## Quick Start in 5 Minutes

1. Install and enable GeckoTask in Obsidian.
2. Open `Settings -> GeckoTask` and set your `Area paths` (for example: `Personal, Work`).
3. Run `GeckoTask: Create Project File` and create your first project under an area.
4. Run `GeckoTask: Quick Add/Edit Task` (or press `Mod+Shift+E`) to capture a task.
5. Open `GeckoTask: Open Tasks Panel` to triage and edit tasks.
6. Run `GeckoTask: Open Weekly Review Panel` to process inbox and review projects.
7. Run `GeckoTask: Open Health Check Panel` to catch stale items and cleanup opportunities.

## What It Does

- Tasks side panel with tabs, filters, inline edits, and quick actions
- Weekly Review panel with guided GTD-style steps
- Health Check panel for stale items, quick wins, and cleanup signals
- Quick capture/edit modal from command palette or hotkey
- Recurring task support (`🔁 every ...`) with automatic next occurrence creation
- Metadata styling in preview and source modes for faster scanning

## Panels at a Glance

GeckoTask has three primary panels, each with a distinct job:

### Tasks Panel (daily execution)
- Use this during the day to decide what to do now, next, and soon.
- Best for triage, filtering, quick edits, moving tasks, and completing work.
- Open with `GeckoTask: Open Tasks Panel`.

### Weekly Review Panel (weekly system maintenance)
- Use this once a week (or more) to run a structured GTD-style review.
- Best for processing inbox, reviewing projects, checking waiting-for items, and generating new commitments.
- Open with `GeckoTask: Open Weekly Review Panel`.

### Health Check Panel (diagnostics and cleanup)
- Use this to identify drift and system quality issues across your task base.
- Best for spotting stale tasks/files, inbox overflow, oversized task titles, and quick wins.
- Open with `GeckoTask: Open Health Check Panel`.

## Current Task Storage Model

GeckoTask infers area/project from file path (not from `project::` metadata). The structure is designed to align with PARA:

- **Projects**: `{Area}/1Projects/{ProjectName}/`
- **Areas**: top-level folders listed in `Area paths` (for example `Personal`, `Work`)
- **Resources**: keep outside GeckoTask-managed task files, or in separate notes linked from tasks
- **Archive**: keep outside active task paths (migration can move old task archive to `tasks-archive/`)

Current structure is root-based:

```text
/
├── Inbox/                                    # one file per inbox item
│   ├── call-bank.md
│   └── follow-up-vendor.md
├── Personal/                                 # area (configured in settings)
│   ├── 1Projects/
│   │   └── RouterRevamp/
│   │       ├── _tasks.md
│   │       └── _SomedayMaybe.md
│   └── 2Areas/
│       ├── _tasks.md
│       └── _SomedayMaybe.md
└── Work/
    └── 1Projects/...
```

Default naming is configurable:
- `projectsSubfolder`: `1Projects`
- `areaTasksSubfolder`: `2Areas`
- `tasksFileName`: `_tasks`
- `somedayMaybeFileName`: `_SomedayMaybe`
- `inboxFolderName`: `Inbox`

## Task Format

```markdown
- [ ] Write router tests #work priority:: high due:: 2026-04-24 scheduled:: 2026-04-22
  Optional multi-line description line 1
  Optional multi-line description line 2
```

Recurring examples:

```markdown
- [ ] Team sync 🔁 every Tuesday due:: 2026-04-28
- [ ] Backup docs 🔁 every 10 days
```

When a recurring task is completed, GeckoTask inserts the next occurrence directly below it.

## Natural Language Dates

GeckoTask supports natural language date input for task date fields when `Natural language due parsing` is enabled in settings.

You can use natural language in:
- `GeckoTask: Set Due (at cursor)`
- `GeckoTask: Set Scheduled (at cursor)`
- quick capture/edit flows when entering date fields

### Examples

- `today` -> current date
- `tomorrow` -> current date + 1 day
- `next monday` -> next upcoming Monday
- `in 3 days` -> current date + 3 days
- `in 2 weeks` -> current date + 14 days
- `2026-05-01` -> explicit ISO date (kept as-is)

If a phrase cannot be parsed, GeckoTask keeps your input value so you can still store explicit date text.

## Tasks Panel

The Tasks panel is the daily command center for GeckoTask.

### Tabs
- **Now**: tasks due today/overdue plus tasks tagged with your configured `Now tag`
- **Next**: next-action focused view
- **Inbox**: items located in the inbox folder
- **Waiting**: tasks tagged with your configured waiting-for tag
- **All Tasks**: full list with all filters

### Filtering and Editing
- Filter by area, project path, priority, due bucket, and text query
- Click task title to edit inline
- Click field badges to update `due`, `scheduled`, `priority`, or recurrence
- Open task in note, move to another file, or toggle completion from the panel

### Behavior
- Auto-refreshes on vault and metadata changes
- Can hide/show completed tasks based on settings
- Supports multi-line task descriptions

## Commands

### Panels
- `GeckoTask: Open Tasks Panel`
- `GeckoTask: Open Weekly Review Panel`
- `GeckoTask: Open Health Check Panel`

### Task Actions
- `GeckoTask: Quick Add/Edit Task` (hotkey: `Mod+Shift+E`)
- `GeckoTask: Complete/Uncomplete Task at Cursor`
- `GeckoTask: Move Task (pick project)`
- `GeckoTask: Set Due (at cursor)`
- `GeckoTask: Set Scheduled (at cursor)`
- `GeckoTask: Set Priority (at cursor)`
- `GeckoTask: Set Recurrence (at cursor)`
- `GeckoTask: Add/Remove Tags (at cursor)`
- `GeckoTask: Normalize Task Line (at cursor)`
- `GeckoTask: Delete Completed Tasks (current file)`

### Project and Migration
- `GeckoTask: Create Project File`
- `GeckoTask: Migrate from old tasks folder structure`

## Weekly Review

Weekly Review is a guided GTD-style flow covering:
- **Get Clear**: collect and process loose ends/inbox
- **Get Current**: review actions, projects, waiting-for, and someday/maybe
- **Get Creative**: brainstorm and capture new opportunities

### Overview

The Weekly Review follows a three-phase structure:

**Phase 1: Get Clear** (Collect and process)
- **Step 1A**: Collect loose ends from physical items, email, and custom collection points
- **Step 1B**: Empty your head - capture worries, postponements, and small wins
- **Step 1C**: Process your inbox - review and organize all inbox tasks

**Phase 2: Get Current** (Review and update)
- **Step 2A**: Review next actions - review tasks due in the next few days
- **Step 2B**: Review calendar (past) - review past calendar events
- **Step 2C**: Review calendar (future) - review upcoming calendar events
- **Step 2D**: Review projects - review all active projects and their tasks
- **Step 2E**: Review waiting-for items - review tasks tagged with your waiting-for tag
- **Step 2F**: Review someday/maybe - review projects and tasks in someday/maybe folders

**Phase 3: Get Creative** (Brainstorm)
- **Step 3A**: Brainstorm - capture new ideas, projects, and opportunities

### Features

- **Progress tracking**: See which steps you've completed and your overall progress
- **State persistence**: Your review state is saved automatically, so you can pause and resume
- **Task actions**: Complete, delete, move to project, move to someday/maybe, update due dates, and more
- **Project review**: Review projects with task counts and quick actions
- **Notes capture**: Capture notes for each step (loose ends, calendar events, brainstorm ideas)
- **Auto-refresh**: Panel updates automatically when your vault changes

### Accessing Weekly Review

- Use the command **GeckoTask: Open Weekly Review Panel** from the command palette
- The panel opens as a side panel view
- Your progress is saved automatically - you can close and reopen without losing your place

## Health Check

The **Health Check Panel** analyzes your entire task system to identify issues, opportunities, and areas for improvement.

### What It Analyzes

**Metrics:**
- Total active tasks
- Tasks by area
- Overdue tasks count
- Urgent and high priority tasks
- Tasks with no due date
- Projects with high task counts

**Issues Identified:**
- **Stale Tasks**: Tasks that haven't been modified or reviewed in a while
- **Quick Wins**: Tasks that might be quick to complete (based on keywords)
- **Must-Move Items**: Tasks that should be moved (e.g., inbox overflow, tasks in wrong locations)
- **Oversized Tasks**: Tasks with very long titles that might need breaking down
- **Tasks Needing Breakdown**: Tasks with keywords suggesting they're actually multiple tasks
- **Recurring Issues**: Problems with recurring task patterns
- **Cleanup Suggestions**: Recommendations for archiving, organizing, or cleaning up

### Features

- **Comprehensive analysis**: Scans all tasks across your vault
- **Actionable insights**: Each issue includes actions you can take (complete, edit, move, etc.)
- **Task tracking**: Tracks when tasks were created, modified, and reviewed
- **Configurable thresholds**: Adjust sensitivity in settings (stale days, quick win keywords, etc.)
- **Hide dismissed items**: Hide tasks you've already addressed
- **Refresh on demand**: Manually refresh the analysis anytime

### Accessing Health Check

- Use the command **GeckoTask: Open Health Check Panel** from the command palette
- The panel opens as a side panel view
- Click "Refresh" to re-analyze your tasks

### Health Check Settings

Configure in **Settings → GeckoTask**:
- **Stale file days**: Files not modified in this time are considered stale (default: 90)
- **Stale task days**: Tasks with no due date older than this (default: 90)
- **Unmodified task days**: Tasks not modified in this time (default: 60)
- **Quick win keywords**: Keywords that indicate quick wins (default: ["order", "book", "cancel", etc.])
- **High task count**: Threshold for high task count projects (default: 30)
- **Inbox threshold**: Threshold for inbox overflow (default: 20)
- **Breakdown title length**: Title length threshold for tasks needing breakdown (default: 100)

Thresholds and keyword lists are configurable in settings.

## Settings

Open `Settings -> GeckoTask`.

### Areas and Structure
- Area paths (`Personal, Work, ...`)
- Projects subfolder
- Area tasks subfolder
- Task file name
- Someday/Maybe file name

### Inbox and Display
- Inbox folder name
- Show completed tasks

### Task Options
- Natural language date parsing
- Allowed priorities
- Due date ranges

### Weekly Review
- Custom collection points
- Waiting For tag
- Now tag
- Next actions due days

### Health Check
- Stale file threshold (days)
- Stale task threshold (days)
- Unmodified task threshold (days)
- Quick win keywords
- High task count threshold
- Inbox overflow threshold
- Breakdown title length threshold
- Breakdown keywords

## Recommended Settings

These are practical starting points for most users.

### Suggested baseline
- **Area paths**: `Personal, Work` (add more only when they represent true responsibility domains)
- **Projects subfolder**: `1Projects`
- **Area tasks subfolder**: `2Areas`
- **Task file name**: `_tasks`
- **Someday/Maybe file name**: `_SomedayMaybe`
- **Inbox folder name**: `Inbox`
- **Show completed tasks**: `off` (turn on when reviewing completed flow)
- **Natural language date parsing**: `on`
- **Allowed priorities**: `low, med, high, urgent`
- **Due date ranges**: `7d, 14d, 30d, 60d, 90d`
- **Waiting For tag**: `#WaitingFor`
- **Now tag**: `#t/now`
- **Next actions due days**: `3`

### Suggested Health Check thresholds
- **Stale file threshold**: `90` days
- **Stale task threshold**: `90` days
- **Unmodified task threshold**: `60` days
- **High task count threshold**: `30`
- **Inbox overflow threshold**: `20`
- **Breakdown title length threshold**: `100`

### Suggested profile adjustments
- **Lighter system (few active projects)**: lower `Inbox overflow` to `10-15`, lower `High task count` to `15-20`
- **Heavy workload (many parallel projects)**: raise `High task count` to `40-60`, keep stale thresholds similar
- **Strict weekly cadence**: reduce `Unmodified task threshold` to `30-45` to surface drift earlier

## Installation

### Manual
1. Download release assets (`main.js`, `manifest.json`, `styles.css`) from the [GitHub releases page](https://github.com/geckom/GeckoTask/releases).
2. Copy them into `<your-vault>/.obsidian/plugins/geckotask/`.
3. Reload Obsidian and enable GeckoTask in Community Plugins.

### Community Plugins Browser
If GeckoTask is published in the Obsidian community catalog, install it from `Settings -> Community plugins -> Browse`.

## Development

### Prerequisites
- Node.js 18+
- npm

### Local Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

Build output is `main.js` in repo root (alongside `manifest.json` and `styles.css`).

## Dataview Examples

Because GeckoTask stores standard markdown tasks with inline fields, Dataview works well out of the box.

Today's tasks:

````markdown
```dataview
task
where !completed and due = date(today)
sort due asc
```
````

Overdue tasks:

````markdown
```dataview
task
where !completed and due < date(today)
sort due asc
```
````

Tasks by priority:

````markdown
```dataview
table priority, due
from ""
where !completed
sort priority desc, due asc
```
````

## Notes on Migration

If you used an older `tasks/`-centered layout, run the migration command. It:
- creates `tasks-backup/` first,
- converts old task locations into the current area/project structure,
- moves old `Archive` to `tasks-archive` when needed.

## License

MIT (see `LICENSE`).
