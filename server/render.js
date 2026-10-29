import { buildInvoiceDocDefinition, generateInvoice } from '../dist/ksef-fe-invoice-converter.js';
import { renderDocDefinitionToHtml } from './render-html.js';

/**
 * Renders an invoice's XML as a PDF or as HTML, shared by the HTTP server and the stdio process.
 * `ksefNumber` is printed in the header and under the QR code; `qrUrl` is the KOD I link.
 */
export async function renderInvoice(xml, { format, ksefNumber, qrUrl }) {
  const file = new File([xml], 'invoice.xml', { type: 'text/xml' });
  const additionalData = { nrKSeF: ksefNumber || '', qrCode: qrUrl || undefined };

  if (format === 'pdf') {
    return Buffer.from(await generateInvoice(file, additionalData, 'base64'), 'base64');
  }

  if (format === 'html') {
    const html = await renderDocDefinitionToHtml(await buildInvoiceDocDefinition(file, additionalData));

    return Buffer.from(html, 'utf8');
  }

  throw new UnknownFormatError();
}

export class UnknownFormatError extends Error {
  constructor() {
    super('Unknown format');
  }
}

/**
 * What went wrong, as a word that is safe to log: an error's message may quote the document
 * (xml-js reports the character it stopped at), so callers log this and never the error.
 */
export function errorKind(err) {
  const message = String(err?.message ?? '');

  if (err instanceof UnknownFormatError) {
    return 'unknown_format';
  }
  if (/\nLine: \d+\nColumn: \d+/.test(message)) {
    return 'parse_error';
  }
  if (message.startsWith('Unknown XML Version')) {
    return 'unsupported_schema';
  }

  return 'render_error';
}
