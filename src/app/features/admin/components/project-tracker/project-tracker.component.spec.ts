import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Database } from '@angular/fire/database';

import { ProjectTrackerComponent } from './project-tracker.component';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { ProjectsService } from '../../../../core/services/projects/projects.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { SessionService } from '../../../../core/services/session/session.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { ClientService } from '../../../../core/services/clients/client.service';
import { AuthService } from '../../../../core/services/auth/auth.service';

describe('ProjectTrackerComponent', () => {
  let component: ProjectTrackerComponent;
  let fixture: ComponentFixture<ProjectTrackerComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  const routeStub: Partial<ActivatedRoute> = {
    paramMap: of(convertToParamMap({})),
    snapshot: {
      paramMap: convertToParamMap({})
    } as any
  };

  const dialogStub = {
    open: () => ({ afterClosed: () => of(null) })
  };
  const feedbackStub = {
    open: jasmine.createSpy('open')
  };
  const projectsServiceStub = {
    getProjectById: () => Promise.resolve(null),
    updateProject: () => Promise.resolve()
  };
  const bookingServiceStub = {
    getAllBookings: () => of([])
  };
  const sessionServiceStub = {
    getAll: () => of([])
  };
  const staffServiceStub = {
    getAllStaff: () => of([])
  };
  const clientServiceStub = {
    getClients: () => of([])
  };
  const authServiceStub = {
    userSig: () => null
  };

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ProjectTrackerComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: MatDialog, useValue: dialogStub },
        { provide: UiFeedbackService, useValue: feedbackStub },
        { provide: ProjectsService, useValue: projectsServiceStub },
        { provide: BookingService, useValue: bookingServiceStub },
        { provide: SessionService, useValue: sessionServiceStub },
        { provide: StaffService, useValue: staffServiceStub },
        { provide: ClientService, useValue: clientServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: Database, useValue: {} }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectTrackerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
