"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskFieldDecorator = createTaskFieldDecorator;
const obsidian_1 = require("obsidian");
const view_1 = require("@codemirror/view");
const state_1 = require("@codemirror/state");
const areaUtils_1 = require("../utils/areaUtils");
/**
 * Creates a CodeMirror ViewPlugin that decorates task metadata fields in source/editing mode.
 * @param app - The Obsidian app instance
 * @param settings - Plugin settings
 * @returns ViewPlugin instance
 */
function createTaskFieldDecorator(app, settings) {
    return view_1.ViewPlugin.fromClass(class {
        constructor(view) {
            this.view = view;
            this.decorations = this.buildDecorations(view);
        }
        update(update) {
            // Rebuild decorations if document changed or viewport changed
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }
        buildDecorations(view) {
            const builder = new state_1.RangeSetBuilder();
            // Get the file associated with this view by finding the MarkdownView
            // The editor view is part of a MarkdownView in Obsidian
            let file = null;
            // Try to find the file by iterating through all leaves
            app.workspace.iterateAllLeaves((leaf) => {
                if (leaf.view instanceof obsidian_1.MarkdownView && leaf.view.editor) {
                    // Check if this editor's CodeMirror view matches
                    const editorView = leaf.view.editor.cm;
                    if (editorView === view) {
                        file = leaf.view.file;
                        return false; // Stop iteration
                    }
                }
            });
            if (!file || !(0, areaUtils_1.isInTasksFolder)(file.path, settings)) {
                return builder.finish();
            }
            const { doc } = view.state;
            const text = doc.toString();
            // Pattern to match task fields like "priority:: urgent", "due:: 2025-11-07", etc.
            // Matches: fieldname:: value (where fieldname is one of the allowed field keys)
            // Value can be single word or multiple words, but stops at next field, tag, newline, or end
            // Match each field separately - value stops at whitespace before next field/tag or newline
            const fieldKeys = "(?:due|scheduled|priority|recur|area|completion|origin_file|origin_project|origin_area)";
            // Pattern: fieldname:: value (value stops at newline, next field/tag, or end)
            // Match value as one or more words (non-whitespace, non-hash, non-newline), separated by single spaces
            // Stop before newline, next field, tag, or end
            const fieldPattern = new RegExp(`\\b(${fieldKeys})::\\s*([^\\n\\s#]+(?: [^\\n\\s#]+)*?)(?=\\s+${fieldKeys}::|\\s+#|\\n|$)`, "gi");
            let match;
            while ((match = fieldPattern.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                // Create decoration with geckotask-field class
                const decoration = view_1.Decoration.mark({
                    class: "geckotask-field",
                    attributes: {
                        "data-field-key": match[1],
                        "data-field-value": match[2].trim()
                    }
                });
                builder.add(start, end, decoration);
            }
            return builder.finish();
        }
    }, {
        decorations: (v) => v.decorations,
    });
}
