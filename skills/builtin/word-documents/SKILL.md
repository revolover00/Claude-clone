---
name: word-documents
description: "Generates formatted Microsoft Word (.docx) documents from structured JSON specifications with headings, paragraphs, bullet lists, tables, images, and page numbers. Use when users ask to create Word documents, formal reports, contracts, manuals, or letters in .docx format. Supports English and RTL Arabic typography. Triggers: create word doc, generate docx, word document, write a report in word, إنشاء ملف وورد, مستند وورد, تقرير وورد, وثيقة docx."
license: MIT
version: 1.0.0
---

# Word Documents Creation (.docx)

Use the server function `create_document({ format: "docx", title, spec })` to generate a professional Word document.

## How to fill the spec

1. **Structure First**: Plan the document hierarchy logically:
   - Document Title
   - Headings (level 1 for main sections, level 2 for subsections, level 3 for details)
   - Paragraphs (set `bold: true` or `italic: true` where emphasis is needed)
   - Bullet lists (`items: string[]`)
   - Tables (`headers: string[]`, `rows: string[][]`)
   - Page numbers (`pageNumbers: true`)
   - Page breaks (`{ type: "page_break" }`)

2. **Concise Text**: Write polished, structured, and informative text directly into the elements.

3. **Arabic & RTL Handling**:
   - For Arabic text or right-to-left layout, set `rtl: true` at the root spec or element level.
   - The docx generator automatically enables bidirectional paragraph formatting and right-aligned text runs.

## Example Call

```json
{
  "format": "docx",
  "title": "Quarterly Performance Report",
  "spec": {
    "rtl": false,
    "pageNumbers": true,
    "elements": [
      { "type": "heading", "level": 1, "text": "Executive Summary" },
      { "type": "paragraph", "text": "This report outlines our strategic deliverables and operational milestones." },
      { "type": "bullet_list", "items": ["Delivered project milestone 1", "Achieved 99.9% uptime"] },
      { "type": "table", "headers": ["Metric", "Target", "Actual"], "rows": [["Revenue", "$1.2M", "$1.4M"], ["NPS", "70", "78"]] }
    ]
  }
}
```
