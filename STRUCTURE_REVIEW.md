# Code Structure & Quality Review

## Executive Summary

The codebase is well-organized overall with good separation of concerns. However, there are several opportunities for improvement, particularly around file size and component extraction.

**Overall Grade: B+**

---

## 1. File Size Analysis

### Critical Issues (Files > 1000 lines)

#### ⚠️ `src/view/WeeklyReviewPanel.ts` - **2,199 lines**
**Status:** Needs significant refactoring

**Issues:**
- Contains 10 different step rendering methods (`renderStep1A`, `renderStep1B`, etc.)
- Each step has its own complex UI rendering logic
- State management mixed with UI rendering
- Hard to maintain and test

**Recommendation:** Split into:
```
src/view/weekly-review/
  ├── WeeklyReviewPanel.ts (main class, ~200 lines)
  ├── WeeklyReviewState.ts (state management)
  ├── steps/
  │   ├── Step1A.ts (Loose Ends)
  │   ├── Step1B.ts (Empty Head)
  │   ├── Step1C.ts (Process Inbox)
  │   ├── Step2A.ts (Next Actions)
  │   ├── Step2B.ts (Calendar Past)
  │   ├── Step2C.ts (Calendar Future)
  │   ├── Step2D.ts (Projects)
  │   ├── Step2E.ts (Waiting For)
  │   ├── Step2F.ts (Someday Maybe)
  │   └── Step3A.ts (Brainstorm)
  └── components/
      ├── TaskCard.ts (reusable task card)
      ├── ProjectCard.ts (reusable project card)
      └── WizardNavigation.ts (step navigation)
```

#### ⚠️ `src/view/TasksPanel.ts` - **1,300 lines**
**Status:** Could benefit from splitting

**Issues:**
- Combines filtering, rendering, task management, and UI logic
- Multiple rendering methods (`renderTabs`, `renderFilters`, `renderList`)
- Complex filtering logic embedded in the class

**Recommendation:** Split into:
```
src/view/tasks/
  ├── TasksPanel.ts (main class, ~300 lines)
  ├── TasksFilter.ts (filtering logic)
  ├── TasksRenderer.ts (rendering logic)
  └── components/
      ├── TaskItem.ts (individual task rendering)
      ├── FilterBar.ts (filter UI)
      └── TabBar.ts (tab navigation)
```

### Moderate Issues (Files 500-1000 lines)

#### `src/view/HealthPanel.ts` - **713 lines**
**Status:** Acceptable but could be improved

**Recommendation:** Extract rendering methods into separate components if it grows further.

#### `src/services/HealthService.ts` - **704 lines**
**Status:** Well-organized with clear function separation

**Recommendation:** Consider splitting into:
- `HealthMetrics.ts` (metrics calculation)
- `HealthIssues.ts` (issue identification)
- `HealthSuggestions.ts` (cleanup suggestions)

---

## 2. Folder Structure Analysis

### Current Structure ✅
```
src/
├── commands/          ✅ Good
├── extensions/        ✅ Good
├── models/           ✅ Good
├── services/         ✅ Good
├── settings.ts       ⚠️ Consider moving to settings/
├── styling/          ✅ Good
├── ui/               ✅ Good
├── utils/            ✅ Good
└── view/             ⚠️ Could be better organized
```

### Recommendations

1. **Create `src/settings/` folder:**
   ```
   src/settings/
   ├── index.ts (export settings)
   ├── SettingsTab.ts (settings UI)
   └── defaults.ts (DEFAULT_SETTINGS)
   ```

2. **Organize `src/view/` by feature:**
   ```
   src/view/
   ├── tasks/
   │   ├── TasksPanel.ts
   │   ├── TasksPanelTypes.ts
   │   └── components/
   ├── weekly-review/
   │   ├── WeeklyReviewPanel.ts
   │   ├── WeeklyReviewPanelTypes.ts
   │   └── steps/
   └── health/
       ├── HealthPanel.ts
       └── HealthPanelTypes.ts
   ```

3. **Consider `src/types/` for shared types:**
   ```
   src/types/
   ├── Task.ts (Task, IndexedTask)
   └── Common.ts (shared types)
   ```

---

## 3. Naming Conventions

### ✅ Good Practices
- Classes: PascalCase (`TasksPanel`, `FilePickerModal`)
- Functions: camelCase (`formatISODate`, `loadTasksFromFile`)
- Interfaces: PascalCase (`GeckoTaskSettings`, `Task`)
- Constants: UPPER_SNAKE_CASE or camelCase (mixed - could be more consistent)

### ⚠️ Inconsistencies

1. **View Type Constants:**
   - `VIEW_TYPE_TASKS` ✅
   - `VIEW_TYPE_WEEKLY_REVIEW` ✅
   - `VIEW_TYPE_HEALTH` ✅
   - All consistent, good!

2. **Utility File Naming:**
   - `areaUtils.ts` ✅
   - `dateUtils.ts` ✅
   - `editorUtils.ts` ✅
   - `fileUtils.ts` ✅
   - `somedayMaybeUtils.ts` ⚠️ (inconsistent - should be `somedayMaybeUtils.ts` or `someday-maybe-utils.ts`)
   - `taskLoader.ts` ⚠️ (should be `taskUtils.ts` or `taskLoaderUtils.ts` for consistency)
   - `viewUtils.ts` ✅

3. **Service File Naming:**
   - All services use PascalCase: `Archive.ts`, `TaskOps.ts`, etc. ✅

### Recommendations

1. **Standardize utility file naming:**
   - Option A: All `*Utils.ts` (rename `taskLoader.ts` → `taskUtils.ts`)
   - Option B: Keep descriptive names but be consistent

2. **Consider grouping related utilities:**
   ```
   src/utils/
   ├── task/
   │   ├── taskLoader.ts
   │   └── taskParser.ts
   ├── date/
   │   └── dateUtils.ts
   └── area/
       └── areaUtils.ts
   ```

---

## 4. Library & Dependency Analysis

### Current Dependencies ✅
```json
{
  "devDependencies": {
    "builtin-modules": "^5.0.0",  // ✅ Build tool
    "esbuild": "^0.25.12",         // ✅ Modern bundler
    "obsidian": "latest",          // ✅ Required
    "typescript": "5.6.3"          // ✅ Required
  }
}
```

### External Libraries Used

1. **Obsidian API** ✅
   - Properly used throughout
   - No issues

2. **CodeMirror** ✅
   - Used via Obsidian's exposed APIs
   - Properly externalized in build config

3. **Moment.js** ⚠️
   - Used via `(window as any).moment()`
   - Not ideal but acceptable for Obsidian plugins
   - **Recommendation:** Consider creating a date utility wrapper to abstract this

### Recommendations

1. **Create date utility abstraction:**
   ```typescript
   // src/utils/dateUtils.ts (extend existing)
   export function formatDate(date: Date, format: string): string {
     // Use moment if available, fallback to native
     if ((window as any).moment) {
       return (window as any).moment(date).format(format);
     }
     // Fallback implementation
   }
   ```

2. **No additional dependencies needed** ✅
   - Codebase is lean and dependency-free
   - Good for Obsidian plugin distribution

---

## 5. Code Organization & Separation of Concerns

### ✅ Well-Organized Areas

1. **Services Layer:**
   - Clear separation: `Archive.ts`, `TaskOps.ts`, `VaultIO.ts`
   - Single responsibility principle followed

2. **Models:**
   - `TaskModel.ts` centralizes task parsing/formatting
   - Good abstraction

3. **UI Components:**
   - Modals properly separated
   - Reusable components

4. **Utilities:**
   - Good separation by domain (date, area, editor, etc.)

### ⚠️ Areas for Improvement

1. **View Classes Mix Concerns:**
   - UI rendering + state management + business logic
   - **Recommendation:** Extract rendering to separate classes/components

2. **Settings File:**
   - `settings.ts` contains both interface and UI
   - **Recommendation:** Split into `settings/index.ts` and `settings/SettingsTab.ts`

---

## 6. Type Safety & TypeScript Usage

### ✅ Good Practices
- Strict mode enabled
- Interfaces properly defined
- Type exports are clear

### ⚠️ Minor Issues

1. **`as any` Usage:**
   - Some necessary (CodeMirror internals)
   - Some could be improved with proper types
   - **Recommendation:** Create type definitions for Obsidian internals where possible

2. **Type Imports:**
   - Good use of `import type` where appropriate ✅

---

## 7. Specific Recommendations

### High Priority

1. **Split `WeeklyReviewPanel.ts`** (2,199 lines)
   - Extract step renderers to separate files
   - Create reusable components
   - **Impact:** High maintainability improvement

2. **Split `TasksPanel.ts`** (1,300 lines)
   - Extract filtering logic
   - Extract rendering logic
   - **Impact:** Medium maintainability improvement

3. **Reorganize `view/` folder**
   - Group by feature (tasks/, weekly-review/, health/)
   - **Impact:** Better organization, easier navigation

### Medium Priority

4. **Standardize utility file naming**
   - Rename `taskLoader.ts` → `taskUtils.ts` OR
   - Keep descriptive names but document convention
   - **Impact:** Consistency

5. **Split `settings.ts`**
   - Move to `settings/` folder
   - Separate interface from UI
   - **Impact:** Better organization

6. **Create date utility wrapper**
   - Abstract moment.js usage
   - **Impact:** Easier to replace moment.js later

### Low Priority

7. **Consider `src/types/` folder**
   - Move shared types out of view-specific files
   - **Impact:** Better type organization

8. **Extract HealthService functions**
   - Split into separate files if it grows
   - **Impact:** Future-proofing

---

## 8. File Naming Consistency Check

### Current Pattern Analysis

| Category | Pattern | Examples | Status |
|----------|---------|----------|--------|
| Services | PascalCase.ts | `Archive.ts`, `TaskOps.ts` | ✅ Consistent |
| Utils | camelCaseUtils.ts | `areaUtils.ts`, `dateUtils.ts` | ⚠️ Mostly consistent |
| Views | PascalCase.ts | `TasksPanel.ts` | ✅ Consistent |
| UI | PascalCase.ts | `FilePickerModal.ts` | ✅ Consistent |
| Types | PascalCaseTypes.ts | `TasksPanelTypes.ts` | ✅ Consistent |
| Models | PascalCase.ts | `TaskModel.ts` | ✅ Consistent |

### Recommendation
- **Standardize:** All utility files should end with `Utils.ts`
- **Action:** Rename `taskLoader.ts` → `taskUtils.ts` OR document that descriptive names are acceptable

---

## 9. Build & Configuration

### ✅ Good
- Modern build setup (esbuild)
- Proper externalization of Obsidian/CodeMirror
- TypeScript strict mode
- Source maps in dev mode

### No Issues Found
- Build configuration is optimal
- No unnecessary dependencies
- Proper bundling strategy

---

## 10. Summary & Action Items

### Critical (Do First)
1. ✅ Split `WeeklyReviewPanel.ts` into smaller components
2. ✅ Split `TasksPanel.ts` into smaller components
3. ✅ Reorganize `view/` folder by feature

### Important (Do Soon)
4. ⚠️ Standardize utility file naming
5. ⚠️ Split `settings.ts` into `settings/` folder
6. ⚠️ Create date utility wrapper

### Nice to Have (Future)
7. 📝 Consider `src/types/` folder
8. 📝 Extract HealthService if it grows
9. 📝 Improve type safety for Obsidian internals

---

## Conclusion

The codebase is **well-structured overall** with good separation of concerns. The main issues are:

1. **File size** - Two view files are too large and should be split
2. **Organization** - View folder could be better organized by feature
3. **Naming** - Minor inconsistencies in utility file naming

**Overall Assessment:** The codebase follows good practices and is maintainable. The recommended changes would improve maintainability and make the code easier to navigate, but the current structure is functional and not problematic.

**Priority Focus:** Start with splitting the large view files, as this will have the biggest impact on maintainability.

