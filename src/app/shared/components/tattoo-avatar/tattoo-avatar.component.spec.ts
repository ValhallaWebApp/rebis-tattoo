import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TattooAvatarComponent } from './tattoo-avatar.component';

describe('TattooAvatarComponent', () => {
  let component: TattooAvatarComponent;
  let fixture: ComponentFixture<TattooAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TattooAvatarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TattooAvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
