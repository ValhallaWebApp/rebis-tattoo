import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  get,
  onValue
} from '@angular/fire/database';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  private readonly OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private db: Database,
    private http: HttpClient,
    private staffService: StaffService,
    private bookingService: BookingService,
    private authService: AuthService
  ) {}

  getApiKey(): string | null {
    return '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';
  }

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
      onValue(refChat, snap => {
        const data = snap.val() || {};
        const sorted = Object.values(data).sort((a: any, b: any) =>
          a.timestamp.localeCompare(b.timestamp)
        );
        obs.next(sorted as ChatMessage[]);
      });
    });
  }

  /**
   * Costruisce un prompt dinamico per GPT e gestisce risposta
   */
  async replyWithPlan(chatId: string, history: ChatMessage[]): Promise<BotPlan> {
    const apiKey = this.getApiKey();
    if (!apiKey) return { message: '🔑 Nessuna API Key trovata.', chips: [] };

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
      ? `Utente loggato: ${user.name} – Email: ${user.email}`
      : 'Utente non loggato. Chiedi gentilmente: nome, cognome, età e un contatto (email o telefono).';

    const prompt = [
  'Sei l’assistente virtuale di Rebis Tattoo.',
  'Aiuta l’utente a prenotare una consulenza di 60 minuti, gestendo chiarimenti e domande.',
  'Quando tutti i dati necessari (artista, giorno, ora, contatto) sono presenti, genera il seguente blocco:',
  '<JSON>{"chips":[],"action":{"type":"booking-draft","draft":{"artistId":"idArtista","date":"YYYY-MM-DD","time":"HH:mm","duration":60,"note":"testo facoltativo"}}}</JSON>',
  'Scrivi la risposta normale PRIMA del blocco JSON, e non aggiungere testo dopo di esso.',
  'Se mancano dati, chiedili esplicitamente uno alla volta.',
  'Non creare JSON se non hai tutti i dati necessari.',
  'Artisti attivi: ' + artists.map(a => `${a.name} (id: ${a.id})`).join(', '),
  'Disponibilità:',
  ...Object.entries(availability).map(
    ([name, slots]) => `• ${name} → ${slots.join(' | ')}`
  ),
  userInfo
].join('\n');


    const messages = [
      { role: 'system', content: prompt },
      ...history.map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    ];

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    });

    const body = {
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3
    };

    try {
      const res: any = await firstValueFrom(this.http.post(this.OPENAI_URL, body, { headers }));
      const fullText = res?.choices?.[0]?.message?.content ?? '';

      const jsonMatch = fullText.match(/<JSON>(.*?)<\/JSON>/s);
      const text = fullText.replace(/<JSON>.*<\/JSON>/s, '').trim();
      const json = jsonMatch?.[1];

      let chips: string[] = [];
      let action: BotPlan['action'];

      if (json) {
        const parsed = JSON.parse(json);
        chips = parsed.chips || [];
        action = parsed.action;
      }

      return { message: text, chips: chips.slice(0, 3), action };
    } catch (err:any) {
      console.error('[ChatBotService] GPT error →', err);

       if (err.status === 429) {
    console.warn('[ChatService] Rate limit superato. Riprovo dopo 5 secondi...');
    await new Promise(res => setTimeout(res, 5000)); // aspetta 5 secondi
    const retry = await firstValueFrom(this.http.post<OpenAIResponse>(this.OPENAI_URL, body, { headers }));
    const fullText = retry?.choices?.[0]?.message?.content ?? '';
    // processa il retry come sopra...
  } else {
    console.error('[ChatBotService] GPT error →', err);
    return { message: '❌ Errore del bot.', chips: [] };
  }
    }
      return { message: '⚠ Errore imprevisto.', chips: [] };

  }
}
interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}
