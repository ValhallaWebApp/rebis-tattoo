import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CalendarShellComponent } from './calendar-shell.component';
import { UiFeedbackService } from '../../../core/services/ui/ui-feedback.service';
import { ClientService } from '../../../core/services/clients/client.service';
import { ProjectsService } from '../../../core/services/projects/projects.service';
import { SessionService } from '../../../core/services/session/session.service';
import { AuthService } from '../../../core/services/auth/auth.service';

describe('CalendarShellComponent', () => {
  let component: CalendarShellComponent;
  let fixture: ComponentFixture<CalendarShellComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  const routeStub: Partial<ActivatedRoute> = {};
  const dialogStub = {
    open: () => ({ afterClosed: () => of(null) })
  };
  const feedbackStub = {
    open: jasmine.createSpy('open')
  };
  const clientServiceStub = {
    getClientsLiteOnce: () => of([])
  };
  const projectsServiceStub = {
    getProjectsLiteOnce: () => of([])
  };
  const sessionServiceStub = {
    getSessionById: () => Promise.resolve(null)
  };
  const authServiceStub = {
    userSig: () => null
  };

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CalendarShellComponent, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: MatDialog, useValue: dialogStub },
        { provide: UiFeedbackService, useValue: feedbackStub },
        { provide: ClientService, useValue: clientServiceStub },
        { provide: ProjectsService, useValue: projectsServiceStub },
        { provide: SessionService, useValue: sessionServiceStub },
        { provide: AuthService, useValue: authServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarShellComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
