import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/authservice';
import { MessagingService } from '../../../../core/services/messaging/messaging.service';
import { Conversation, ConversationMessage, ConversationStatus, ParticipantRole } from '../../../../core/models/messaging.model';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule, PickerModule],
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss']
})
export class MessagingComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly messaging = inject(MessagingService);
  private readonly ui = inject(UiFeedbackService);

  isDesktop = window.innerWidth >= 768;
  sidebarOpen = false;
  emojiPickerVisible = false;
  galleryOpen = false;
  expandedImage: string | null = null;

  statusFilter = signal<'aperte' | 'chiuse' | 'tutte'>('aperte');
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  threads = signal<Conversation[]>([]);
  selectedThread = signal<Conversation | null>(null);
  messages = signal<ConversationMessage[]>([]);
  newMessage = '';

  emojiCategories: any[] = ['smileys', 'foods', 'activities', 'objects'];
  projectImages: string[] = [];

  private convSub?: Subscription;
  private msgSub?: Subscription;
  private currentUserId: string | null = null;
  private currentUserRole: ParticipantRole = 'client';

  readonly filteredThreads = computed(() => {
    const q = (this.searchCtrl.value || '').toLowerCase();
    const mode = this.statusFilter();
    return this.threads().filter(t => {
      const matchesStatus =
        mode === 'tutte' ? true :
        mode === 'aperte' ? t.status === 'open' :
        t.status === 'closed';
      const lastText = t.lastMessageText || t.summary || '';
      const matchesQuery = !q || t.id.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  });

  @ViewChild('msgBox') msgBox!: ElementRef<HTMLDivElement>;

  constructor() {
    window.addEventListener('resize', this.onResize);
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.convSub?.unsubscribe();
    this.msgSub?.unsubscribe();
  }

  async createConversation(): Promise<void> {
    if (!this.currentUserId) return;
    const id = await this.messaging.createConversationForClient(this.currentUserId, 'Chat con studio');
    const created = this.threads().find(t => t.id === id) ?? null;
    if (created) this.selectThread(created);
  }

  selectThread(t: Conversation | null): void {
    this.selectedThread.set(t);
    this.messages.set([]);
    this.msgSub?.unsubscribe();

    if (!t?.id || !this.currentUserId) return;

    this.msgSub = this.messaging.streamMessages(t.id).subscribe(msgs => {
      this.messages.set(msgs);
      setTimeout(() => this.scrollBottom(), 0);
      this.updateGallery();
    });

    void this.messaging.markAsRead(t.id, this.currentUserId);
  }

  async sendMessage(): Promise<void> {
    const text = this.newMessage.trim();
    const t = this.selectedThread();
    if (!text || !t?.id || !this.currentUserId) return;

    await this.messaging.sendMessage({
      conversationId: t.id,
      senderId: this.currentUserId,
      senderRole: this.currentUserRole,
      text,
      kind: 'text'
    });

    this.newMessage = '';
    this.emojiPickerVisible = false;
  }

  async uploadMedia(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const t = this.selectedThread();
    if (!file || !t?.id || !this.currentUserId) return;

    const url = URL.createObjectURL(file);
    await this.messaging.sendMessage({
      conversationId: t.id,
      senderId: this.currentUserId,
      senderRole: this.currentUserRole,
      text: `📎 Media: ${url}`,
      kind: 'media'
    });
  }

  async setStatus(status: 'aperto' | 'chiuso'): Promise<void> {
    const t = this.selectedThread();
    if (!t?.id || !this.currentUserId) return;

    const mapped: ConversationStatus = status === 'chiuso' ? 'closed' : 'open';
    await this.messaging.setConversationStatus(t.id, mapped, this.currentUserId, this.currentUserRole);
  }

  async deleteThread(): Promise<void> {
    const t = this.selectedThread();
    if (!t?.id || !this.currentUserId) return;

    await this.messaging.archiveConversationForUser(t.id, this.currentUserId);
    this.selectThread(null);
    this.ui.info('Conversazione archiviata');
  }

  isOwnMessage(m: ConversationMessage): boolean {
    return !!this.currentUserId && m.senderId === this.currentUserId;
  }

  statusLabel(status: ConversationStatus | undefined): string {
    return status === 'closed' ? 'chiuso' : 'aperto';
  }

  addEmoji(e: any): void {
    this.newMessage += e.emoji.native;
    this.emojiPickerVisible = false;
  }

  hasGallery(): boolean {
    return this.messages().some(m => /https?:\/\/.+\.(png|jpe?g|webp|gif)/i.test(m.text));
  }

  openGallery(): void {
    this.updateGallery();
    this.galleryOpen = true;
  }

  toggleExpand(img: string): void {
    this.expandedImage = this.expandedImage === img ? null : img;
  }

  private async bootstrap(): Promise<void> {
    const user = await this.auth.resolveCurrentUser();
    if (!user?.uid) return;

    this.currentUserId = user.uid;
    this.currentUserRole = this.toParticipantRole(user.role);
    this.bindConversations(user.uid);
  }

  private bindConversations(userId: string): void {
    this.convSub?.unsubscribe();
    this.convSub = this.messaging.streamConversationsForUser(userId).subscribe(async list => {
      this.threads.set(list);

      const selected = this.selectedThread();
      if (selected && list.some(t => t.id === selected.id)) return;

      if (!list.length) {
        const id = await this.messaging.createConversationForClient(userId, 'Chat con studio');
        const created = this.threads().find(t => t.id === id) ?? null;
        this.selectThread(created);
        return;
      }

      this.selectThread(list[0] ?? null);
    });
  }

  private toParticipantRole(role?: string): ParticipantRole {
    if (role === 'admin') return 'admin';
    if (role === 'staff') return 'staff';
    return 'client';
  }

  private scrollBottom(): void {
    const el = this.msgBox?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private updateGallery(): void {
    this.projectImages = this.messages()
      .map(m => m.text?.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/i)?.[0] || null)
      .filter(Boolean) as string[];
  }

  private readonly onResize = (): void => {
    this.isDesktop = window.innerWidth >= 768;
  };
}
