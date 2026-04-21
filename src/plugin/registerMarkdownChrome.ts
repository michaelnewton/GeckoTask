import { MarkdownView } from "obsidian";
import type GeckoTaskPlugin from "../main";
import { isInAnyArea, isInInboxFolder } from "../utils/areaUtils";
import { styleTaskFieldsInMarkdown, updateMarkdownViewStyling } from "../styling/MarkdownStyler";
import { createTaskFieldDecorator } from "../extensions/TaskFieldDecorator";
import { createCheckboxClickHandler } from "../extensions/CheckboxClickHandler";
import { handleTaskCheckboxToggle } from "../services/taskCheckboxToggle";

/**
 * Registers markdown preview styling, editor decorations, checkbox handling, and workspace hooks for markdown view chrome.
 */
export function registerMarkdownChrome(plugin: GeckoTaskPlugin): void {
  plugin.registerMarkdownPostProcessor((element, context) => {
    if (
      context.sourcePath &&
      (isInAnyArea(context.sourcePath, plugin.settings) || isInInboxFolder(context.sourcePath, plugin.settings))
    ) {
      plugin.registerInterval(
        window.setTimeout(() => {
          styleTaskFieldsInMarkdown(element);
        }, 0)
      );
    }
  });

  plugin.registerEditorExtension(createTaskFieldDecorator(plugin.app, plugin.settings));

  plugin.registerEditorExtension(
    createCheckboxClickHandler(plugin.app, plugin.settings, (editor, view, lineNo) =>
      handleTaskCheckboxToggle(editor, view, lineNo)
    )
  );

  plugin.registerEvent(
    plugin.app.workspace.on("file-open", (file) => {
      updateMarkdownViewStyling(plugin.app, plugin.settings, file);
    })
  );

  plugin.registerEvent(
    plugin.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) {
        updateMarkdownViewStyling(plugin.app, plugin.settings, leaf.view.file);
        plugin.registerInterval(
          window.setTimeout(
            () => updateMarkdownViewStyling(plugin.app, plugin.settings, (leaf.view as MarkdownView).file),
            100
          )
        );
      }
    })
  );

  plugin.registerEvent(
    plugin.app.workspace.on("layout-change", () => {
      plugin.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView) {
          updateMarkdownViewStyling(plugin.app, plugin.settings, leaf.view.file);
        }
      });
    })
  );

  plugin.app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      updateMarkdownViewStyling(plugin.app, plugin.settings, leaf.view.file);
    }
  });

  plugin.registerInterval(
    window.setTimeout(() => {
      plugin.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView) {
          updateMarkdownViewStyling(plugin.app, plugin.settings, leaf.view.file);
        }
      });
    }, 500)
  );
}
