import PptxGenJS from "pptxgenjs";
import { PptxSpec } from "../types";
import { isArabicText } from "../arabicHelper";

export async function generatePptxBuffer(title: string, spec: PptxSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();

  pptx.title = title;
  pptx.layout = "LAYOUT_16x9";

  const isGlobalRtl = Boolean(spec.rtl);
  const primaryColor = spec.theme?.primaryColor || "1E3A8A"; // Deep Navy
  const textColor = spec.theme?.textColor || "1F2937"; // Charcoal
  const bgColor = spec.theme?.backgroundColor || "FFFFFF";

  // First slide: Title Slide if not already explicit
  const firstSlideSpec = spec.slides[0];
  const hasDedicatedTitle =
    firstSlideSpec &&
    firstSlideSpec.title === title &&
    (!firstSlideSpec.bullets || firstSlideSpec.bullets.length === 0);

  if (!hasDedicatedTitle) {
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: bgColor };
    const isTitleArabic = isArabicText(title) || isGlobalRtl;

    titleSlide.addText(title, {
      x: 0.8,
      y: 2.2,
      w: 8.4,
      h: 1.8,
      fontSize: 36,
      bold: true,
      color: primaryColor,
      align: isTitleArabic ? "right" : "left",
      fontFace: "Arial",
      rtl: isTitleArabic,
    });

    titleSlide.addText("Generated with AI Studio", {
      x: 0.8,
      y: 4.2,
      w: 8.4,
      h: 0.6,
      fontSize: 16,
      color: "6B7280",
      align: isTitleArabic ? "right" : "left",
      fontFace: "Arial",
      rtl: isTitleArabic,
    });
  }

  for (const slideSpec of spec.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };

    const isSlideRtl = Boolean(slideSpec.rtl ?? isGlobalRtl);

    // Slide Title
    if (slideSpec.title) {
      slide.addText(slideSpec.title, {
        x: 0.8,
        y: 0.6,
        w: 8.4,
        h: 0.9,
        fontSize: 26,
        bold: true,
        color: primaryColor,
        align: isSlideRtl ? "right" : "left",
        fontFace: "Arial",
        rtl: isSlideRtl,
      });
    }

    // Slide Subtitle
    if (slideSpec.subtitle) {
      slide.addText(slideSpec.subtitle, {
        x: 0.8,
        y: 1.5,
        w: 8.4,
        h: 0.6,
        fontSize: 16,
        color: "4B5563",
        align: isSlideRtl ? "right" : "left",
        fontFace: "Arial",
        rtl: isSlideRtl,
      });
    }

    // Bullets or Paragraphs
    const textItems = slideSpec.bullets || slideSpec.paragraphs || [];
    if (textItems.length > 0) {
      const startY = slideSpec.subtitle ? 2.3 : 1.8;
      const textObjects = textItems.map((item) => ({
        text: item,
        options: {
          fontSize: 16,
          color: textColor,
          bullet: Boolean(slideSpec.bullets && slideSpec.bullets.length > 0),
          breakLine: true,
          fontFace: "Arial",
          rtl: isSlideRtl,
        },
      }));

      const contentWidth = slideSpec.imageUrl ? 4.8 : 8.4;
      const contentX = isSlideRtl && slideSpec.imageUrl ? 4.4 : 0.8;

      slide.addText(textObjects, {
        x: contentX,
        y: startY,
        w: contentWidth,
        h: 4.0,
        align: isSlideRtl ? "right" : "left",
        valign: "top",
      });
    }

    // Image
    if (slideSpec.imageUrl) {
      const imgX = isSlideRtl ? 0.8 : 5.8;
      slide.addImage({
        path: slideSpec.imageUrl,
        x: imgX,
        y: 1.8,
        w: 3.4,
        h: 3.4,
      });
    }

    // Speaker Notes
    if (slideSpec.speakerNotes) {
      slide.addNotes(slideSpec.speakerNotes);
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
