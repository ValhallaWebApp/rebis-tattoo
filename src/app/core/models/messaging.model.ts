export type ConversationStatus = 'open' | 'closed';
export type MessageKind = 'text' | 'media' | 'system';
export type ParticipantRole = 'client' | 'staff' | 'admin' | 'bot';
export type TicketStatus = 'new' | 'triage' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'booking' | 'billing' | 'aftercare' | 'tattoo-advice' | 'technical' | 'generic';
export type TicketType = 'support' | 'booking' | 'info' | 'advice';
export type TicketSource = 'chatbot' | 'manual' | 'system';

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
  ticketStatus?: TicketStatus;
  ticketPriority?: TicketPriority;
  ticketCategory?: TicketCategory;
  ticketType?: TicketType;
  ticketSource?: TicketSource;
  ownerStaffId?: string;
  assignedAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  slaDueAt?: string;
  linkedBookingId?: string;
  tags?: string[];
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
