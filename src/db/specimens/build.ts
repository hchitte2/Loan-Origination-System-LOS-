/**
 * Builds the three specimen PDFs the fixture points at.
 *
 *   npx tsx src/db/specimens/build.ts
 *
 * Run once; the PDFs are committed beside this file and `pnpm seed:files` uploads them
 * to `seed/` in Blob, where the nightly reset never touches them. Regenerate only to
 * change the wording, then re-run `pnpm seed:files` and update `SPECIMENS` in `seed.ts`
 * with the new byte sizes, which the needs list displays.
 *
 * The PDFs are written by hand rather than with a library: three static one-page
 * documents do not justify a dependency, and a demo must never ship a document that
 * could be mistaken for a real one — every page carries a SPECIMEN watermark, and every
 * name, address and figure is invented (PLAN.md §6 invariant 7).
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** US Letter, in PDF points. */
const WIDTH = 612;
const HEIGHT = 792;

type Line = { text: string; bold?: boolean; size?: number; gap?: number };

/** PDF strings escape backslashes and both parentheses. */
function pdfString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * The page's drawing commands: the diagonal watermark first so everything else sits on
 * top of it, then the title block, then the body lines.
 */
function contentStream(title: string, lines: Line[]): string {
  const parts: string[] = [];

  // Watermark: light grey, rotated 45°, centred low-left so it crosses the whole page.
  parts.push(
    "q",
    "0.85 0.85 0.85 rg",
    "BT",
    "/F2 46 Tf",
    "0.7071 0.7071 -0.7071 0.7071 96 330 Tm",
    `(${pdfString("SPECIMEN - SYNTHETIC")}) Tj`,
    "ET",
    "Q",
  );

  parts.push(
    "q",
    "0 0 0 rg",
    "BT",
    "/F2 20 Tf",
    `1 0 0 1 64 ${HEIGHT - 84} Td`,
  );
  parts.push(`(${pdfString(title)}) Tj`, "ET", "Q");

  // A rule under the title.
  parts.push(
    "q",
    "0.6 0.6 0.6 RG",
    "1 w",
    `64 ${HEIGHT - 98} m ${WIDTH - 64} ${HEIGHT - 98} l S`,
    "Q",
  );

  let y = HEIGHT - 132;
  parts.push("q", "0.1 0.1 0.1 rg", "BT", `1 0 0 1 64 ${y} Td`);
  let previousSize = 0;
  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "/F2" : "/F1";
    parts.push(`${font} ${size} Tf`);
    const gap = line.gap ?? (previousSize === 0 ? 0 : Math.round(size * 1.6));
    if (gap > 0) parts.push(`0 -${gap} Td`);
    parts.push(`(${pdfString(line.text)}) Tj`);
    previousSize = size;
    y -= gap;
  }
  parts.push("ET", "Q");

  return parts.join("\n");
}

/** Assemble the objects, compute the xref offsets, and return the file bytes. */
function buildPdf(title: string, lines: Line[]): Buffer {
  const content = contentStream(title, lines);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
      "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

const NOTICE: Line = {
  text: "This is a synthetic sample used in a product demonstration. It is not a real document.",
  size: 9,
  gap: 34,
};

const SPECIMENS: { file: string; title: string; lines: Line[] }[] = [
  {
    file: "specimen-pay-stub.pdf",
    title: "Earnings Statement",
    lines: [
      { text: "Northgate Provisions Co.", bold: true, size: 13 },
      { text: "1400 Aldergrove Blvd, Austin TX 78702" },
      {
        text: "Employee: M. Chen          Pay period: Aug 16 - Aug 31",
        gap: 30,
      },
      { text: "Earnings", bold: true, gap: 30 },
      { text: "Regular            80.00 hrs        3,120.00" },
      { text: "Overtime            4.50 hrs          263.25" },
      { text: "Gross pay                            3,383.25", bold: true },
      { text: "Deductions", bold: true, gap: 30 },
      { text: "Withholding                            487.10" },
      { text: "Benefits                               162.00" },
      { text: "Net pay                              2,734.15", bold: true },
      NOTICE,
    ],
  },
  {
    file: "specimen-w2.pdf",
    title: "Wage and Tax Statement",
    lines: [
      { text: "Tax year 2025", bold: true, size: 13 },
      { text: "Employer: Northgate Provisions Co." },
      { text: "Employee: M. Chen" },
      {
        text: "Box 1  Wages, tips, other compensation      81,240.00",
        gap: 30,
      },
      { text: "Box 2  Federal income tax withheld          11,690.00" },
      { text: "Box 3  Social security wages                81,240.00" },
      { text: "Box 5  Medicare wages and tips              81,240.00" },
      { text: "Box 16 State wages                          81,240.00" },
      NOTICE,
    ],
  },
  {
    file: "specimen-bank-statement.pdf",
    title: "Account Statement",
    lines: [
      { text: "Lakeshore Mutual Bank", bold: true, size: 13 },
      { text: "Statement period: Aug 1 - Aug 31" },
      { text: "Account: Checking ending 4021" },
      { text: "Opening balance                          9,412.66", gap: 30 },
      { text: "Deposits and credits                     5,468.30" },
      { text: "Withdrawals and debits                   4,133.51" },
      { text: "Closing balance                         10,747.45", bold: true },
      { text: "Recent activity", bold: true, gap: 30 },
      { text: "Aug 04  Payroll deposit                  2,734.15" },
      { text: "Aug 12  Rent                            -1,850.00" },
      { text: "Aug 18  Payroll deposit                  2,734.15" },
      { text: "Aug 29  Utilities                         -218.44" },
      NOTICE,
    ],
  },
];

for (const specimen of SPECIMENS) {
  const bytes = buildPdf(specimen.title, specimen.lines);
  writeFileSync(path.join(HERE, specimen.file), bytes);
  console.log(`${specimen.file.padEnd(30)} ${bytes.length} bytes`);
}
