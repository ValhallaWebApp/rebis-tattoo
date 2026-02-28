import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EventDrawerComponent } from './event-drawer.component';

describe('EventDrawerComponent', () => {
  let component: EventDrawerComponent;
  let fixture: ComponentFixture<EventDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventDrawerComponent, NoopAnimationsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show raw client id in booking label when client is missing from cache', () => {
    const label = component.displayBooking({
      id: 'bk-1',
      clientId: 'abc123uid',
      title: 'Mario Rossi - Prenotazione',
      start: '2026-02-26T10:00:00'
    } as any);

    expect(label).toContain('Mario Rossi');
    expect(label).not.toContain('abc123uid');
  });

  it('should use generic client text instead of id in clientQuery fallback', () => {
    component.form.controls.clientId.setValue('abc123uid');
    (component as any).hydrateClientQueryFromId();

    expect(component.form.controls.clientQuery.value).toBe('Cliente');
  });

  it('should submit session without clientId when project is selected', () => {
    const emitSpy = spyOn(component.submit, 'emit');

    component.form.controls.type.setValue('session');
    component.form.controls.artistId.setValue('artist-1');
    component.form.controls.projectId.setValue('project-1');
    component.form.controls.clientId.setValue('legacy-client-id');

    component.onSubmit();

    expect(emitSpy).toHaveBeenCalled();
    const payload = emitSpy.calls.mostRecent().args[0] as any;
    expect(payload?.mode).toBe('create');
    expect(payload?.draft?.type).toBe('session');
    expect(payload?.draft?.projectId).toBe('project-1');
    expect(payload?.draft?.clientId).toBeUndefined();
  });
});
