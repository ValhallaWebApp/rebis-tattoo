import { Component, ElementRef, OnDestroy, OnInit, Renderer2 } from '@angular/core';
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
export class ChatBotPopupComponent implements OnInit, OnDestroy {
  isOpen = false;

  constructor(
    private host: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.updateChatViewportVars();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize, { passive: true });
      window.addEventListener('orientationchange', this.onResize, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
    }
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.updateChatViewportVars();
  }

  closeChat(): void {
    this.isOpen = false;
  }

  private readonly onResize = (): void => {
    this.updateChatViewportVars();
  };

  private updateChatViewportVars(): void {
    if (typeof window === 'undefined') return;
    const vh = Math.max(window.innerHeight || 0, 0);
    this.renderer.setStyle(this.host.nativeElement, '--chat-vh', `${vh}px`);
  }
}
