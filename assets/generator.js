const FORMATS = [
  ["md", "MD", "Markdown"],
  ["html", "HTML", "HTML"],
  ["pdf", "PDF", "PDF"],
  ["docx", "WORD", "Word"],
];

const list = document.querySelector("#documents");
const statusLine = document.querySelector("#status");
const countLine = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const search = document.querySelector("#search");
const clearSearch = document.querySelector("#clear-search");
const categoryFilter = document.querySelector("#category-filter");
const catalogueView = document.querySelector("#catalogue-view");
const documentBanner = document.querySelector("#document-banner");
const previewView = document.querySelector("#preview-view");
const documentPreview = document.querySelector("#document-preview");
const previewTitle = document.querySelector("#preview-title");
const previewCategory = document.querySelector("#preview-category");
const previewDownloads = document.querySelector("#preview-downloads");
const backToCatalogue = document.querySelector("#back-to-catalogue");

let catalog = [];
const documentCache = new Map();
let lastPreviewTrigger = null;

const safeText = (value) => String(value ?? "");

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", isError);
}

function makeCard(item) {
  const card = document.createElement("article");
  card.className = "document-card";
  card.dataset.title = `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase("fr");
  card.dataset.category = item.category;

  const copy = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "document-meta";
  const category = document.createElement("span");
  category.className = "category";
  category.textContent = item.category;
  const sourceType = document.createElement("span");
  sourceType.textContent = "Source JSON";
  meta.append(category, sourceType);

  const title = document.createElement("h3");
  title.className = "document-title";
  const titleButton = document.createElement("button");
  titleButton.type = "button";
  titleButton.className = "document-title-button";
  titleButton.dataset.previewDocumentId = item.id;
  titleButton.textContent = item.title;
  titleButton.setAttribute("aria-label", `Afficher l’aperçu HTML de « ${item.title} »`);
  title.append(titleButton);
  const description = document.createElement("p");
  description.className = "document-description";
  description.textContent = item.description;
  copy.append(meta, title, description);

  card.append(copy);
  return card;
}

function populateFormatButtons(container, item) {
  container.replaceChildren();
  container.setAttribute("aria-label", `Télécharger ${item.title}`);
  for (const [format, label, longLabel] of FORMATS) {
    const button = document.createElement("button");
    button.className = "format-button";
    button.type = "button";
    button.dataset.format = format;
    button.dataset.documentId = item.id;
    button.textContent = label;
    button.title = `Télécharger en ${longLabel}`;
    button.setAttribute("aria-label", `Télécharger « ${item.title} » en ${longLabel}`);
    container.append(button);
  }
}

function updateView() {
  const query = search.value.trim().toLocaleLowerCase("fr");
  const category = categoryFilter.value;
  const visible = [...list.children].filter((card) => {
    const matches = card.dataset.title.includes(query)
      && (category === "all" || card.dataset.category === category);
    card.hidden = !matches;
    return matches;
  });

  countLine.textContent = `${visible.length} ressource${visible.length === 1 ? "" : "s"}`;
  clearSearch.hidden = !search.value;
  if (catalog.length && visible.length === 0) {
    emptyTitle.textContent = "Aucun résultat";
    emptyCopy.textContent = "Essayez un autre mot ou choisissez un autre thème.";
    emptyState.hidden = false;
  } else {
    emptyState.hidden = catalog.length > 0;
  }
}

function escapeHtml(value) {
  return safeText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function usableContent(documentData) {
  if (!documentData || documentData.schemaVersion !== 1 || !Array.isArray(documentData.content)) {
    throw new Error("Le document JSON n’a pas la version attendue.");
  }
  return documentData.content.filter((block) => {
    return !(block.type === "heading" && block.level === 1
      && safeText(block.text).trim() === safeText(documentData.title).trim());
  });
}

async function loadDocument(item) {
  if (documentCache.has(item.id)) return documentCache.get(item.id);
  const response = await fetch(new URL(item.source, document.baseURI));
  if (!response.ok) throw new Error(`La source JSON n’a pas pu être chargée (${response.status}).`);
  const documentData = await response.json();
  usableContent(documentData);
  documentCache.set(item.id, documentData);
  return documentData;
}

async function showPreview(item, trigger) {
  lastPreviewTrigger = trigger;
  setStatus(`Ouverture de l’aperçu : ${item.title}…`);
  try {
    const documentData = await loadDocument(item);
    documentPreview.srcdoc = htmlFor(documentData);
    documentPreview.title = `Aperçu HTML : ${item.title}`;
    previewTitle.textContent = item.title;
    previewCategory.textContent = item.category;
    populateFormatButtons(previewDownloads, item);
    catalogueView.hidden = true;
    previewView.hidden = false;
    documentBanner.hidden = false;
    backToCatalogue.focus({ preventScroll: true });
    setStatus(`Aperçu HTML affiché : ${item.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "L’aperçu HTML n’a pas pu être chargé.", true);
  }
}

function returnToCatalogue() {
  documentBanner.hidden = true;
  previewView.hidden = true;
  catalogueView.hidden = false;
  documentPreview.srcdoc = "";
  setStatus("Catalogue des ressources.");
  if (lastPreviewTrigger?.isConnected) lastPreviewTrigger.focus();
}

function markdownFor(documentData) {
  const chunks = [`# ${documentData.title}`, "", documentData.description || ""];
  for (const block of usableContent(documentData)) {
    if (block.type === "heading") chunks.push(`${"#".repeat(block.level)} ${block.text}`);
    else if (block.type === "paragraph") chunks.push(block.text);
    else if (block.type === "quote") chunks.push(...safeText(block.text).split("\n").map((line) => `> ${line}`));
    else if (block.type === "code") chunks.push(`\`\`\`\n${block.text}\n\`\`\``);
    else if (block.type === "list") {
      block.items.forEach((item, index) => chunks.push(`${block.ordered ? `${index + 1}.` : "-"} ${item}`));
    } else if (block.type === "separator") chunks.push("---");
    chunks.push("");
  }
  return `${chunks.join("\n").trim()}\n`;
}

function htmlFor(documentData) {
  const body = [];
  body.push(`<header><p class="category">${escapeHtml(documentData.category)}</p><h1>${escapeHtml(documentData.title)}</h1><p class="description">${escapeHtml(documentData.description)}</p></header>`);
  for (const block of usableContent(documentData)) {
    if (block.type === "heading") body.push(`<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`);
    else if (block.type === "paragraph") body.push(`<p>${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`);
    else if (block.type === "quote") body.push(`<blockquote>${escapeHtml(block.text).replace(/\n/g, "<br>")}</blockquote>`);
    else if (block.type === "code") body.push(`<pre><code>${escapeHtml(block.text)}</code></pre>`);
    else if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      body.push(`<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`);
    } else if (block.type === "separator") body.push("<hr>");
  }
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(documentData.title)}</title>
<style>body{max-width:760px;margin:64px auto;padding:0 28px;color:#18251f;font:17px/1.7 Georgia,serif}header{margin-bottom:42px;padding-bottom:23px;border-bottom:1px solid #dce4de}.category{color:#35634e;font:700 12px/1.4 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.1em}h1{font-size:42px;line-height:1.1;letter-spacing:-.04em}h2,h3{margin-top:1.8em;font-family:system-ui,sans-serif;line-height:1.25}h2{font-size:25px}h3{font-size:20px}.description{color:#65716b;font:16px/1.6 system-ui,sans-serif}blockquote{margin:24px 0;padding:4px 0 4px 20px;border-left:3px solid #d76545;color:#536259}pre{overflow:auto;padding:18px;background:#f1f4f1;border-radius:6px;font:14px/1.6 ui-monospace,monospace}li{margin:.45em 0}hr{margin:30px 0;border:0;border-top:1px solid #dce4de}@media print{body{margin:22mm auto}}</style></head><body>${body.join("\n")}</body></html>`;
}

function blocksAsLines(documentData) {
  const lines = [{ text: documentData.title, style: "title" }];
  if (documentData.description) lines.push({ text: documentData.description, style: "description" }, { text: "", style: "normal" });
  for (const block of usableContent(documentData)) {
    if (block.type === "heading") lines.push({ text: block.text, style: `heading${block.level}` });
    else if (block.type === "paragraph") lines.push({ text: block.text, style: "normal" });
    else if (block.type === "quote") lines.push({ text: `“${block.text}”`, style: "quote" });
    else if (block.type === "code") lines.push({ text: block.text, style: "code" });
    else if (block.type === "list") block.items.forEach((item, index) => lines.push({ text: `${block.ordered ? `${index + 1}.` : "•"}  ${item}`, style: "normal" }));
    else if (block.type === "separator") lines.push({ text: "────────────────────────", style: "separator" });
    lines.push({ text: "", style: "normal" });
  }
  return lines;
}

function xmlEscape(value) {
  return safeText(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function docxFor(documentData) {
  const paragraphs = [{ text: documentData.title, style: "Title" }];
  if (documentData.description) paragraphs.push({ text: documentData.description, style: "Subtitle" });
  for (const block of usableContent(documentData)) {
    if (block.type === "heading") paragraphs.push({ text: block.text, style: `Heading${block.level}` });
    else if (block.type === "paragraph") paragraphs.push({ text: block.text });
    else if (block.type === "quote") paragraphs.push({ text: block.text, style: "Quote" });
    else if (block.type === "code") paragraphs.push({ text: block.text, style: "Code" });
    else if (block.type === "list") block.items.forEach((item, index) => paragraphs.push({ text: `${block.ordered ? `${index + 1}.` : "•"}  ${item}` }));
    else if (block.type === "separator") paragraphs.push({ text: "────────────────────────" });
  }
  const body = paragraphs.map((paragraph) => {
    const style = paragraph.style ? `<w:pPr><w:pStyle w:val="${paragraph.style}"/></w:pPr>` : "";
    const runs = safeText(paragraph.text).split("\n").map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`).join("");
    return `<w:p>${style}${runs}</w:p>`;
  }).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="65716B"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="480"/><w:spacing w:before="140" w:after="140"/></w:pPr><w:rPr><w:i/><w:color w:val="35634E"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return storedZip([
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRels],
    ["word/document.xml", documentXml],
    ["word/styles.xml", stylesXml],
  ]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value++) {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const bytes = encoder.encode(content);
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length + bytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true);
    view.setUint16(26, nameBytes.length, true); view.setUint16(28, 0, true);
    local.set(nameBytes, 30); local.set(bytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true); centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true); centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true); centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46); centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function pdfLiteral(value) {
  const win1252 = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };
  let output = "";
  for (const character of safeText(value)) {
    const code = win1252[character] ?? character.codePointAt(0);
    const byte = code <= 255 ? code : 63;
    if (byte === 40 || byte === 41 || byte === 92) output += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) output += `\\${byte.toString(8).padStart(3, "0")}`;
    else output += String.fromCharCode(byte);
  }
  return `(${output})`;
}

function wrapText(value, maxLength) {
  const result = [];
  for (const sourceLine of safeText(value).split("\n")) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (!words.length) { result.push(""); continue; }
    let line = "";
    for (const word of words) {
      if (!line) line = word;
      else if ((line + " " + word).length <= maxLength) line += ` ${word}`;
      else { result.push(line); line = word; }
    }
    if (line) result.push(line);
  }
  return result;
}

function pdfFor(documentData) {
  const pages = [];
  let commands = [];
  let y = 785;
  const beginPage = () => { commands = []; y = 785; };
  const finishPage = () => pages.push(commands.join("\n"));
  const writeLine = (text, style) => {
    const sizes = { title: 24, description: 11, heading1: 18, heading2: 15, heading3: 12, normal: 11, quote: 11, code: 9, separator: 9 };
    const fonts = { title: "F2", description: "F3", heading1: "F2", heading2: "F2", heading3: "F2", normal: "F1", quote: "F3", code: "F4", separator: "F1" };
    const size = sizes[style] || 11;
    const maxLength = Math.max(36, Math.floor(475 / (size * 0.53)));
    const wrapped = wrapText(text, maxLength);
    if (["title", "heading1", "heading2", "heading3"].includes(style)) y -= style === "title" ? 8 : 7;
    for (const line of wrapped) {
      if (y < 55) { finishPage(); beginPage(); }
      commands.push(`BT /${fonts[style] || "F1"} ${size} Tf 58 ${y} Td ${pdfLiteral(line)} Tj ET`);
      y -= Math.max(14, size * 1.5);
    }
    y -= style === "normal" || style === "description" ? 5 : 8;
  };

  writeLine(documentData.title, "title");
  if (documentData.description) writeLine(documentData.description, "description");
  for (const block of usableContent(documentData)) {
    if (block.type === "heading") writeLine(block.text, `heading${block.level}`);
    else if (block.type === "paragraph") writeLine(block.text, "normal");
    else if (block.type === "quote") writeLine(`“${block.text}”`, "quote");
    else if (block.type === "code") writeLine(block.text, "code");
    else if (block.type === "list") block.items.forEach((item, index) => writeLine(`${block.ordered ? `${index + 1}.` : "•"}  ${item}`, "normal"));
    else if (block.type === "separator") writeLine("────────────────────────", "separator");
    y -= 5;
  }
  finishPage();

  const objects = [];
  const setObject = (number, content) => { objects[number] = content; };
  setObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  setObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  setObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  setObject(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
  setObject(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  const pageRefs = [];
  pages.forEach((content, index) => {
    const pageObject = 7 + index * 2;
    const streamObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    setObject(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${streamObject} 0 R >>`);
    setObject(streamObject, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  setObject(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let number = 1; number < objects.length; number++) {
    offsets[number] = pdf.length;
    pdf += `${number} 0 obj\n${objects[number]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let number = 1; number < objects.length; number++) pdf += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([new TextEncoder().encode(pdf)], { type: "application/pdf" });
}

function blobFor(documentData, format) {
  if (format === "md") return new Blob([markdownFor(documentData)], { type: "text/markdown;charset=utf-8" });
  if (format === "html") return new Blob([htmlFor(documentData)], { type: "text/html;charset=utf-8" });
  if (format === "pdf") return pdfFor(documentData);
  if (format === "docx") return docxFor(documentData);
  throw new Error("Format non reconnu.");
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function createDownload(button) {
  const item = catalog.find((entry) => entry.id === button.dataset.documentId);
  if (!item) return;
  const actions = button.closest(".format-actions");
  const buttons = [...actions.querySelectorAll("button")];
  buttons.forEach((element) => { element.disabled = true; });
  button.dataset.previousText = button.textContent;
  button.textContent = "…";
  const labels = { md: "Markdown", html: "HTML", pdf: "PDF", docx: "Word" };
  setStatus(`Création du fichier ${labels[button.dataset.format]} : ${item.title}…`);
  try {
    const documentData = await loadDocument(item);
    const blob = blobFor(documentData, button.dataset.format);
    const extensions = { md: "md", html: "html", pdf: "pdf", docx: "docx" };
    const filename = safeText(item.filename || item.id.split("/").pop()).replace(/[^\p{L}\p{N}._-]+/gu, "-");
    downloadBlob(blob, `${filename}.${extensions[button.dataset.format]}`);
    setStatus(`Fichier ${labels[button.dataset.format]} prêt : ${filename}.${extensions[button.dataset.format]}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "La création du fichier a échoué.", true);
  } finally {
    buttons.forEach((element) => { element.disabled = false; });
    button.textContent = button.dataset.previousText;
  }
}

async function initialize() {
  try {
    const response = await fetch(new URL("catalog.json", document.baseURI));
    if (!response.ok) throw new Error(`Le catalogue n’a pas pu être chargé (${response.status}).`);
    catalog = await response.json();
    if (!Array.isArray(catalog)) throw new Error("Le catalogue JSON est invalide.");

    const categories = [...new Set(catalog.map((item) => item.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr"));
    for (const value of categories) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      categoryFilter.append(option);
    }
    for (const item of catalog) list.append(makeCard(item));

    if (catalog.length === 0) {
      countLine.textContent = "0 ressource";
      emptyTitle.textContent = "Aucune ressource pour le moment";
      emptyCopy.innerHTML = 'Ajoutez un fichier JSON conforme au <a href="schemas/document.schema.json">schéma du document</a> dans le dossier <code>documents/</code>, puis publiez la mise à jour.';
      emptyState.hidden = false;
      setStatus("Le catalogue est prêt pour vos premiers documents JSON.");
    } else {
      setStatus("Choisissez un format pour créer votre fichier.");
      updateView();
    }
  } catch (error) {
    countLine.textContent = "Catalogue indisponible";
    emptyTitle.textContent = "Impossible de charger le catalogue";
    emptyCopy.textContent = error instanceof Error ? error.message : "Vérifiez votre connexion puis actualisez la page.";
    emptyState.hidden = false;
    setStatus("Le catalogue n’a pas pu être chargé.", true);
  }
}

search.addEventListener("input", updateView);
search.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && search.value) {
    search.value = "";
    updateView();
  }
});
clearSearch.addEventListener("click", () => {
  search.value = "";
  updateView();
  search.focus();
});
categoryFilter.addEventListener("change", updateView);
list.addEventListener("click", (event) => {
  const titleButton = event.target.closest("button[data-preview-document-id]");
  if (titleButton) {
    const item = catalog.find((entry) => entry.id === titleButton.dataset.previewDocumentId);
    if (item) showPreview(item, titleButton);
    return;
  }
  const button = event.target.closest("button[data-document-id]");
  if (button && !button.disabled) createDownload(button);
});
backToCatalogue.addEventListener("click", returnToCatalogue);

initialize();


