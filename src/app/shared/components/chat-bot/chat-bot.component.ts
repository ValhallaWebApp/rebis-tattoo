import {
  Component, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MaterialModule } from '../../../core/modules/material.module';
import { ChatService, ChatMessage } from '../../../core/services/chatBot/chat-bot.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { MessagingService } from '../../../core/services/messaging/messaging.service';

@Component({
  selector: 'app-chat-bot',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './chat-bot.component.html',
  styleUrls: ['./chat-bot.component.scss']
})
export class ChatBotComponent implements AfterViewChecked {
  private readonly guestChatIdentityKey = 'rebis.chat.guest.identity';
  private readonly preferredConversationStorageKey = 'rebis.messaging.preferredConversation';

  messages: { text: string; from: 'user' | 'bot'; chips?: string[] | null }[] = [];
  inputCtrl = new FormControl<string>('', { nonNullable: true });
  typing = false;
  isUserAtBottom = true;
  loadingLabel = 'Sto preparando la risposta...';

  chatId: string | null = null;
  userId: string | null = null;
  userName?: string;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('bottomAnchor') bottomAnchor!: ElementRef;

  constructor(
    private chatService: ChatService,
    private auth: AuthService,
    private router: Router,
    private messaging: MessagingService
  ) {
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
          'Ciao, sono l assistente Rebis. Ti aiuto con consulenze, contatti e chat con lo studio.',
          this.defaultChipsForCurrentRole()
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
    const userText = this.inputCtrl.value.trim();
    if (!userText || !this.chatId || this.typing) return;

    this.addUserMessage(userText);
    this.inputCtrl.setValue('');
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
      console.error('Errore chatbot:', err);
      this.addBotMessage('Errore durante la risposta. Riprova tra qualche secondo.');
    } finally {
      this.typing = false;
    }
  }

  onChipClick(label: string): void {
    if (this.typing) return;

    if (label === 'Apri chat studio') {
      void this.openStudioChat();
      return;
    }

    if (label === 'Accedi' || label === 'Registrati' || label === 'Accedi per chat studio') {
      this.openLoginForStudioChat();
      return;
    }

    if (label === 'Prenota consulenza' || label === 'Apri consulenza') {
      void this.router.navigate(['/fast-booking']);
      return;
    }

    if (label === 'Contatti studio' || label === 'Orari studio') {
      void this.router.navigate(['/contatti']);
      return;
    }

    if (label === 'Vai al profilo' || label === 'Stato prenotazione') {
      void this.openStudioChat();
      return;
    }

    this.inputCtrl.setValue(label);
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

  private defaultChipsForCurrentRole(): string[] {
    const role = this.auth.userSig()?.role ?? 'guest';
    if (role === 'client' || role === 'user' || role === 'staff' || role === 'admin') {
      return ['Apri chat studio', 'Prenota consulenza', 'Contatti studio'];
    }
    return ['Accedi per chat studio', 'Prenota consulenza', 'Contatti studio'];
  }

  private async openStudioChat(): Promise<void> {
    const role = this.auth.userSig()?.role ?? 'guest';
    if (role === 'admin') {
      await this.router.navigate(['/admin/messaging']);
      return;
    }
    if (role === 'staff') {
      await this.router.navigate(['/staff/messaging']);
      return;
    }
    if (role === 'client' || role === 'user') {
      const user = this.auth.userSig();
      const clientId = String(user?.uid ?? '').trim();
      if (!clientId) {
        this.openLoginForStudioChat();
        return;
      }

      try {
        const firstUserMessage = this.latestUserMessage();
        const firstBotReply = this.latestBotMessage();
        const summary = firstUserMessage
          ? `Ticket: ${firstUserMessage.slice(0, 64)}`
          : 'Ticket assistenza da chatbot';
        const initialMessage = this.buildHandoffMessage(firstUserMessage, firstBotReply);

        const conversationId = await this.messaging.createOrOpenSupportTicketForClient({
          clientId,
          summary,
          category: this.inferCategory(firstUserMessage),
          type: this.inferType(firstUserMessage),
          priority: 'normal',
          source: 'chatbot',
          tags: ['chatbot', 'handoff'],
          initialMessage
        });

        this.safeStorageSet(this.preferredConversationStorageKey, conversationId);
        await this.router.navigate(['/dashboard/chat'], {
          queryParams: { conversationId }
        });
      } catch (err) {
        console.warn('[ChatBot] handoff ticket fallito, fallback su chat dashboard', err);
        await this.router.navigate(['/dashboard/chat']);
      }
      return;
    }

    this.openLoginForStudioChat();
  }

  private openLoginForStudioChat(): void {
    this.safeStorageSet('pre-log', '/dashboard/chat');
    void this.router.navigate(['/login']);
  }

  private latestUserMessage(): string {
    const item = [...this.messages].reverse().find((m) => m.from === 'user' && m.text.trim().length > 0);
    return item?.text?.trim() ?? '';
  }

  private latestBotMessage(): string {
    const item = [...this.messages].reverse().find((m) => m.from === 'bot' && m.text.trim().length > 0);
    return item?.text?.trim() ?? '';
  }

  private buildHandoffMessage(latestUserMessage: string, latestBotMessage: string): string {
    const recent = this.messages.slice(-4).map((m) => `${m.from === 'user' ? 'Cliente' : 'Assistente'}: ${m.text}`);
    const lines = [
      '[handoff-chatbot]',
      latestUserMessage ? `Richiesta cliente: ${latestUserMessage}` : 'Richiesta cliente: supporto generale',
      latestBotMessage ? `Ultima risposta assistente: ${latestBotMessage}` : '',
      recent.length ? 'Contesto breve:' : '',
      ...recent
    ].filter(Boolean);

    return lines.join('\n').slice(0, 1400);
  }

  private inferCategory(text: string): 'booking' | 'billing' | 'aftercare' | 'tattoo-advice' | 'technical' | 'generic' {
    const normalized = String(text ?? '').toLowerCase();
    if (normalized.includes('prenot') || normalized.includes('consulenza') || normalized.includes('appuntamento')) return 'booking';
    if (normalized.includes('pagament') || normalized.includes('fattura') || normalized.includes('prezzo') || normalized.includes('costo')) return 'billing';
    if (normalized.includes('cura') || normalized.includes('guarig') || normalized.includes('aftercare')) return 'aftercare';
    if (normalized.includes('stile') || normalized.includes('soggetto') || normalized.includes('tattoo') || normalized.includes('tatuaggio')) return 'tattoo-advice';
    if (normalized.includes('errore') || normalized.includes('bug') || normalized.includes('accesso') || normalized.includes('login')) return 'technical';
    return 'generic';
  }

  private inferType(text: string): 'support' | 'booking' | 'info' | 'advice' {
    const normalized = String(text ?? '').toLowerCase();
    if (normalized.includes('prenot') || normalized.includes('consulenza') || normalized.includes('appuntamento')) return 'booking';
    if (normalized.includes('consiglio') || normalized.includes('stile') || normalized.includes('idea')) return 'advice';
    if (normalized.includes('orari') || normalized.includes('contatt') || normalized.includes('dove') || normalized.includes('indirizzo')) return 'info';
    return 'support';
  }

  private async flushUi(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
}


