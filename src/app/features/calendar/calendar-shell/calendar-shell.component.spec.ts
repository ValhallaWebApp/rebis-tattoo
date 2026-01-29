import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarShellComponent } from './calendar-shell.component';

describe('CalendarShellComponent', () => {
  let component: CalendarShellComponent;
  let fixture: ComponentFixture<CalendarShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarShellComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
