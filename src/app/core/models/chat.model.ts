export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
}

export interface ChatThread {
  id: string;
  clientId: string;
  staffId: string;
  messages: ChatMessage[];
  updatedAt: string;
}
