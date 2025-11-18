import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatActionsDialogComponent } from './chat-actions-dialog.component';

describe('ChatActionsDialogComponent', () => {
  let component: ChatActionsDialogComponent;
  let fixture: ComponentFixture<ChatActionsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatActionsDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatActionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
