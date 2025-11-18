import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffMembersAdminComponent } from './staff-members-admin.component';

describe('StaffMembersAdminComponent', () => {
  let component: StaffMembersAdminComponent;
  let fixture: ComponentFixture<StaffMembersAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffMembersAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffMembersAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
