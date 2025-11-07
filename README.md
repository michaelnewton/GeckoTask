# TaskWork

**TaskWork** is a Markdown-first task manager for Obsidian that provides fast task capture, metadata management, and archiving while working seamlessly with Dataview for powerful task queries and displays.

## Features

### Core Functionality

- **Fast Task Capture**: Quick-add modal for creating tasks with metadata (due date, priority, tags, project)
- **TaskWork Panel**: Side panel view for browsing, filtering, and managing tasks with inline editing
- **Folder-Based Organization**: Organize tasks by areas (Work, Personal) and projects using folder structure
- **Recurring Tasks**: Support for recurring tasks with automatic next occurrence generation (Tasks plugin compatible)
- **Multi-line Descriptions**: Support for task descriptions stored as indented lines below task lines
- **Natural Language Dates**: Parse dates like "today", "tomorrow", "next monday", "in 3 days"
- **Task Movement**: Easily move tasks between projects while preserving metadata
- **Archiving**: Archive completed tasks with origin context preserved
- **Dataview Integration**: Tasks use consistent inline metadata that works perfectly with Dataview queries

### Task Format

Tasks use standard Markdown checkboxes with inline metadata:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15  project:: RouterRevamp
```

Tasks can include recurrence patterns (Tasks plugin compatible):

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday due:: 2025-11-11
- [ ] Backup files 🔁 every 10 days due:: 2025-11-07
- [ ] Bi-weekly report 🔁 every 2 weeks on Tuesday due:: 2025-11-11
```

When a recurring task is completed, the plugin automatically creates the next occurrence with an updated due date.

Tasks can also include multi-line descriptions:

```markdown
- [ ] Write agent router tests  #work #router priority:: high  due:: 2025-11-15  project:: RouterRevamp
  This is a multi-line description.
  It can span multiple lines.
```

### Commands

- **TaskWork: Open TaskWork Panel** - Opens the side panel for task management
- **TaskWork: Quick Add Task** - Opens modal to create a new task
- **TaskWork: Complete/Uncomplete Task at Cursor** - Toggles task completion
- **TaskWork: Move Task (pick project)** - Move task to a different project file
- **TaskWork: Set Due (at cursor)** - Set or update due date
- **TaskWork: Set Priority (at cursor)** - Set or update priority
- **TaskWork: Set Recurrence (at cursor)** - Set or update recurrence pattern
- **TaskWork: Add/Remove Tags (at cursor)** - Manage task tags
- **TaskWork: Set Project (at cursor)** - Set or update project
- **TaskWork: Archive Completed in Current File** - Archive completed tasks from current file
- **TaskWork: Archive All Completed (older than N days)** - Archive completed tasks across vault
- **TaskWork: Create Project File** - Create a new project file with frontmatter
- **TaskWork: Normalize Task Line (at cursor)** - Normalize task metadata order and spacing

## Installation

### From Obsidian

1. Open Obsidian Settings
2. Go to **Community plugins**
3. Click **Browse** and search for "TaskWork"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/yourusername/taskwork/releases)
2. Extract the files (`main.js`, `manifest.json`, `styles.css`) to your vault's `.obsidian/plugins/taskwork/` folder
3. Reload Obsidian
4. Enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → TaskWork** to configure:

- **Tasks folder**: Base folder for all tasks (default: `tasks`)
- **Areas**: Comma-separated list of area folder names (e.g., `Work, Personal`)
- **Inbox path**: Path to the single inbox file (default: `tasks/Inbox`)
- **General tasks file**: File name for general tasks without a project (default: `General`)
- **Archive pattern**: Pattern for archive files (default: `Archive/Completed-YYYY.md`)
- **Archive older than (days)**: Days before archiving completed tasks (default: 7)
- **Natural language due parsing**: Enable parsing of dates like "today", "tomorrow" (default: on)
- **Allowed priorities**: Comma-separated list of priority values (default: `low, med, high, urgent`)

## Usage

### Vault Structure

TaskWork organizes tasks in a folder structure:

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

1. **Create your first task**: Use **TaskWork: Quick Add Task** from the command palette
2. **Open TaskWork Panel**: Click the ribbon icon or use **TaskWork: Open TaskWork Panel**
3. **Filter and manage**: Use the panel to filter by area, project, priority, due date, or search query
4. **Edit tasks**: Click badges in the panel to edit due dates, priorities, or titles inline
5. **Archive completed**: Use archive commands to move completed tasks to the archive folder

### TaskWork Panel

The TaskWork Panel provides a rich interface for managing tasks:

- **Filtering**: Filter by area, project, priority, due date (today, 7d, overdue, none), or search query
- **Sorting**: Tasks are sorted by due date, priority, area, project, and title
- **Inline Editing**: Click title to edit, click badges to change due date, priority, or recurrence pattern
- **Recurrence Display**: Shows recurrence pattern (🔁) badge for recurring tasks
- **Quick Actions**: Toggle completion (handles recurring task regeneration), open task in note, or move to different project
- **Auto-refresh**: Panel automatically updates when vault changes

### Dataview Integration

TaskWork tasks work seamlessly with Dataview. Example queries:

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
    └── TaskworkPanel.ts # Side panel view
```

### Building

- **Development**: `npm run dev` (watch mode)
- **Production**: `npm run build` (creates `main.js`)

### Manual Installation for Development

1. Build the plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/taskwork/`
3. Reload Obsidian

## Design Philosophy

- **Markdown-first**: Tasks are plain Markdown that can be edited anywhere
- **Folder-based organization**: Areas are inferred from folder structure, not stored in metadata
- **Dataview-friendly**: Consistent inline metadata works with Dataview queries
- **Mobile-compatible**: Works on iOS, Android, and desktop
- **Sync-friendly**: Compatible with Obsidian Sync, Syncthing, and Git

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## Acknowledgments

- Built for Obsidian using the Obsidian Plugin API
- Designed to work seamlessly with the Dataview plugin
