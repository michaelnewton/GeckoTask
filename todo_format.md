# Task Format Specification

This document describes the markdown format used for tasks in the TaskWork plugin.

## Basic Format

A task is a markdown checkbox list item that starts with `- [ ]` (incomplete) or `- [x]` (complete):

```markdown
- [ ] Task title
- [x] Completed task
```

## Full Task Format

A complete task line can include:
- **Checkbox**: `[ ]` (incomplete) or `[x]` (complete)
- **Title**: Free text describing the task
- **Tags**: Hashtags like `#work`, `#personal`, `#urgent`
- **Fields**: Key-value pairs in the format `key:: value`

### Field Types

The following fields are supported:

| Field | Format | Description | Example |
|-------|--------|-------------|---------|
| `due` | `due:: YYYY-MM-DD` | Due date in ISO format | `due:: 2025-11-15` |
| `scheduled` | `scheduled:: YYYY-MM-DD` | Scheduled date (optional, not used in UI) | `scheduled:: 2025-11-10` |
| `priority` | `priority:: <value>` | Priority level | `priority:: high` |
| `recur` | `🔁 <pattern>` or `recur:: <pattern>` | Recurrence pattern (Tasks plugin compatible) | `🔁 every Tuesday` |
| `completed` | `completed:: YYYY-MM-DD` | Completion date (auto-added) | `completed:: 2025-11-14` |
| `origin_file` | `origin_file:: <path>` | Original file path (archive only) | `origin_file:: tasks/Work/Project.md` |
| `origin_project` | `origin_project:: <name>` | Original project (archive only) | `origin_project:: RouterRevamp` |
| `origin_area` | `origin_area:: <name>` | Original area (archive only) | `origin_area:: Work` |

**Note:** 
- The `area` field is **not** stored in task metadata. Areas are derived from the folder structure (e.g., `tasks/Work/` → area: `Work`).
- The `project` field is **not** stored in task metadata for regular project files. Projects are derived from the file basename (e.g., `tasks/Work/RouterRevamp.md` → project: `RouterRevamp`). For special files (Inbox, General), project is undefined.
- The `scheduled` field is supported in the format but is not currently used in the UI (no way to set or filter by it in the plugin interface).
- The `recur` field uses the 🔁 emoji format for compatibility with the Tasks plugin. When a recurring task is completed, the plugin automatically creates the next occurrence with an updated due date.
- The `origin_*` fields are only added when tasks are archived. They preserve the original location of the task.

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
- [ ] Submit report due:: 2025-11-15
```

### Task with Priority

```markdown
- [ ] Fix critical bug priority:: urgent
```

### Task with Recurrence

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday due:: 2025-11-11
- [ ] Backup files 🔁 every 10 days due:: 2025-11-07
- [ ] Bi-weekly report 🔁 every 2 weeks on Tuesday due:: 2025-11-11
```

**Recurrence Patterns Supported:**
- `every day` or `daily` - Every day
- `every weekday` or `weekdays` - Monday through Friday
- `every N days` - Every N days (e.g., `every 10 days`)
- `every week` or `weekly` - Every week
- `every N weeks` - Every N weeks (e.g., `every 2 weeks`)
- `every [day]` - Every specific day of week (e.g., `every Tuesday`)
- `every N weeks on [day]` - Every N weeks on a specific day (e.g., `every 2 weeks on Tuesday`)
- `every month` or `monthly` - Every month
- `every N months` - Every N months
- `every month on the [day]` - Every month on a specific day (e.g., `every month on the 15th`)
- `every year` or `yearly` - Every year
- `every N years` - Every N years

When a recurring task is completed, the plugin automatically creates a new task with the next occurrence date calculated from the recurrence pattern.

### Complete Task Example

```markdown
- [ ] Write agent router tests #work #router priority:: high due:: 2025-11-15
```

### Task with Recurrence and All Fields

```markdown
- [ ] Weekly team meeting 🔁 every Tuesday #work priority:: high due:: 2025-11-11
```

### Completed Task

```markdown
- [x] Write agent router tests #work #router priority:: high due:: 2025-11-15 completed:: 2025-11-14
```

### Task with All Fields

```markdown
- [ ] Implement feature #work #backend priority:: high due:: 2025-11-20 scheduled:: 2025-11-18
```

**Note:** The `scheduled` field is supported but not currently used in the plugin UI. You can manually add it to tasks for Dataview queries or future use.

## Multi-line Descriptions

Tasks can have multi-line descriptions stored as indented lines (2+ spaces) below the task line:

```markdown
- [ ] Write agent router tests #work #router priority:: high due:: 2025-11-15
  This is a multi-line description.
  It can span multiple lines.
  
  Empty lines are preserved for spacing.
  
  You can include additional context, notes, or requirements here.
```

**Rules for descriptions:**
- Must be indented with 2 or more spaces
- Description ends when a non-indented line is encountered
- Description ends when a new task line (`- [ ]` or `- [x]`) is encountered
- Description ends when a markdown heading (`#`, `##`, etc.) is encountered
- Empty lines within the description are preserved

## Date Formats

### ISO Date Format

Dates should be in ISO format: `YYYY-MM-DD`

```markdown
- [ ] Task with ISO date due:: 2025-11-15
```

### Natural Language Dates (if enabled)

When natural language date parsing is enabled in settings, you can use:

- `today` → Current date
- `tomorrow` → Next day
- `next monday` → Next Monday (or any day of week)
- `in 3 days` → 3 days from now

**Note:** Natural language dates are automatically converted to ISO format when the task is saved.

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

Fields can appear in any order on the task line. The plugin will normalize the order when using the "Normalize Task Line" command. The typical order is:

1. Checkbox and title
2. Tags (all `#hashtag` values)
3. Recurrence pattern (🔁 emoji format)
4. Fields (in order: `priority`, `due`, `scheduled`, `completed`, `origin_*`)

## Field Formatting

- Fields use double colons: `key:: value`
- Fields can have empty values: `key::` (though this is typically not useful)
- Fields can be separated by spaces: `due:: 2025-11-15 priority:: high`
- Multiple spaces between fields are normalized to double spaces

## Special Files

Tasks in certain special files behave differently:

- **Inbox** (`tasks/Inbox.md`): Tasks don't require a project
- **General** (`tasks/General.md`): Tasks don't show a project name (similar to Inbox)

## Archive Format

When tasks are archived, they include origin metadata:

```markdown
- [x] Completed task #work priority:: high due:: 2025-11-15 completed:: 2025-11-14 origin_file:: tasks/Work/RouterRevamp.md origin_project:: RouterRevamp origin_area:: Work
```

## Best Practices

1. **Keep titles concise**: The title should be clear and actionable
2. **Use tags for filtering**: Tags like `#work`, `#personal`, `#urgent` help with organization
3. **Set due dates**: Use `due::` for tasks with deadlines
4. **Organize by file**: Place tasks in project files to automatically assign them to projects (project is derived from the file name)
5. **Add descriptions when needed**: Use multi-line descriptions for additional context, requirements, or notes
6. **Normalize tasks**: Use the "Normalize Task Line" command to ensure consistent formatting

## Dataview Compatibility

Tasks are designed to be compatible with Dataview queries. All fields are stored inline on a single line (except descriptions), making them easy to query:

````markdown
```dataview
task from "tasks"
where !completed and due = date(today)
sort priority desc, due asc
```
````

## Examples in Context

### Project File Structure

```markdown
---
area: Work
project: RouterRevamp
created: 2025-11-07
---

# RouterRevamp

> Project notes here.

## Tasks

- [ ] Write agent router tests #work #router priority:: high due:: 2025-11-15
  Implement comprehensive test coverage for the new router module.
  Focus on edge cases and error handling.

- [ ] Update documentation #work priority:: med due:: 2025-11-20
  Document the new routing API and provide usage examples.

- [x] Design router architecture #work priority:: high completed:: 2025-11-10
```

**Note:** Tasks in this file automatically have project `RouterRevamp` (derived from the file name). The `project::` field is not stored in the task line.

### Inbox Example

```markdown
# Inbox

- [ ] Review email backlog #work
- [ ] Call dentist #personal due:: 2025-11-18
- [ ] Buy groceries #personal priority:: low
```

