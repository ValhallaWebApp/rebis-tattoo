import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoReferralComponent } from './promo-referral.component';

describe('PromoReferralComponent', () => {
  let component: PromoReferralComponent;
  let fixture: ComponentFixture<PromoReferralComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoReferralComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromoReferralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
