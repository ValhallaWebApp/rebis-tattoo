import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { BookingHistoryComponent } from './booking-history.component';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { SessionService } from '../../../../core/services/session/session.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { MatDialog } from '@angular/material/dialog';
import { ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { Router } from '@angular/router';
import { InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { ExternalActionsHelperService } from '../../../../core/services/helpers/external-actions-helper.service';

describe('BookingHistoryComponent', () => {
  let fixture: ComponentFixture<BookingHistoryComponent>;
  let component: BookingHistoryComponent;

  const authServiceMock = {
    userSig: () => ({ uid: 'client-1', role: 'client', name: 'Mario Rossi', email: 'mario.rossi@test.it' })
  };

  const bookingServiceMock = {
    getBookingsByClient: jasmine.createSpy('getBookingsByClient').and.returnValue(of([]))
  };

  const staffServiceMock = {
    getAllStaff: jasmine.createSpy('getAllStaff').and.returnValue(of([]))
  };

  const sessionServiceMock = {
    getAll: jasmine.createSpy('getAll').and.returnValue(of([])),
    getSessionsByClientWithBookingFallback: jasmine
      .createSpy('getSessionsByClientWithBookingFallback')
      .and.returnValue(of([]))
  };

  const uiFeedbackMock = {
    open: jasmine.createSpy('open')
  };

  const dialogMock = {
    open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(null) })
  };

  const reviewsServiceMock = {
    getReviewsByUser: jasmine.createSpy('getReviewsByUser').and.returnValue(of([]))
  };

  const routerMock = {
    navigate: jasmine.createSpy('navigate'),
    navigateByUrl: jasmine.createSpy('navigateByUrl')
  };

  const invoicesServiceMock = {
    getInvoices: jasmine.createSpy('getInvoices').and.returnValue(of([]))
  };

  const externalActionsMock = {
    openWhatsApp: jasmine.createSpy('openWhatsApp'),
    downloadTextFile: jasmine.createSpy('downloadTextFile')
  };

  beforeEach(async () => {
    bookingServiceMock.getBookingsByClient.calls.reset();
    staffServiceMock.getAllStaff.calls.reset();
    sessionServiceMock.getAll.calls.reset();
    sessionServiceMock.getSessionsByClientWithBookingFallback.calls.reset();
    reviewsServiceMock.getReviewsByUser.calls.reset();

    await TestBed.configureTestingModule({
      imports: [BookingHistoryComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: BookingService, useValue: bookingServiceMock },
        { provide: StaffService, useValue: staffServiceMock },
        { provide: SessionService, useValue: sessionServiceMock },
        { provide: UiFeedbackService, useValue: uiFeedbackMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: ReviewsService, useValue: reviewsServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: InvoicesService, useValue: invoicesServiceMock },
        { provide: ExternalActionsHelperService, useValue: externalActionsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingHistoryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should request sessions with client booking fallback', () => {
    const booking = {
      id: 'bk-1',
      clientId: 'client-1',
      status: 'completed',
      projectId: 'prj-1',
      start: '2026-02-18T09:00:00',
      end: '2026-02-18T10:00:00'
    } as any;
    bookingServiceMock.getBookingsByClient.and.returnValue(of([booking]));

    fixture.detectChanges();

    expect(sessionServiceMock.getSessionsByClientWithBookingFallback).toHaveBeenCalledWith('client-1', ['bk-1'], ['prj-1']);
  });

  it('should link sessions by projectId when bookingId is missing', () => {
    const booking = {
      id: 'bk-1',
      clientId: 'client-1',
      status: 'completed',
      projectId: 'prj-1',
      start: '2026-02-18T09:00:00',
      end: '2026-02-18T10:00:00'
    } as any;
    const session = {
      id: 's-1',
      projectId: 'prj-1',
      status: 'planned',
      start: '2026-02-18T10:00:00',
      end: '2026-02-18T11:00:00',
      artistId: 'artist-1'
    } as any;

    bookingServiceMock.getBookingsByClient.and.returnValue(of([booking]));
    sessionServiceMock.getSessionsByClientWithBookingFallback.and.returnValue(of([session]));

    fixture.detectChanges();

    expect(component.historyBookings.length).toBe(1);
    expect(component.getSessionCount(component.historyBookings[0] as any)).toBe(1);
  });

  it('should keep consultation label when booking type is explicit', () => {
    const booking = {
      id: 'bk-1',
      clientId: 'client-1',
      type: 'consultation',
      status: 'completed',
      projectId: 'prj-1',
      start: '2026-02-18T09:00:00',
      end: '2026-02-18T10:00:00'
    } as any;
    const session = {
      id: 's-1',
      projectId: 'prj-1',
      status: 'planned',
      start: '2026-02-18T10:00:00',
      end: '2026-02-18T11:00:00',
      artistId: 'artist-1'
    } as any;

    bookingServiceMock.getBookingsByClient.and.returnValue(of([booking]));
    sessionServiceMock.getSessionsByClientWithBookingFallback.and.returnValue(of([session]));

    fixture.detectChanges();

    expect(component.getBookingKindLabel(component.historyBookings[0] as any)).toBe('Consulenza');
    expect(component.getBookingKindClass(component.historyBookings[0] as any)).toBe('consultation');
  });

  it('should show readable client label in invoice html instead of client id', () => {
    fixture.detectChanges();

    const html = (component as any).buildInvoiceHtml(
      {
        id: 'inv-1',
        clientId: 'client-1',
        total: 50,
        currency: 'EUR'
      },
      {
        id: 'bk-1',
        artistId: 'artist-1',
        start: '2026-02-18T10:00:00'
      }
    ) as string;

    expect(html).toContain('Mario Rossi');
    expect(html).not.toContain('<div class="v">client-1</div>');
  });
});
