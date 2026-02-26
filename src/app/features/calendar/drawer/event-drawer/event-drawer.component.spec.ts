import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EventDrawerComponent } from './event-drawer.component';

describe('EventDrawerComponent', () => {
  let component: EventDrawerComponent;
  let fixture: ComponentFixture<EventDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventDrawerComponent, NoopAnimationsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
