import { Component } from '@angular/core';
import { ChatBotComponent } from './chat-bot.component';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../core/modules/material.module';

@Component({
  selector: 'app-chat-bot-popup',
  standalone: true,
  imports: [CommonModule, ChatBotComponent,MaterialModule],
  templateUrl: './chat-bot-popup.component.html',
  styleUrls: ['./chat-bot-popup.component.scss']
})
export class ChatBotPopupComponent {
  isOpen = false;

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  closeChat(): void {
    this.isOpen = false;
  }
}
