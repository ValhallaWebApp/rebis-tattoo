import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAppointmentDetailsDialogComponent } from './admin-appointment-details-dialog.component';

describe('AdminAppointmentDetailsDialogComponent', () => {
  let component: AdminAppointmentDetailsDialogComponent;
  let fixture: ComponentFixture<AdminAppointmentDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAppointmentDetailsDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAppointmentDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
