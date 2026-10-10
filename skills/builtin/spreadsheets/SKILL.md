---
name: spreadsheets
description: "Generates Microsoft Excel spreadsheets (.xlsx) with multi-sheet workbooks, formatted tables, typed cells, calculations and formulas, custom column widths, and visual styles. Use when users ask to create spreadsheets, financial models, budgets, inventory trackers, or data tables in .xlsx format. Supports RTL Arabic sheets. Triggers: create spreadsheet, excel sheet, generate xlsx, financial model, budget sheet, إنشاء جدول إكسل, جدول بيانات, ملف إكسل, حسابات مالية."
license: MIT
version: 1.0.0
---

# Spreadsheets Creation (.xlsx)

Use the server function `create_document({ format: "xlsx", title, spec })` to generate an Excel spreadsheet.

## How to fill the spec

1. **Structure First**: Plan the workbook sheets and column widths:
   - Sheet name (`name: string`)
   - Explicit column widths (`columnWidths: number[]`)
   - Header row with bold styling and background fill
   - Data rows with typed values (numbers, strings, booleans)
   - Formula cells (`{ formula: "SUM(C2:C10)", value: 0 }`)
   - Number formats (`format: "$#,##0.00"` or `"0.0%"`)

2. **Concise Text**: Keep headers and cell labels clear and standardized.

3. **Arabic & RTL Handling**:
   - For Arabic sheets, set `rtl: true` on the sheet or root spec.
   - Excel will display columns from Right to Left with right-aligned text.

## Example Call

```json
{
  "format": "xlsx",
  "title": "Annual Department Budget",
  "spec": {
    "rtl": false,
    "sheets": [
      {
        "name": "Q1 Budget",
        "columnWidths": [24, 15, 15, 18],
        "rows": [
          {
            "cells": [
              { "value": "Department", "bold": true, "backgroundColor": "E5E7EB" },
              { "value": "Budget", "bold": true, "backgroundColor": "E5E7EB" },
              { "value": "Actual", "bold": true, "backgroundColor": "E5E7EB" },
              { "value": "Variance", "bold": true, "backgroundColor": "E5E7EB" }
            ]
          },
          {
            "cells": [
              "Engineering",
              { "value": 50000, "format": "$#,##0" },
              { "value": 46000, "format": "$#,##0" },
              { "formula": "B2-C2", "value": 4000, "format": "$#,##0" }
            ]
          }
        ]
      }
    ]
  }
}
```
