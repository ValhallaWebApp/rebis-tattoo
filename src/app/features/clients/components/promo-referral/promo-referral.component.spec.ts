import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PromoReferralComponent } from './promo-referral.component';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BonusService } from '../../../../core/services/bonus/bonus.service';
import { LanguageService } from '../../../../core/services/language/language.service';

describe('PromoReferralComponent', () => {
  let component: PromoReferralComponent;
  let fixture: ComponentFixture<PromoReferralComponent>;
  let authMock: jasmine.SpyObj<AuthService>;
  let bonusMock: jasmine.SpyObj<BonusService>;
  const langMock: Pick<LanguageService, 't'> = { t: (key: string) => key };

  beforeEach(async () => {
    authMock = jasmine.createSpyObj<AuthService>('AuthService', ['resolveCurrentUser']);
    authMock.resolveCurrentUser.and.resolveTo(null);

    bonusMock = jasmine.createSpyObj<BonusService>('BonusService', [
      'streamWallet',
      'streamWalletLedger',
      'applyPromoCodeForCurrentUser',
      'redeemGiftCardForCurrentUser'
    ]);
    bonusMock.streamWallet.and.returnValue(of({ userId: '', balance: 0, updatedAt: new Date(0).toISOString() }));
    bonusMock.streamWalletLedger.and.returnValue(of([]));
    bonusMock.applyPromoCodeForCurrentUser.and.resolveTo({ code: 'PROMO', amount: 10, walletBalance: 10 });
    bonusMock.redeemGiftCardForCurrentUser.and.resolveTo({ code: 'GIFT', amount: 10, walletBalance: 20 });

    await TestBed.configureTestingModule({
      imports: [PromoReferralComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: BonusService, useValue: bonusMock },
        { provide: LanguageService, useValue: langMock }
      ]
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
