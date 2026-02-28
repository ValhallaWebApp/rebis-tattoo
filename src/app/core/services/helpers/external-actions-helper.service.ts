import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExternalActionsHelperService {
  private readonly document = inject(DOCUMENT);

  private get windowRef(): Window | null {
    return this.document.defaultView ?? null;
  }

  openInNewTab(url: string): void {
    if (!url) return;
    this.windowRef?.open(url, '_blank');
  }

  openInSameTab(url: string): void {
    if (!url) return;
    this.windowRef?.open(url, '_self');
  }

  openMailTo(params: { email: string; subject?: string; body?: string }): void {
    const email = String(params.email ?? '').trim();
    if (!email) return;
    const subject = String(params.subject ?? '').trim();
    const body = String(params.body ?? '').trim();
    const query = [
      subject ? `subject=${encodeURIComponent(subject)}` : '',
      body ? `body=${encodeURIComponent(body)}` : ''
    ].filter(Boolean).join('&');
    const url = query ? `mailto:${email}?${query}` : `mailto:${email}`;
    this.openInSameTab(url);
  }

  openWhatsApp(phone: string, message?: string): void {
    const safePhone = String(phone ?? '').replace(/\s+/g, '').trim();
    if (!safePhone) return;
    const encodedMessage = String(message ?? '').trim();
    const query = encodedMessage ? `?text=${encodeURIComponent(encodedMessage)}` : '';
    this.openInNewTab(`https://wa.me/${safePhone}${query}`);
  }

  downloadTextFile(content: string, filename: string, mimeType: string): void {
    const name = String(filename ?? '').trim();
    if (!name) return;
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlobFile(blob, name);
  }

  downloadBlobFile(blob: Blob, filename: string): void {
    const name = String(filename ?? '').trim();
    if (!name || !blob) return;
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
}
