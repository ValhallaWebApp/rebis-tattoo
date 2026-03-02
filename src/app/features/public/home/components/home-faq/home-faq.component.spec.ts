import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { HomeFaqComponent } from './home-faq.component';
import { LanguageService } from '../../../../../core/services/language/language.service';

describe('HomeFaqComponent', () => {
  let component: HomeFaqComponent;
  let fixture: ComponentFixture<HomeFaqComponent>;

  const languageServiceStub = {
    t: (path: string) => (path === 'home.faqTitle' ? 'FAQ' : path),
    get: (path: string) => {
      if (path !== 'home.faq') return undefined;
      return [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' }
      ];
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HomeFaqComponent],
      imports: [NoopAnimationsModule],
      providers: [{ provide: LanguageService, useValue: languageServiceStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeFaqComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read faq entries from language service', () => {
    expect(component.faqs().length).toBe(2);
    expect(component.faqs()[0].question).toBe('Q1');
  });

  it('should toggle active faq index', () => {
    component.toggle(1);
    expect(component.activeIndex).toBe(1);

    component.toggle(1);
    expect(component.activeIndex).toBeNull();
  });
});
