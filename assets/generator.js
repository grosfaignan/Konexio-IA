const documentCache = new Map();
let eta;
let pageTemplate;
let headerTemplate;
let footerTemplate;
let blocksTemplate;
let headerData;
let footerData;
let downloadFormats;

const safeText = (value) => String(value ?? "");

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
  if (!eta) throw new Error("Les modèles Eta ne sont pas chargés.");
  const data = {
    document: { ...documentData, content: usableContent(documentData) },
    header: { ...headerData, title: documentData.title, category: documentData.category, description: documentData.description },
    footer: footerData,
    content: usableContent(documentData),
  };
  return eta.render("@page", data);
}

async function loadTemplates() {
  const { Eta } = await import("https://cdn.jsdelivr.net/npm/eta@3.5.0/+esm");
  eta = new Eta({ autoEscape: true });
  const read = async (path) => {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) throw new Error(`Le fichier ${path} n’a pas pu être chargé (${response.status}).`);
    return response.headers.get("content-type")?.includes("json") ? response.json() : response.text();
  };
  [pageTemplate, headerTemplate, footerTemplate, blocksTemplate, headerData, footerData, downloadFormats] = await Promise.all([
    read("templates/page.eta"), read("templates/header.eta"), read("templates/footer.eta"), read("templates/blocks.eta"),
    read("data/header.json"), read("data/footer.json"), read("data/components/downloads.json"),
  ]);
  eta.loadTemplate("@page", pageTemplate);
  eta.loadTemplate("@header", headerTemplate);
  eta.loadTemplate("@footer", footerTemplate);
  eta.loadTemplate("@blocks", blocksTemplate);
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

document.addEventListener("alpine:init", () => {
  window.Alpine.data("library", () => ({
    catalog: [],
    ready: false,
    query: "",
    category: "all",
    selectedDocument: null,
    previewHtml: "",
    lastPreviewTrigger: null,
    status: "Chargement du catalogue…",
    hasError: false,
    busyFormat: null,
    formats: [],

    get categories() {
      return [...new Set(this.catalog.map((item) => item.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "fr"));
    },

    get visibleDocuments() {
      const query = this.query.trim().toLocaleLowerCase("fr");
      return this.catalog.filter((item) => {
        const searchable = `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase("fr");
        return searchable.includes(query) && (this.category === "all" || item.category === this.category);
      });
    },

    setStatus(message, isError = false) {
      this.status = message;
      this.hasError = isError;
    },

    async init() {
      try {
        const response = await fetch(new URL("catalog.json", document.baseURI));
        if (!response.ok) throw new Error(`Le catalogue n’a pas pu être chargé (${response.status}).`);
        const entries = await response.json();
        if (!Array.isArray(entries)) throw new Error("Le catalogue JSON est invalide.");
        await loadTemplates();
        this.catalog = entries;
        this.formats = downloadFormats;
        this.ready = true;
        this.setStatus(entries.length ? "Choisissez une ressource pour afficher son aperçu." : "Le catalogue est prêt pour vos premiers documents JSON.");
      } catch (error) {
        this.ready = true;
        this.setStatus(error instanceof Error ? error.message : "Vérifiez votre connexion puis actualisez la page.", true);
      }
    },

    async openPreview(item, trigger) {
      this.lastPreviewTrigger = trigger;
      this.setStatus(`Ouverture de l’aperçu : ${item.title}…`);
      try {
        const documentData = await loadDocument(item);
        this.previewHtml = htmlFor(documentData);
        this.selectedDocument = item;
        this.setStatus(`Aperçu HTML affiché : ${item.title}`);
        this.$nextTick(() => document.querySelector(".back-button")?.focus({ preventScroll: true }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        this.setStatus(error instanceof Error ? error.message : "L’aperçu HTML n’a pas pu être chargé.", true);
      }
    },

    closePreview() {
      this.selectedDocument = null;
      this.previewHtml = "";
      this.setStatus("Catalogue des ressources.");
      this.$nextTick(() => {
        if (this.lastPreviewTrigger?.isConnected) this.lastPreviewTrigger.focus();
      });
    },

    async download(item, format) {
      if (!item || this.busyFormat) return;
      this.busyFormat = format;
      const labels = { md: "Markdown", html: "HTML", pdf: "PDF", docx: "Word" };
      const extensions = { md: "md", html: "html", pdf: "pdf", docx: "docx" };
      this.setStatus(`Création du fichier ${labels[format]} : ${item.title}…`);
      try {
        const documentData = await loadDocument(item);
        const blob = blobFor(documentData, format);
        const filename = safeText(item.filename || item.id.split("/").pop()).replace(/[^\p{L}\p{N}._-]+/gu, "-");
        downloadBlob(blob, `${filename}.${extensions[format]}`);
        this.setStatus(`Fichier ${labels[format]} prêt : ${filename}.${extensions[format]}`);
      } catch (error) {
        this.setStatus(error instanceof Error ? error.message : "La création du fichier a échoué.", true);
      } finally {
        this.busyFormat = null;
      }
    },
  }));
});

