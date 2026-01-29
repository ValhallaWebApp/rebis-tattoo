import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailabilitySheetComponent } from './availability-sheet.component';

describe('AvailabilitySheetComponent', () => {
  let component: AvailabilitySheetComponent;
  let fixture: ComponentFixture<AvailabilitySheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvailabilitySheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvailabilitySheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
