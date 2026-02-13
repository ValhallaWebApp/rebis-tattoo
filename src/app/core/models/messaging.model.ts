export type ConversationStatus = 'open' | 'closed';
export type MessageKind = 'text' | 'media' | 'system';
export type ParticipantRole = 'client' | 'staff' | 'admin' | 'bot';

export interface Conversation {
  id: string;
  summary: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: Record<string, ParticipantRole>;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  unreadBy?: Record<string, number>;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: ParticipantRole;
  text: string;
  kind: MessageKind;
  createdAt: string;
}
