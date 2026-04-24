# Task Format Specification

This document describes the markdown format used for tasks in the GeckoTask plugin.

## Basic Format

A task is a markdown checkbox list item that starts with `- [ ]` (incomplete) or `- [x]` / `- [X]` (complete). Matching is case-insensitive for the `x`.

```markdown
- [ ] Task title
- [x] Completed task
```

## Full Task Format

A complete task line can include:
- **Checkbox**: `[ ]` (incomplete) or `[x]` / `[X]` (complete)
- **Title**: Free text describing the task
- **Tags**: Hashtags like `#work`, `#personal`, `#urgent`
- **Fields**: Key-value pairs in the format `key:: value`

### Field Types

The following fields are supported:

| Field | Format | Description | Example |
|-------|--------|-------------|---------|
| `due` | `due:: YYYY-MM-DD` | Due date in ISO format | `due:: 2026-04-24` |
| `scheduled` | `scheduled:: YYYY-MM-DD` | Scheduled "do" date (optional) | `scheduled:: 2026-04-22` |
| `priority` | `priority:: <value>` | Priority level | `priority:: high` |
| `recur` | `🔁 <pattern>` or `recur:: <pattern>` | Recurrence pattern (both formats supported) | `🔁 every Tuesday` or `recur:: every Tuesday` |
| `completion` | `completion:: YYYY-MM-DDTHH:mm:ss` | Completion timestamp (auto-added when you check the box) | `completion:: 2026-04-14T15:42:00` |
| `origin_file` | `origin_file:: <path>` | Optional provenance: original file path | `origin_file:: Work/1Projects/RouterRevamp/_tasks.md` |
| `origin_project` | `origin_project:: <name>` | Optional provenance: original project | `origin_project:: RouterRevamp` |
| `origin_area` | `origin_area:: <name>` | Optional provenance: original area | `origin_area:: Work` |

**Note:** 
- The `space` value is **not** stored in task metadata. Root spaces are derived from configured **Space paths** and the file path (e.g., `Work/1Projects/MyProj/_tasks.md` with space `Work` configured -> space: `Work`).
- The `project` field is **not** stored in task metadata for project task files. Projects are derived from the project folder name (e.g., `Personal/1Projects/RouterRevamp/_tasks.md` -> project: `RouterRevamp`). For the inbox folder and PARA area-level task files (see [Special files](#special-files)), project is undefined.
- The `scheduled` field is fully supported: you can set it from the Tasks panel, Quick Add/Edit, or the command **GeckoTask: Set scheduled date (at cursor)**. It affects ordering and views (for example Next actions and weekly review logic).
- The `recur` field supports both the 🔁 emoji format (for Tasks plugin compatibility) and the `recur::` field format. When a recurring task is completed, the plugin inserts the next occurrence below it with updated `due` and/or `scheduled` per the recurrence rules.
- The `origin_*` fields are parsed if present (for example when importing tasks from another system). GeckoTask does not add them automatically; there is no built-in "archive to another vault" step that writes them today.

## Examples

### Simple Task

```markdown
- [ ] Write documentation
```

### Task with Tags

```markdown
- [ ] Review pull request #work #code-review
```

### Task with Due Date

```markdown
- [ ] Submit report due:: 2026-04-30
```

### Task with Priority

```markdown
- [ ] Fix critical bug priority:: urgent
```

### Task with Recurrence

Recurrence can be specified using either the 🔁 emoji format (Tasks plugin compatible) or the `recur::` field format:

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday due:: 2026-04-28
- [ ] Backup files 🔁 every 10 days due:: 2026-05-02
- [ ] Bi-weekly report 🔁 every 2 weeks on Tuesday due:: 2026-04-28
- [ ] Monthly review recur:: every month due:: 2026-05-01
- [ ] Rent payment 🔁 7th of every month due:: 2026-05-07
- [ ] Annual review 🔁 1st of june every year due:: 2026-06-01
- [ ] Quarterly report 🔁 every 4 weeks due:: 2026-05-20
```

**Recurrence Patterns Supported:**
- `every day` or `daily` - Every day
- `every weekday` or `weekdays` - Monday through Friday
- `every N days` - Every N days (e.g., `every 10 days`)
- `every week` or `weekly` - Every week
- `every N weeks` - Every N weeks (e.g., `every 2 weeks`, `every 4 weeks`)
- `every [day]` - Every specific day of week (e.g., `every Tuesday`)
- `every N weeks on [day]` - Every N weeks on a specific day (e.g., `every 2 weeks on Tuesday`)
- `every month` or `monthly` - Every month
- `every N months` - Every N months
- `every month on the [day]` - Every month on a specific day (e.g., `every month on the 15th`)
- `[day] of every month` - Every month on a specific day (e.g., `7th of every month`, `15th of every month`)
- `every year` or `yearly` - Every year
- `every N years` - Every N years
- `[day] of [month] every year` - Every year on a specific date (e.g., `1st of june every year`, `15th of december every year`)

When a recurring task is completed, the plugin inserts the next occurrence directly below it, with `due` and/or `scheduled` updated from the recurrence pattern.

### Complete Task Example

```markdown
- [ ] Write agent router tests #work #router priority:: high due:: 2026-04-30
```

### Task with Recurrence and All Fields

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday #work priority:: high due:: 2026-04-28
```

### Completed Task

```markdown
- [x] Write agent router tests #work #router priority:: high due:: 2026-04-30 completion:: 2026-04-29T15:42:00
```

### Task with All Fields

```markdown
- [ ] Implement feature #work #backend priority:: high due:: 2026-05-15 scheduled:: 2026-05-12
```

## Multi-line Descriptions

Tasks can have multi-line descriptions stored as indented lines (2+ spaces) below the task line:

```markdown
- [ ] Write agent router tests #work #router priority:: high due:: 2026-04-30
  This is a multi-line description.
  It can span multiple lines.
  
  Empty lines are preserved for spacing.
  
  You can include additional context, notes, or requirements here.
```

**Rules for descriptions:**
- Continuation lines must be indented with 2 or more spaces; each line is stored trimmed (leading/trailing spaces on that line removed)
- A **non-indented** non-empty line (fewer than two leading spaces) ends the description
- An **indented** line that still looks like a new task item (`- [ ]` / `- [x]`, with optional leading space before the dash) ends the description
- After a **blank** line, the parser peeks at the next non-empty line: if that line is a task line or a markdown heading at column 0 (`#` ...), the blank line ends the description; otherwise blank lines are kept inside the description

## Date Formats

### ISO Date Format

Dates should be in ISO format: `YYYY-MM-DD`

```markdown
- [ ] Task with ISO date due:: 2026-04-30
```

### Natural language dates

**`due::`:** When a task line is parsed, common natural language values on `due::` are resolved to ISO `YYYY-MM-DD` (for example `today`, `tomorrow`, `next monday`, bare weekdays such as `friday`, `in 3 days`, and other phrases Obsidian can parse via moment/Date when available). Commands and the Tasks panel also accept natural language and write ISO back into the line.

**`scheduled::`:** Prefer ISO dates in markdown for consistent sorting and filters. Natural language is accepted when you set scheduled through **Quick Add/Edit**, the Tasks panel, or **GeckoTask: Set scheduled date (at cursor)**; those paths normalize to ISO.

Settings include **Natural language date parsing**; today, toggling it does not change how existing markdown lines are loaded (the flag is reserved for future wiring).

## Priority Values

Priority values are configurable in plugin settings. Default values are:
- `low`
- `med`
- `high`
- `urgent`

```markdown
- [ ] Low priority task priority:: low
- [ ] Medium priority task priority:: med
- [ ] High priority task priority:: high
- [ ] Urgent task priority:: urgent
```

## Field Order

Fields can appear in any order on the task line. The plugin will normalize the order when using **GeckoTask: Normalize Task Line (at cursor)**. The normalized order is:

1. Checkbox and title
2. Tags (all `#hashtag` values)
3. Recurrence pattern (🔁 emoji format, if present)
4. Fields (in order: `priority`, `due`, `scheduled`, `completion`, `origin_file`, `origin_project`, `origin_area`)

## Field Formatting

- Fields use double colons: `key:: value`
- Fields can have empty values: `key::` (though this is typically not useful)
- Fields can be separated by spaces: `due:: 2026-04-30 priority:: high`
- Multiple spaces between fields are normalized to double spaces

## Special files

Paths use the defaults from **Settings -> GeckoTask** (`Space paths`, `inboxFolderName`, `projectsSubfolder`, `areaTasksSubfolder`, `tasksFileName`, `somedayMaybeFileName`). Out of the box:

- **Inbox:** Any note under the inbox folder (default folder name: `Inbox` at the vault root, not a single fixed `Inbox.md`). Tasks here have no project; the UI treats them as inbox items.
- **Area-level tasks:** Any task file under `{Space}/{areaTasksSubfolder}/**/{tasksFileName}.md` (includes the root file `{Space}/{areaTasksSubfolder}/{tasksFileName}.md`; defaults to `{Space}/2Areas/_tasks.md`). Same as inbox for **project**: none; the **area** context is shown where a project name would appear for project files.
- **Area someday/maybe:** Any file under `{Space}/{areaTasksSubfolder}/**/{somedayMaybeFileName}.md` (default stem `_SomedayMaybe`) follows the same project rules as area `_tasks` files.

Project tasks live at `{Space}/{projectsSubfolder}/{ProjectName}/{tasksFileName}.md` (default `{Space}/1Projects/{Project}/_tasks.md`).

If **Space paths** is blank, GeckoTask does not auto-insert a default space. In this mode, space-based grouping and actions are reduced, and area-style files shown in the Project filter are labeled **Single Action List**.

## Optional `origin_*` metadata

You can keep `origin_file::`, `origin_project::`, and `origin_area::` on a line if you use them for your own workflows (imports, Dataview, etc.). GeckoTask reads them like any other supported field. Checking a task still adds `completion::` automatically; there is no separate archive command that rewrites tasks with `origin_*` fields.

## Best Practices

1. **Keep titles concise**: The title should be clear and actionable
2. **Use tags for filtering**: Tags like `#work`, `#personal`, `#urgent` help with organization
3. **Set due dates**: Use `due::` for tasks with deadlines
4. **Organize by file**: Place tasks in project `_tasks` files so project is inferred from the parent folder name
5. **Add descriptions when needed**: Use multi-line descriptions for additional context, requirements, or notes
6. **Normalize tasks**: Use **GeckoTask: Normalize Task Line (at cursor)** for consistent spacing and field order

## Dataview Compatibility

Tasks are designed to be compatible with Dataview queries. All fields are stored inline on a single line (except descriptions), making them easy to query:

````markdown
```dataview
task from "Work"
where !completed and due = date(today)
sort priority desc, due asc
```
````

Use a folder path that exists in your vault (for example a **Space path** such as `Work` or `Personal`, or `Inbox`). Dataview's `task` query reads checklist items under that path.

## Examples in Context

### Project file (`Work/1Projects/RouterRevamp/_tasks.md`)

GeckoTask infers space and project from the **path**, not from YAML frontmatter. Frontmatter is fine for your own notes but does not drive task metadata.

```markdown
# RouterRevamp

> Project notes here.

## Tasks

- [ ] Write agent router tests #work #router priority:: high due:: 2026-04-30
  Implement comprehensive test coverage for the new router module.
  Focus on edge cases and error handling.

- [ ] Update documentation #work priority:: med due:: 2026-05-10
  Document the new routing API and provide usage examples.

- [x] Design router architecture #work priority:: high completion:: 2026-04-08T09:30:00
```

**Note:** Tasks in this file automatically have project `RouterRevamp` (derived from the parent folder name). The `project::` field is not stored in the task line.

### Inbox example (`Inbox/triage.md`)

```markdown
# Inbox

- [ ] Review email backlog #work
- [ ] Call dentist #personal due:: 2026-04-25
- [ ] Buy groceries #personal priority:: low
```
