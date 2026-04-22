# GeckoTask — testing before commit

Use this **every time** you change code and plan to **commit** (or open a PR): run the **automated** checks first, then the **manual** steps in Obsidian. Automated checks catch TypeScript, lint, and bundle issues; only Obsidian can confirm UI, commands, and editor behavior.

---

## What runs automatically

**On your machine (run before commit):**

- **`npm run typecheck`** — TypeScript compiles with `noEmit`; catches bad types and broken imports in `src/`.
- **`npm run lint`** — ESLint on `src/**/*.ts` (including Obsidian-focused rules from `eslint-plugin-obsidianmd` where configured).
- **`npm run build`** — esbuild produces production **`main.js`** from `src/main.ts`; catches missing modules and bundling errors.

**In GitHub (after you push):**

- **[`.github/workflows/ci.yml`](.github/workflows/ci.yml)** runs **`npm ci`**, then **typecheck**, **lint**, and **build** on pushes and pull requests to **`main`** / **`master`**.

**Not automated (must do in Obsidian):** plugin load, settings UI, side panels, ribbon, modals, checkbox/recurrence, markdown styling, mobile layout, hotkey clashes with other plugins, and vault-specific paths.

---

## Before you commit — checklist

1. From the repo root: **`npm run typecheck`** → must exit **0**.
2. **`npm run lint`** → must exit **0**.
3. **`npm run build`** → must exit **0**; confirm **`main.js`** updated if you expect code changes in the bundle.
4. Do **Step-by-step manual testing** below in a test vault (required for anything touching plugin behavior, UI, or editor).
5. **`git status`** — only commit intended files (e.g. avoid committing scratch notes or wrong `main.js` if your workflow gitignores it later).

After push, confirm the **CI** job on your branch is green (same checks as steps 1–3).

---

## Step-by-step manual testing (Obsidian)

Use a **test vault** (or a copy you can reset). Build artifacts first (**Before you commit** steps 1–3), then install them into the vault.

### Step 1 — Install plugin files into the vault

1. Copy **`main.js`**, **`manifest.json`**, and **`styles.css`** (if the file exists in the repo) into  
   `<YourVault>/.obsidian/plugins/geckotask/`  
   The folder name **`geckotask`** must match **`"id"`** in `manifest.json`.
2. In Obsidian: **Reload** (command palette: *Reload app without saving*, or restart Obsidian).
3. **Settings → Community plugins:** enable **GeckoTask** if needed. Confirm there is **no** load error for GeckoTask.

### Step 2 — Settings

1. Open **Settings → GeckoTask**.
2. Confirm the settings screen **renders** (areas, inbox, health options, etc.).
3. Toggle **Show completed tasks** (or another safe toggle), close settings, open **Settings → GeckoTask** again, and confirm the value **stuck**.

### Step 3 — Tasks panel and ribbon

1. Command palette: run **Open Tasks Panel** (command id `geckotask-open-panel`).
2. Click the **Tasks Panel** ribbon icon — same behavior as step 1.
3. If you use tabs/filters in the panel, switch them once; confirm **no** stuck spinner and no console errors.

### Step 4 — Weekly Review and Health panels

1. Run **Open Weekly Review Panel** (`weekly-review-open-panel`).
2. Advance or interact with **at least one** wizard step.
3. Run **Open Health Check Panel** (`health-open-panel`); wait until content or empty state appears.

### Step 5 — Quick add / edit task

1. Open a **Markdown** note under a configured **space** or **inbox** (per GeckoTask settings).
2. Run **Quick Add/Edit Task** (`geckotask-quick-add`) **with the cursor not** on a task line — complete the flow; confirm a line appears in the note if you added a task.
3. Put the cursor on a task line and run **Quick Add/Edit Task** again — confirm **edit** path works.

### Step 6 — Editor commands (cursor on a task line)

1. Run **Complete/Uncomplete Task at Cursor** (`geckotask-toggle-complete`); confirm the checkbox and line update.
2. Run **at least one** of: **Set Due**, **Set Scheduled**, **Set Priority**, **Set Recurrence**, **Add/Remove Tags**, or **Normalize Task Line** — confirm the line updates.
3. *(Optional if you use projects)* Run **Move Task** (`geckotask-move-task`) from a suitable note.

### Step 7 — Recurring task (checkbox in editor)

1. In a space/inbox note, use or add a task with **`recur::`** (supported recurrence format).
2. In **editing/source** mode, **click the task checkbox** to complete it.
3. Confirm **completion** is recorded and a **next occurrence** line appears when expected; toggle again and confirm you do **not** get duplicate next lines.

### Step 8 — Markdown styling (metadata fields)

1. Stay in (or open) a space/inbox task note.
2. Switch **Reading** ↔ **Source** if you use both.
3. Confirm **`due::`**, **`priority::`**, etc. still **look styled** (preview and/or editor decorations). Watch the developer console for repeated errors.

### Step 9 — *(Optional)* Auto-open Tasks panel

Only if **Auto-open Tasks panel** is **on** in settings:

1. Fully **quit and restart** Obsidian (or reload twice).
2. Confirm the Tasks panel **opens after startup** as before, and the console does not spam warnings beyond what you already accept.

### Step 10 — *(Optional)* Mobile

If you care about **iOS/Android** (`isDesktopOnly` is false in `manifest.json`):

1. Repeat **Step 1** (load), **Step 3** (open Tasks), and **Step 7** (checkbox) on a device or simulator.

---

## Releases (tags only)

Tag-driven releases use [`.github/workflows/release.yml`](.github/workflows/release.yml) (`npm ci` + `npm run build` + attach `main.js`, `manifest.json`, `styles.css`; the tag must match `manifest.json` and `package.json` versions). Maintainer checklist: [`CONTRIBUTING.md`](CONTRIBUTING.md). Before tagging, complete **Before you commit** and **Step-by-step manual testing** in a vault that matches how users install the release.

---

## Optional extras (not required every commit)

| When | What |
|------|------|
| Large refactors | Skim **`main.js`** size or obvious duplicated chunks (esbuild output). |
| Path-sensitive changes | Repeat manual steps in a **second vault** with different `spacePaths` / empty inbox. |
| Hotkey changes | Check **Mod+Shift+E** (quick add) does not clash with another plugin in your test vault. |
| Deeper automation later | Unit tests (e.g. Vitest) for `TaskModel` / recurrence strings; settings merge fixtures — see historical notes in git for `TESTING.md` roadmap if you add them. |

---

## Command ids (reference)

| Command id | Typical manual step |
|------------|---------------------|
| `geckotask-open-panel` | Step 3 |
| `weekly-review-open-panel` | Step 4 |
| `health-open-panel` | Step 4 |
| `geckotask-quick-add` | Step 5 |
| `geckotask-toggle-complete` | Step 6 |
| `geckotask-move-task` | Step 6 (optional) |
| `geckotask-set-due`, `geckotask-set-scheduled`, `geckotask-set-priority`, `geckotask-set-recur`, `geckotask-add-remove-tags`, `geckotask-normalize-task` | Step 6 |
| `geckotask-create-project` | README / as needed |
| `geckotask-delete-completed` | Only in a **disposable** test note |

Ribbon **Tasks Panel** = same as `geckotask-open-panel` (Step 3).

---

## Copy-paste sign-off

```text
Before commit:
[ ] npm run typecheck
[ ] npm run lint
[ ] npm run build
[ ] Manual Steps 1–8 (Obsidian)
[ ] (Optional) Steps 9–10

Obsidian version: ___
```
