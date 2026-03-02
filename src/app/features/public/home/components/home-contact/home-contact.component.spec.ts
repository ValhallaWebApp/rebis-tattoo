import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { HomeContactComponent } from './home-contact.component';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { StaffService } from '../../../../../core/services/staff/staff.service';
import { FastBookingStore } from '../../../fast-booking/state/fast-booking-store.service';

describe('HomeContactComponent', () => {
  let component: HomeContactComponent;
  let fixture: ComponentFixture<HomeContactComponent>;
  let router: Router;

  const authServiceStub = {
    userSig: () => null
  };

  const staffServiceStub = {
    getAllStaff: () =>
      of([
        {
          id: 'artist-1',
          name: 'Artist One',
          role: 'tatuatore',
          isActive: true
        }
      ])
  };

  const fastBookingStoreStub = {
    applyHomeSeed: jasmine.createSpy('applyHomeSeed')
  };

  const languageServiceStub = {
    t: (path: string) => path,
    get: () => undefined
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HomeContactComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: StaffService, useValue: staffServiceStub },
        { provide: FastBookingStore, useValue: fastBookingStoreStub },
        { provide: LanguageService, useValue: languageServiceStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeContactComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();

    expect(component.bookingForm.valid).toBeFalse();
    expect(fastBookingStoreStub.applyHomeSeed).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should seed fast booking and navigate when form is valid', () => {
    component.bookingForm.setValue({
      fullName: 'Mario Rossi',
      email: 'mario@example.com',
      phone: '+39 3400000000',
      procedure: 'Custom Procedure',
      artist: 'artist-1',
      comments: 'Test',
      privacyConsent: true
    });

    component.onSubmit();

    expect(fastBookingStoreStub.applyHomeSeed).toHaveBeenCalledWith(
      jasmine.objectContaining({
        fullName: 'Mario Rossi',
        email: 'mario@example.com',
        artist: 'artist-1'
      })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/fast-booking']);
  });
});
