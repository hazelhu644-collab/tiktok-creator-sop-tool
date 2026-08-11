import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseCreatorFile } from "./fileParser";

describe("real-world spreadsheet shapes", () => {
  const HEADERS = ["达人账号", "产品", "合作状态"];

  function xlsxFile(sheets: Array<[string, unknown[][]]>): File {
    const workbook = XLSX.utils.book_new();
    for (const [name, aoa] of sheets)
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(aoa),
        name,
      );
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    return fileFrom(new Uint8Array(buffer), "creators.xlsx");
  }

  function fileFrom(bytes: Uint8Array, name: string): File {
    return {
      name,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    } as unknown as File;
  }

  const textFile = (text: string, name = "creators.csv") =>
    fileFrom(new TextEncoder().encode(text), name);

  it("skips a title row above the headers", async () => {
    const { rows, report } = await parseCreatorFile(
      xlsxFile([
        [
          "Sheet1",
          [["8月达人合作表"], [], HEADERS, ["alice", "蒸汽梳", "Delivered"]],
        ],
      ]),
    );

    expect(report.headerRow).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("alice");
  });

  it("matches headers broken by line breaks or stray spaces", async () => {
    const { rows } = await parseCreatorFile(
      xlsxFile([
        [
          "Sheet1",
          [
            ["达人\n账号", "产 品"],
            ["alice", "蒸汽梳"],
          ],
        ],
      ]),
    );

    expect(rows[0].username).toBe("alice");
    expect(rows[0].product).toBe("蒸汽梳");
  });

  it("reads the sheet holding the data, not merely the first one", async () => {
    const { rows, report } = await parseCreatorFile(
      xlsxFile([
        ["使用说明", [["请填写下表"]]],
        ["达人数据", [HEADERS, ["alice", "蒸汽梳", "Delivered"]]],
      ]),
    );

    expect(report.sheetName).toBe("达人数据");
    expect(rows[0].username).toBe("alice");
  });

  it("reads a CSV written with a byte-order mark", async () => {
    const { rows } = await parseCreatorFile(
      textFile("﻿达人账号,产品\nalice,蒸汽梳\n"),
    );

    expect(rows[0].username).toBe("alice");
  });

  it("reads a GBK CSV, which is what Chinese Excel writes", async () => {
    // 达人账号,产品 / alice,蒸汽梳
    const gbk = new Uint8Array([
      0xb4, 0xef, 0xc8, 0xcb, 0xd5, 0xcb, 0xba, 0xc5, 0x2c, 0xb2, 0xfa, 0xc6,
      0xb7, 0x0a, 0x61, 0x6c, 0x69, 0x63, 0x65, 0x2c, 0xd5, 0xf4, 0xc6, 0xfb,
      0xca, 0xe1, 0x0a,
    ]);
    const { rows, report } = await parseCreatorFile(fileFrom(gbk, "a.csv"));

    expect(report.encoding).toBe("GBK");
    expect(rows[0].username).toBe("alice");
  });

  it("reads a workbook that was renamed to .csv", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([HEADERS, ["alice", "蒸汽梳", "Delivered"]]),
      "Sheet1",
    );
    const bytes = new Uint8Array(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    );

    const { rows } = await parseCreatorFile(fileFrom(bytes, "creators.csv"));

    expect(rows[0].username).toBe("alice");
  });

  it("reports unrecognised columns instead of dropping them silently", async () => {
    const { report } = await parseCreatorFile(
      xlsxFile([
        [
          "Sheet1",
          [
            ["达人账号", "佣金比例"],
            ["alice", "20%"],
          ],
        ],
      ]),
    );

    expect(report.matchedColumns).toContain("达人账号");
    expect(report.unmatchedColumns).toEqual(["佣金比例"]);
  });

  it("rejects an empty file with a message that says what to do", async () => {
    await expect(parseCreatorFile(textFile(""))).rejects.toThrow(
      "这个文件是空的",
    );
  });
});
