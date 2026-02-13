export type NotificationType = 'booking' | 'chat' | 'payment' | 'bonus' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority: NotificationPriority;
  createdAt: string;
  readAt: string | null;
  meta?: Record<string, string>;
}
