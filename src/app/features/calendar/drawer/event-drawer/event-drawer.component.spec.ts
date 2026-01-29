import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventDrawerComponent } from './event-drawer.component';

describe('EventDrawerComponent', () => {
  let component: EventDrawerComponent;
  let fixture: ComponentFixture<EventDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventDrawerComponent]
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
