import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewCreateDialogComponent } from './review-create-dialog.component';

describe('ReviewCreateDialogComponent', () => {
  let component: ReviewCreateDialogComponent;
  let fixture: ComponentFixture<ReviewCreateDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewCreateDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
