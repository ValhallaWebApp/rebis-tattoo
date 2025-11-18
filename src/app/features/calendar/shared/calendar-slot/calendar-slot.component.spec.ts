import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarSlotComponent } from './calendar-slot.component';

describe('CalendarSlotComponent', () => {
  let component: CalendarSlotComponent;
  let fixture: ComponentFixture<CalendarSlotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarSlotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarSlotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
