import {
  Component, ViewChild, ElementRef, AfterViewChecked, DestroyRef, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MaterialModule } from '../../../core/modules/material.module';
import { ChatService, ChatMessage } from '../../../core/services/chatBot/chat-bot.service';
import { AuthService } from '../../../core/services/auth/authservice';
import { LocalLlmService, LlmRuntimeStatus } from '../../../core/services/chatBot/local-llm.service';

@Component({
  selector: 'app-chat-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './chat-bot.component.html',
  styleUrls: ['./chat-bot.component.scss']
})
export class ChatBotComponent implements AfterViewChecked {
  private readonly guestChatIdentityKey = 'rebis.chat.guest.identity';
  private readonly destroyRef = inject(DestroyRef);

  messages: { text: string; from: 'user' | 'bot'; chips?: string[] | null }[] = [];
  inputText = '';
  typing = false;
  isUserAtBottom = true;
  loadingLabel = 'Elaboro la risposta...';

  chatId: string | null = null;
  userId: string | null = null;
  userName?: string;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('bottomAnchor') bottomAnchor!: ElementRef;

  constructor(
    private chatService: ChatService,
    private auth: AuthService,
    private router: Router,
    private localLlm: LocalLlmService
  ) {
    this.localLlm.status$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        this.loadingLabel = this.mapLoadingLabel(status);
      });

    this.startConversation();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    this.bottomAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  onScroll(): void {
    const el = this.scrollContainer.nativeElement;
    const threshold = 150;
    this.isUserAtBottom = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - threshold);
  }

  trackByIndex = (i: number) => i;

  addUserMessage(text: string): void {
    this.messages.push({ text, from: 'user' });
    this.saveMessage('user', text);
  }

  addBotMessage(text: string, chips?: string[] | null): void {
    this.messages.push({ text, from: 'bot', chips: chips?.length ? chips : null });
    this.saveMessage('bot', text, chips || undefined);
  }

  saveMessage(from: 'user' | 'bot', text: string, chips?: string[]): void {
    if (!this.chatId) return;

    const msg: ChatMessage = {
      from,
      text,
      timestamp: new Date().toISOString(),
      chips: chips ?? null
    };

    void this.chatService.addMessage(this.chatId, msg).catch((err) => console.error('saveMessage ERROR', err));
  }

  private listenToChat(chatId: string): void {
    this.chatService.getMessages(chatId).subscribe((list) => {
      this.messages = list.map((m) => ({ text: m.text, from: m.from, chips: m.chips || null }));
      this.scrollToBottom();

      if (this.messages.length === 0) {
        this.addBotMessage(
          'Ciao, sono l assistente virtuale Rebis. Scrivimi la tua richiesta.',
          ['Accedi', 'Apri booking']
        );
      }
    });
  }

  startConversation(): void {
    const user = this.auth.userSig();

    if (user) {
      this.userId = user.uid;
      this.userName = user.name || undefined;
      const identity = user.email || user.uid;

      void this.chatService.createOrReuseChatByEmail(identity).then((chatId) => {
        this.chatId = chatId;
        this.listenToChat(chatId);
      });

      return;
    }

    const guestIdentity = this.getGuestIdentity();
    this.userId = null;
    this.userName = undefined;

    void this.chatService.createOrReuseChatByEmail(guestIdentity).then((chatId) => {
      this.chatId = chatId;
      this.listenToChat(chatId);
    });
  }

  async sendMessage(): Promise<void> {
    const userText = this.inputText.trim();
    if (!userText || !this.chatId || this.typing) return;

    this.addUserMessage(userText);
    this.inputText = '';
    this.typing = true;
    await this.flushUi();

    try {
      const history: ChatMessage[] = this.messages.map((m) => ({
        from: m.from,
        text: m.text,
        timestamp: new Date().toISOString(),
        chips: m.chips || undefined
      }));

      const role = this.auth.userSig()?.role ?? 'guest';
      const plan = await this.chatService.replyWithPlan(this.chatId, history, { role });

      this.addBotMessage(plan.message, plan.chips);
    } catch (err) {
      console.error('Errore chat AI:', err);
      this.addBotMessage('Errore durante la risposta AI. Riprova tra qualche secondo.');
    } finally {
      this.typing = false;
    }
  }

  onChipClick(label: string): void {
    if (this.typing) return;

    if (label === 'Accedi' || label === 'Registrati') {
      void this.router.navigate(['/login']);
      return;
    }

    if (label === 'Apri booking') {
      void this.router.navigate(['/fast-booking']);
      return;
    }

    if (label === 'Vai al profilo') {
      void this.router.navigate(['/dashboard']);
      return;
    }

    this.inputText = label;
    void this.sendMessage();
  }

  private getGuestIdentity(): string {
    const existing = this.safeStorageGet(this.guestChatIdentityKey);
    if (existing) return existing;

    const generated = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.safeStorageSet(this.guestChatIdentityKey, generated);
    return generated;
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
      // Ignore storage errors.
    }
  }

  private mapLoadingLabel(status: LlmRuntimeStatus): string {
    if (status === 'loading-model') return 'Sto caricando il modello AI...';
    if (status === 'generating') return 'Sto generando la risposta...';
    if (status === 'error') return 'Recupero servizio AI...';
    return 'Elaboro la risposta...';
  }

  private async flushUi(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
}
