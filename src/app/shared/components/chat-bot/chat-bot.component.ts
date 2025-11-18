import {
  Component, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MaterialModule } from '../../../core/modules/material.module';
import { ChatService, ChatMessage } from '../../../core/services/chatBot/chat-bot.service';
import { AuthService } from '../../../core/services/auth/authservice';
import {
  BookingDraftService,
  Booking,
  BookingChatDraft,
  BookingService
} from '../../../core/services/bookings/booking.service';

@Component({
  selector: 'app-chat-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './chat-bot.component.html',
  styleUrls: ['./chat-bot.component.scss']
})
export class ChatBotComponent implements AfterViewChecked {
  messages: { text: string; from: 'user' | 'bot'; chips?: string[] | null }[] = [];
  inputText = '';
  typing = false;
  isUserAtBottom = true;

  chatId: string | null = null;
  userId: string | null = null;
  userName?: string;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('bottomAnchor') bottomAnchor!: ElementRef;

  constructor(
    private chatService: ChatService,
    private auth: AuthService,
    private router: Router,
    private bookingService: BookingService
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
    if (!this.chatId || !this.userId) return;
    const msg: ChatMessage = {
      from,
      text,
      timestamp: new Date().toISOString(),
      chips: chips ?? null
    };
    this.chatService.addMessage(this.chatId, msg).catch(err => console.error('saveMessage ERROR', err));
  }

  private listenToChat(chatId: string): void {
    this.chatService.getMessages(chatId).subscribe(list => {
      this.messages = list.map(m => ({ text: m.text, from: m.from, chips: m.chips || null }));
      this.scrollToBottom();
      if (this.messages.length === 0) {
        this.addBotMessage(
          '🟢 Posso aiutarti con assistenza o guidarti nella prenotazione. Vuoi iniziare?',
          ['Prenotazione guidata', 'Apri booking', 'ℹ️ Info']
        );
      }
    });
  }

  startConversation(): void {
    const user = this.auth.userSig();
    if (user) {
      this.userId = user.uid;
      this.userName = user.name || undefined;
      const email = user.email || user.uid;
      this.chatService.createOrReuseChatByEmail(email).then(chatId => {
        this.chatId = chatId;
        this.listenToChat(chatId);
      });
    } else {
      const email = prompt("Inserisci la tua email per iniziare la conversazione:");
      if (!email) return;
      this.userId = null;
      this.userName = undefined;
      this.chatService.createOrReuseChatByEmail(email).then(chatId => {
        this.chatId = chatId;
        this.listenToChat(chatId);
      });
    }
  }

  async sendMessage(): Promise<void> {
    const userText = this.inputText.trim();
    if (!userText || !this.chatId) return;

    this.addUserMessage(userText);
    this.inputText = '';
    this.typing = true;

    const history: ChatMessage[] = this.messages.map(m => ({
      from: m.from,
      text: m.text,
      timestamp: new Date().toISOString(),
      chips: m.chips || undefined
    }));

    const plan = await this.chatService.replyWithPlan(this.chatId, history);
    this.typing = false;

    this.addBotMessage(plan.message, plan.chips);

    if (plan.action?.type === 'booking-draft') {
      const draft = plan.action.draft;
      const user = this.auth.userSig();
      const email = user?.email || prompt("Inserisci un'email per confermare la prenotazione:");

      if (!email || !draft?.date || !draft?.time || !draft?.artistId) {
        this.addBotMessage("❌ Impossibile completare la prenotazione. Dati insufficienti.");
        return;
      }

      try {
        const idClient = user?.uid || `anonimo-${this.chatId}`;
        await this.bookingService.addDraftFromChat(draft, {
          idClient,
          clientName: this.userName ?? 'Utente Chat'
        });

        this.addBotMessage("✅ Prenotazione registrata con successo! Puoi vedere i dettagli nella tua area personale.", ["Vai al profilo"]);
      } catch (err) {
        console.error("Errore durante la prenotazione:", err);
        this.addBotMessage("❌ Errore durante la prenotazione. Riprova più tardi.");
      }
    }
  }

  onChipClick(label: string): void {
    if (label === 'Accedi' || label === 'Registrati') {
      this.router.navigate(['/login']);
      return;
    }
    if (label === 'Prenotazione guidata') {
      this.inputText = 'prenota una consulenza';
      this.sendMessage();
      return;
    }
    if (label === 'Apri booking') {
      this.router.navigate(['/bookings']);
      return;
    }
    if (label === 'Vai al profilo') {
      this.router.navigate(['/account']);
      return;
    }
    this.inputText = label;
    this.sendMessage();
  }
}
