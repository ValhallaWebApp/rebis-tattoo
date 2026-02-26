import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdminDashboardComponent } from './admin-dashboard.component';
import { BookingService } from '../../../core/services/bookings/booking.service';
import { ReviewsService } from '../../../core/services/reviews/reviews.service';
import { ClientService } from '../../../core/services/clients/client.service';
import { AuthService } from '../../../core/services/auth/auth.service';

registerLocaleData(localeIt);

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  const bookingServiceStub = {
    getBookingsByDate: () => of([]),
    getTotalRevenueThisMonth: () => of(0)
  };

  const reviewsServiceStub = {
    getRecentReviews: () => of([]),
    getAllReviews: () => of([])
  };

  const clientServiceStub = {
    getClients: () => of([])
  };

  const authServiceStub = {
    userSig: () => ({ role: 'admin', permissions: {} }),
    canManageRoles: () => true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: BookingService, useValue: bookingServiceStub },
        { provide: ReviewsService, useValue: reviewsServiceStub },
        { provide: ClientService, useValue: clientServiceStub },
        { provide: AuthService, useValue: authServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
