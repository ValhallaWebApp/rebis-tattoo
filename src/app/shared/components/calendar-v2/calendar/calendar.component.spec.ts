import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarComponentV2 } from './calendar.component';

describe('CalendarComponentV2', () => {
  let component: CalendarComponentV2;
  let fixture: ComponentFixture<CalendarComponentV2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponentV2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarComponentV2);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
