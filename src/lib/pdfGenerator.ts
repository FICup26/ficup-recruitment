import { jsPDF } from 'jspdf';

export interface FicupPdfDocumentInput {
  title: string;
  subtitle?: string;
  version: string;
  publishedAt?: string;
  content: string;
  fileName: string;
}

type ParsedLineBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; marker: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

function sanitizePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ');
}

function parseLinesForPdf(rawContent: string): ParsedLineBlock[] {
  const lines = sanitizePdfText(rawContent).split('\n');
  const blocks: ParsedLineBlock[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'spacer') {
        blocks.push({ type: 'spacer' });
      }
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch?.[1]) {
      blocks.push({ type: 'bullet', text: bulletMatch[1].trim() });
      continue;
    }

    const numMatch = trimmed.match(/^(\d+[.)])\s+(.+)$/);
    if (numMatch?.[1] && numMatch?.[2]) {
      blocks.push({ type: 'numbered', marker: numMatch[1], text: numMatch[2].trim() });
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed });
  }

  return blocks;
}

/**
 * Genera e scarica un documento PDF reale e multipagina usando esclusivamente
 * il testo ufficiale passato in input (nessun testo inventato).
 * Compatibile con smartphone Android e desktop senza popup window.open.
 */
export function downloadOfficialDocumentPdf(input: FicupPdfDocumentInput): void {
  const cleanContent = input.content.trim();
  if (!cleanContent) {
    throw new Error('Contenuto del documento non disponibile per il download PDF.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const maxContentWidth = pageWidth - marginX * 2;
  const bottomLimitY = pageHeight - 20;

  const drawHeader = (isFirstPage: boolean) => {
    if (isFirstPage) {
      // Navy institutional header block
      doc.setFillColor(11, 31, 77); // #0B1F4D
      doc.rect(0, 0, pageWidth, 34, 'F');

      // Gold accent stripe
      doc.setFillColor(198, 146, 20); // #C69214
      doc.rect(0, 34, pageWidth, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(253, 230, 138); // #FDE68A
      doc.text('FICUP 26/27 · FANTA ITALIA CUP — DOCUMENTO UFFICIALE', marginX, 11);

      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      const wrappedTitle = doc.splitTextToSize(sanitizePdfText(input.title), maxContentWidth);
      doc.text(wrappedTitle[0] || 'Regolamento Ufficiale', marginX, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(226, 232, 240);
      const metaParts = [
        `Versione: ${sanitizePdfText(input.version)}`,
        input.publishedAt ? `Pubblicazione: ${sanitizePdfText(input.publishedAt)}` : null,
        input.subtitle ? sanitizePdfText(input.subtitle) : null,
      ].filter(Boolean);
      doc.text(metaParts.join('   ·   '), marginX, 28);

      return 45;
    }

    // Compact continuation header on subsequent pages
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 31, 77);
    doc.text(
      `FICUP 26/27 — ${sanitizePdfText(input.title)} (v${sanitizePdfText(input.version)})`,
      marginX,
      11
    );
    return 22;
  };

  let y = drawHeader(true);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimitY) {
      doc.addPage();
      y = drawHeader(false);
    }
  };

  const blocks = parseLinesForPdf(cleanContent);

  for (const block of blocks) {
    if (block.type === 'spacer') {
      y += 2.5;
      continue;
    }

    if (block.type === 'h1') {
      ensureSpace(14);
      y += 2.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(11, 31, 77); // #0B1F4D
      const lines = doc.splitTextToSize(block.text, maxContentWidth) as string[];
      for (const line of lines) {
        ensureSpace(6.5);
        doc.text(line, marginX, y);
        y += 5.8;
      }
      doc.setDrawColor(198, 146, 20);
      doc.setLineWidth(0.35);
      doc.line(marginX, y - 3.2, marginX + 28, y - 3.2);
      y += 1.5;
      continue;
    }

    if (block.type === 'h2') {
      ensureSpace(10);
      y += 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.8);
      doc.setTextColor(21, 57, 133); // #153985
      const lines = doc.splitTextToSize(block.text, maxContentWidth) as string[];
      for (const line of lines) {
        ensureSpace(5.5);
        doc.text(line, marginX, y);
        y += 5.2;
      }
      y += 0.8;
      continue;
    }

    if (block.type === 'bullet') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const indentX = marginX + 5;
      const lines = doc.splitTextToSize(block.text, maxContentWidth - 5) as string[];
      ensureSpace(6);
      doc.setTextColor(198, 146, 20);
      doc.text('•', marginX + 1.2, y);
      doc.setTextColor(51, 65, 85);
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, indentX, y);
        y += 4.9;
      }
      y += 0.8;
      continue;
    }

    if (block.type === 'numbered') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const indentX = marginX + 7;
      const lines = doc.splitTextToSize(block.text, maxContentWidth - 7) as string[];
      ensureSpace(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 31, 77);
      doc.text(block.marker, marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, indentX, y);
        y += 4.9;
      }
      y += 0.8;
      continue;
    }

    // Paragraph
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(block.text, maxContentWidth) as string[];
    for (const line of lines) {
      ensureSpace(5.2);
      doc.text(line, marginX, y);
      y += 4.9;
    }
    y += 1.2;
  }

  // Page numbers & footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('FANTA ITALIA CUP · Stagione 26/27 · Documento ufficiale', marginX, pageHeight - 9);
    doc.text(`Pagina ${i} di ${totalPages}`, pageWidth - marginX, pageHeight - 9, {
      align: 'right',
    });
  }

  // Mobile-friendly blob download (works on Android Chrome & desktop without window.open)
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = input.fileName.endsWith('.pdf') ? input.fileName : `${input.fileName}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
