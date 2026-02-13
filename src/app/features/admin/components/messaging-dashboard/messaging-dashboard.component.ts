import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Conversation, ConversationMessage, ParticipantRole } from '../../../../core/models/messaging.model';
import { AuthService } from '../../../../core/services/auth/authservice';
import { MessagingService } from '../../../../core/services/messaging/messaging.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-messaging-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './messaging-dashboard.component.html',
  styleUrls: ['./messaging-dashboard.component.scss']
})
export class MessagingDashboardComponent implements OnDestroy {
  threads: Conversation[] = [];
  selectedThread: Conversation | null = null;
  messages: ConversationMessage[] = [];
  newMessage = '';

  private convSub?: Subscription;
  private msgSub?: Subscription;
  actorId = '';
  private actorRole: ParticipantRole = 'admin';

  constructor(
    private messaging: MessagingService,
    private auth: AuthService,
    private ui: UiFeedbackService
  ) {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.convSub?.unsubscribe();
    this.msgSub?.unsubscribe();
  }

  selectThread(thread: Conversation): void {
    this.selectedThread = thread;
    this.msgSub?.unsubscribe();
    this.messages = [];

    this.msgSub = this.messaging.streamMessages(thread.id).subscribe(list => {
      this.messages = list;
    });

    if (this.actorId) {
      void this.messaging.markAsRead(thread.id, this.actorId);
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.selectedThread || !this.newMessage.trim() || !this.actorId) return;

    await this.messaging.sendMessage({
      conversationId: this.selectedThread.id,
      senderId: this.actorId,
      senderRole: this.actorRole,
      text: this.newMessage.trim()
    });

    this.newMessage = '';
  }

  async setStatus(status: 'aperto' | 'chiuso'): Promise<void> {
    if (!this.selectedThread || !this.actorId) return;

    await this.messaging.setConversationStatus(
      this.selectedThread.id,
      status === 'chiuso' ? 'closed' : 'open',
      this.actorId,
      this.actorRole
    );
    this.ui.info(`Conversazione ${status === 'chiuso' ? 'chiusa' : 'riaperta'}`);
  }

  labelStatus(status?: string): string {
    return status === 'closed' ? 'chiusa' : 'aperta';
  }

  isAdminMessage(msg: ConversationMessage): boolean {
    return msg.senderRole === 'admin' || msg.senderRole === 'staff';
  }

  private async bootstrap(): Promise<void> {
    const user = await this.auth.resolveCurrentUser();
    if (!user?.uid) return;
    this.actorId = user.uid;
    this.actorRole = user.role === 'staff' ? 'staff' : 'admin';

    this.convSub = this.messaging.streamAllConversations().subscribe(list => {
      this.threads = list;
      if (!this.selectedThread && this.threads.length) {
        this.selectThread(this.threads[0]);
      } else if (this.selectedThread) {
        const latest = this.threads.find(t => t.id === this.selectedThread!.id);
        if (latest) this.selectedThread = latest;
      }
    });
  }
}
