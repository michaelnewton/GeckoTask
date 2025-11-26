# GeckoTask

**GeckoTask** is a Markdown-first task manager for Obsidian that provides fast task capture, metadata management, and archiving while working seamlessly with Dataview for powerful task queries and displays.

## Overview

GeckoTask is designed around the principle that your tasks should be **plain Markdown files** that you can edit anywhere, sync with any tool, and query with Dataview. It provides a powerful task management system with three main panels:

- **Tasks Panel**: Browse, filter, and manage all your tasks with inline editing
- **Weekly Review Panel**: Guided GTD-style weekly review workflow
- **Health Check Panel**: Analyze your task system for issues and opportunities

Tasks are stored as standard Markdown checkboxes with inline metadata, organized in a simple folder structure. Projects are represented as files, and areas are represented as folders. This makes your task system transparent, portable, and compatible with any Markdown editor.

## Features

### Core Functionality

- **Fast Task Capture**: Quick-add modal for creating tasks with metadata (due date, priority, tags, project)
- **Tasks Panel**: Side panel view for browsing, filtering, and managing tasks with inline editing
- **Weekly Review Panel**: Guided GTD-style weekly review workflow with step-by-step wizard
- **Health Check Panel**: Comprehensive analysis of your task system to identify issues and opportunities
- **Folder-Based Organization**: Organize tasks by areas (Work, Personal) and projects using folder structure
- **Recurring Tasks**: Support for recurring tasks with automatic next occurrence generation (Tasks plugin compatible)
- **Multi-line Descriptions**: Support for task descriptions stored as indented lines below task lines
- **Natural Language Dates**: Parse dates like "today", "tomorrow", "next monday", "in 3 days"
- **Task Movement**: Easily move tasks between projects while preserving metadata
- **Archiving**: Archive completed tasks with origin context preserved
- **Markdown Styling**: Automatic styling of task metadata fields in markdown preview and source view
- **Dataview Integration**: Tasks use consistent inline metadata that works perfectly with Dataview queries

### Task Format

Tasks use standard Markdown checkboxes with inline metadata:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15
```

**Note:** The `project::` field is not stored in metadata for regular project files. Projects are derived from the file basename (e.g., `tasks/Work/RouterRevamp.md` → project: `RouterRevamp`). For special files (Inbox, Single Action), project is undefined.

Tasks can include recurrence patterns (Tasks plugin compatible):

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday due:: 2025-11-11
- [ ] Backup files 🔁 every 10 days due:: 2025-11-07
- [ ] Bi-weekly report 🔁 every 2 weeks on Tuesday due:: 2025-11-11
```

When a recurring task is completed, the plugin automatically creates the next occurrence with an updated due date.

Tasks can also include multi-line descriptions:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15
  This is a multi-line description.
  It can span multiple lines.
```


## How Tasks and Projects Are Stored

### Task Storage

Tasks are stored as standard Markdown checkboxes in `.md` files within your tasks folder. Each task is a single line (or multiple lines with indented descriptions) with inline metadata:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15
```

**Key points about task storage:**
- Tasks are plain Markdown - you can edit them in any editor
- Metadata is stored inline using the format `key:: value`
- Tasks can have multi-line descriptions stored as indented lines below the task line
- Completed tasks get a `completion:: YYYY-MM-DDTHH:mm:ss` timestamp field (date + time) automatically added
- Recurring tasks use the Tasks plugin format: `🔁 every Tuesday` or `recur:: every 10 days`

### Project and Area Organization

GeckoTask uses a **folder-based organization system** where:
- **Projects** are represented as individual `.md` files (e.g., `tasks/Work/RouterRevamp.md`)
- **Areas** are represented as folders (e.g., `tasks/Work/`, `tasks/Personal/`)
- The project name is derived from the file basename (e.g., `RouterRevamp.md` → project: `RouterRevamp`)
- The area name is derived from the folder name (e.g., `tasks/Work/` → area: `Work`)

**Important:** Projects and areas are **not stored in task metadata**. They are inferred from the file location. This means:
- Moving a task to a different file changes its project
- Moving a task to a different folder changes its area
- Special files like `Inbox.md` and `Single Action.md` have no project (undefined)

### Vault Structure

```
/
├── tasks/                          # Base tasks folder (configurable)
│   ├── Inbox.md                    # Single inbox for all areas
│   ├── Work/                       # Area: Work
│   │   ├── ProjectA.md            # Project: ProjectA
│   │   ├── ProjectB.md            # Project: ProjectB
│   │   └── Someday Maybe/         # Someday/Maybe folder for Work area
│   │       └── FutureProject.md
│   ├── Personal/                  # Area: Personal
│   │   └── ProjectX.md            # Project: ProjectX
│   └── Single Action.md           # Single action tasks (no project)
├── Archive/                        # Archive folder
│   └── Completed-YYYY.md          # Archived tasks by year
└── Dashboards/
    └── Tasks.md                    # Dataview queries
```

### Special Files and Folders

- **Inbox.md**: Single inbox file for capturing tasks quickly (no project assigned)
- **Single Action.md**: File for single-action tasks that don't belong to a project
- **Someday Maybe/**: Folder within each area for future projects and ideas
- **Archive/**: Folder for archived completed tasks (preserves origin context)

## Weekly Review

The **Weekly Review Panel** provides a guided GTD-style weekly review workflow. It's a step-by-step wizard that helps you get clear, get current, and get creative with your task system.

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

## Commands

### Panel Commands

- **GeckoTask: Open Tasks Panel** - Opens the side panel for task management
- **GeckoTask: Open Weekly Review Panel** - Opens the weekly review wizard
- **GeckoTask: Open Health Check Panel** - Opens the health check analysis

### Task Management Commands

- **GeckoTask: Quick Add/Edit Task** - Opens modal to create or edit a task (edits if cursor is on a task)
- **GeckoTask: Complete/Uncomplete Task at Cursor** - Toggles task completion
- **GeckoTask: Move Task (pick project)** - Move task to a different project file
- **GeckoTask: Set Due (at cursor)** - Set or update due date
- **GeckoTask: Set Priority (at cursor)** - Set or update priority
- **GeckoTask: Set Recurrence (at cursor)** - Set or update recurrence pattern
- **GeckoTask: Add/Remove Tags (at cursor)** - Manage task tags
- **GeckoTask: Normalize Task Line (at cursor)** - Normalize task metadata order and spacing

### Archive Commands

- **GeckoTask: Archive Completed in Current File** - Archive completed tasks from current file
- **GeckoTask: Archive All Completed (older than N days)** - Archive completed tasks across vault

### Project Commands

- **GeckoTask: Create Project File** - Create a new project file with frontmatter

## Installation

### From Obsidian

1. Open Obsidian Settings
2. Go to **Community plugins**
3. Click **Browse** and search for "GeckoTask"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/geckom/GeckoTask/releases)
2. Extract the files (`main.js`, `manifest.json`, `styles.css`) to your vault's `.obsidian/plugins/geckotask/` folder
3. Reload Obsidian
4. Enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → GeckoTask** to configure:

### Basic Settings

- **Tasks folder**: Base folder for all tasks (default: `tasks`)
- **Areas enabled**: When enabled, areas are auto-detected from first-level directories in tasks folder
- **Inbox path**: Path to the single inbox file (default: `tasks/Inbox`)
- **Single Action file**: File name for single action tasks without a project (default: `Single Action`)
- **Someday Maybe folder name**: Folder name for someday/maybe items per area (default: `Someday Maybe`)

### Archive Settings

- **Archive pattern**: Pattern for archive files (default: `Archive/Completed-YYYY.md`)
- **Archive older than (days)**: Days before archiving completed tasks (default: 7)

### Task Settings

- **Natural language due parsing**: Enable parsing of dates like "today", "tomorrow" (default: on)
- **Allowed priorities**: Comma-separated list of priority values (default: `low, med, high, urgent`)
- **Due date ranges**: Comma-separated list of configurable due date ranges for filter dropdown (default: `7d, 14d, 30d, 60d, 90d`)

### Weekly Review Settings

- **Custom collection points**: Custom collection points for step 1A (e.g., `Facebook, Slack, Twitter`)
- **Waiting-for tag**: Tag for waiting-for tasks (default: `#WaitingFor`)
- **Now tag**: Tag for "now" tasks shown in today view (default: `#t/now`)
- **Next actions due days**: Number of days ahead to show tasks in next actions list (default: 3)

### Health Check Settings

- **Stale file days**: Files not modified in this time are considered stale (default: 90)
- **Stale task days**: Tasks with no due date older than this (default: 90)
- **Unmodified task days**: Tasks not modified in this time (default: 60)
- **Quick win keywords**: Keywords that indicate quick wins (default: `order, book, cancel, check, confirm, set up, make, appointment, call, email, message, reply, buy, refill`)
- **High task count**: Threshold for high task count projects (default: 30)
- **Inbox threshold**: Threshold for inbox overflow (default: 20)
- **Completed archive days**: Completed tasks older than this can be archived (default: 30)
- **Breakdown title length**: Title length threshold for tasks needing breakdown (default: 100)
- **Breakdown keywords**: Keywords suggesting a task needs breakdown (default: `and, then, also, plus`)

## Usage

### Vault Structure

GeckoTask organizes tasks in a folder structure:

```
/
├── tasks/
│   ├── Inbox.md                    # Single inbox for all areas
│   ├── Work/
│   │   ├── ProjectA.md
│   │   └── ProjectB.md
│   ├── Personal/
│   │   └── ProjectX.md
│   └── Single Action.md           # Single action tasks (no project shown)
├── Archive/
│   └── Completed-YYYY.md           # Archived tasks
└── Dashboards/
    └── Tasks.md                    # Dataview queries
```

### Quick Start Guide

1. **Set up your folder structure**: Create a `tasks` folder in your vault (or configure a different name in settings)
   - Create an `Inbox.md` file in the tasks folder
   - Optionally create area folders like `Work/` and `Personal/`
   - Create project files as needed (e.g., `Work/ProjectA.md`)

2. **Create your first task**: 
   - Use **GeckoTask: Quick Add/Edit Task** from the command palette
   - Or open `tasks/Inbox.md` and manually add a task: `- [ ] My first task`

3. **Open the Tasks Panel**: 
   - Click the ribbon icon (check-circle) or use **GeckoTask: Open Tasks Panel**
   - Browse, filter, and manage all your tasks

4. **Try Weekly Review**: 
   - Use **GeckoTask: Open Weekly Review Panel** to start a guided weekly review
   - Follow the step-by-step wizard to get clear, get current, and get creative

5. **Check your system health**: 
   - Use **GeckoTask: Open Health Check Panel** to analyze your task system
   - Identify issues, quick wins, and areas for improvement

6. **Customize settings**: 
   - Go to **Settings → GeckoTask** to configure folders, priorities, and other options

### Tasks Panel

The Tasks Panel provides a rich interface for managing all your tasks:

**Tabs:**
- **"Now"**: Shows tasks due today or overdue, or tasks tagged with the "now" tag (default: `#t/now`)
- **"Next"**: Shows next actions - all Single Action tasks and the first uncompleted task from each project file (within configured days ahead)
- **"Inbox"**: Shows only tasks from the inbox file
- **"Waiting"**: Shows only tasks tagged with the waiting-for tag (default: `#WaitingFor`)
- **"All Tasks"**: Shows all tasks with full filtering options

**Filtering:**
- **Area**: Filter by area (Work, Personal, etc.)
- **Project**: Filter by project file
- **Priority**: Filter by priority level (low, med, high, urgent)
- **Due date**: Multiple filter options:
  - Fixed options: any, today, overdue, none
  - Configurable day ranges from settings: 7d, 14d, 30d, 60d, 90d
  - Relative periods: this-week, next-week, this-month, next-month
- **Search**: Searches task titles and tags

**Task Display:**
- **Sorting**: Tasks are sorted by due date, priority, area, project, and title
- **Inline Editing**: 
  - Click task title to edit
  - Click badges to change due date, priority, or recurrence pattern
- **Recurrence Display**: Shows recurrence pattern (🔁) badge for recurring tasks (click to edit)
- **Description Support**: Multi-line descriptions can be toggled visible/hidden via icon (📄)
- **Tag Display**: Displays hashtags (task tags) for filtering and organization

**Actions:**
- **Toggle completion**: Handles recurring task regeneration automatically
- **Edit task**: Open task in edit modal
- **Open in note**: Opens the file and scrolls to the task line
- **Move to project**: Move task to a different project file

**Features:**
- **Mobile optimized**: Touch device detection, tap-to-reveal action buttons on mobile
- **Auto-refresh**: Panel automatically updates when vault changes
- **Badge styling**: Visual badges for priority, due dates, and recurrence patterns

### Dataview Integration

GeckoTask tasks work seamlessly with Dataview. Example queries:

**Today's tasks:**
````markdown
```dataview
task from "tasks"
where !completed and due = date(today)
sort priority desc, due asc
```
````

**Overdue tasks:**
````markdown
```dataview
task from "tasks"
where !completed and due < date(today)
sort due asc
```
````

**By project:**
````markdown
```dataview
table file.link as Project, rows
from "tasks/Work"
where !completed
group by project
```
````

## Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm

### Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development in watch mode
4. For production build, run `npm run build`

### Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── commands/
│   └── index.ts               # Command registration
├── extensions/
│   ├── CheckboxClickHandler.ts # Checkbox click handling
│   └── TaskFieldDecorator.ts  # Task field styling in editor
├── models/
│   └── TaskModel.ts           # Task parsing and formatting
├── services/
│   ├── Archive.ts             # Archiving functionality
│   ├── HealthService.ts       # Health check analysis
│   ├── NLDate.ts              # Natural language date parsing
│   ├── Recurrence.ts          # Recurrence pattern parsing and calculation
│   ├── TaskOps.ts             # Task operations (complete, set fields)
│   ├── TaskTrackingService.ts # Task tracking for health checks
│   ├── VaultIO.ts             # File operations (move, create)
│   └── WeeklyReviewService.ts # Weekly review functionality
├── settings/
│   ├── defaults.ts            # Default settings values
│   ├── index.ts               # Settings interface
│   └── SettingsTab.ts         # Settings UI
├── styling/
│   └── MarkdownStyler.ts      # Markdown preview styling
├── ui/
│   ├── CaptureModal.ts        # Task capture modal
│   ├── ConfirmationModal.ts   # Confirmation dialogs
│   ├── FilePickerModal.ts     # File picker for moving tasks
│   └── PromptModal.ts         # Generic prompt modal
├── utils/
│   ├── areaUtils.ts           # Area/folder utilities
│   ├── dateUtils.ts           # Date formatting utilities
│   ├── editorUtils.ts         # Editor manipulation utilities
│   ├── fileUtils.ts           # File operations utilities
│   ├── somedayMaybeUtils.ts   # Someday/maybe utilities
│   ├── taskUtils.ts           # Task loading utilities
│   └── viewUtils.ts           # View utilities
└── view/
    ├── health/                 # Health check panel
    ├── tasks/                 # Tasks panel
    └── weekly-review/         # Weekly review panel
```

### Building

- **Development**: `npm run dev` (watch mode)
- **Production**: `npm run build` (creates `main.js`)

### Manual Installation for Development

1. Build the plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/geckotask/`
3. Reload Obsidian

## Design Philosophy

- **Markdown-first**: Tasks are plain Markdown that can be edited anywhere
- **Folder-based organization**: Areas and projects are inferred from folder structure, not stored in metadata
- **Dataview-friendly**: Consistent inline metadata works with Dataview queries
- **Mobile-compatible**: Works on iOS, Android, and desktop with touch-optimized UI
- **Sync-friendly**: Compatible with Obsidian Sync, Syncthing, and Git
- **Visual distinction**: Task metadata fields are automatically styled in markdown preview and source view for better readability

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## Acknowledgments

- Built for Obsidian using the Obsidian Plugin API
- Designed to work seamlessly with the Dataview plugin
