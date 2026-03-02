import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { StudioDocument } from '../../../../core/models/document.model';
import { DocumentsService } from '../../../../core/services/documents/documents.service';
import { ConfirmActionService } from '../../../../core/services/ui/confirm-action.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

import { DocumentsComponent } from './documents.component';

class DocumentsServiceStub {
  private readonly docsSubject = new BehaviorSubject<StudioDocument[]>([
    {
      id: 'doc-1',
      title: 'Privacy',
      description: 'Documento privacy',
      fileUrl: '/assets/documents/privacy.pdf',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z'
    }
  ]);

  readonly getDocuments = jasmine.createSpy('getDocuments').and.returnValue(this.docsSubject.asObservable());
  readonly createDocument = jasmine.createSpy('createDocument').and.resolveTo('doc-2');
  readonly updateDocument = jasmine.createSpy('updateDocument').and.resolveTo();
  readonly deleteDocument = jasmine.createSpy('deleteDocument').and.resolveTo();
  readonly uploadDocumentFile = jasmine.createSpy('uploadDocumentFile').and.resolveTo('https://files.test/doc.pdf');
}

class ConfirmActionServiceStub {
  readonly confirm = jasmine.createSpy('confirm').and.resolveTo(true);
}

class UiFeedbackServiceStub {
  readonly error = jasmine.createSpy('error');
}

describe('DocumentsComponent', () => {
  let component: DocumentsComponent;
  let fixture: ComponentFixture<DocumentsComponent>;
  let documentsService: DocumentsServiceStub;
  let confirmAction: ConfirmActionServiceStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsComponent, NoopAnimationsModule],
      providers: [
        { provide: DocumentsService, useClass: DocumentsServiceStub },
        { provide: ConfirmActionService, useClass: ConfirmActionServiceStub },
        { provide: UiFeedbackService, useClass: UiFeedbackServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentsComponent);
    component = fixture.componentInstance;
    documentsService = TestBed.inject(DocumentsService) as unknown as DocumentsServiceStub;
    confirmAction = TestBed.inject(ConfirmActionService) as unknown as ConfirmActionServiceStub;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create a new document from form', async () => {
    component.openCreateDrawer();
    component.form.setValue({
      title: ' Consenso ',
      description: ' Modulo consenso ',
      fileUrl: '/assets/documents/consenso.pdf'
    });

    await component.saveDocument();

    expect(documentsService.createDocument).toHaveBeenCalledWith({
      title: 'Consenso',
      description: 'Modulo consenso',
      fileUrl: '/assets/documents/consenso.pdf'
    });
    expect(component.drawerOpen()).toBeFalse();
  });

  it('should update selected document when editing', async () => {
    const doc = component.documents()[0];
    component.openEditDrawer(doc);
    component.form.patchValue({ title: 'Privacy aggiornata' });

    await component.saveDocument();

    expect(documentsService.updateDocument).toHaveBeenCalledWith('doc-1', {
      title: 'Privacy aggiornata',
      description: 'Documento privacy',
      fileUrl: '/assets/documents/privacy.pdf'
    });
  });

  it('should open drawer in create mode', () => {
    component.openCreateDrawer();

    expect(component.drawerOpen()).toBeTrue();
    expect(component.isEditing()).toBeFalse();
  });

  it('should confirm and delete document', async () => {
    const doc = component.documents()[0];

    await component.deleteDocument(doc);

    expect(confirmAction.confirm).toHaveBeenCalled();
    expect(documentsService.deleteDocument).toHaveBeenCalledWith('doc-1');
  });
});
