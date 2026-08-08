function asciiText(value: unknown) {
  return String(value ?? "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(value: string, maxLength: number) {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function textCommand(x: number, y: number, size: number, text: string) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET\n`;
}

function buildPages(rows: unknown[][], title: string) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const lineHeight = 13;
  const maxLineLength = 112;
  const pages: string[] = [];
  let page = "";
  let y = pageHeight - margin;
  let pageNo = 1;

  function addHeader() {
    page += textCommand(margin, y, 14, asciiText(title));
    y -= 20;
    page += textCommand(margin, y, 8, `Generated at ${new Date().toISOString()}`);
    y -= 18;
  }

  function flushPage() {
    page += textCommand(margin, 24, 8, `Page ${pageNo}`);
    pages.push(page);
    page = "";
    y = pageHeight - margin;
    pageNo += 1;
  }

  addHeader();
  rows.forEach((row, index) => {
    const text = row.map(asciiText).join(" | ");
    const wrapped = wrapLine(text, maxLineLength);
    const neededHeight = wrapped.length * lineHeight + (index === 0 ? 6 : 0);
    if (y - neededHeight < margin) {
      flushPage();
      addHeader();
    }
    if (index === 0) {
      page += textCommand(margin, y, 9, wrapped[0] ?? "");
      y -= lineHeight + 4;
      return;
    }
    for (const line of wrapped) {
      page += textCommand(margin, y, 8, line);
      y -= lineHeight;
    }
  });
  flushPage();
  return pages;
}

export function makePdf(rows: unknown[][], title = "Workflow report") {
  const pages = buildPages(rows, title);
  const objects: Array<{ id: number; body: string }> = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>` },
    { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" }
  ];

  pages.forEach((content, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push({
      id: pageObjectId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    });
    objects.push({
      id: contentObjectId,
      body: `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream`
    });
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects.sort((left, right) => left.id - right.id)) {
    offsets[object.id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
