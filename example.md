# GeckoTask

Index only `- [ ]` / `- [x]` in:
- `Inbox/**/*.md`
- `{Area}/2Areas/_tasks.md|_SomedayMaybe.md`
- `{Area}/1Projects/{Project}/_tasks.md|_SomedayMaybe.md`
(use user settings if different)

Area/project = path only.

Task:
`- [ ] Title #tags priority:: {low|med|high|urgent} due:: YYYY-MM-DD scheduled:: YYYY-MM-DD`

Rules:
- fields optional
- dates = ISO
- desc = child lines (≥2 spaces)

Recurrence:
- `recur::` or `🔁`
- must use `every` (not `each`)

Tags:
- `#WaitingFor`, `#t/now` (or user overrides)

Done:
- `- [x]` → adds `completion::`
- recurring → next task auto-created (keep dates unless told)