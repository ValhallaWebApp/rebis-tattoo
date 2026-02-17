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
import { map, Observable, of } from 'rxjs';
import { AppNotification, NotificationPriority, NotificationType } from '../../models/notification.model';
import { UiFeedbackService } from '../ui/ui-feedback.service';

type AppRole = 'admin' | 'client' | 'public' | string;

type CreateNotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority?: NotificationPriority;
  meta?: Record<string, string>;
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly path = 'notifications';

  constructor(
    private db: Database,
    private ui: UiFeedbackService
  ) {}

  private isPermissionDenied(error: unknown): boolean {
    const code = String((error as any)?.code ?? '').toLowerCase();
    const message = String((error as any)?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || message.includes('permission_denied') || message.includes('permission denied');
  }

  getUserNotifications(userId: string): Observable<AppNotification[]> {
    if (!userId) return of([]);

    return new Observable<AppNotification[]>(observer => {
      const userRef = ref(this.db, `${this.path}/${userId}`);
      const unsubscribe = onValue(
        userRef,
        snapshot => {
          if (!snapshot.exists()) {
            observer.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, Partial<AppNotification>>;
          const notifications = Object.entries(raw)
            .map(([id, value]) => this.toNotification(id, userId, value))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          observer.next(notifications);
        },
        error => {
          if (this.isPermissionDenied(error)) {
            observer.next([]);
            return;
          }
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  getUnreadCount(userId: string): Observable<number> {
    return this.getUserNotifications(userId).pipe(
      map(items => items.filter(item => !item.readAt).length)
    );
  }

  async createForUser(userId: string, payload: CreateNotificationPayload): Promise<string> {
    const node = push(ref(this.db, `${this.path}/${userId}`));
    const id = node.key ?? `${Date.now()}`;
    const now = new Date().toISOString();

    const notification: AppNotification = {
      id,
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      priority: payload.priority ?? 'normal',
      createdAt: now,
      readAt: null,
      meta: payload.meta
    };

    try {
      await set(node, this.stripUndef(notification));
      return id;
    } catch (error) {
      if (this.isPermissionDenied(error)) return id;
      throw error;
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = ref(this.db, `${this.path}/${userId}/${notificationId}`);
      await update(notificationRef, { readAt: new Date().toISOString() });
    } catch (error) {
      if (this.isPermissionDenied(error)) return;
      this.ui.error('Errore aggiornamento notifica');
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const userRef = ref(this.db, `${this.path}/${userId}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) return;

      const data = snapshot.val() as Record<string, Partial<AppNotification>>;
      const now = new Date().toISOString();
      const updates: Record<string, string> = {};

      for (const [id, notification] of Object.entries(data)) {
        if (!notification.readAt) {
          updates[`${id}/readAt`] = now;
        }
      }

      if (Object.keys(updates).length === 0) return;
      await update(userRef, updates);
      this.ui.info('Notifiche segnate come lette');
    } catch (error) {
      if (this.isPermissionDenied(error)) return;
      this.ui.error('Errore aggiornamento notifiche');
      throw error;
    }
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    try {
      await remove(ref(this.db, `${this.path}/${userId}/${notificationId}`));
      this.ui.info('Notifica eliminata');
    } catch (error) {
      if (this.isPermissionDenied(error)) return;
      this.ui.error('Errore eliminazione notifica');
      throw error;
    }
  }

  resolveNotificationLink(notification: AppNotification, role: AppRole): string {
    const explicit = String(notification.link ?? '').trim();
    if (explicit) return explicit;
    return this.getDefaultLinkByTypeAndRole(notification.type, role);
  }

  getDefaultLinkByTypeAndRole(type: NotificationType, role: AppRole): string {
    const isAdmin = role === 'admin';
    const isStaff = role === 'staff';
    const backofficeBase = isAdmin ? '/admin' : isStaff ? '/staff' : '';
    const isBackoffice = isAdmin || isStaff;
    const staffSafeBase = '/staff';

    if (type === 'booking') {
      if (isAdmin) return `${backofficeBase}/calendar`;
      if (isStaff) return staffSafeBase;
      return '/dashboard/booking-history';
    }

    if (type === 'chat') {
      if (isAdmin) return `${backofficeBase}/messaging`;
      if (isStaff) return staffSafeBase;
      return '/dashboard/chat';
    }

    if (type === 'payment') {
      if (isAdmin) return `${backofficeBase}/billing`;
      if (isStaff) return staffSafeBase;
      return '/dashboard/invoices';
    }

    if (type === 'bonus') {
      if (isAdmin) return `${backofficeBase}/bonus`;
      if (isStaff) return staffSafeBase;
      return '/dashboard/buoni';
    }

    return isBackoffice ? backofficeBase : '/dashboard';
  }

  private toNotification(
    id: string,
    userId: string,
    value: Partial<AppNotification>
  ): AppNotification {
    return {
      id,
      userId,
      type: value.type ?? 'system',
      title: value.title ?? '',
      message: value.message ?? '',
      link: value.link,
      priority: value.priority ?? 'normal',
      createdAt: value.createdAt ?? new Date(0).toISOString(),
      readAt: value.readAt ?? null,
      meta: value.meta
    };
  }

  private stripUndef<T extends object>(obj: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) out[key] = value;
    }
    return out as Partial<T>;
  }
}
