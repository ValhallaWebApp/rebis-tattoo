import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewListAdminComponent } from './review-list-admin.component';

describe('ReviewListAdminComponent', () => {
  let component: ReviewListAdminComponent;
  let fixture: ComponentFixture<ReviewListAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewListAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewListAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
