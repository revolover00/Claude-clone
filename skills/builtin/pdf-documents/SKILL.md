---
name: pdf-documents
description: "Generates publication-quality PDF documents with headings, paragraphs, bullet lists, tables, images, and page numbers. Use when users ask to create PDF files, printable summaries, invoices, brochures, or whitepapers. Features built-in RTL and Arabic font support. Triggers: create pdf, generate pdf, pdf document, export to pdf, make a pdf, إنشاء ملف pdf, مستند بي دي إف, تقرير pdf, وثيقة pdf."
license: MIT
version: 1.0.0
---

# PDF Documents Creation (.pdf)

Use the server function `create_document({ format: "pdf", title, spec })` to generate a standalone PDF document.

## How to fill the spec

1. **Structure First**: Organize pages cleanly:
   - Clear Title
   - Section headings (`level: 1 | 2 | 3`)
   - Paragraphs with `bold: true` or regular text
   - Bullet lists (`items: string[]`)
   - Tables (`headers: string[]`, `rows: string[][]`)
   - Page numbers (`pageNumbers: true`)
   - Explicit page breaks (`{ "type": "page_break" }`)

2. **Concise Text**: Keep text scannable and well-spaced.

3. **Arabic & RTL Handling**:
   - For Arabic text, set `rtl: true`.
   - The PDF generator automatically applies Arabic font embedding (Kacst) and right-to-left layout alignment.

## Example Call

```json
{
  "format": "pdf",
  "title": "Business Proposal Summary",
  "spec": {
    "rtl": false,
    "pageNumbers": true,
    "elements": [
      { "type": "heading", "level": 1, "text": "Project Overview" },
      { "type": "paragraph", "text": "This proposal provides an end-to-end roadmap for modernization." },
      { "type": "bullet_list", "items": ["Phase 1: Architecture audit", "Phase 2: Cloud migration"] },
      { "type": "table", "headers": ["Phase", "Duration", "Cost"], "rows": [["Phase 1", "2 weeks", "$8,000"], ["Phase 2", "6 weeks", "$24,000"]] }
    ]
  }
}
```
