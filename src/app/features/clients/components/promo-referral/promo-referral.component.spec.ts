import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PromoReferralComponent } from './promo-referral.component';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BonusService } from '../../../../core/services/bonus/bonus.service';
import { LanguageService } from '../../../../core/services/language/language.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { UserService } from '../../../../core/services/users/user.service';

describe('PromoReferralComponent', () => {
  let component: PromoReferralComponent;
  let fixture: ComponentFixture<PromoReferralComponent>;
  let authMock: jasmine.SpyObj<AuthService>;
  let bonusMock: jasmine.SpyObj<BonusService>;
  let userServiceMock: jasmine.SpyObj<UserService>;
  let uiMock: jasmine.SpyObj<UiFeedbackService>;
  const langMock: Pick<LanguageService, 't'> = { t: (key: string) => key };

  beforeEach(async () => {
    authMock = jasmine.createSpyObj<AuthService>('AuthService', ['resolveCurrentUser']);
    authMock.resolveCurrentUser.and.resolveTo(null);

    bonusMock = jasmine.createSpyObj<BonusService>('BonusService', [
      'streamWallet',
      'streamWalletLedger',
      'redeemGiftCardForCurrentUser',
      'createGiftCardFromPurchase'
    ]);
    bonusMock.streamWallet.and.returnValue(of({ userId: '', balance: 0, updatedAt: new Date(0).toISOString() }));
    bonusMock.streamWalletLedger.and.returnValue(of([]));
    bonusMock.redeemGiftCardForCurrentUser.and.resolveTo({ code: 'GIFT', amount: 10, walletBalance: 20 });
    bonusMock.createGiftCardFromPurchase.and.resolveTo({ giftId: 'gift_1', code: 'GIFT-1234', amount: 50 });
    userServiceMock = jasmine.createSpyObj<UserService>('UserService', ['getAllUsers']);
    userServiceMock.getAllUsers.and.returnValue(of([]));
    uiMock = jasmine.createSpyObj<UiFeedbackService>('UiFeedbackService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [PromoReferralComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: BonusService, useValue: bonusMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: LanguageService, useValue: langMock },
        { provide: UiFeedbackService, useValue: uiMock }
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
