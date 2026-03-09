import { Injectable } from '@angular/core';

export interface BookingHistoryInvoicePdfParams {
  booking: any;
  invoices: any[];
  sessions: any[];
  artistName: string;
  bookingLabel: string;
  user?: any;
}

export interface BookingHistoryInvoicePdfResult {
  blob: Blob;
  fileName: string;
  usedExistingInvoice: boolean;
}

@Injectable({ providedIn: 'root' })
export class BookingHistoryInvoiceHelperService {
  createInvoicePdf(params: BookingHistoryInvoicePdfParams): BookingHistoryInvoicePdfResult {
    const bookingId = String(params.booking?.id ?? '').trim();
    const existingInvoice = (params.invoices ?? []).find((invoice) => String(invoice?.bookingId ?? '') === bookingId) ?? null;
    const invoice = existingInvoice ?? this.buildDerivedInvoiceFromBooking(params);
    const pdfBytes = this.buildInvoicePdf(invoice, params);
    const invoiceIdForFile = invoice?.number ?? invoice?.id ?? bookingId ?? Date.now();
    const fileName = `fattura-${String(invoiceIdForFile)}.pdf`;

    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      fileName,
      usedExistingInvoice: Boolean(existingInvoice)
    };
  }

  buildInvoiceHtml(
    invoice: any,
    booking: any,
    context: { artistName?: string; user?: any } = {}
  ): string {
    const artistName = String(context.artistName ?? 'Rebis Tattoo');
    const invNumber = String(invoice?.number ?? invoice?.id ?? 'FATTURA');
    const currency = String(invoice?.currency ?? 'EUR');
    const issuedAt = String(invoice?.issuedAt ?? invoice?.date ?? new Date().toISOString());
    const date = new Date(issuedAt);
    const clientLabel = this.resolveClientLabel(invoice, booking, context.user);

    const items = Array.isArray(invoice?.items) ? invoice.items : [];
    const total = Number(invoice?.total ?? invoice?.amount ?? 0);
    const paid = Number(invoice?.paid ?? 0);
    const status = String(invoice?.status ?? 'issued').toUpperCase();

    const bookingStart = new Date(booking?.start);
    const bookingLine = Number.isFinite(bookingStart.getTime())
      ? `${bookingStart.toLocaleDateString()} ${bookingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '-';

    const rows = items.length
      ? items.map((it: any, idx: number) => {
          const label = it?.label ?? it?.description ?? `Voce ${idx + 1}`;
          const qty = Number(it?.qty ?? it?.quantity ?? 1);
          const unit = Number(it?.unitPrice ?? it?.price ?? 0);
          const line = qty * unit;
          return `
            <tr>
              <td>${this.escapeHtml(String(label))}</td>
              <td class="num">${qty}</td>
              <td class="num">${this.money(unit, currency)}</td>
              <td class="num">${this.money(line, currency)}</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="4" class="muted">Nessuna voce dettagliata</td></tr>`;

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(invNumber)}</title>
</head>
<body>
  <h1>Rebis Tattoo</h1>
  <p>Numero: ${this.escapeHtml(invNumber)}</p>
  <p>Data: ${date.toLocaleDateString()}</p>
  <p>Artista: ${this.escapeHtml(artistName)}</p>
  <p>Cliente: ${this.escapeHtml(clientLabel)}</p>
  <p>Appuntamento: ${this.escapeHtml(bookingLine)}</p>
  <p>Stato: ${this.escapeHtml(status)}</p>
  <table>
    <tbody>${rows}</tbody>
  </table>
  <p>Totale: ${this.money(total, currency)}</p>
  ${paid ? `<p>Pagato: ${this.money(paid, currency)}</p>` : ''}
</body>
</html>`;
  }

  private buildInvoicePdf(invoice: any, params: BookingHistoryInvoicePdfParams): Uint8Array {
    const booking = params.booking ?? {};
    const invNumber = String(invoice?.number ?? invoice?.id ?? 'FATTURA');
    const currency = String(invoice?.currency ?? 'EUR');
    const issuedAt = String(invoice?.issuedAt ?? invoice?.date ?? new Date().toISOString());
    const issueDate = new Date(issuedAt);
    const dateLabel = Number.isFinite(issueDate.getTime()) ? issueDate.toLocaleDateString('it-IT') : issuedAt;
    const artistName = String(params.artistName ?? 'Rebis Tattoo');
    const clientLabel = this.resolveClientLabel(invoice, booking, params.user);
    const bookingStart = new Date(booking?.start);
    const bookingLine = Number.isFinite(bookingStart.getTime())
      ? `${bookingStart.toLocaleDateString('it-IT')} ${bookingStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
      : '-';

    const items = Array.isArray(invoice?.items) ? invoice.items : [];
    const total = Number(invoice?.total ?? invoice?.amount ?? 0) || 0;
    const paid = Number(invoice?.paid ?? 0) || 0;
    const residual = Math.max(0, total - paid);
    const status = String(invoice?.status ?? 'issued').toUpperCase();

    const lines: string[] = [];
    lines.push('Rebis Tattoo - Fattura / Ricevuta');
    lines.push(`Numero: ${invNumber}`);
    lines.push(`Data: ${dateLabel}`);
    lines.push(`Stato: ${status}`);
    lines.push(`Cliente: ${clientLabel}`);
    lines.push(`Artista: ${artistName}`);
    lines.push(`Consulenza ID: ${String(booking?.id ?? '-')}`);
    lines.push(`Appuntamento: ${bookingLine}`);
    lines.push('');
    lines.push('Dettaglio voci:');

    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i] ?? {};
        const label = String(it?.label ?? it?.description ?? `Voce ${i + 1}`);
        const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
        const unit = Number(it?.unitPrice ?? it?.price ?? 0) || 0;
        const lineTotal = qty * unit;
        const row = `- ${label} | Qta: ${qty} | Prezzo: ${this.moneyPlain(unit, currency)} | Totale: ${this.moneyPlain(lineTotal, currency)}`;
        lines.push(...this.wrapPdfText(row, 95));
      }
    } else {
      lines.push('- Nessuna voce dettagliata');
    }

    lines.push('');
    lines.push(`Totale: ${this.moneyPlain(total, currency)}`);
    lines.push(`Pagato: ${this.moneyPlain(paid, currency)}`);
    lines.push(`Residuo: ${this.moneyPlain(residual, currency)}`);

    return this.buildSimplePdf(lines);
  }

  private buildDerivedInvoiceFromBooking(params: BookingHistoryInvoicePdfParams): any {
    const booking = params.booking ?? {};
    const sessions = params.sessions ?? [];
    const bookingId = String(booking?.id ?? '').trim();
    const nowIso = new Date().toISOString();
    const items: Array<{ description: string; quantity: number; price: number }> = [];

    const bookingBase =
      this.toFiniteNumber(booking?.price) ??
      this.toFiniteNumber(booking?.depositRequired) ??
      this.toFiniteNumber(booking?.paidAmount) ??
      0;

    if (bookingBase > 0) {
      items.push({
        description: `Consulenza ${params.bookingLabel}`,
        quantity: 1,
        price: bookingBase
      });
    }

    for (const session of sessions) {
      const amount = this.toFiniteNumber(session?.price) ?? this.toFiniteNumber(session?.paidAmount) ?? 0;
      if (amount <= 0) continue;
      const start = String(session?.start ?? session?._start ?? '').trim();
      items.push({
        description: `Seduta ${start || '-'} (${String(session?.status ?? 'planned')})`,
        quantity: 1,
        price: amount
      });
    }

    if (!items.length) {
      items.push({
        description: `Prestazione ${params.bookingLabel}`,
        quantity: 1,
        price: 0
      });
    }

    const total = items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0);
    const bookingPaid = this.toFiniteNumber(booking?.paidAmount) ?? 0;
    const sessionsPaid = sessions.reduce((sum, session) => sum + (this.toFiniteNumber(session?.paidAmount) ?? 0), 0);
    const paid = bookingPaid + sessionsPaid;
    const normalizedTotal = total > 0 ? total : paid;

    return {
      id: `derived-${bookingId || Date.now()}`,
      number: `DRV-${bookingId || Date.now()}`,
      bookingId,
      clientName: this.resolveClientLabel({}, booking, params.user),
      date: nowIso,
      issuedAt: nowIso,
      currency: 'EUR',
      items,
      amount: normalizedTotal,
      total: normalizedTotal,
      paid,
      status: normalizedTotal > 0 && paid >= normalizedTotal ? 'paid' : 'pending'
    };
  }

  private buildSimplePdf(lines: string[]): Uint8Array {
    const contentLines: string[] = ['BT', '/F1 11 Tf', '50 800 Td'];
    for (let i = 0; i < lines.length; i++) {
      const raw = this.pdfAscii(lines[i] ?? '');
      const safe = this.pdfEscape(raw);
      contentLines.push(`(${safe}) Tj`);
      if (i < lines.length - 1) contentLines.push('0 -14 Td');
    }
    contentLines.push('ET');
    const stream = contentLines.join('\n');

    const objects: string[] = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    ];

    const header = '%PDF-1.4\n';
    let body = '';
    const offsets: number[] = [0];
    let cursor = header.length;
    for (const obj of objects) {
      offsets.push(cursor);
      body += obj;
      cursor += obj.length;
    }

    const xrefOffset = header.length + body.length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    const trailer =
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(header + body + xref + trailer);
  }

  private wrapPdfText(input: string, maxLen: number): string[] {
    const text = String(input ?? '').trim();
    if (!text) return [''];
    if (text.length <= maxLen) return [text];

    const words = text.split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxLen) {
        current = candidate;
        continue;
      }
      if (current) rows.push(current);
      current = word;
    }
    if (current) rows.push(current);
    return rows;
  }

  private resolveClientLabel(invoice: any, booking: any, user: any): string {
    const candidates = [
      invoice?.clientName,
      invoice?.customerName,
      invoice?.clientEmail,
      invoice?.email,
      booking?.clientName,
      booking?.customerName,
      booking?.clientEmail,
      user?.name,
      user?.displayName,
      user?.email
    ];

    for (const candidate of candidates) {
      const value = String(candidate ?? '').trim();
      if (value) return value;
    }
    return 'Cliente';
  }

  private toFiniteNumber(value: any): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private money(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  private moneyPlain(value: number, currency: string): string {
    const n = Number(value ?? 0);
    const safe = Number.isFinite(n) ? n : 0;
    return `${safe.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(currency || 'EUR').toUpperCase()}`;
  }

  private pdfEscape(value: string): string {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private pdfAscii(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  private escapeHtml(input: string): string {
    return String(input ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
