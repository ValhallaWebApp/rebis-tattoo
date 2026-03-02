import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ChatActorRole = 'guest' | 'public' | 'client' | 'user' | 'staff' | 'admin';

export interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
  chips?: string[] | null;
}

export interface ChatPlanResult {
  message: string;
  chips?: string[];
}

export interface ChatPlanContext {
  role?: ChatActorRole;
}

interface StoredChatState {
  emailToChatId: Record<string, string>;
  chats: Record<string, ChatMessage[]>;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly storageKey = 'rebis.chat.front.v1';
  private readonly subjects = new Map<string, BehaviorSubject<ChatMessage[]>>();
  private state: StoredChatState = this.loadState();
  private readonly studioName = 'Rebis Tattoo';
  private readonly studioPhone = '+39 340 099 8312';
  private readonly studioEmail = 'sarapushi@rebistattoo.info';
  private readonly studioAddress = 'Via al Carmine 1A, 07100 Sassari (SS)';
  private readonly studioInstagram = '@rebis_tattoo';

  async createOrReuseChatByEmail(email: string): Promise<string> {
    const key = this.normalizeChatKey(email);
    const existing = this.state.emailToChatId[key];
    if (existing) {
      this.ensureSubject(existing);
      return existing;
    }

    const chatId = this.buildChatId();
    this.state.emailToChatId[key] = chatId;
    this.state.chats[chatId] = [];
    this.persistState();
    this.ensureSubject(chatId);
    return chatId;
  }

  getMessages(chatId: string): Observable<ChatMessage[]> {
    return this.ensureSubject(chatId).asObservable();
  }

  async addMessage(chatId: string, msg: ChatMessage): Promise<void> {
    const subject = this.ensureSubject(chatId);
    const sanitized: ChatMessage = {
      from: msg.from,
      text: (msg.text ?? '').trim(),
      timestamp: msg.timestamp || new Date().toISOString(),
      chips: msg.chips ?? null
    };

    if (!sanitized.text) return;

    const next = [...subject.value, sanitized];
    subject.next(next);
    this.state.chats[chatId] = next;
    this.persistState();
  }

  async replyWithPlan(
    _chatId: string,
    history: ChatMessage[],
    context: ChatPlanContext = {}
  ): Promise<ChatPlanResult> {
    const role: ChatActorRole = context.role ?? 'guest';
    const canOpenStudioChat = this.canOpenStudioChat(role);
    const lastUser = [...history].reverse().find((m) => m.from === 'user' && m.text.trim().length > 0);

    if (!lastUser) {
      return {
        message: 'Ciao, sono l assistente Rebis. Ti aiuto con consulenze, contatti e chat con lo studio.',
        chips: this.defaultSupportChips(role, canOpenStudioChat)
      };
    }

    const text = this.normalize(lastUser.text);
    const intent = this.detectIntent(text);

    if (intent === 'greeting') {
      return {
        message: 'Eccomi. Dimmi pure cosa ti serve: prenotazione, stato richiesta o contatti studio.',
        chips: this.defaultSupportChips(role, canOpenStudioChat)
      };
    }

    if (intent === 'studio-chat') {
      if (canOpenStudioChat) {
        return {
          message: 'Perfetto. Apri la chat con lo studio: se non esiste viene creata automaticamente.',
          chips: ['Apri chat studio', 'Prenota consulenza', 'Contatti studio']
        };
      }

      return {
        message: 'Per aprire la chat con lo studio devi prima accedere con il tuo account.',
        chips: ['Accedi per chat studio', 'Prenota consulenza', 'Contatti studio']
      };
    }

    if (intent === 'booking') {
      return {
        message: canOpenStudioChat
          ? 'Per una nuova consulenza puoi prenotare subito oppure scrivere in chat allo studio.'
          : 'Puoi iniziare da Prenota consulenza. Per follow-up personalizzati serve accesso account.',
        chips: canOpenStudioChat
          ? ['Prenota consulenza', 'Apri chat studio', 'Stato prenotazione']
          : ['Prenota consulenza', 'Accedi per chat studio', 'Contatti studio']
      };
    }

    if (intent === 'status') {
      return {
        message: canOpenStudioChat
          ? 'Per controllare lo stato della tua richiesta apri la chat con lo studio.'
          : 'Per vedere lo stato richieste devi accedere e aprire la chat studio.',
        chips: canOpenStudioChat
          ? ['Apri chat studio', 'Prenota consulenza']
          : ['Accedi per chat studio', 'Prenota consulenza']
      };
    }

    if (intent === 'pricing') {
      return {
        message: canOpenStudioChat
          ? 'Per una stima reale servono dettagli progetto e reference. Scrivi allo studio in chat.'
          : 'I costi dipendono da soggetto, dimensione e sedute. Ti conviene prenotare una consulenza.',
        chips: canOpenStudioChat
          ? ['Apri chat studio', 'Prenota consulenza']
          : ['Prenota consulenza', 'Accedi per chat studio']
      };
    }

    if (intent === 'tattoo-advice') {
      return {
        message: canOpenStudioChat
          ? 'Per un consiglio preciso indicami zona del corpo, stile desiderato e dimensione. Possiamo anche aprire ticket con lo studio.'
          : 'Per consigli utili servono stile, zona e dimensione. Se vuoi valutazione personalizzata, prenota una consulenza.',
        chips: canOpenStudioChat
          ? ['Apri chat studio', 'Prenota consulenza', 'Contatti studio']
          : ['Prenota consulenza', 'Accedi per chat studio', 'Contatti studio']
      };
    }

    if (intent === 'aftercare') {
      return {
        message:
          'Aftercare base: lava delicatamente 2 volte al giorno, asciuga tamponando, applica crema sottile e evita sole, mare e piscina finche non e guarito. Se noti rossore forte o secrezioni, contatta lo studio.',
        chips: canOpenStudioChat
          ? ['Apri chat studio', 'Contatti studio']
          : ['Contatti studio', 'Accedi per chat studio']
      };
    }

    if (intent === 'pre-session') {
      return {
        message:
          'Prima della seduta: dormi bene, mangia leggero, idratati, evita alcol nelle 24h precedenti e porta un capo comodo che lasci libera la zona da tatuare.',
        chips: canOpenStudioChat
          ? ['Prenota consulenza', 'Apri chat studio']
          : ['Prenota consulenza', 'Contatti studio']
      };
    }

    if (intent === 'contacts') {
      return {
        message: [
          `${this.studioName}`,
          `Telefono: ${this.studioPhone}`,
          `Email: ${this.studioEmail}`,
          `Indirizzo: ${this.studioAddress}`,
          `Instagram: ${this.studioInstagram}`
        ].join('\n'),
        chips: canOpenStudioChat
          ? ['Apri chat studio', 'Prenota consulenza']
          : ['Accedi per chat studio', 'Prenota consulenza']
      };
    }

    return {
      message: canOpenStudioChat
        ? 'Posso aiutarti ad aprire la chat con lo studio, prenotare una consulenza o condividere i contatti.'
        : 'Posso guidarti su consulenza e contatti studio. Per chat diretta devi accedere.',
      chips: this.defaultSupportChips(role, canOpenStudioChat)
    };
  }

  private defaultSupportChips(role: ChatActorRole, canOpenStudioChat: boolean): string[] {
    if (!canOpenStudioChat) {
      return ['Accedi per chat studio', 'Prenota consulenza', 'Contatti studio'];
    }
    if (role === 'staff' || role === 'admin') {
      return ['Apri chat studio', 'Contatti studio'];
    }
    return ['Apri chat studio', 'Prenota consulenza', 'Stato prenotazione'];
  }

  private detectIntent(text: string): ChatIntent {
    if (!text) return 'generic';
    if (this.matchesAny(text, ['ciao', 'salve', 'buongiorno', 'buonasera', 'hey'])) return 'greeting';

    const asksStatus = this.matchesAny(text, ['stato', 'aggiornamento', 'conferm', 'avanzamento']);
    const contextBooking = this.matchesAny(text, ['prenot', 'booking', 'session', 'sedut', 'richiesta', 'progetto']);
    if (asksStatus && contextBooking) return 'status';

    if (this.matchesAny(text, ['operatore', 'umano', 'chat', 'assistenza', 'supporto', 'studio'])) return 'studio-chat';
    if (this.matchesAny(text, ['prezzo', 'costo', 'preventivo', 'quanto'])) return 'pricing';
    if (this.matchesAny(text, ['cura', 'guarig', 'aftercare', 'cicatrizz', 'crema'])) return 'aftercare';
    if (this.matchesAny(text, ['prima della seduta', 'prima seduta', 'prepar', 'come mi preparo', 'cosa porto'])) return 'pre-session';
    if (this.matchesAny(text, ['consiglio', 'stile', 'idea', 'soggetto', 'dimensione', 'posizione', 'zona'])) return 'tattoo-advice';
    if (this.matchesAny(text, ['orari', 'orario', 'telefono', 'email', 'indirizzo', 'instagram', 'contatti', 'dove'])) return 'contacts';
    if (this.matchesAny(text, ['prenot', 'consulenza', 'appuntamento', 'session', 'sedut'])) return 'booking';

    return 'generic';
  }

  private canOpenStudioChat(role: ChatActorRole): boolean {
    return role === 'client' || role === 'user' || role === 'staff' || role === 'admin';
  }

  private matchesAny(text: string, terms: readonly string[]): boolean {
    return terms.some((term) => text.includes(term));
  }

  private normalize(value: string): string {
    return String(value ?? '').toLowerCase().trim();
  }

  private ensureSubject(chatId: string): BehaviorSubject<ChatMessage[]> {
    const existing = this.subjects.get(chatId);
    if (existing) return existing;

    const list = this.state.chats[chatId] ?? [];
    this.state.chats[chatId] = list;
    const subject = new BehaviorSubject<ChatMessage[]>(list);
    this.subjects.set(chatId, subject);
    this.persistState();
    return subject;
  }

  private normalizeChatKey(email: string): string {
    return (email || 'guest')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '');
  }

  private buildChatId(): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `chat_${Date.now()}_${rand}`;
  }

  private loadState(): StoredChatState {
    try {
      const raw = this.safeStorageGet(this.storageKey);
      if (!raw) {
        return { emailToChatId: {}, chats: {} };
      }

      const parsed = JSON.parse(raw) as Partial<StoredChatState>;
      return {
        emailToChatId: parsed.emailToChatId ?? {},
        chats: parsed.chats ?? {}
      };
    } catch {
      return { emailToChatId: {}, chats: {} };
    }
  }

  private persistState(): void {
    this.safeStorageSet(this.storageKey, JSON.stringify(this.state));
  }

  private safeStorageGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeStorageSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore write errors (private mode / quota).
    }
  }
}

type ChatIntent = 'greeting' | 'studio-chat' | 'booking' | 'status' | 'pricing' | 'contacts' | 'tattoo-advice' | 'aftercare' | 'pre-session' | 'generic';
