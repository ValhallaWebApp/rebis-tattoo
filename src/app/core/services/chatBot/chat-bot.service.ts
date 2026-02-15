import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  get,
  onValue
} from '@angular/fire/database';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { StaffService } from '../staff/staff.service';
import { BookingService } from '../bookings/booking.service';
import { addDays, format } from 'date-fns';
import { AuthService } from '../auth/authservice';

export interface ChatMessage {
  id?: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
  chips?: string[] | null;
}

export interface BotPlan {
  message: string;
  chips: string[];
  action?: {
    type: 'booking-draft';
    draft: {
      artistId?: string;
      date?: string;
      time?: string;
      duration?: number;
      note?: string;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly path = 'chats';
  // Backend proxy endpoint: no secret in frontend.
  private readonly chatPlanUrl = 'http://localhost:3001/api/chat/plan';

  constructor(
    private db: Database,
    private http: HttpClient,
    private staffService: StaffService,
    private bookingService: BookingService,
    private authService: AuthService
  ) {}

  /**
   * Crea o riusa una chat a partire dalla email (che diventa chiave)
   */
  async createOrReuseChatByEmail(email: string): Promise<string> {
    const emailKey = email.replace(/\./g, '_');
    const refIndex = ref(this.db, `chatsByEmail/${emailKey}`);
    const snap = await get(refIndex);

    if (snap.exists()) {
      return snap.val().chatId;
    }

    const refChat = push(ref(this.db, this.path));
    const now = new Date().toISOString();

    await set(refChat, {
      id: refChat.key,
      email,
      createAt: now,
      status: 'aperto'
    });

    await set(refIndex, { chatId: refChat.key });
    return refChat.key!;
  }

  /**
   * Salva un messaggio nella chat (RTDB)
   */
  async addMessage(chatId: string, msg: ChatMessage): Promise<void> {
    const refMsg = push(ref(this.db, `${this.path}/${chatId}/messages`));
    const payload: ChatMessage = {
      ...msg,
      timestamp: new Date().toISOString(),
      chips: msg.chips && msg.chips.length ? msg.chips : null,
      id: refMsg.key!
    };
    await set(refMsg, payload);
  }

  /**
   * Legge tutti i messaggi della chat
   */
  getMessages(chatId: string): Observable<ChatMessage[]> {
    return new Observable(obs => {
      const refChat = ref(this.db, `${this.path}/${chatId}/messages`);
      const unsub = onValue(
        refChat,
        snap => {
          const data = snap.val() || {};
          const sorted = Object.values(data).sort((a: any, b: any) =>
            a.timestamp.localeCompare(b.timestamp)
          );
          obs.next(sorted as ChatMessage[]);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  /**
   * Crea risposta bot: preferisce backend proxy, fallback locale se non disponibile.
   */
  async replyWithPlan(chatId: string, history: ChatMessage[]): Promise<BotPlan> {
    const staff = await firstValueFrom(this.staffService.getAllStaff());
    const artists = staff.filter(s => s.isActive && s.role === 'tatuatore');

    const availability: Record<string, string[]> = {};
    const today = new Date();

    for (const artist of artists) {
      const days: string[] = [];
      for (let i = 0; i < 3; i++) {
        const date = format(addDays(today, i), 'yyyy-MM-dd');
        const slots = await this.bookingService.getFreeSlotsInDay(artist.id!, date);
        if (slots.length) {
          days.push(`${date}: ${slots.slice(0, 3).map(s => s.time).join(', ')}`);
        }
      }
      if (days.length) {
        availability[artist.name!] = days;
      }
    }

    const user = this.authService.userSig();
    const userInfo = user
      ? `Utente loggato: ${user.name} - Email: ${user.email}`
      : 'Utente non loggato. Chiedi nome e contatto.';

    try {
      const response = await firstValueFrom(
        this.http.post<BotPlan>(this.chatPlanUrl, {
          chatId,
          history,
          artists,
          availability,
          userInfo
        })
      );

      if (response?.message) {
        return {
          message: response.message,
          chips: (response.chips ?? []).slice(0, 3),
          action: response.action
        };
      }
    } catch (err: any) {
      console.warn('[ChatService] chat proxy unavailable, fallback locale.', err?.message ?? err);
    }

    return this.localFallbackPlan(artists, availability, history);
  }

  private localFallbackPlan(
    artists: Array<{ id?: string; name?: string }>,
    availability: Record<string, string[]>,
    history: ChatMessage[]
  ): BotPlan {
    const lastUser = [...history].reverse().find(m => m.from === 'user')?.text?.toLowerCase() ?? '';

    if (!artists.length) {
      return {
        message: 'Al momento non trovo artisti disponibili. Riprova tra poco o contattaci direttamente.',
        chips: []
      };
    }

    if (lastUser.includes('orari') || lastUser.includes('disponibil') || lastUser.includes('quando')) {
      const preview = Object.entries(availability)
        .slice(0, 2)
        .map(([name, slots]) => `${name}: ${slots.slice(0, 2).join(' | ')}`)
        .join(' - ');

      return {
        message: preview
          ? `Ti mostro alcune disponibilita: ${preview}. Dimmi artista, giorno e orario preferiti.`
          : 'Posso aiutarti a prenotare: indicami artista e giorno preferito.',
        chips: artists.slice(0, 3).map(a => a.name || 'Artista').filter(Boolean)
      };
    }

    return {
      message: 'Perfetto, iniziamo dalla scelta artista. Poi ti propongo giorno e orario disponibili.',
      chips: artists.slice(0, 3).map(a => a.name || 'Artista').filter(Boolean)
    };
  }
}
