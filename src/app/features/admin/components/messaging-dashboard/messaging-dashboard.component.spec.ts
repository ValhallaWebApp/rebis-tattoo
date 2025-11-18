import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagingDashboardComponent } from './messaging-dashboard.component';

describe('MessagingDashboardComponent', () => {
  let component: MessagingDashboardComponent;
  let fixture: ComponentFixture<MessagingDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagingDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagingDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
