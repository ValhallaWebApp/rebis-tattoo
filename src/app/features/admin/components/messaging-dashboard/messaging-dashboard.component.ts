import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Conversation, ConversationMessage, ParticipantRole, TicketPriority, TicketStatus } from '../../../../core/models/messaging.model';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { MessagingService } from '../../../../core/services/messaging/messaging.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-messaging-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './messaging-dashboard.component.html',
  styleUrls: ['./messaging-dashboard.component.scss']
})
export class MessagingDashboardComponent implements OnDestroy {
  threads: Conversation[] = [];
  filteredThreads: Conversation[] = [];
  selectedThread: Conversation | null = null;
  messages: ConversationMessage[] = [];
  isDesktop = window.innerWidth >= 992;
  sidebarOpen = true;

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  readonly statusFilterCtrl = new FormControl<'all' | 'open' | 'closed' | 'unread'>('all', { nonNullable: true });
  readonly filtersForm = new FormGroup({
    search: this.searchCtrl,
    status: this.statusFilterCtrl
  });
  readonly filterFields: DynamicField[] = [
    {
      type: 'text',
      name: 'search',
      label: 'Cerca',
      placeholder: 'ID, titolo, ultimo messaggio...'
    },
    {
      type: 'button-toggle',
      name: 'status',
      label: 'Filtro',
      className: 'field-status',
      options: [
        { label: 'Tutte', value: 'all' },
        { label: 'Aperte', value: 'open' },
        { label: 'Chiuse', value: 'closed' },
        { label: 'Non lette', value: 'unread' }
      ]
    }
  ];

  messageCtrl = new FormControl<string>('', { nonNullable: true });
  readonly composerForm = new FormGroup({
    messageCtrl: this.messageCtrl
  });
  readonly composerFields: DynamicField[] = [
    {
      type: 'textarea',
      name: 'messageCtrl',
      label: 'Scrivi una risposta',
      placeholder: 'Scrivi una risposta...',
      rows: 3
    }
  ];

  private convSub?: Subscription;
  private msgSub?: Subscription;
  private filtersSub?: Subscription;
  actorId = '';
  private actorRole: ParticipantRole = 'admin';

  @ViewChild('messagesBox') messagesBox?: ElementRef<HTMLDivElement>;

  constructor(
    private messaging: MessagingService,
    private auth: AuthService,
    private ui: UiFeedbackService
  ) {
    this.filtersSub = this.filtersForm.valueChanges.subscribe(() => {
      this.applyThreadFilters();
    });
    window.addEventListener('resize', this.onResize);
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.convSub?.unsubscribe();
    this.msgSub?.unsubscribe();
    this.filtersSub?.unsubscribe();
    window.removeEventListener('resize', this.onResize);
  }

  selectThread(thread: Conversation): void {
    this.selectedThread = thread;
    if (!this.isDesktop) this.sidebarOpen = false;
    this.msgSub?.unsubscribe();
    this.messages = [];

    this.msgSub = this.messaging.streamMessages(thread.id).subscribe(list => {
      this.messages = list;
      setTimeout(() => this.scrollMessagesBottom(), 0);
    });

    if (this.actorId) {
      void this.messaging.markAsRead(thread.id, this.actorId).catch(() => {
        this.ui.warn('Impossibile segnare la conversazione come letta');
      });
      this.clearUnreadLocally(thread.id);
    }
  }

  async sendMessage(): Promise<void> {
    const message = this.messageCtrl.value.trim();
    if (!this.selectedThread || !message || !this.actorId) return;

    try {
      await this.messaging.sendMessage({
        conversationId: this.selectedThread.id,
        senderId: this.actorId,
        senderRole: this.actorRole,
        text: message
      });
      this.messageCtrl.setValue('');
    } catch (error) {
      this.ui.error(this.readErrorMessage(error, 'Invio messaggio non riuscito'));
    }
  }

  async setStatus(status: 'aperto' | 'chiuso'): Promise<void> {
    if (!this.selectedThread || !this.actorId) return;

    try {
      await this.messaging.setConversationStatus(
        this.selectedThread.id,
        status === 'chiuso' ? 'closed' : 'open',
        this.actorId,
        this.actorRole
      );
      this.ui.info(`Conversazione ${status === 'chiuso' ? 'chiusa' : 'riaperta'}`);
    } catch (error) {
      this.ui.error(this.readErrorMessage(error, 'Aggiornamento stato conversazione non riuscito'));
    }
  }

  async setTicketStatus(status: TicketStatus): Promise<void> {
    if (!this.selectedThread || !this.actorId) return;

    try {
      await this.messaging.updateTicketMeta(this.selectedThread.id, this.actorId, this.actorRole, {
        ticketStatus: status
      });
      this.ui.info(`Ticket aggiornato: ${this.ticketStatusLabel(status)}`);
    } catch (error) {
      this.ui.error(this.readErrorMessage(error, 'Aggiornamento ticket non riuscito'));
    }
  }

  labelStatus(status?: string): string {
    return status === 'closed' ? 'chiusa' : 'aperta';
  }

  statusChipClass(status?: string): 'open' | 'closed' {
    return status === 'closed' ? 'closed' : 'open';
  }

  ticketStatusLabel(status?: string): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'new': return 'Nuovo';
      case 'triage': return 'Triage';
      case 'in_progress': return 'In lavorazione';
      case 'waiting_client': return 'Attesa cliente';
      case 'resolved': return 'Risolto';
      case 'closed': return 'Chiuso';
      default: return 'Nuovo';
    }
  }

  ticketPriorityLabel(priority?: string): string {
    const normalized = String(priority ?? '').toLowerCase() as TicketPriority;
    if (normalized === 'low') return 'Bassa';
    if (normalized === 'high') return 'Alta';
    if (normalized === 'urgent') return 'Urgente';
    return 'Normale';
  }

  ticketPriorityClass(priority?: string): 'low' | 'normal' | 'high' | 'urgent' {
    const normalized = String(priority ?? '').toLowerCase();
    if (normalized === 'low' || normalized === 'high' || normalized === 'urgent') return normalized;
    return 'normal';
  }

  unreadCount(thread: Conversation): number {
    if (!this.actorId) return 0;
    return thread.unreadBy?.[this.actorId] ?? 0;
  }

  totalUnreadCount(): number {
    if (!this.actorId) return 0;
    return this.threads.reduce((sum, thread) => sum + (thread.unreadBy?.[this.actorId] ?? 0), 0);
  }

  isThreadSelected(thread: Conversation): boolean {
    return thread.id === this.selectedThread?.id;
  }

  conversationTitle(thread: Conversation): string {
    return thread.summary || `Conversazione #${thread.id.slice(-6)}`;
  }

  conversationPreview(thread: Conversation): string {
    const preview = thread.lastMessageText?.trim();
    return preview?.length ? preview : 'Nessun messaggio';
  }

  lastActivityDate(thread: Conversation): string {
    return thread.lastMessageAt || thread.updatedAt || thread.createdAt;
  }

  trackThread = (_: number, thread: Conversation): string => thread.id;
  trackMessage = (_: number, msg: ConversationMessage): string => msg.id;

  isOwnMessage(msg: ConversationMessage): boolean {
    return !!this.actorId && msg.senderId === this.actorId;
  }

  private async bootstrap(): Promise<void> {
    try {
      const user = await this.auth.resolveCurrentUser();
      if (!user?.uid) return;
      this.actorId = user.uid;
      this.actorRole = user.role === 'staff' ? 'staff' : 'admin';

      this.convSub = this.messaging.streamAllConversations().subscribe({
        next: (list) => {
          this.threads = list;
          this.applyThreadFilters();

          if (!this.selectedThread) {
            if (this.threads.length) this.selectThread(this.threads[0]);
            return;
          }

          const latest = this.threads.find(t => t.id === this.selectedThread!.id);
          if (latest) {
            this.selectedThread = latest;
            return;
          }

          this.selectedThread = null;
          this.messages = [];
          this.msgSub?.unsubscribe();
          if (this.threads.length) this.selectThread(this.threads[0]);
        },
        error: () => {
          this.ui.error('Impossibile caricare le conversazioni');
        }
      });
    } catch (error) {
      this.ui.error(this.readErrorMessage(error, 'Inizializzazione messaggistica non riuscita'));
    }
  }

  private applyThreadFilters(): void {
    const search = (this.searchCtrl.value || '').trim().toLowerCase();
    const mode = this.statusFilterCtrl.value;

    this.filteredThreads = this.threads.filter(thread => {
      const matchesSearch =
        !search ||
        thread.id.toLowerCase().includes(search) ||
        this.conversationTitle(thread).toLowerCase().includes(search) ||
        this.conversationPreview(thread).toLowerCase().includes(search);
      const unread = this.unreadCount(thread);
      const matchesStatus =
        mode === 'all' ? true :
        mode === 'open' ? thread.status !== 'closed' :
        mode === 'closed' ? thread.status === 'closed' :
        unread > 0;
      return matchesSearch && matchesStatus;
    });
  }

  private clearUnreadLocally(threadId: string): void {
    if (!this.actorId) return;
    this.threads = this.threads.map(thread => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        unreadBy: {
          ...(thread.unreadBy ?? {}),
          [this.actorId]: 0
        }
      };
    });
    this.applyThreadFilters();
  }

  private scrollMessagesBottom(): void {
    const box = this.messagesBox?.nativeElement;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
  }

  private readonly onResize = (): void => {
    this.isDesktop = window.innerWidth >= 992;
    if (this.isDesktop) this.sidebarOpen = true;
  };
}


