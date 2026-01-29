import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeekResourceComponent } from './week-resource.component';

describe('WeekResourceComponent', () => {
  let component: WeekResourceComponent;
  let fixture: ComponentFixture<WeekResourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeekResourceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeekResourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
