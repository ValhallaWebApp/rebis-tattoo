import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ChatBotComponent } from './chat-bot.component';
import { ChatService } from '../../../core/services/chatBot/chat-bot.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Router } from '@angular/router';
import { MessagingService } from '../../../core/services/messaging/messaging.service';

class ChatServiceStub {
  readonly createOrReuseChatByEmail = jasmine.createSpy('createOrReuseChatByEmail').and.resolveTo('chat-test');
  readonly getMessages = jasmine.createSpy('getMessages').and.returnValue(of([]));
  readonly addMessage = jasmine.createSpy('addMessage').and.resolveTo();
  readonly replyWithPlan = jasmine.createSpy('replyWithPlan').and.resolveTo({
    message: 'ok',
    chips: ['Apri chat studio']
  });
}

class AuthServiceStub {
  userSig = jasmine.createSpy('userSig').and.returnValue(null);
}

class RouterStub {
  readonly navigate = jasmine.createSpy('navigate').and.resolveTo(true);
}

class MessagingServiceStub {
  readonly createOrOpenSupportTicketForClient = jasmine.createSpy('createOrOpenSupportTicketForClient').and.resolveTo('conv-test');
}

describe('ChatBotComponent', () => {
  let component: ChatBotComponent;
  let fixture: ComponentFixture<ChatBotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatBotComponent, NoopAnimationsModule],
      providers: [
        { provide: ChatService, useClass: ChatServiceStub },
        { provide: AuthService, useClass: AuthServiceStub },
        { provide: Router, useClass: RouterStub },
        { provide: MessagingService, useClass: MessagingServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatBotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
