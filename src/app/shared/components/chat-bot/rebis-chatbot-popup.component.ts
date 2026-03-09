import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RebisChatbotService } from '../../../core/services/chatbot/rebis-chatbot.service';
import { LanguageService } from '../../../core/services/language/language.service';

@Component({
  selector: 'app-rebis-chatbot-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rebis-chatbot-popup.component.html',
  styleUrl: './rebis-chatbot-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RebisChatbotPopupComponent {
  private readonly chat = inject(RebisChatbotService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  private messagesWrap?: ElementRef<HTMLElement>;

  @ViewChild('messagesWrap')
  set messagesWrapRef(value: ElementRef<HTMLElement> | undefined) {
    this.messagesWrap = value;
    if (value) {
      this.scheduleScrollToBottom('auto');
    }
  }

  @ViewChild('filePicker') filePicker?: ElementRef<HTMLInputElement>;

  readonly panelState = this.chat.panelState;
  readonly messages = this.chat.messages;
  readonly quickActions = this.chat.quickActions;
  readonly typing = this.chat.typing;
  readonly error = this.chat.error;
  readonly bookingActive = this.chat.bookingActive;
  readonly bookingStep = this.chat.bookingStep;
  readonly bookingProgress = this.chat.bookingProgress;
  readonly bookingSuccess = this.chat.bookingSuccess;

  readonly teaserText = computed(() => this.lang.t('chatbot.teaser'));
  readonly composerValue = signal('');
  readonly bookingInput = signal('');
  readonly canSend = computed(() => this.composerValue().trim().length > 0);
  readonly canSendBooking = computed(() => this.bookingInput().trim().length > 0);

  private readonly scrollEffect = effect(() => {
    this.panelState();
    this.messages();
    this.typing();
    this.bookingSuccess();
    this.scheduleScrollToBottom(this.typing() ? 'auto' : 'smooth');
  });

  openChat(): void {
    this.chat.open();
    setTimeout(() => this.scheduleScrollToBottom('auto'), 860);
  }

  closeChat(): void {
    this.chat.close();
  }

  showTeaser(): void {
    this.chat.showTeaser();
  }

  async send(): Promise<void> {
    const text = this.composerValue().trim();
    if (!text) return;
    this.composerValue.set('');
    await this.chat.sendUserMessage(text);
  }

  async onComposerKeydown(event: KeyboardEvent): Promise<void> {
    const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
    if (!isEnter || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    await this.send();
  }

  async pickQuickAction(actionId: string): Promise<void> {
    await this.chat.selectQuickAction(actionId);
  }

  async submitBooking(): Promise<void> {
    const value = this.bookingInput().trim();
    if (!value) return;
    this.bookingInput.set('');
    await this.chat.submitBookingStep(value);
  }

  async onBookingKeydown(event: KeyboardEvent): Promise<void> {
    const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
    if (!isEnter || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    await this.submitBooking();
  }

  onComposerFocus(): void {
    this.scheduleScrollToBottom('auto');
    setTimeout(() => this.scheduleScrollToBottom('auto'), 220);
    setTimeout(() => this.scheduleScrollToBottom('auto'), 520);
  }

  onBookingFocus(): void {
    this.scheduleScrollToBottom('auto');
    setTimeout(() => this.scheduleScrollToBottom('auto'), 220);
    setTimeout(() => this.scheduleScrollToBottom('auto'), 520);
  }

  triggerReferencePicker(): void {
    this.filePicker?.nativeElement?.click();
  }

  onReferencePicked(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    this.chat.registerReference(file.name);
    input.value = '';
  }

  goToFastBooking(): void {
    void this.router.navigate(['/fast-booking']);
    this.closeChat();
  }

  goToContacts(): void {
    void this.router.navigate(['/contatti']);
    this.closeChat();
  }

  restart(): void {
    this.chat.resetConversation();
  }

  t(path: string): string {
    return this.lang.t(path);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.panelState() === 'active' || this.panelState() === 'opening') {
      this.scheduleScrollToBottom('auto');
    }
  }

  private scheduleScrollToBottom(behavior: ScrollBehavior): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        this.scrollToBottom(behavior);
        requestAnimationFrame(() => this.scrollToBottom(behavior));
      });
    });
  }

  private scrollToBottom(behavior: ScrollBehavior): void {
    const el = this.messagesWrap?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }
}
