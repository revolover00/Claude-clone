import fs from "fs";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DocxPdfSpec } from "../types";
import { isArabicText, shapeAndReverseArabic } from "../arabicHelper";

const KACST_FONT_PATH = "/usr/share/fonts/truetype/kacst/KacstLetter.ttf";

export async function generatePdfBuffer(title: string, spec: DocxPdfSpec): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let customArabicFont: PDFFont | null = null;
  if (fs.existsSync(KACST_FONT_PATH)) {
    try {
      const fontBytes = fs.readFileSync(KACST_FONT_PATH);
      customArabicFont = await pdfDoc.embedFont(fontBytes);
    } catch (err) {
      console.warn("Failed embedding Kacst font in PDF:", err);
    }
  }

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const selectFont = (text: string, bold = false): PDFFont => {
    if (isArabicText(text) && customArabicFont) {
      return customArabicFont;
    }
    return bold ? helveticaBold : helvetica;
  };

  const isGlobalRtl = Boolean(spec.rtl);
  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY - neededHeight < MARGIN + 30) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentY = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawTextLine = (text: string, size: number, bold = false, alignRight = false) => {
    const font = selectFont(text, bold);
    const isArabic = isArabicText(text);
    const displayText = isArabic ? shapeAndReverseArabic(text) : text;
    const textWidth = font.widthOfTextAtSize(displayText, size);

    let x = MARGIN;
    if (alignRight || (isArabic && isGlobalRtl)) {
      x = PAGE_WIDTH - MARGIN - textWidth;
    }

    currentPage.drawText(displayText, {
      x,
      y: currentY,
      size,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
    currentY -= size + 8;
  };

  // Draw Title
  const isTitleRtl = isArabicText(title) || isGlobalRtl;
  drawTextLine(title, 22, true, isTitleRtl);
  currentY -= 12;

  for (const element of spec.elements) {
    const elRtl = Boolean(element.rtl ?? isGlobalRtl);

    switch (element.type) {
      case "heading": {
        const size = element.level === 1 ? 18 : element.level === 2 ? 15 : 13;
        checkPageBreak(size + 24);
        currentY -= 10;
        drawTextLine(element.text, size, true, elRtl);
        break;
      }

      case "paragraph": {
        checkPageBreak(28);
        drawTextLine(element.text, 11, Boolean(element.bold), elRtl);
        break;
      }

      case "bullet_list": {
        for (const item of element.items) {
          checkPageBreak(20);
          const bulletPrefix = elRtl ? "" : "• ";
          const bulletSuffix = elRtl ? " •" : "";
          drawTextLine(`${bulletPrefix}${item}${bulletSuffix}`, 11, false, elRtl);
        }
        break;
      }

      case "table": {
        const rowHeight = 24;
        const totalRows = (element.headers ? 1 : 0) + element.rows.length;
        const colCount = Math.max(
          element.headers?.length || 0,
          ...element.rows.map((r) => r.length)
        );
        if (colCount === 0) break;

        const colWidth = CONTENT_WIDTH / colCount;

        checkPageBreak(rowHeight * 2);

        // Headers
        if (element.headers && element.headers.length > 0) {
          currentPage.drawRectangle({
            x: MARGIN,
            y: currentY - 18,
            width: CONTENT_WIDTH,
            height: rowHeight,
            color: rgb(0.94, 0.95, 0.96),
          });

          element.headers.forEach((h, cIdx) => {
            const font = selectFont(h, true);
            const isAr = isArabicText(h);
            const txt = isAr ? shapeAndReverseArabic(h) : h;
            const x = elRtl
              ? PAGE_WIDTH - MARGIN - (cIdx + 1) * colWidth + 5
              : MARGIN + cIdx * colWidth + 5;
            currentPage.drawText(txt, {
              x,
              y: currentY - 12,
              size: 10,
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
          });
          currentY -= rowHeight;
        }

        // Rows
        for (const r of element.rows) {
          checkPageBreak(rowHeight);
          r.forEach((cell, cIdx) => {
            const font = selectFont(cell, false);
            const isAr = isArabicText(cell);
            const txt = isAr ? shapeAndReverseArabic(cell) : cell;
            const x = elRtl
              ? PAGE_WIDTH - MARGIN - (cIdx + 1) * colWidth + 5
              : MARGIN + cIdx * colWidth + 5;
            currentPage.drawText(txt, {
              x,
              y: currentY - 12,
              size: 10,
              font,
              color: rgb(0.2, 0.2, 0.2),
            });
          });
          currentY -= rowHeight;
        }
        currentY -= 10;
        break;
      }

      case "image": {
        try {
          const res = await fetch(element.url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const imgBytes = new Uint8Array(arrayBuf);
            let img;
            try {
              img = await pdfDoc.embedPng(imgBytes);
            } catch {
              img = await pdfDoc.embedJpg(imgBytes);
            }

            const imgWidth = Math.min(element.width || 350, CONTENT_WIDTH);
            const imgHeight = element.height || (imgWidth * img.height) / img.width;

            checkPageBreak(imgHeight + 20);
            currentPage.drawImage(img, {
              x: (PAGE_WIDTH - imgWidth) / 2,
              y: currentY - imgHeight,
              width: imgWidth,
              height: imgHeight,
            });
            currentY -= imgHeight + 15;
          }
        } catch (imgErr) {
          console.warn("Could not load PDF image:", imgErr);
        }
        break;
      }

      case "page_break": {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - MARGIN;
        break;
      }
    }
  }

  // Draw Page Numbers if enabled
  if (spec.pageNumbers) {
    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const page = pdfDoc.getPage(i);
      const pageText = `${i + 1} / ${totalPages}`;
      const textWidth = helvetica.widthOfTextAtSize(pageText, 9);
      page.drawText(pageText, {
        x: (PAGE_WIDTH - textWidth) / 2,
        y: 20,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
