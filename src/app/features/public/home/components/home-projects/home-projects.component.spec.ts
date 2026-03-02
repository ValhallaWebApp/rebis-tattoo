import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HomeProjectsComponent } from './home-projects.component';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { ProjectsService } from '../../../../../core/services/projects/projects.service';

describe('HomeProjectsComponent', () => {
  let component: HomeProjectsComponent;
  let fixture: ComponentFixture<HomeProjectsComponent>;

  const projectsServiceStub = {
    getProjects: () => of([])
  };

  const languageServiceStub = {
    t: (path: string) => {
      if (path === 'home.projects.noPhotoLabel') return 'No photo';
      if (path === 'home.projects.fallbackTitle') return 'Project';
      if (path === 'home.projects.fallbackDescription') return 'Project description';
      return path;
    },
    get: () => undefined
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HomeProjectsComponent],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceStub },
        { provide: LanguageService, useValue: languageServiceStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should replace broken image src with fallback', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/broken.jpg';

    component.onImgError({ target: img } as unknown as Event);

    expect(img.src).toBe(component.fallbackCover);
  });
});
