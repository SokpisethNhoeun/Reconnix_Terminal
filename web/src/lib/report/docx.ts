/* The Word (.docx) report, built from the blocks in `docx-blocks.ts` with no extra Node
   dependencies: a .docx is a zip of a few XML parts, and node:zlib does the compression.
   Every value is XML-escaped (tool output and operator text stay text), and the evidence it
   shows was masked before it was saved. Server-only, like the other renderers. */
import "server-only";

import { deflateRawSync } from "node:zlib";

import type { Assessment } from "@/lib/data/schema";

import { type DocBlock, docxBlocks } from "./docx-blocks";

/* --- XML ---------------------------------------------------------------------------------- */
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Escape text for XML, dropping control characters XML 1.0 can't carry. */
export function xmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One run of text; line breaks inside it become <w:br/>. */
function run(text: string, rpr = ""): string {
  const props = rpr ? `<w:rPr>${rpr}</w:rPr>` : "";
  const parts = text.split("\n").map((line) => `<w:t xml:space="preserve">${xmlText(line)}</w:t>`);
  return `<w:r>${props}${parts.join("<w:br/>")}</w:r>`;
}

function para(text: string, style?: string): string {
  const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${props}${run(text)}</w:p>`;
}

const LINE = 'w:val="single" w:sz="4" w:color="D0D5DD"';
const BORDERS = ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} ${LINE}/>`).join("");

function table(head: string[] | null, rows: string[][]): string {
  const cell = (text: string, header: boolean) =>
    `<w:tc><w:tcPr>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="17305A"/>' : ""}</w:tcPr>` +
    `<w:p>${run(text, header ? '<w:b/><w:color w:val="FFFFFF"/>' : "")}</w:p></w:tc>`;
  const body = [
    ...(head ? [`<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h) => cell(h, true)).join("")}</w:tr>`] : []),
    ...rows.map((r) => `<w:tr>${r.map((c) => cell(c, false)).join("")}</w:tr>`),
  ];
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${BORDERS}</w:tblBorders>` +
    `<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `${body.join("")}</w:tbl><w:p/>`
  );
}

const STYLE_OF: Record<string, string> = {
  title: "Title", subtitle: "Subtitle", h1: "Heading1", h2: "Heading2", quote: "Quote", note: "Note",
};

function blockXml(b: DocBlock): string {
  if (b.kind === "table") return table(b.head, b.rows);
  return para(b.text, STYLE_OF[b.kind]);
}

function documentXml(blocks: DocBlock[]): string {
  return (
    `${XML_HEAD}<w:document xmlns:w="${W}"><w:body>${blocks.map(blockXml).join("")}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`
  );
}

const style = (id: string, name: string, ppr: string, rpr: string) =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>` +
  `<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;

const STYLES =
  `${XML_HEAD}<w:styles xmlns:w="${W}">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
  `<w:sz w:val="21"/><w:color w:val="141A24"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
  style("Title", "Title", '<w:spacing w:after="60"/>', '<w:b/><w:sz w:val="44"/><w:color w:val="0E1F3E"/>') +
  style("Subtitle", "Subtitle", '<w:spacing w:after="240"/>', '<w:sz w:val="24"/><w:color w:val="434D5C"/>') +
  style("Heading1", "heading 1", '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>',
    '<w:b/><w:sz w:val="30"/><w:color w:val="17305A"/>') +
  style("Heading2", "heading 2", '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>',
    '<w:b/><w:sz w:val="24"/><w:color w:val="17305A"/>') +
  style("Quote", "Quote", '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="17305A"/></w:pBdr><w:ind w:left="284"/>',
    '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/><w:color w:val="434D5C"/>') +
  style("Note", "Note", "", '<w:b/><w:sz w:val="18"/><w:color w:val="B42318"/>') +
  `</w:styles>`;

const CONTENT_TYPES =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `</Types>`;

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;

/* --- zip ---------------------------------------------------------------------------------- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive (deflate) of the given text files, in order. */
export function zip(files: [string, string][]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.from(text, "utf8");
    const packed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0x00210000, 10); // 1980-01-01 00:00
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(0x00210000, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** The report as a .docx file. */
export function renderDocx(assessment: Assessment, now: Date = new Date()): Buffer {
  return zip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["word/document.xml", documentXml(docxBlocks(assessment, now))],
    ["word/_rels/document.xml.rels", DOC_RELS],
    ["word/styles.xml", STYLES],
  ]);
}
