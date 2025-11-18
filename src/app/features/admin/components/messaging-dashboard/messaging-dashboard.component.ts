import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
interface ChatMessage {
  sender: 'utente' | 'admin' | 'chatbot';
  text: string;
  timestamp: Date;
}

interface ChatThread {
  userId: string;
  userName: string;
  source: 'form' | 'chatbot';
  messages: ChatMessage[];
  unread: boolean;
}

@Component({
  selector: 'app-messaging-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './messaging-dashboard.component.html',
  styleUrls: ['./messaging-dashboard.component.scss']
})
export class MessagingDashboardComponent {
  users = [
    { name: 'Mario Rossi' },
    { name: 'Giulia Verdi' },
    { name: 'Luca Bianchi' }
  ];

  messages = [
    { sender: 'Mario', text: 'Ciao, quando posso passare?' },
    { sender: 'Admin', text: 'Domani alle 15:00 è libero.' }
  ];
  threads: ChatThread[] = [
    {
      userId: 'u1',
      userName: 'Mario Rossi',
      source: 'form',
      unread: true,
      messages: [
        { sender: 'utente', text: 'Salve, volevo informazioni.', timestamp: new Date() },
        { sender: 'admin', text: 'Certamente, dimmi pure.', timestamp: new Date() }
      ]
    },
    {
      userId: 'u2',
      userName: 'Giulia Verdi',
      source: 'chatbot',
      unread: false,
      messages: [
        { sender: 'chatbot', text: 'Hai bisogno di un appuntamento?', timestamp: new Date() },
        { sender: 'utente', text: 'Sì, per sabato.', timestamp: new Date() }
      ]
    }
  ];

  selectedThread: ChatThread | any = null
  newMessage = '';

  selectThread(thread: ChatThread) {
    this.selectedThread = thread;
    thread.unread = false;
  }

  sendMessage() {
    if (!this.selectedThread || !this.newMessage.trim()) return;

    this.selectedThread.messages.push({
      sender: 'admin',
      text: this.newMessage.trim(),
      timestamp: new Date()
    });

    this.newMessage = '';
  }

}
