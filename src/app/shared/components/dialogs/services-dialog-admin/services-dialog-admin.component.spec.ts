import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicesDialogAdminComponent } from './services-dialog-admin.component';

describe('ServicesDialogAdminComponent', () => {
  let component: ServicesDialogAdminComponent;
  let fixture: ComponentFixture<ServicesDialogAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesDialogAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServicesDialogAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
