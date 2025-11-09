# GeckoTask

**GeckoTask** is a Markdown-first task manager for Obsidian that provides fast task capture, metadata management, and archiving while working seamlessly with Dataview for powerful task queries and displays.

## Features

### Core Functionality

- **Fast Task Capture**: Quick-add modal for creating tasks with metadata (due date, priority, tags, project)
- **GeckoTask Panel**: Side panel view for browsing, filtering, and managing tasks with inline editing
- **Folder-Based Organization**: Organize tasks by areas (Work, Personal) and projects using folder structure
- **Recurring Tasks**: Support for recurring tasks with automatic next occurrence generation (Tasks plugin compatible)
- **Multi-line Descriptions**: Support for task descriptions stored as indented lines below task lines
- **@ Labels**: Support for @ labels (e.g., `@ppl/Libby`) in task titles and descriptions, styled in markdown preview
- **Natural Language Dates**: Parse dates like "today", "tomorrow", "next monday", "in 3 days"
- **Task Movement**: Easily move tasks between projects while preserving metadata
- **Archiving**: Archive completed tasks with origin context preserved
- **Markdown Styling**: Automatic styling of task metadata fields and @ labels in markdown preview and source view
- **Dataview Integration**: Tasks use consistent inline metadata that works perfectly with Dataview queries

### Task Format

Tasks use standard Markdown checkboxes with inline metadata:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15
```

**Note:** The `project::` field is not stored in metadata for regular project files. Projects are derived from the file basename (e.g., `tasks/Work/RouterRevamp.md` → project: `RouterRevamp`). For special files (Inbox, General), project is undefined.

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

Tasks can include @ labels in titles or descriptions:

```markdown
- [ ] Follow up with @ppl/Libby about the design
- [ ] Schedule meeting with @person/John and @person/Sarah
```

**Note:** @ labels are automatically styled in markdown preview and can be extracted from task descriptions for display in the GeckoTask Panel.

### Commands

- **GeckoTask: Open GeckoTask Panel** - Opens the side panel for task management
- **GeckoTask: Quick Add Task** - Opens modal to create a new task
- **GeckoTask: Complete/Uncomplete Task at Cursor** - Toggles task completion
- **GeckoTask: Move Task (pick project)** - Move task to a different project file
- **GeckoTask: Set Due (at cursor)** - Set or update due date
- **GeckoTask: Set Priority (at cursor)** - Set or update priority
- **GeckoTask: Set Recurrence (at cursor)** - Set or update recurrence pattern
- **GeckoTask: Add/Remove Tags (at cursor)** - Manage task tags
- **GeckoTask: Set Project (at cursor)** - Set or update project
- **GeckoTask: Archive Completed in Current File** - Archive completed tasks from current file
- **GeckoTask: Archive All Completed (older than N days)** - Archive completed tasks across vault
- **GeckoTask: Create Project File** - Create a new project file with frontmatter
- **GeckoTask: Normalize Task Line (at cursor)** - Normalize task metadata order and spacing

## Installation

### From Obsidian

1. Open Obsidian Settings
2. Go to **Community plugins**
3. Click **Browse** and search for "GeckoTask"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/geckom/geckotask/releases)
2. Extract the files (`main.js`, `manifest.json`, `styles.css`) to your vault's `.obsidian/plugins/geckotask/` folder
3. Reload Obsidian
4. Enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → GeckoTask** to configure:

- **Tasks folder**: Base folder for all tasks (default: `tasks`)
- **Areas**: Comma-separated list of area folder names (e.g., `Work, Personal`)
- **Inbox path**: Path to the single inbox file (default: `tasks/Inbox`)
- **General tasks file**: File name for general tasks without a project (default: `General`)
- **Archive pattern**: Pattern for archive files (default: `Archive/Completed-YYYY.md`)
- **Archive older than (days)**: Days before archiving completed tasks (default: 7)
- **Natural language due parsing**: Enable parsing of dates like "today", "tomorrow" (default: on)
- **Allowed priorities**: Comma-separated list of priority values (default: `low, med, high, urgent`)
- **Due date ranges**: Comma-separated list of configurable due date ranges for filter dropdown (default: `7d, 14d, 30d, 60d, 90d`)

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
│   └── General.md                 # General tasks (no project shown)
├── Archive/
│   └── Completed-YYYY.md           # Archived tasks
└── Dashboards/
    └── Tasks.md                    # Dataview queries
```

### Quick Start

1. **Create your first task**: Use **GeckoTask: Quick Add Task** from the command palette
2. **Open GeckoTask Panel**: Click the ribbon icon or use **GeckoTask: Open GeckoTask Panel**
3. **Filter and manage**: Use the panel to filter by area, project, priority, due date, or search query
4. **Edit tasks**: Click badges in the panel to edit due dates, priorities, or titles inline
5. **Archive completed**: Use archive commands to move completed tasks to the archive folder

### GeckoTask Panel

The GeckoTask Panel provides a rich interface for managing tasks:

- **Tabs**: Two tabs available:
  - "Today" - Shows tasks due today or overdue (due filter hidden)
  - "All Tasks" - Shows all tasks with full filtering options
- **Filtering**: Filter by area, project, priority, due date, or search query
  - **Due date filters**: Fixed options (any, today, overdue, none), configurable day ranges from settings (e.g., 7d, 14d, 30d, 60d, 90d), and relative periods (this-week, next-week, this-month, next-month)
  - **Search**: Searches task titles and tags
- **Sorting**: Tasks are sorted by due date, priority, area, project, and title
- **Inline Editing**: Click title to edit, click badges to change due date, priority, or recurrence pattern
- **Recurrence Display**: Shows recurrence pattern (🔁) badge for recurring tasks (click to edit)
- **Description Support**: Multi-line descriptions can be toggled visible/hidden via icon (📄)
- **@ Label Extraction**: Extracts @ labels from both task tags and descriptions for display
- **Quick Actions**: Toggle completion (handles recurring task regeneration), edit task, open task in note (scrolls to line), or move to different project
- **Mobile Features**: Touch device detection, tap-to-reveal action buttons on mobile
- **Auto-refresh**: Panel automatically updates when vault changes

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
├── main.ts              # Plugin entry point
├── settings.ts          # Settings interface and UI
├── models/
│   └── TaskModel.ts     # Task parsing and formatting
├── services/
│   ├── Archive.ts       # Archiving functionality
│   ├── NLDate.ts        # Natural language date parsing
│   ├── Recurrence.ts    # Recurrence pattern parsing and calculation
│   ├── TaskOps.ts       # Task operations (complete, set fields)
│   └── VaultIO.ts       # File operations (move, create)
├── ui/
│   ├── CaptureModal.ts  # Task capture modal
│   └── PromptModal.ts   # Generic prompt modal
├── utils/
│   └── areaUtils.ts     # Area/folder utilities
└── view/
    └── TasksPanel.ts # Side panel view
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
- **Visual distinction**: Task metadata fields and @ labels are automatically styled in markdown preview and source view for better readability

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## Acknowledgments

- Built for Obsidian using the Obsidian Plugin API
- Designed to work seamlessly with the Dataview plugin
