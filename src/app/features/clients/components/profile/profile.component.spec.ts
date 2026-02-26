import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { ProjectsService } from '../../../../core/services/projects/projects.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  const authServiceStub = {
    userSig: () => null,
    updateCurrentUserProfile: () => Promise.resolve()
  };

  const bookingServiceStub = {
    getBookingsByClient: () => of([])
  };

  const projectsServiceStub = {
    getProjectsByClient: () => of([])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: BookingService, useValue: bookingServiceStub },
        { provide: ProjectsService, useValue: projectsServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
