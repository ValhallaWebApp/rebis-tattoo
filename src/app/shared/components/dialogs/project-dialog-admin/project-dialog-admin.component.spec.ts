import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectDialogAdminComponent } from './project-dialog-admin.component';

describe('ProjectDialogAdminComponent', () => {
  let component: ProjectDialogAdminComponent;
  let fixture: ComponentFixture<ProjectDialogAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDialogAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectDialogAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
