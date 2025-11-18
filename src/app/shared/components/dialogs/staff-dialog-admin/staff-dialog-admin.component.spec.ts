import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffDialogAdminComponent } from './staff-dialog-admin.component';

describe('StaffDialogAdminComponent', () => {
  let component: StaffDialogAdminComponent;
  let fixture: ComponentFixture<StaffDialogAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffDialogAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffDialogAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
