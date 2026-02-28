import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChatActorRole, LocalLlmService } from './local-llm.service';

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

  constructor(private localLlm: LocalLlmService) {}

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
    const lastUser = [...history].reverse().find((m) => m.from === 'user' && m.text.trim().length > 0);

    if (!lastUser) {
      return {
        message: 'Ciao, sono l assistente virtuale Rebis. Scrivimi la tua richiesta.',
        chips: this.defaultSupportChips(role)
      };
    }

    const aiReply = await this.localLlm.generateSupportReply({
      role,
      userMessage: lastUser.text,
      history
    });

    if (aiReply) {
      return {
        message: aiReply,
        chips: this.defaultSupportChips(role)
      };
    }

    return {
      message: 'Non riesco a rispondere in questo momento. Riprova tra poco.',
      chips: this.defaultSupportChips(role)
    };
  }

  private defaultSupportChips(role: ChatActorRole): string[] {
    if (role === 'guest' || role === 'public') {
      return ['Accedi', 'Apri consulenza'];
    }
    return ['Vai al profilo', 'Apri consulenza'];
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
