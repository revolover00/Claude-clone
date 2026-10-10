import { CreateDocumentInput, DocxPdfSpec, PptxSpec, XlsxSpec } from "./types";
import { isArabicText } from "./arabicHelper";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedSpec?: any;
}

export const MAX_PAGES_SLIDES_SHEETS = 100;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function validateDocumentInput(input: CreateDocumentInput): ValidationResult {
  if (!input) return { valid: false, error: "Missing document input" };
  const { format, title, spec } = input;

  if (!["docx", "pdf", "pptx", "xlsx"].includes(format)) {
    return { valid: false, error: `Invalid format: "${format}". Allowed: docx, pdf, pptx, xlsx.` };
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return { valid: false, error: "Document 'title' is required." };
  }
  if (title.length > 250) {
    return { valid: false, error: "Document 'title' exceeds 250 characters." };
  }

  if (!spec || typeof spec !== "object") {
    return { valid: false, error: "Document 'spec' must be a valid JSON object." };
  }

  switch (format) {
    case "docx":
    case "pdf":
      return validateDocxPdfSpec(spec, title);
    case "pptx":
      return validatePptxSpec(spec, title);
    case "xlsx":
      return validateXlsxSpec(spec, title);
    default:
      return { valid: false, error: `Unsupported format: ${format}` };
  }
}

function validateDocxPdfSpec(rawSpec: any, title: string): ValidationResult {
  if (!Array.isArray(rawSpec.elements)) {
    return { valid: false, error: "Docx/PDF spec requires an 'elements' array." };
  }

  if (rawSpec.elements.length > 500) {
    return { valid: false, error: "Exceeded max element limit (500)." };
  }

  const pageBreaks = rawSpec.elements.filter((el: any) => el?.type === "page_break").length;
  if (pageBreaks >= MAX_PAGES_SLIDES_SHEETS) {
    return { valid: false, error: `Exceeded max page limit (${MAX_PAGES_SLIDES_SHEETS}).` };
  }

  const hasArabic = isArabicText(title) || rawSpec.elements.some((el: any) => {
    if (el?.text && isArabicText(el.text)) return true;
    if (Array.isArray(el?.items) && el.items.some((i: any) => typeof i === "string" && isArabicText(i))) return true;
    if (Array.isArray(el?.rows) && el.rows.some((r: any) => Array.isArray(r) && r.some((c: any) => typeof c === "string" && isArabicText(c)))) return true;
    return false;
  });

  const validElements: any[] = [];
  for (const el of rawSpec.elements) {
    if (!el || typeof el !== "object" || !el.type) {
      return { valid: false, error: "Each element in 'elements' must have a 'type'." };
    }
    const type = el.type;
    if (!["heading", "paragraph", "bullet_list", "table", "image", "page_break"].includes(type)) {
      return { valid: false, error: `Invalid element type: "${type}".` };
    }

    if (type === "heading" || type === "paragraph") {
      if (typeof el.text !== "string") {
        return { valid: false, error: `${type} element requires string 'text'.` };
      }
    } else if (type === "bullet_list") {
      if (!Array.isArray(el.items)) {
        return { valid: false, error: "bullet_list element requires array 'items'." };
      }
    } else if (type === "table") {
      if (!Array.isArray(el.rows)) {
        return { valid: false, error: "table element requires array 'rows'." };
      }
    } else if (type === "image") {
      if (!el.url || typeof el.url !== "string") {
        return { valid: false, error: "image element requires 'url'." };
      }
    }

    validElements.push({
      ...el,
      rtl: el.rtl ?? (el.text ? isArabicText(el.text) : (hasArabic || Boolean(rawSpec.rtl))),
    });
  }

  const normalized: DocxPdfSpec = {
    rtl: Boolean(rawSpec.rtl || hasArabic),
    pageNumbers: rawSpec.pageNumbers ?? true,
    author: rawSpec.author || "AI Studio",
    elements: validElements,
  };

  return { valid: true, normalizedSpec: normalized };
}

function validatePptxSpec(rawSpec: any, title: string): ValidationResult {
  if (!Array.isArray(rawSpec.slides)) {
    return { valid: false, error: "PowerPoint spec requires a 'slides' array." };
  }

  if (rawSpec.slides.length === 0) {
    return { valid: false, error: "PowerPoint spec requires at least 1 slide." };
  }

  if (rawSpec.slides.length > MAX_PAGES_SLIDES_SHEETS) {
    return { valid: false, error: `Exceeded max slide limit (${MAX_PAGES_SLIDES_SHEETS}).` };
  }

  const hasArabic = isArabicText(title) || rawSpec.slides.some((s: any) =>
    (s?.title && isArabicText(s.title)) ||
    (s?.subtitle && isArabicText(s.subtitle)) ||
    (Array.isArray(s?.bullets) && s.bullets.some((b: any) => typeof b === "string" && isArabicText(b)))
  );

  const normalizedSlides = rawSpec.slides.map((s: any) => ({
    title: typeof s?.title === "string" ? s.title : "",
    subtitle: typeof s?.subtitle === "string" ? s.subtitle : undefined,
    bullets: Array.isArray(s?.bullets) ? s.bullets.filter((b: any) => typeof b === "string") : [],
    speakerNotes: typeof s?.speakerNotes === "string" ? s.speakerNotes : undefined,
    imageUrl: typeof s?.imageUrl === "string" ? s.imageUrl : undefined,
    rtl: s?.rtl ?? (isArabicText(s?.title || "") || hasArabic || Boolean(rawSpec.rtl)),
  }));

  const normalized: PptxSpec = {
    rtl: Boolean(rawSpec.rtl || hasArabic),
    theme: rawSpec.theme || {},
    slides: normalizedSlides,
  };

  return { valid: true, normalizedSpec: normalized };
}

function validateXlsxSpec(rawSpec: any, title: string): ValidationResult {
  if (!Array.isArray(rawSpec.sheets)) {
    return { valid: false, error: "Excel spec requires a 'sheets' array." };
  }

  if (rawSpec.sheets.length === 0) {
    return { valid: false, error: "Excel spec requires at least 1 sheet." };
  }

  if (rawSpec.sheets.length > MAX_PAGES_SLIDES_SHEETS) {
    return { valid: false, error: `Exceeded max sheet limit (${MAX_PAGES_SLIDES_SHEETS}).` };
  }

  const hasArabic = isArabicText(title) || rawSpec.sheets.some((sh: any) =>
    (sh?.name && isArabicText(sh.name)) ||
    (Array.isArray(sh?.rows) && sh.rows.some((r: any) =>
      Array.isArray(r?.cells) && r.cells.some((c: any) =>
        typeof c === "string" ? isArabicText(c) : (typeof c?.value === "string" && isArabicText(c.value))
      )
    ))
  );

  const normalizedSheets = rawSpec.sheets.map((sh: any, idx: number) => {
    const sheetName = typeof sh?.name === "string" && sh.name.trim() ? sh.name.trim() : `Sheet${idx + 1}`;
    const rows = Array.isArray(sh?.rows) ? sh.rows : [];
    if (rows.length > 10000) {
      throw new Error(`Sheet "${sheetName}" exceeds maximum 10,000 rows.`);
    }
    return {
      name: sheetName.slice(0, 31), // Excel sheet name limit is 31 chars
      rtl: Boolean(sh?.rtl ?? (hasArabic || rawSpec.rtl)),
      columnWidths: Array.isArray(sh?.columnWidths) ? sh.columnWidths : undefined,
      rows: rows.map((r: any) => ({
        cells: Array.isArray(r?.cells) ? r.cells : (Array.isArray(r) ? r : []),
      })),
    };
  });

  const normalized: XlsxSpec = {
    rtl: Boolean(rawSpec.rtl || hasArabic),
    sheets: normalizedSheets,
  };

  return { valid: true, normalizedSpec: normalized };
}
