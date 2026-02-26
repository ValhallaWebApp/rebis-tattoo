import { Injectable } from '@angular/core';
import {
  Database,
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update
} from '@angular/fire/database';
import { Observable } from 'rxjs';
import {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  MessageKind,
  ParticipantRole
} from '../../models/messaging.model';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly conversationsPath = 'conversations';
  private readonly messagesPath = 'conversationMessages';
  private readonly userConversationsPath = 'userConversations';

  constructor(
    private db: Database,
    private notifications: NotificationService,
    private audit: AuditLogService,
    private auth: AuthService
  ) {}

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private isPermissionDeniedReason(reason: unknown): boolean {
    const payload = reason as { code?: unknown } | null;
    return String(payload?.code ?? '').includes('PERMISSION_DENIED');
  }

  private normalizeParticipantRole(value: unknown): ParticipantRole {
    const role = String(value ?? '').toLowerCase();
    if (role === 'admin' || role === 'staff' || role === 'bot') return role;
    return 'client';
  }

  private toParticipants(value: unknown): Record<string, ParticipantRole> {
    const source = this.toRecord(value);
    const participants: Record<string, ParticipantRole> = {};
    for (const [uid, role] of Object.entries(source)) {
      participants[uid] = this.normalizeParticipantRole(role);
    }
    return participants;
  }

  private toUnreadBy(value: unknown): Record<string, number> {
    const source = this.toRecord(value);
    const unreadBy: Record<string, number> = {};
    for (const [uid, count] of Object.entries(source)) {
      unreadBy[uid] = Number(count ?? 0) || 0;
    }
    return unreadBy;
  }

  private roleOf(uid: string, conv: Conversation): ParticipantRole | undefined {
    return conv.participants?.[uid];
  }

  private isAdminLike(role?: string): boolean {
    return role === 'admin' || role === 'staff';
  }

  private canStaffAccessConversation(userId: string, conv: Conversation): boolean {
    return !!this.roleOf(userId, conv);
  }

  streamConversationsForUser(userId: string): Observable<Conversation[]> {
    if (!userId) return new Observable<Conversation[]>(obs => obs.next([]));

    return new Observable<Conversation[]>(observer => {
      const indexRef = ref(this.db, `${this.userConversationsPath}/${userId}`);
      const unsubscribe = onValue(
        indexRef,
        async snapshot => {
          if (!snapshot.exists()) {
            observer.next([]);
            return;
          }

          const index = snapshot.val() as Record<string, string | boolean>;
          const ids = Object.keys(index);
          const rows = await Promise.all(ids.map(async id => {
            const convSnap = await get(ref(this.db, `${this.conversationsPath}/${id}`));
            if (!convSnap.exists()) return null;
            return this.toConversation(id, convSnap.val());
          }));

          const conversations = rows
            .filter((r): r is Conversation => !!r)
            .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));

          observer.next(conversations);
        },
        error => observer.error(error)
      );

      return () => unsubscribe();
    });
  }

  streamAllConversations(): Observable<Conversation[]> {
    const actor = this.auth.userSig();
    const actorId = actor?.uid ?? '';
    const actorRole = actor?.role ?? 'guest';
    if (!this.isAdminLike(actorRole)) {
      return new Observable<Conversation[]>(obs => {
        obs.next([]);
        obs.complete();
      });
    }
    if (actorRole === 'staff') {
      return this.streamConversationsForUser(actorId);
    }

    return new Observable<Conversation[]>(observer => {
      const conversationsRef = ref(this.db, this.conversationsPath);
      const unsubscribe = onValue(
        conversationsRef,
        snapshot => {
          if (!snapshot.exists()) {
            observer.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, unknown>;
          const conversations = Object.entries(raw)
            .map(([id, item]) => this.toConversation(id, item))
            .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
          observer.next(conversations);
        },
        error => observer.error(error)
      );
      return () => unsubscribe();
    });
  }

  streamMessages(conversationId: string): Observable<ConversationMessage[]> {
    if (!conversationId) return new Observable<ConversationMessage[]>(obs => obs.next([]));

    return new Observable<ConversationMessage[]>(observer => {
      const messagesRef = ref(this.db, `${this.messagesPath}/${conversationId}`);
      const unsubscribe = onValue(
        messagesRef,
        snapshot => {
          if (!snapshot.exists()) {
            observer.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, unknown>;
          const messages = Object.entries(raw)
            .map(([id, value]) => this.toMessage(id, conversationId, value))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

          observer.next(messages);
        },
        error => observer.error(error)
      );

      return () => unsubscribe();
    });
  }

  async createConversationForClient(clientId: string, summary = 'Conversazione con studio'): Promise<string> {
    const actor = this.auth.userSig();
    const now = new Date().toISOString();
    const node = push(ref(this.db, this.conversationsPath));
    const id = node.key!;
    const participants: Record<string, ParticipantRole> = { [clientId]: 'client' };

    const conversation: Conversation = {
      id,
      summary,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      createdBy: actor?.uid ?? clientId,
      participants,
      unreadBy: {}
    };

    await set(node, conversation);
    await this.touchParticipants(id, Object.keys(participants), now);

    void this.audit.log({
      action: 'messaging.conversation.create',
      resource: 'conversation',
      resourceId: id,
      status: 'success',
      actorId: actor?.uid ?? clientId,
      actorRole: actor?.role,
      targetUserId: clientId,
      meta: { participants: Object.keys(participants).length }
    });

    return id;
  }

  async sendMessage(params: {
    conversationId: string;
    senderId: string;
    senderRole: ParticipantRole;
    text: string;
    kind?: MessageKind;
  }): Promise<void> {
    const { conversationId, senderId, senderRole, text } = params;
    const kind = params.kind ?? 'text';
    const content = String(text ?? '').trim();
    if (!conversationId || !senderId || !content) return;

    const now = new Date().toISOString();
    const convRef = ref(this.db, `${this.conversationsPath}/${conversationId}`);
    const convSnap = await get(convRef);
    if (!convSnap.exists()) throw new Error('Conversazione non trovata');

    const conv = this.toConversation(conversationId, convSnap.val());
    const isSenderParticipant = !!this.roleOf(senderId, conv);
    const isSenderAdmin = senderRole === 'admin';
    const isSenderStaff = senderRole === 'staff';
    if (!isSenderAdmin && !isSenderParticipant) {
      throw new Error('Utente non autorizzato a scrivere in questa conversazione');
    }
    if (isSenderStaff && !isSenderParticipant) {
      throw new Error('Staff non assegnato a questa conversazione');
    }
    const participants = Object.keys(conv.participants ?? {});
    const unreadBy: Record<string, number> = { ...(conv.unreadBy ?? {}) };
    participants.forEach(uid => {
      if (uid === senderId) unreadBy[uid] = 0;
      else unreadBy[uid] = Number(unreadBy[uid] ?? 0) + 1;
    });

    const msgNode = push(ref(this.db, `${this.messagesPath}/${conversationId}`));
    const message: ConversationMessage = {
      id: msgNode.key!,
      conversationId,
      senderId,
      senderRole,
      text: content,
      kind,
      createdAt: now
    };

    await set(msgNode, message);
    await update(convRef, {
      updatedAt: now,
      status: conv.status === 'closed' ? 'open' : conv.status,
      lastMessageAt: now,
      lastMessageBy: senderId,
      lastMessageText: content.slice(0, 180),
      unreadBy
    });
    await this.touchParticipants(conversationId, participants, now);

    const recipients = participants.filter(uid => uid !== senderId);
    await Promise.allSettled(recipients.map(uid => {
      const recipientRole = conv.participants?.[uid];
      const link = recipientRole === 'admin'
        ? '/admin/messaging'
        : recipientRole === 'staff'
          ? '/staff/messaging'
          : '/dashboard/chat';
      return this.notifications.createForUser(uid, {
        type: 'chat',
        title: 'Nuovo messaggio',
        message: content.length > 90 ? `${content.slice(0, 87)}...` : content,
        link,
        meta: { conversationId, senderId }
      });
    }));

    void this.audit.log({
      action: 'messaging.message.send',
      resource: 'conversation',
      resourceId: conversationId,
      status: 'success',
      actorId: senderId,
      actorRole: senderRole,
      meta: { kind, recipients: recipients.length }
    });
  }

  async setConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    actorId: string,
    actorRole?: string
  ): Promise<void> {
    const convSnap = await get(ref(this.db, `${this.conversationsPath}/${conversationId}`));
    if (!convSnap.exists()) throw new Error('Conversazione non trovata');
    const conv = this.toConversation(conversationId, convSnap.val());
    const actor = this.auth.userSig();
    const role = actorRole ?? actor?.role ?? 'guest';
    if (!this.isAdminLike(role)) {
      throw new Error('Solo admin o staff possono cambiare stato conversazione');
    }
    if (role === 'staff' && !this.canStaffAccessConversation(actorId, conv)) {
      throw new Error('Staff non assegnato a questa conversazione');
    }

    const now = new Date().toISOString();
    await update(ref(this.db, `${this.conversationsPath}/${conversationId}`), {
      status,
      updatedAt: now
    });
    await this.touchParticipants(conversationId, Object.keys(conv.participants ?? {}), now);

    void this.audit.log({
      action: 'messaging.conversation.status',
      resource: 'conversation',
      resourceId: conversationId,
      status: 'success',
      actorId,
      actorRole,
      meta: { status }
    });
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    if (!conversationId || !userId) return;
    const convSnap = await get(ref(this.db, `${this.conversationsPath}/${conversationId}`));
    if (!convSnap.exists()) return;
    const conv = this.toConversation(conversationId, convSnap.val());
    const actor = this.auth.userSig();
    const actorRole = actor?.role ?? 'guest';
    const actorId = actor?.uid ?? userId;
    const actorCanRead = this.isAdminLike(actorRole) || !!this.roleOf(actorId, conv);
    if (!actorCanRead) throw new Error('Non autorizzato');
    if (!this.isAdminLike(actorRole) && actorId !== userId) throw new Error('Non autorizzato');

    const now = new Date().toISOString();
    await update(ref(this.db, `${this.conversationsPath}/${conversationId}/unreadBy`), {
      [userId]: 0
    });
    await set(ref(this.db, `${this.userConversationsPath}/${userId}/${conversationId}`), now);
  }

  async archiveConversationForUser(conversationId: string, userId: string): Promise<void> {
    if (!conversationId || !userId) return;
    const convSnap = await get(ref(this.db, `${this.conversationsPath}/${conversationId}`));
    if (!convSnap.exists()) return;
    const conv = this.toConversation(conversationId, convSnap.val());
    const actor = this.auth.userSig();
    const actorRole = actor?.role ?? 'guest';
    const actorId = actor?.uid ?? userId;
    if (!this.isAdminLike(actorRole) && actorId !== userId) throw new Error('Non autorizzato');
    if (!this.isAdminLike(actorRole) && !this.roleOf(userId, conv)) throw new Error('Non autorizzato');
    if (actorRole === 'staff' && !this.canStaffAccessConversation(actorId, conv)) {
      throw new Error('Staff non assegnato a questa conversazione');
    }
    await remove(ref(this.db, `${this.userConversationsPath}/${userId}/${conversationId}`));

    void this.audit.log({
      action: 'messaging.conversation.archive',
      resource: 'conversation',
      resourceId: conversationId,
      status: 'success',
      actorId: actor?.uid ?? userId,
      actorRole: actor?.role
    });
  }

  private async touchParticipants(conversationId: string, userIds: string[], now: string): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map(uid => set(ref(this.db, `${this.userConversationsPath}/${uid}/${conversationId}`), now))
    );

    const denied = results.filter(
      (r): r is PromiseRejectedResult =>
        r.status === 'rejected' && this.isPermissionDeniedReason(r.reason)
    ).length;

    if (denied > 0) {
      console.warn('[MessagingService] touchParticipants partial deny on userConversations', {
        conversationId,
        denied,
        total: userIds.length
      });
    }
  }

  private toConversation(id: string, raw: unknown): Conversation {
    const source = this.toRecord(raw);
    return {
      id,
      summary: String(source['summary'] ?? 'Conversazione'),
      status: source['status'] === 'closed' ? 'closed' : 'open',
      createdAt: String(source['createdAt'] ?? new Date(0).toISOString()),
      updatedAt: String(source['updatedAt'] ?? source['createdAt'] ?? new Date(0).toISOString()),
      createdBy: String(source['createdBy'] ?? ''),
      participants: this.toParticipants(source['participants']),
      lastMessageText: source['lastMessageText'] ? String(source['lastMessageText']) : undefined,
      lastMessageAt: source['lastMessageAt'] ? String(source['lastMessageAt']) : undefined,
      lastMessageBy: source['lastMessageBy'] ? String(source['lastMessageBy']) : undefined,
      unreadBy: this.toUnreadBy(source['unreadBy'])
    };
  }

  private toMessage(id: string, conversationId: string, raw: unknown): ConversationMessage {
    const source = this.toRecord(raw);
    return {
      id,
      conversationId,
      senderId: String(source['senderId'] ?? ''),
      senderRole: this.normalizeParticipantRole(source['senderRole']),
      text: String(source['text'] ?? ''),
      kind: source['kind'] === 'media' || source['kind'] === 'system' ? source['kind'] : 'text',
      createdAt: String(source['createdAt'] ?? new Date(0).toISOString())
    };
  }
}


