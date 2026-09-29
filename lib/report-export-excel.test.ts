import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { buildDataSheet, coerceExcelNumericCell } from "@/lib/report-export-excel";

describe("buildDataSheet", () => {
  it("applies hyperlinks from cellLinks matrix", async () => {
    const workbook = new ExcelJS.Workbook();
    const headers = ["Rank", "Content URL"];
    const rows = [["1", "https://example.com/post/1"]];
    const cellLinks: (string | null)[][] = [[null, "https://example.com/post/1"]];

    buildDataSheet(workbook, "Submissions", headers, rows, { cellLinks });

    const ws = workbook.getWorksheet("Submissions");
    assert.ok(ws);

    const urlCell = ws.getRow(2).getCell(2);
    const value = urlCell.value as {
      text: string;
      hyperlink: string;
      tooltip: string;
    };
    assert.equal(value.text, "https://example.com/post/1");
    assert.equal(value.hyperlink, "https://example.com/post/1");
    assert.equal(urlCell.hyperlink, "https://example.com/post/1");
  });

  it("stores numeric metric columns as numbers for Excel sorting", async () => {
    const workbook = new ExcelJS.Workbook();
    const headers = ["Rank", "Views", "Likes"];
    const rows = [["1", "2,623,130", "134,972"]];

    buildDataSheet(workbook, "Submissions", headers, rows);

    const ws = workbook.getWorksheet("Submissions");
    assert.ok(ws);
    assert.equal(ws.getRow(2).getCell(1).value, 1);
    assert.equal(ws.getRow(2).getCell(2).value, 2623130);
    assert.equal(ws.getRow(2).getCell(3).value, 134972);
  });

  it("keeps data rows at a fixed height without wrap text", async () => {
    const workbook = new ExcelJS.Workbook();
    const headers = ["Rank", "Video / Post Title"];
    const longTitle = "A".repeat(500);
    const rows = [["1", longTitle]];

    buildDataSheet(workbook, "Submissions", headers, rows);

    const ws = workbook.getWorksheet("Submissions");
    assert.ok(ws);
    assert.equal(ws.properties.defaultRowHeight, 18);
    assert.equal(ws.getRow(2).height, 18);
    assert.equal(ws.getRow(2).alignment?.wrapText, false);
    assert.equal(ws.getRow(2).getCell(2).value, longTitle);
  });
});

describe("coerceExcelNumericCell", () => {
  it("parses comma-separated integers", () => {
    assert.equal(coerceExcelNumericCell("Views", "2,623,130"), 2623130);
    assert.equal(coerceExcelNumericCell("Rank", "1"), 1);
  });
});
