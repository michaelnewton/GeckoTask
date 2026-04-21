# GeckoTask

GeckoTask is an Obsidian plugin that turns notes into a practical task system. It helps you capture tasks fast, organize work by area and project, plan with due and scheduled dates, and review everything in dedicated Tasks, Weekly Review, and Health Check panels.

Everything stays in plain Markdown with inline fields (`due::`, `priority::`, `scheduled::`, `recur::`), so tasks remain portable, editable, and Dataview-friendly.

GeckoTask is for Obsidian users who want a GTD-friendly workflow without leaving the vault.

## Quick Install

### Manual Install
GeckoTask is not in the Obsidian Community Plugins catalog yet, and release assets are not published yet.

1. Clone this repository locally.
2. Build the plugin artifacts:
   ```bash
   npm install
   npm run build
   ```
3. Copy `main.js`, `manifest.json`, and `styles.css` into `<your-vault>/.obsidian/plugins/geckotask/`.
4. Reload Obsidian and enable GeckoTask in `Settings -> Community plugins`.

For updates, rebuild and replace all three files together so versions stay in sync.

## Quick Start in 5 Minutes

### Prerequisites
- Obsidian is installed and your target vault is open.
- GeckoTask is installed and enabled.

### Setup Flow
1. Open `Settings -> GeckoTask`.
2. Set `Area paths` (for example: `Personal, Work`).
3. Run `GeckoTask: Create Project File` and create your first project.
4. Run `GeckoTask: Quick Add/Edit Task` (hotkey: `Mod+Shift+E`) and capture a task.
5. Open `GeckoTask: Open Tasks Panel` and triage or edit that task.
6. Run `GeckoTask: Open Weekly Review Panel` for weekly maintenance.
7. Run `GeckoTask: Open Health Check Panel` to find cleanup opportunities.
8. Verify success: your first task appears in the Tasks panel and opens in its source note.

### First Task Lifecycle
`capture -> set due/scheduled -> execute -> complete -> auto-generate next (if recurring)`

### Troubleshooting Quick Checks
- Plugin not visible: confirm GeckoTask is enabled in `Settings -> Community plugins`.
- Panels not opening: run commands from the command palette and verify exact command names.
- Tasks not showing: make sure tasks are unchecked Markdown tasks (`- [ ]`) in configured areas or inbox.
- Wrong area/project assignment: verify file paths match your configured `Area paths` and subfolder names.

## Core Concepts

### Task Format
```markdown
- [ ] Write router tests #work priority:: high due:: 2026-04-24 scheduled:: 2026-04-22
  Optional multi-line description line 1
  Optional multi-line description line 2
```

### Recurrence
```markdown
- [ ] Team sync 🔁 every Tuesday due:: 2026-04-28
- [ ] Backup docs 🔁 every 10 days
```

When you complete a recurring task, GeckoTask inserts the next occurrence directly below it.

### Storage Model
GeckoTask infers area and project from file path (not `project::` metadata).

- **Projects**: `{Area}/1Projects/{ProjectName}/`
- **Areas**: top-level folders listed in `Area paths`
- **Inbox**: dedicated folder for unprocessed items

Example structure:

```text
/
├── Inbox/
├── Personal/
│   ├── 1Projects/
│   │   └── RouterRevamp/
│   │       ├── _tasks.md
│   │       └── _SomedayMaybe.md
│   └── 2Areas/
└── Work/
    └── 1Projects/...
```

Default names are configurable:
- `projectsSubfolder`: `1Projects`
- `areaTasksSubfolder`: `2Areas`
- `tasksFileName`: `_tasks`
- `somedayMaybeFileName`: `_SomedayMaybe`
- `inboxFolderName`: `Inbox`

GeckoTask reads area/project context from these paths, so keep folder names stable after setup.

## Features Overview

- Tasks side panel with tabs, filters, inline edits, and quick actions
- Weekly Review panel with GTD-style review flow
- Health Check panel for stale items, quick wins, and cleanup signals
- Quick Add/Edit modal from command palette or hotkey
- Recurring task support with automatic next-occurrence creation
- Markdown-native storage model that works with Dataview and normal note editing

## Panels at a Glance

### Tasks Panel (Daily Execution)
- Use for daily triage, filtering, inline edits, and completion.
- Open with `GeckoTask: Open Tasks Panel`.

### Weekly Review Panel (Weekly Maintenance)
- Use weekly to process inbox, review projects, and align commitments.
- Open with `GeckoTask: Open Weekly Review Panel`.

### Health Check Panel (Diagnostics and Cleanup)
- Use to detect drift, stale items, and structural cleanup opportunities.
- Open with `GeckoTask: Open Health Check Panel`.

## In-Depth Guides

### Tasks Panel
The Tasks panel is your daily command center.

**Tabs**
- **Now**: due today/overdue plus tasks tagged with `Now tag`
- **Next**: next-action-focused view
- **Inbox**: tasks located in the inbox folder
- **Waiting**: tasks tagged with your waiting-for tag
- **All Tasks**: full list with all filters

**Filtering and editing**
- Filter by area, project path, priority, due bucket, and text query
- Click title to edit inline
- Click field badges to edit `due`, `scheduled`, `priority`, or recurrence
- Open task in note, move it to another file, or toggle completion

**Behavior**
- Auto-refreshes on vault and metadata changes
- Supports multi-line task descriptions
- Can hide completed tasks based on settings

### Weekly Review
Weekly Review follows three GTD-style phases:

- **Get Clear**: collect loose ends, empty your head, process inbox
- **Get Current**: review actions, calendar context, projects, waiting-for, someday/maybe
- **Get Creative**: capture ideas and new opportunities

It includes progress tracking, step notes, task/project actions, and saved review state.

Typical weekly flow:
- Collect loose inputs from your custom collection points
- Convert inbox items into next actions or project tasks
- Review active projects and ensure each has at least one clear next action
- Reprioritize waiting-for and someday/maybe items
- Capture new commitments for the coming week

### Health Check
Health Check scans your task system and surfaces actionable issues.

**Metrics**
- Total active tasks
- Tasks by area
- Overdue tasks
- Urgent/high-priority tasks
- Tasks without due dates
- High-task-count projects

**Common issue categories**
- Stale tasks/files
- Quick wins
- Must-move items (for example inbox overflow)
- Oversized or breakdown-needed tasks
- Recurring-pattern issues
- Cleanup suggestions

Configure thresholds in `Settings -> GeckoTask` under Health Check settings.

Recommended use:
- Run weekly after review to catch drift early
- Run after major project planning sessions to rebalance workload
- Dismiss low-value findings and focus on repeated patterns

### Settings
Open `Settings -> GeckoTask`.

**Areas and structure**
- Area paths
- Projects subfolder
- Area tasks subfolder
- Task file name
- Someday/Maybe file name

**Inbox and display**
- Inbox folder name
- Show completed tasks

**Task options**
- Natural language date parsing
- Allowed priorities
- Due date ranges

**Weekly Review**
- Custom collection points
- Waiting For tag
- Now tag
- Next actions due days

**Health Check**
- Stale file/task thresholds
- Unmodified task threshold
- Quick win keywords
- High task count threshold
- Inbox overflow threshold
- Breakdown title length and keywords

Settings changes apply immediately or on the next panel refresh.

## Commands Reference

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

### Project
- `GeckoTask: Create Project File`

## Advanced

### Natural Language Dates
When `Natural language due parsing` is enabled, you can enter natural language in:
- `GeckoTask: Set Due (at cursor)`
- `GeckoTask: Set Scheduled (at cursor)`
- Quick Add/Edit date fields

Examples:
- `today`
- `tomorrow`
- `next monday`
- `in 3 days`
- `in 2 weeks`
- `2026-05-01`

If a phrase cannot be parsed, GeckoTask preserves your original input.

Tip: use ISO dates (`YYYY-MM-DD`) when you need exact, reproducible values across devices and locales.

### Recommended Settings
Suggested baseline:
- Area paths: `Personal, Work`
- Projects subfolder: `1Projects`
- Area tasks subfolder: `2Areas`
- Task file name: `_tasks`
- Someday/Maybe file name: `_SomedayMaybe`
- Inbox folder name: `Inbox`
- Show completed tasks: `off`
- Natural language date parsing: `on`
- Allowed priorities: `low, med, high, urgent`
- Due date ranges: `7d, 14d, 30d, 60d, 90d`
- Waiting For tag: `#WaitingFor`
- Now tag: `#t/now`
- Next actions due days: `3`

Suggested Health Check defaults:
- Stale file threshold: `90` days
- Stale task threshold: `90` days
- Unmodified task threshold: `60` days
- High task count threshold: `30`
- Inbox overflow threshold: `20`
- Breakdown title length threshold: `100`

Profile adjustments:
- Lighter system: lower inbox overflow to `10-15`, high task count to `15-20`
- Heavy workload: raise high task count to `40-60`
- Strict weekly cadence: reduce unmodified threshold to `30-45`

These are starting points; tune them over 2-3 review cycles based on how noisy or quiet the panels feel.

### Dataview Examples
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

## Development

### Prerequisites
- Node.js 18+
- npm

### Local Setup
```bash
npm install
npm run dev
```

`npm run dev` runs watch mode for iterative plugin development.

### Build
```bash
npm run build
```

Build output is `main.js` in repo root (with `manifest.json` and `styles.css`).

Before cutting a release, run a production build and test in a clean vault profile.

## License

MIT (see `LICENSE`).
