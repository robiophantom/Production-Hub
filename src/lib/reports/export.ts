import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportTable } from "./core";

const BRAND = "2563EB";
const BRAND_DARK = "1E3A8A";
const SLATE = "475569";

function excelColumnWidth(fraction: number): number {
  return Math.max(10, Math.round(fraction * 150));
}

export async function reportToExcel(report: ReportTable): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Company A Production Hub";
  workbook.created = new Date();
  workbook.subject = report.title;

  const sheetName = report.title
    .replace(/[[\]:*?/\\]/g, "")
    .slice(0, 31) || "Report";
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const columnCount = report.columns.length;
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = report.title;
  titleCell.font = { size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_DARK}` } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, columnCount);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = report.subtitle;
  subtitleCell.font = { size: 9, color: { argb: `FF${SLATE}` } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  sheet.getRow(2).height = 32;

  const headerRow = sheet.getRow(4);
  report.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = {
      vertical: "middle",
      horizontal: column.align === "right" ? "right" : "left",
      wrapText: true,
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: `FF${BRAND_DARK}` } },
    };
    sheet.getColumn(index + 1).width = excelColumnWidth(column.width);
  });
  headerRow.height = 26;

  report.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    report.columns.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = row[columnIndex] ?? "";
      cell.font = { size: 9, color: { argb: "FF1F2937" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: column.align === "right" ? "right" : "left",
        wrapText: false,
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      if (rowIndex % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
    excelRow.height = 18;
  });

  if (report.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + report.rows.length, column: columnCount },
    };
  }

  const footerRow = sheet.getRow(6 + report.rows.length);
  const footerCell = footerRow.getCell(1);
  footerCell.value = "Company A Production Hub · Confidential — internal management reporting";
  footerCell.font = { size: 8, italic: true, color: { argb: `FF${SLATE}` } };
  sheet.mergeCells(6 + report.rows.length, 1, 6 + report.rows.length, columnCount);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const FOOTER_HEIGHT = 24;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

export async function reportToPdf(report: ReportTable): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(report.title);
  document.setAuthor("Company A Production Hub");
  document.setSubject(report.subtitle);
  document.setCreator("Company A Production Hub reporting");
  document.setProducer("Company A Production Hub");

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const widths = report.columns.map((column) => column.width * tableWidth);
  const headerHeight = 20;
  const rowHeight = 17;

  let page: PDFPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawPageHeader(target: PDFPage, first: boolean): number {
    let cursor = PAGE_HEIGHT - MARGIN;
    if (first) {
      target.drawText("COMPANY A · PRODUCTION HUB", {
        x: MARGIN,
        y: cursor - 10,
        size: 8,
        font: bold,
        color: rgb(0.14, 0.39, 0.92),
      });
      cursor -= 30;
      target.drawText(report.title, {
        x: MARGIN,
        y: cursor,
        size: 18,
        font: bold,
        color: rgb(0.12, 0.23, 0.54),
      });
      cursor -= 18;
    } else {
      target.drawText(report.title, {
        x: MARGIN,
        y: cursor - 8,
        size: 12,
        font: bold,
        color: rgb(0.12, 0.23, 0.54),
      });
      cursor -= 26;
    }

    const subtitleLines = wrapText(report.subtitle, regular, 8.5, tableWidth).slice(0, 3);
    for (const line of subtitleLines) {
      target.drawText(line, {
        x: MARGIN,
        y: cursor - 8,
        size: 8.5,
        font: regular,
        color: rgb(0.29, 0.33, 0.41),
      });
      cursor -= 12;
    }
    return cursor - 14;
  }

  function drawTableHeader(target: PDFPage, top: number): number {
    target.drawRectangle({
      x: MARGIN,
      y: top - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.14, 0.39, 0.92),
    });
    let x = MARGIN;
    report.columns.forEach((column, index) => {
      const width = widths[index];
      const text = fitText(column.header, bold, 8, width - 8);
      const textWidth = bold.widthOfTextAtSize(text, 8);
      const textX = column.align === "right" ? x + width - 4 - textWidth : x + 4;
      target.drawText(text, {
        x: textX,
        y: top - 13,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += width;
    });
    return top - headerHeight;
  }

  y = drawPageHeader(page, true);
  y = drawTableHeader(page, y);

  report.rows.forEach((row, rowIndex) => {
    if (y - rowHeight < MARGIN + FOOTER_HEIGHT) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawPageHeader(page, false);
      y = drawTableHeader(page, y);
    }
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.97, 0.98, 0.99),
      });
    }
    let x = MARGIN;
    report.columns.forEach((column, index) => {
      const width = widths[index];
      const value = String(row[index] ?? "");
      const text = fitText(value, regular, 8, width - 8);
      const textWidth = regular.widthOfTextAtSize(text, 8);
      const textX = column.align === "right" ? x + width - 4 - textWidth : x + 4;
      page.drawText(text, {
        x: textX,
        y: y - 12,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.16, 0.22),
      });
      x += width;
    });
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight },
      end: { x: MARGIN + tableWidth, y: y - rowHeight },
      thickness: 0.4,
      color: rgb(0.88, 0.91, 0.94),
    });
    y -= rowHeight;
  });

  const pages = document.getPages();
  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: MARGIN, y: MARGIN + 12 },
      end: { x: MARGIN + tableWidth, y: MARGIN + 12 },
      thickness: 0.5,
      color: rgb(0.88, 0.91, 0.94),
    });
    current.drawText("Company A Production Hub · Confidential internal report", {
      x: MARGIN,
      y: MARGIN,
      size: 7.5,
      font: regular,
      color: rgb(0.42, 0.46, 0.53),
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = regular.widthOfTextAtSize(label, 7.5);
    current.drawText(label, {
      x: PAGE_WIDTH - MARGIN - width,
      y: MARGIN,
      size: 7.5,
      font: regular,
      color: rgb(0.42, 0.46, 0.53),
    });
  });

  return document.save();
}
