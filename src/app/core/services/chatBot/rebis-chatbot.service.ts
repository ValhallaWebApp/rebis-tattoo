import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../language/language.service';

type PanelState = 'closed' | 'teaser' | 'opening' | 'active';
type Sender = 'assistant' | 'user';
type BookingStep = 'style' | 'placement' | 'timing' | 'contact';

export interface RebisChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  chips?: string[];
}

export interface QuickAction {
  id: string;
  label: string;
}

interface BookingDraft {
  style?: string;
  placement?: string;
  timing?: string;
  contact?: string;
}

@Injectable({ providedIn: 'root' })
export class RebisChatbotService {
  private readonly http = inject(HttpClient);
  private readonly lang = inject(LanguageService);
  private readonly storageKey = 'rebis.chat.premium.v1';
  private readonly chatApiBaseUrl = this.resolveChatApiBaseUrl();

  private readonly _panelState = signal<PanelState>('closed');
  private readonly _messages = signal<RebisChatMessage[]>(this.readMessages());
  private readonly _typing = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _bookingActive = signal(false);
  private readonly _bookingStep = signal<BookingStep>('style');
  private readonly _bookingDraft = signal<BookingDraft>({});
  private readonly _bookingSuccess = signal(false);

  readonly panelState = this._panelState.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly typing = this._typing.asReadonly();
  readonly error = this._error.asReadonly();
  readonly bookingActive = this._bookingActive.asReadonly();
  readonly bookingStep = this._bookingStep.asReadonly();
  readonly bookingSuccess = this._bookingSuccess.asReadonly();
  readonly isOpen = computed(() => this._panelState() !== 'closed');
  readonly bookingProgress = computed(() => {
    const map: Record<BookingStep, number> = { style: 25, placement: 50, timing: 75, contact: 100 };
    return map[this._bookingStep()];
  });

  get quickActions(): QuickAction[] {
    return [
      { id: 'book', label: this.t('chatbot.quickActions.book') },
      { id: 'pricing', label: this.t('chatbot.quickActions.pricing') },
      { id: 'styles', label: this.t('chatbot.quickActions.styles') },
      { id: 'artists', label: this.t('chatbot.quickActions.artists') },
      { id: 'aftercare', label: this.t('chatbot.quickActions.aftercare') },
      { id: 'contacts', label: this.t('chatbot.quickActions.contacts') }
    ];
  }

  constructor() {
    if (this._messages().length === 0) {
      this._messages.set([this.welcomeMessage()]);
      this.persist();
    }
    this.showTeaser();
  }

  showTeaser(): void {
    if (this._panelState() === 'closed') this._panelState.set('teaser');
  }

  close(): void {
    this._panelState.set('closed');
  }

  open(): void {
    this._error.set(null);
    this._panelState.set('opening');
    setTimeout(() => this._panelState.set('active'), 820);
  }

  resetConversation(): void {
    this._bookingActive.set(false);
    this._bookingSuccess.set(false);
    this._bookingStep.set('style');
    this._bookingDraft.set({});
    this._messages.set([this.welcomeMessage()]);
    this.persist();
  }

  async sendUserMessage(raw: string): Promise<void> {
    const text = String(raw ?? '').trim();
    if (!text) return;
    this._error.set(null);
    this.pushMessage('user', text);
    await this.reply(text);
  }

  async selectQuickAction(actionId: string): Promise<void> {
    const action = this.quickActions.find((a) => a.id === actionId);
    if (!action) return;
    this.pushMessage('user', action.label);

    if (actionId === 'book') {
      this.startBookingFlow();
      return;
    }
    await this.reply(action.label);
  }

  async submitBookingStep(value: string): Promise<void> {
    const text = String(value ?? '').trim();
    if (!text) return;

    this.pushMessage('user', text);
    const draft = { ...this._bookingDraft() };
    const step = this._bookingStep();
    if (step === 'style') draft.style = text;
    if (step === 'placement') draft.placement = text;
    if (step === 'timing') draft.timing = text;
    if (step === 'contact') draft.contact = text;
    this._bookingDraft.set(draft);

    if (step === 'style') {
      this._bookingStep.set('placement');
      this.pushMessage('assistant', this.t('chatbot.flow.placement'));
      return;
    }
    if (step === 'placement') {
      this._bookingStep.set('timing');
      this.pushMessage('assistant', this.t('chatbot.flow.timing'));
      return;
    }
    if (step === 'timing') {
      this._bookingStep.set('contact');
      this.pushMessage('assistant', this.t('chatbot.flow.contact'));
      return;
    }

    this._bookingActive.set(false);
    this._bookingSuccess.set(true);
    this.pushMessage(
      'assistant',
      this.t('chatbot.flow.success')
    );
  }

  registerReference(fileName: string): void {
    const safe = String(fileName ?? '').trim() || 'reference';
    this.pushMessage('user', `${this.t('chatbot.referenceAttached')}: ${safe}`);
    this.pushMessage('assistant', this.t('chatbot.referenceReceived'));
  }

  private startBookingFlow(): void {
    this._bookingSuccess.set(false);
    this._bookingActive.set(true);
    this._bookingStep.set('style');
    this._bookingDraft.set({});
    this.pushMessage('assistant', this.t('chatbot.flow.start'));
  }

  private async reply(prompt: string): Promise<void> {
    this._typing.set(true);
    try {
      const remote = await this.fetchRemoteReply(prompt);
      if (remote) {
        this.pushMessage('assistant', remote);
        return;
      }
      this.pushMessage('assistant', this.localFallback(prompt));
    } catch {
      this._error.set(this.t('chatbot.errorConnection'));
      this.pushMessage('assistant', this.localFallback(prompt));
    } finally {
      this._typing.set(false);
    }
  }

  private async fetchRemoteReply(prompt: string): Promise<string | null> {
    if (!this.chatApiBaseUrl) return null;
    const payload = {
      message: prompt,
      history: this._messages()
        .slice(-10)
        .map((m) => ({
          role: m.sender === 'assistant' ? 'assistant' : 'user',
          content: m.text
        }))
    };

    const res = await firstValueFrom(
      this.http.post<{ ok?: boolean; reply?: string }>(`${this.chatApiBaseUrl}/complete`, payload)
    );
    const reply = String(res?.reply ?? '').trim();
    return reply.length ? reply : null;
  }

  private localFallback(raw: string): string {
    const text = this.normalizeText(raw);
    if (text.includes('prezz') || text.includes('costo') || text.includes('preventiv')) {
      return this.t('chatbot.fallback.pricing');
    }
    if (text.includes('aftercare') || text.includes('cura') || text.includes('guar')) {
      return this.t('chatbot.fallback.aftercare');
    }
    if (text.includes('stile') || text.includes('stili') || text.includes('style')) {
      return this.t('chatbot.fallback.styles');
    }
    if (
      text.includes('artist') ||
      text.includes('tatuator') ||
      text.includes('chi ce') ||
      text.includes('chi c e') ||
      text.includes('disponibil') ||
      text.includes('isponibil')
    ) {
      return this.t('chatbot.fallback.artists');
    }
    if (text.includes('prenot') || text.includes('consulenz')) {
      return this.t('chatbot.fallback.booking');
    }
    if (text.includes('contatt')) {
      return this.t('chatbot.fallback.contacts');
    }
    return this.t('chatbot.fallback.default');
  }

  private normalizeText(raw: string): string {
    return String(raw ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private pushMessage(sender: Sender, text: string, chips?: string[]): void {
    const next = [
      ...this._messages(),
      {
        id: this.nextId(),
        sender,
        text,
        createdAt: new Date().toISOString(),
        chips
      }
    ].slice(-120);
    this._messages.set(next);
    this.persist();
  }

  private welcomeMessage(): RebisChatMessage {
    return {
      id: this.nextId(),
      sender: 'assistant',
      text: this.t('chatbot.welcome'),
      createdAt: new Date().toISOString(),
      chips: this.quickActions.slice(0, 3).map((a) => a.label)
    };
  }

  private t(path: string): string {
    return this.lang.t(path);
  }

  private nextId(): string {
    return `rebis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this._messages()));
    } catch {
      // Ignore storage failures.
    }
  }

  private readMessages(): RebisChatMessage[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RebisChatMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-120);
    } catch {
      return [];
    }
  }

  private resolveChatApiBaseUrl(): string {
    try {
      const runtime = (globalThis as unknown as { __APP_CONFIG__?: Record<string, unknown> }).__APP_CONFIG__;
      const value = String(runtime?.['chatApiBaseUrl'] ?? '').trim();
      return value.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }
}
