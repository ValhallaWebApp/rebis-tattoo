import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudioSettingsComponent } from './studio-settings.component';

describe('StudioSettingsComponent', () => {
  let component: StudioSettingsComponent;
  let fixture: ComponentFixture<StudioSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudioSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudioSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
