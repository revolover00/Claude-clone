import ExcelJS from "exceljs";
import { XlsxSpec } from "../types";
import { isArabicText } from "../arabicHelper";

export async function generateXlsxBuffer(title: string, spec: XlsxSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Studio";
  workbook.title = title;
  workbook.created = new Date();

  const isGlobalRtl = Boolean(spec.rtl);

  for (const sheetSpec of spec.sheets) {
    const isSheetRtl = Boolean(sheetSpec.rtl ?? isGlobalRtl);
    const worksheet = workbook.addWorksheet(sheetSpec.name, {
      views: [{ rightToLeft: isSheetRtl }],
    });

    // Column Widths
    if (sheetSpec.columnWidths && sheetSpec.columnWidths.length > 0) {
      sheetSpec.columnWidths.forEach((w, colIdx) => {
        const col = worksheet.getColumn(colIdx + 1);
        col.width = Math.max(8, w);
      });
    }

    // Rows
    for (const rowData of sheetSpec.rows) {
      const rowValues: any[] = [];
      const cellStyles: Array<{
        bold?: boolean;
        align?: "left" | "center" | "right";
        bgColor?: string;
        color?: string;
        numFmt?: string;
      }> = [];

      rowData.cells.forEach((cell) => {
        if (cell === null || cell === undefined) {
          rowValues.push("");
          cellStyles.push({});
        } else if (typeof cell === "object") {
          if (cell.formula) {
            rowValues.push({
              formula: cell.formula.startsWith("=") ? cell.formula.slice(1) : cell.formula,
              result: cell.value,
            });
          } else {
            rowValues.push(cell.value);
          }
          cellStyles.push({
            bold: cell.bold,
            align: cell.align,
            bgColor: cell.backgroundColor?.replace("#", ""),
            color: cell.textColor?.replace("#", ""),
            numFmt: cell.format,
          });
        } else {
          rowValues.push(cell);
          cellStyles.push({});
        }
      });

      const addedRow = worksheet.addRow(rowValues);

      // Apply cell styling
      addedRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const style = cellStyles[colNumber - 1];
        if (style) {
          if (style.bold) {
            cell.font = { ...(cell.font || {}), bold: true };
          }
          if (style.color) {
            cell.font = { ...(cell.font || {}), color: { argb: `FF${style.color}` } };
          }
          if (style.bgColor) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: `FF${style.bgColor}` },
            };
          }
          if (style.numFmt) {
            cell.numFmt = style.numFmt;
          }
          if (style.align) {
            cell.alignment = { horizontal: style.align };
          } else if (isSheetRtl || isArabicText(String(cell.value || ""))) {
            cell.alignment = { horizontal: "right" };
          }
        } else if (isSheetRtl || isArabicText(String(cell.value || ""))) {
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    // Auto-fit column widths if not explicitly provided
    if (!sheetSpec.columnWidths || sheetSpec.columnWidths.length === 0) {
      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const val = cell.value ? String(cell.value) : "";
          if (val.length > maxLength) {
            maxLength = Math.min(val.length + 3, 40);
          }
        });
        column.width = maxLength;
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
