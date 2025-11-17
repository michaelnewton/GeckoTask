import { App, MarkdownView, TFile } from "obsidian";
import { EditorView } from "@codemirror/view";
import { GeckoTaskSettings } from "../settings";
import { isInTasksFolder } from "../utils/areaUtils";

/**
 * Styles @ labels in markdown preview by wrapping them in spans.
 * Only processes text nodes that aren't already inside a geckotask-label span.
 * @param element - The markdown preview element
 */
export function styleLabelsInMarkdown(element: HTMLElement): void {
  // Pattern to match labels like @ppl/Libby, @person/Name, @label, etc.
  const labelPattern = /(@[\w/-]+)/g;
  
  // Walk through all text nodes in the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip if already inside a geckotask-label span or inside a tag/link
    const parent = node.parentElement;
    if (parent?.classList.contains("geckotask-label") || 
        parent?.classList.contains("tag") ||
        parent?.classList.contains("geckotask-field") ||
        parent?.tagName === "A") {
      continue;
    }
    textNodes.push(node as Text);
  }
  
  // Process each text node
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || "";
    const matches = Array.from(text.matchAll(labelPattern));
    
    if (matches.length === 0) return;
    
    // Create a document fragment to hold the replacements
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    
    matches.forEach((match) => {
      // Add text before the label
      if (match.index !== undefined && match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }
      
      // Create span for the label
      const labelSpan = document.createElement("span");
      labelSpan.className = "geckotask-label";
      labelSpan.textContent = match[0];
      fragment.appendChild(labelSpan);
      
      lastIndex = (match.index || 0) + match[0].length;
    });
    
    // Add remaining text after the last label
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the text node with the fragment
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

/**
 * Updates the styling class on markdown views based on whether the file is in the tasks folder.
 * @param app - The Obsidian app instance
 * @param settings - Plugin settings
 * @param file - The file to check, or null to remove styling from all views
 */
export function updateMarkdownViewStyling(app: App, settings: GeckoTaskSettings, file: TFile | null): void {
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      const viewEl = leaf.view.containerEl;
      const viewFile = leaf.view.file;
      
      // Check if this view's file is in the tasks folder
      if (viewFile && isInTasksFolder(viewFile.path, settings)) {
        // Add class to container
        viewEl.classList.add("mod-geckotask-styled");
        
        // Also add to content area if it exists (for better targeting)
        const contentEl = viewEl.querySelector(".markdown-source-view, .markdown-preview-view, .markdown-reading-view");
        if (contentEl) {
          contentEl.classList.add("mod-geckotask-styled");
        }
        
        // Also add to CodeMirror editor if it exists (for source view)
        if (leaf.view.editor) {
          const cmEditor = (leaf.view.editor as any).cm as EditorView | undefined;
          if (cmEditor) {
            const cmEl = cmEditor.dom;
            if (cmEl) {
              cmEl.classList.add("mod-geckotask-styled");
            }
          }
        }
      } else {
        // Remove class from container
        viewEl.classList.remove("mod-geckotask-styled");
        
        // Also remove from content area
        const contentEl = viewEl.querySelector(".markdown-source-view, .markdown-preview-view, .markdown-reading-view");
        if (contentEl) {
          contentEl.classList.remove("mod-geckotask-styled");
        }
        
        // Also remove from CodeMirror editor
        if (leaf.view.editor) {
          const cmEditor = (leaf.view.editor as any).cm as EditorView | undefined;
          if (cmEditor) {
            const cmEl = cmEditor.dom;
            if (cmEl) {
              cmEl.classList.remove("mod-geckotask-styled");
            }
          }
        }
      }
    }
  });
}

/**
 * Styles task metadata fields (priority::, due::, etc.) in markdown preview by wrapping them in spans.
 * Only processes text nodes that aren't already inside a geckotask-field span.
 * @param element - The markdown preview element
 */
export function styleTaskFieldsInMarkdown(element: HTMLElement): void {
  // Pattern to match task fields like "priority:: urgent", "due:: 2025-11-07", "recur:: every Tuesday", etc.
  // Matches: fieldname:: value (where fieldname is one of the allowed field keys)
  // Value can be single word or multiple words, but stops at next field, tag, newline, or end
  const fieldKeys = "(?:due|scheduled|priority|recur|area|completion|origin_file|origin_project|origin_area)";
  // Pattern: fieldname:: value (value stops at newline, next field/tag, or end)
  // Match value as one or more words (non-whitespace, non-hash, non-newline), separated by single spaces
  // Stop before newline, next field, tag, or end
  const fieldPattern = new RegExp(`\\b(${fieldKeys})::\\s*([^\\n\\s#]+(?: [^\\n\\s#]+)*?)(?=\\s+${fieldKeys}::|\\s+#|\\n|$)`, "gi");
  
  // Walk through all text nodes in the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip if already inside a geckotask-field span or inside a tag/link
    const parent = node.parentElement;
    if (parent?.classList.contains("geckotask-field") ||
        parent?.classList.contains("tag") ||
        parent?.classList.contains("geckotask-label") ||
        parent?.tagName === "A") {
      continue;
    }
    textNodes.push(node as Text);
  }
  
  // Process each text node
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || "";
    
    // Reset regex lastIndex to ensure fresh matching
    fieldPattern.lastIndex = 0;
    const matches = Array.from(text.matchAll(fieldPattern));
    
    if (matches.length === 0) return;
    
    // Create a document fragment to hold the replacements
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    
    matches.forEach((match) => {
      // Add text before the field
      if (match.index !== undefined && match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }
      
      // Create span for the field
      const fieldSpan = document.createElement("span");
      fieldSpan.className = "geckotask-field";
      
      // Add the field key (e.g., "priority::")
      const keySpan = document.createElement("span");
      keySpan.className = "geckotask-field-key";
      keySpan.textContent = match[1] + "::";
      fieldSpan.appendChild(keySpan);
      
      // Add a space
      fieldSpan.appendChild(document.createTextNode(" "));
      
      // Add the field value (e.g., "urgent")
      const valueSpan = document.createElement("span");
      valueSpan.className = "geckotask-field-value";
      valueSpan.textContent = match[2].trim();
      fieldSpan.appendChild(valueSpan);
      
      fragment.appendChild(fieldSpan);
      
      lastIndex = (match.index || 0) + match[0].length;
    });
    
    // Add remaining text after the last field
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the text node with the fragment
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

