export type DocumentFormat = "docx" | "pdf" | "pptx" | "xlsx";

export interface DocElementHeading {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3;
  rtl?: boolean;
}

export interface DocElementParagraph {
  type: "paragraph";
  text: string;
  bold?: boolean;
  italic?: boolean;
  rtl?: boolean;
}

export interface DocElementBulletList {
  type: "bullet_list";
  items: string[];
  rtl?: boolean;
}

export interface DocElementTable {
  type: "table";
  headers?: string[];
  rows: string[][];
  rtl?: boolean;
}

export interface DocElementImage {
  type: "image";
  url: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface DocElementPageBreak {
  type: "page_break";
}

export type DocElement =
  | DocElementHeading
  | DocElementParagraph
  | DocElementBulletList
  | DocElementTable
  | DocElementImage
  | DocElementPageBreak;

export interface DocxPdfSpec {
  rtl?: boolean;
  author?: string;
  pageNumbers?: boolean;
  elements: DocElement[];
}

export interface SlideSpec {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  paragraphs?: string[];
  imageUrl?: string;
  speakerNotes?: string;
  rtl?: boolean;
}

export interface PptxSpec {
  rtl?: boolean;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  slides: SlideSpec[];
}

export interface SheetCell {
  value: string | number | boolean | null;
  type?: "string" | "number" | "boolean" | "formula";
  formula?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  backgroundColor?: string;
  textColor?: string;
  format?: string;
}

export interface SheetRow {
  cells: (SheetCell | string | number | boolean | null)[];
}

export interface SheetSpec {
  name: string;
  rtl?: boolean;
  columnWidths?: number[];
  rows: SheetRow[];
}

export interface XlsxSpec {
  rtl?: boolean;
  sheets: SheetSpec[];
}

export type DocumentSpec = DocxPdfSpec | PptxSpec | XlsxSpec;

export interface GeneratedDocument {
  id: string;
  format: DocumentFormat;
  title: string;
  fileName: string;
  size: number;
  url: string;
  createdAt: number;
  spec?: any;
  error?: string;
}

export interface CreateDocumentInput {
  format: DocumentFormat;
  title: string;
  spec: any;
  userId?: string;
}
