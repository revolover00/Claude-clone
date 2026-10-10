import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun,
} from "docx";
import { DocxPdfSpec, DocElement } from "../types";
import { isArabicText } from "../arabicHelper";

export async function generateDocxBuffer(title: string, spec: DocxPdfSpec): Promise<Buffer> {
  const isGlobalRtl = Boolean(spec.rtl);
  const children: any[] = [];

  // Title heading
  const isTitleArabic = isArabicText(title) || isGlobalRtl;
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: isTitleArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: isTitleArabic,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 36, // 18pt
          font: "Arial",
          rightToLeft: isTitleArabic,
        }),
      ],
    })
  );

  for (const element of spec.elements) {
    const elRtl = Boolean(element.rtl ?? isGlobalRtl);

    switch (element.type) {
      case "heading": {
        const hLevel =
          element.level === 1
            ? HeadingLevel.HEADING_1
            : element.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
        const size = element.level === 1 ? 30 : element.level === 2 ? 26 : 22;

        children.push(
          new Paragraph({
            heading: hLevel,
            alignment: elRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            bidirectional: elRtl,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: element.text,
                bold: true,
                size,
                font: "Arial",
                rightToLeft: elRtl,
              }),
            ],
          })
        );
        break;
      }

      case "paragraph": {
        children.push(
          new Paragraph({
            alignment: elRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            bidirectional: elRtl,
            spacing: { after: 140, line: 300 },
            children: [
              new TextRun({
                text: element.text,
                bold: Boolean(element.bold),
                italics: Boolean(element.italic),
                size: 22, // 11pt
                font: "Arial",
                rightToLeft: elRtl,
              }),
            ],
          })
        );
        break;
      }

      case "bullet_list": {
        for (const item of element.items) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              alignment: elRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              bidirectional: elRtl,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: item,
                  size: 22,
                  font: "Arial",
                  rightToLeft: elRtl,
                }),
              ],
            })
          );
        }
        break;
      }

      case "table": {
        const rows: TableRow[] = [];

        if (element.headers && element.headers.length > 0) {
          rows.push(
            new TableRow({
              tableHeader: true,
              children: element.headers.map(
                (h) =>
                  new TableCell({
                    shading: { fill: "F3F4F6" },
                    children: [
                      new Paragraph({
                        alignment: elRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                        bidirectional: elRtl,
                        children: [
                          new TextRun({
                            text: h,
                            bold: true,
                            size: 20,
                            font: "Arial",
                            rightToLeft: elRtl,
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            })
          );
        }

        for (const r of element.rows) {
          rows.push(
            new TableRow({
              children: r.map(
                (cellText) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: elRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                        bidirectional: elRtl,
                        children: [
                          new TextRun({
                            text: String(cellText),
                            size: 20,
                            font: "Arial",
                            rightToLeft: elRtl,
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            })
          );
        }

        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        break;
      }

      case "image": {
        try {
          const res = await fetch(element.url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: Buffer.from(arrayBuf),
                    transformation: {
                      width: element.width || 450,
                      height: element.height || 260,
                    },
                    type: "png",
                  }),
                ],
              })
            );
            if (element.caption) {
              children.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: element.caption,
                      italics: true,
                      size: 18,
                      font: "Arial",
                    }),
                  ],
                })
              );
            }
          }
        } catch (imgErr) {
          console.warn(`Could not load docx image URL: ${element.url}`, imgErr);
        }
        break;
      }

      case "page_break": {
        children.push(new Paragraph({ pageBreakBefore: true }));
        break;
      }
    }
  }

  const footers = spec.pageNumbers
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: isGlobalRtl ? AlignmentType.LEFT : AlignmentType.RIGHT,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
                  size: 18,
                  font: "Arial",
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  const doc = new Document({
    creator: spec.author || "AI Studio",
    title,
    sections: [
      {
        properties: {},
        footers,
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
