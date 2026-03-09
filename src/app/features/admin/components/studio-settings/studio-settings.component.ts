import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MaterialModule } from '../../../../core/modules/material.module';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../../core/services/studio/studio-profile.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { MediaStorageService } from '../../../../core/services/media/media-storage.service';

@Component({
  selector: 'app-studio-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './studio-settings.component.html',
  styleUrls: ['./studio-settings.component.scss']
})
export class StudioSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studioProfile = inject(StudioProfileService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaStorage = inject(MediaStorageService);

  saving = false;
  mediaUploading: Record<string, boolean> = {};
  mediaUploadProgress: Record<string, number> = {};

  readonly settingsForm: FormGroup = this.fb.group({
    studioName: [DEFAULT_STUDIO_PROFILE.studioName, [Validators.required, Validators.minLength(2)]],
    tagline: [DEFAULT_STUDIO_PROFILE.tagline, [Validators.required]],
    mission: [DEFAULT_STUDIO_PROFILE.mission, [Validators.required, Validators.minLength(10)]],
    teamIntro: [DEFAULT_STUDIO_PROFILE.teamIntro, [Validators.required, Validators.minLength(10)]],

    ownerName: [DEFAULT_STUDIO_PROFILE.ownerName, [Validators.required]],
    ownerRoleLabel: [DEFAULT_STUDIO_PROFILE.ownerRoleLabel, [Validators.required]],
    ownerBio: [DEFAULT_STUDIO_PROFILE.ownerBio, [Validators.required, Validators.minLength(10)]],
    ownerPhotoUrl: [DEFAULT_STUDIO_PROFILE.ownerPhotoUrl, [Validators.required]],
    homeBackgroundImageUrl: [DEFAULT_STUDIO_PROFILE.homeBackgroundImageUrl],
    homeHeroBackgroundImageUrl: [DEFAULT_STUDIO_PROFILE.homeHeroBackgroundImageUrl],

    address: [DEFAULT_STUDIO_PROFILE.address, [Validators.required]],
    phoneDisplay: [DEFAULT_STUDIO_PROFILE.phoneDisplay, [Validators.required]],
    email: [DEFAULT_STUDIO_PROFILE.email, [Validators.required, Validators.email]],
    instagramUrl: [DEFAULT_STUDIO_PROFILE.instagramUrl, [Validators.required]],
    instagramHandle: [DEFAULT_STUDIO_PROFILE.instagramHandle, [Validators.required]],

    homeUpdatesKicker: [DEFAULT_STUDIO_PROFILE.homeUpdatesKicker, [Validators.required]],
    homeUpdatesTitle: [DEFAULT_STUDIO_PROFILE.homeUpdatesTitle, [Validators.required]],
    homeUpdatesSubtitle: [DEFAULT_STUDIO_PROFILE.homeUpdatesSubtitle, [Validators.required, Validators.minLength(10)]],
    homeCollabBadge: [DEFAULT_STUDIO_PROFILE.homeCollabBadge, [Validators.required]],
    homeCollabTitle: [DEFAULT_STUDIO_PROFILE.homeCollabTitle, [Validators.required]],
    homeCollabDescription: [DEFAULT_STUDIO_PROFILE.homeCollabDescription, [Validators.required, Validators.minLength(10)]],
    homeCollabHighlights: [DEFAULT_STUDIO_PROFILE.homeCollabHighlights, [Validators.required, Validators.minLength(10)]],
    homeCollabCtaLabel: [DEFAULT_STUDIO_PROFILE.homeCollabCtaLabel, [Validators.required]],
    homeEventsBadge: [DEFAULT_STUDIO_PROFILE.homeEventsBadge, [Validators.required]],
    homeEventsTitle: [DEFAULT_STUDIO_PROFILE.homeEventsTitle, [Validators.required]],
    homeEventsDescription: [DEFAULT_STUDIO_PROFILE.homeEventsDescription, [Validators.required, Validators.minLength(10)]],
    homeEventsHighlights: [DEFAULT_STUDIO_PROFILE.homeEventsHighlights, [Validators.required, Validators.minLength(10)]],
    homeEventsCtaLabel: [DEFAULT_STUDIO_PROFILE.homeEventsCtaLabel, [Validators.required]],

    homeHeroHeadlineLine1: [DEFAULT_STUDIO_PROFILE.homeHeroHeadlineLine1, [Validators.required]],
    homeHeroHeadlineLine2: [DEFAULT_STUDIO_PROFILE.homeHeroHeadlineLine2, [Validators.required]],
    homeHeroSubtext: [DEFAULT_STUDIO_PROFILE.homeHeroSubtext, [Validators.required]],
    homeHeroDescription: [DEFAULT_STUDIO_PROFILE.homeHeroDescription, [Validators.required, Validators.minLength(10)]],
    homeHeroCtaLine1: [DEFAULT_STUDIO_PROFILE.homeHeroCtaLine1, [Validators.required]],
    homeHeroCtaLine2: [DEFAULT_STUDIO_PROFILE.homeHeroCtaLine2, [Validators.required]],

    homeAboutTitle: [DEFAULT_STUDIO_PROFILE.homeAboutTitle, [Validators.required]],
    homeAboutParagraph1: [DEFAULT_STUDIO_PROFILE.homeAboutParagraph1, [Validators.required, Validators.minLength(10)]],
    homeAboutCta: [DEFAULT_STUDIO_PROFILE.homeAboutCta, [Validators.required]],

    homeServicesTitle: [DEFAULT_STUDIO_PROFILE.homeServicesTitle, [Validators.required]],
    homeServicesSubtitle: [DEFAULT_STUDIO_PROFILE.homeServicesSubtitle, [Validators.required, Validators.minLength(10)]],
    homeServicesEmptyTitle: [DEFAULT_STUDIO_PROFILE.homeServicesEmptyTitle, [Validators.required]],
    homeServicesEmptySubtitle: [DEFAULT_STUDIO_PROFILE.homeServicesEmptySubtitle, [Validators.required]],

    homeProjectsTitle: [DEFAULT_STUDIO_PROFILE.homeProjectsTitle, [Validators.required]],
    homeProjectsSubtitle: [DEFAULT_STUDIO_PROFILE.homeProjectsSubtitle, [Validators.required, Validators.minLength(10)]],
    homeProjectsEmpty: [DEFAULT_STUDIO_PROFILE.homeProjectsEmpty, [Validators.required]],
    homeProjectsViewAll: [DEFAULT_STUDIO_PROFILE.homeProjectsViewAll, [Validators.required]],

    homeShowcaseTitle: [DEFAULT_STUDIO_PROFILE.homeShowcaseTitle, [Validators.required]],
    homeShowcaseSubtitle: [DEFAULT_STUDIO_PROFILE.homeShowcaseSubtitle, [Validators.required, Validators.minLength(10)]],
    homeShowcaseDescription: [DEFAULT_STUDIO_PROFILE.homeShowcaseDescription, [Validators.required, Validators.minLength(10)]],
    homeShowcaseCta: [DEFAULT_STUDIO_PROFILE.homeShowcaseCta, [Validators.required]],

    homeFaqTitle: [DEFAULT_STUDIO_PROFILE.homeFaqTitle, [Validators.required]],
    homeContactTitlePrefix: [DEFAULT_STUDIO_PROFILE.homeContactTitlePrefix, [Validators.required]],
    homeContactTitleSuffix: [DEFAULT_STUDIO_PROFILE.homeContactTitleSuffix, [Validators.required]],

    publicChiSiamoHeroKicker: [DEFAULT_STUDIO_PROFILE.publicChiSiamoHeroKicker, [Validators.required]],
    publicChiSiamoHeroTitle: [DEFAULT_STUDIO_PROFILE.publicChiSiamoHeroTitle, [Validators.required]],
    publicChiSiamoPrimaryCta: [DEFAULT_STUDIO_PROFILE.publicChiSiamoPrimaryCta, [Validators.required]],
    publicChiSiamoSecondaryCta: [DEFAULT_STUDIO_PROFILE.publicChiSiamoSecondaryCta, [Validators.required]],
    publicChiSiamoHeroImageUrl: [DEFAULT_STUDIO_PROFILE.publicChiSiamoHeroImageUrl, [Validators.required]],
    publicChiSiamoBackgroundImageUrl: [DEFAULT_STUDIO_PROFILE.publicChiSiamoBackgroundImageUrl],
    publicChiSiamoStudioProfileTitle: [DEFAULT_STUDIO_PROFILE.publicChiSiamoStudioProfileTitle, [Validators.required]],
    publicChiSiamoTeamSnapshotTitle: [DEFAULT_STUDIO_PROFILE.publicChiSiamoTeamSnapshotTitle, [Validators.required]],
    publicChiSiamoArtistsTitle: [DEFAULT_STUDIO_PROFILE.publicChiSiamoArtistsTitle, [Validators.required]],
    publicChiSiamoArtistsSubtitle: [DEFAULT_STUDIO_PROFILE.publicChiSiamoArtistsSubtitle, [Validators.required]],
    publicChiSiamoNoTeamText: [DEFAULT_STUDIO_PROFILE.publicChiSiamoNoTeamText, [Validators.required]],

    publicContattiHeroKicker: [DEFAULT_STUDIO_PROFILE.publicContattiHeroKicker, [Validators.required]],
    publicContattiHeroTitle: [DEFAULT_STUDIO_PROFILE.publicContattiHeroTitle, [Validators.required]],
    publicContattiHeroSubtitle: [DEFAULT_STUDIO_PROFILE.publicContattiHeroSubtitle, [Validators.required, Validators.minLength(10)]],
    publicContattiTag1: [DEFAULT_STUDIO_PROFILE.publicContattiTag1, [Validators.required]],
    publicContattiTag2: [DEFAULT_STUDIO_PROFILE.publicContattiTag2, [Validators.required]],
    publicContattiTag3: [DEFAULT_STUDIO_PROFILE.publicContattiTag3, [Validators.required]],
    publicContattiButtonBook: [DEFAULT_STUDIO_PROFILE.publicContattiButtonBook, [Validators.required]],
    publicContattiButtonChat: [DEFAULT_STUDIO_PROFILE.publicContattiButtonChat, [Validators.required]],
    publicContattiButtonWhatsapp: [DEFAULT_STUDIO_PROFILE.publicContattiButtonWhatsapp, [Validators.required]],
    publicContattiHeroImageUrl: [DEFAULT_STUDIO_PROFILE.publicContattiHeroImageUrl, [Validators.required]],
    publicContattiBackgroundImageUrl: [DEFAULT_STUDIO_PROFILE.publicContattiBackgroundImageUrl],
    publicContattiMediaOverlayTitle: [DEFAULT_STUDIO_PROFILE.publicContattiMediaOverlayTitle, [Validators.required]],
    publicContattiMediaOverlaySubtitle: [DEFAULT_STUDIO_PROFILE.publicContattiMediaOverlaySubtitle, [Validators.required]],
    publicContattiPanelFormTitle: [DEFAULT_STUDIO_PROFILE.publicContattiPanelFormTitle, [Validators.required]],
    publicContattiPanelFormSubtitle: [DEFAULT_STUDIO_PROFILE.publicContattiPanelFormSubtitle, [Validators.required, Validators.minLength(10)]],
    publicContattiPanelCollabTitle: [DEFAULT_STUDIO_PROFILE.publicContattiPanelCollabTitle, [Validators.required]],
    publicContattiPanelCollabSubtitle: [DEFAULT_STUDIO_PROFILE.publicContattiPanelCollabSubtitle, [Validators.required, Validators.minLength(10)]],
    publicContattiCollabItem1: [DEFAULT_STUDIO_PROFILE.publicContattiCollabItem1, [Validators.required]],
    publicContattiCollabItem2: [DEFAULT_STUDIO_PROFILE.publicContattiCollabItem2, [Validators.required]],
    publicContattiCollabItem3: [DEFAULT_STUDIO_PROFILE.publicContattiCollabItem3, [Validators.required]],
    publicContattiCollabItem4: [DEFAULT_STUDIO_PROFILE.publicContattiCollabItem4, [Validators.required]],
    publicContattiSendCandidaturaLabel: [DEFAULT_STUDIO_PROFILE.publicContattiSendCandidaturaLabel, [Validators.required]],
    publicContattiInstagramCtaLabel: [DEFAULT_STUDIO_PROFILE.publicContattiInstagramCtaLabel, [Validators.required]],

    publicEventiTimelineCtaLabel: [DEFAULT_STUDIO_PROFILE.publicEventiTimelineCtaLabel, [Validators.required]]
  });

  readonly identityFields: DynamicField[] = [
    { type: 'text', name: 'studioName', label: 'Nome studio' },
    { type: 'text', name: 'tagline', label: 'Tagline' },
    { type: 'textarea', name: 'mission', label: 'Mission', rows: 3, className: 'full' },
    { type: 'textarea', name: 'teamIntro', label: 'Intro team', rows: 3, className: 'full' }
  ];

  readonly ownerFields: DynamicField[] = [
    { type: 'text', name: 'ownerName', label: 'Nome titolare' },
    { type: 'text', name: 'ownerRoleLabel', label: 'Ruolo titolare' },
    { type: 'textarea', name: 'ownerBio', label: 'Bio titolare', rows: 4, className: 'full' },
    {
      type: 'text',
      name: 'ownerPhotoUrl',
      label: 'Foto titolare (url o path assets)',
      className: 'full'
    },
    { type: 'text', name: 'homeBackgroundImageUrl', label: 'Home background image URL', className: 'full' },
    { type: 'text', name: 'homeHeroBackgroundImageUrl', label: 'Home hero background image URL', className: 'full' }
  ];

  readonly contactsFields: DynamicField[] = [
    { type: 'text', name: 'address', label: 'Indirizzo', className: 'full' },
    { type: 'text', name: 'phoneDisplay', label: 'Telefono' },
    { type: 'email', name: 'email', label: 'Email' },
    { type: 'text', name: 'instagramUrl', label: 'Instagram URL' },
    { type: 'text', name: 'instagramHandle', label: 'Instagram handle' }
  ];

  readonly homeUpdatesFields: DynamicField[] = [
    { type: 'text', name: 'homeUpdatesKicker', label: 'Kicker sezione home' },
    { type: 'text', name: 'homeUpdatesTitle', label: 'Titolo sezione home' },
    {
      type: 'textarea',
      name: 'homeUpdatesSubtitle',
      label: 'Sottotitolo sezione home',
      rows: 2,
      className: 'full'
    },
    { type: 'text', name: 'homeCollabBadge', label: 'Badge collab' },
    { type: 'text', name: 'homeCollabTitle', label: 'Titolo collab' },
    {
      type: 'textarea',
      name: 'homeCollabDescription',
      label: 'Descrizione collab',
      rows: 2,
      className: 'full'
    },
    {
      type: 'textarea',
      name: 'homeCollabHighlights',
      label: 'Punti collab (una riga per punto)',
      rows: 4,
      className: 'full'
    },
    { type: 'text', name: 'homeCollabCtaLabel', label: 'Label CTA collab' },
    { type: 'text', name: 'homeEventsBadge', label: 'Badge eventi' },
    { type: 'text', name: 'homeEventsTitle', label: 'Titolo eventi' },
    {
      type: 'textarea',
      name: 'homeEventsDescription',
      label: 'Descrizione eventi',
      rows: 2,
      className: 'full'
    },
    {
      type: 'textarea',
      name: 'homeEventsHighlights',
      label: 'Punti eventi (una riga per punto)',
      rows: 4,
      className: 'full'
    },
    { type: 'text', name: 'homeEventsCtaLabel', label: 'Label CTA eventi' }
  ];

  readonly homeHeroFields: DynamicField[] = [
    { type: 'text', name: 'homeHeroHeadlineLine1', label: 'Headline riga 1' },
    { type: 'text', name: 'homeHeroHeadlineLine2', label: 'Headline riga 2' },
    { type: 'text', name: 'homeHeroSubtext', label: 'Sottotesto hero', className: 'full' },
    { type: 'textarea', name: 'homeHeroDescription', label: 'Descrizione hero', rows: 3, className: 'full' },
    { type: 'text', name: 'homeHeroCtaLine1', label: 'CTA riga 1' },
    { type: 'text', name: 'homeHeroCtaLine2', label: 'CTA riga 2' }
  ];

  readonly homeAboutFields: DynamicField[] = [
    { type: 'text', name: 'homeAboutTitle', label: 'Titolo sezione about' },
    { type: 'textarea', name: 'homeAboutParagraph1', label: 'Paragrafo sezione about', rows: 3, className: 'full' },
    { type: 'text', name: 'homeAboutCta', label: 'CTA sezione about' }
  ];

  readonly homeServicesFields: DynamicField[] = [
    { type: 'text', name: 'homeServicesTitle', label: 'Titolo servizi' },
    { type: 'text', name: 'homeServicesSubtitle', label: 'Sottotitolo servizi', className: 'full' },
    { type: 'text', name: 'homeServicesEmptyTitle', label: 'Titolo empty servizi' },
    { type: 'text', name: 'homeServicesEmptySubtitle', label: 'Sottotitolo empty servizi' }
  ];

  readonly homeProjectsFields: DynamicField[] = [
    { type: 'text', name: 'homeProjectsTitle', label: 'Titolo progetti' },
    { type: 'text', name: 'homeProjectsSubtitle', label: 'Sottotitolo progetti', className: 'full' },
    { type: 'text', name: 'homeProjectsEmpty', label: 'Testo empty progetti', className: 'full' },
    { type: 'text', name: 'homeProjectsViewAll', label: 'Label CTA progetti' }
  ];

  readonly homeShowcaseFields: DynamicField[] = [
    { type: 'text', name: 'homeShowcaseTitle', label: 'Titolo showcase' },
    { type: 'textarea', name: 'homeShowcaseSubtitle', label: 'Sottotitolo showcase', rows: 2, className: 'full' },
    { type: 'textarea', name: 'homeShowcaseDescription', label: 'Descrizione showcase', rows: 4, className: 'full' },
    { type: 'text', name: 'homeShowcaseCta', label: 'Label CTA showcase' }
  ];

  readonly homeFaqFields: DynamicField[] = [
    { type: 'text', name: 'homeFaqTitle', label: 'Titolo FAQ home' }
  ];

  readonly homeContactFields: DynamicField[] = [
    { type: 'text', name: 'homeContactTitlePrefix', label: 'Titolo contact prefix' },
    { type: 'text', name: 'homeContactTitleSuffix', label: 'Titolo contact suffix' }
  ];

  readonly chiSiamoFields: DynamicField[] = [
    { type: 'text', name: 'publicChiSiamoHeroKicker', label: 'Kicker hero' },
    { type: 'text', name: 'publicChiSiamoHeroTitle', label: 'Titolo hero' },
    { type: 'text', name: 'publicChiSiamoPrimaryCta', label: 'CTA primaria' },
    { type: 'text', name: 'publicChiSiamoSecondaryCta', label: 'CTA secondaria' },
    { type: 'text', name: 'publicChiSiamoHeroImageUrl', label: 'Hero image URL', className: 'full' },
    { type: 'text', name: 'publicChiSiamoBackgroundImageUrl', label: 'Section background URL', className: 'full' },
    { type: 'text', name: 'publicChiSiamoStudioProfileTitle', label: 'Titolo panel profilo studio' },
    { type: 'text', name: 'publicChiSiamoTeamSnapshotTitle', label: 'Titolo panel team snapshot' },
    { type: 'text', name: 'publicChiSiamoArtistsTitle', label: 'Titolo sezione artisti' },
    { type: 'text', name: 'publicChiSiamoArtistsSubtitle', label: 'Sottotitolo sezione artisti', className: 'full' },
    { type: 'text', name: 'publicChiSiamoNoTeamText', label: 'Testo empty artisti', className: 'full' }
  ];

  readonly contattiPageFields: DynamicField[] = [
    { type: 'text', name: 'publicContattiHeroKicker', label: 'Kicker hero contatti' },
    { type: 'text', name: 'publicContattiHeroTitle', label: 'Titolo hero contatti' },
    { type: 'textarea', name: 'publicContattiHeroSubtitle', label: 'Sottotitolo hero contatti', rows: 3, className: 'full' },
    { type: 'text', name: 'publicContattiTag1', label: 'Tag 1 hero' },
    { type: 'text', name: 'publicContattiTag2', label: 'Tag 2 hero' },
    { type: 'text', name: 'publicContattiTag3', label: 'Tag 3 hero' },
    { type: 'text', name: 'publicContattiButtonBook', label: 'Label bottone prenota' },
    { type: 'text', name: 'publicContattiButtonChat', label: 'Label bottone chat' },
    { type: 'text', name: 'publicContattiButtonWhatsapp', label: 'Label bottone WhatsApp' },
    { type: 'text', name: 'publicContattiHeroImageUrl', label: 'Hero image URL', className: 'full' },
    { type: 'text', name: 'publicContattiBackgroundImageUrl', label: 'Section background URL', className: 'full' },
    { type: 'text', name: 'publicContattiMediaOverlayTitle', label: 'Titolo overlay media', className: 'full' },
    { type: 'text', name: 'publicContattiMediaOverlaySubtitle', label: 'Sottotitolo overlay media', className: 'full' },
    { type: 'text', name: 'publicContattiPanelFormTitle', label: 'Titolo panel form' },
    { type: 'text', name: 'publicContattiPanelFormSubtitle', label: 'Sottotitolo panel form', className: 'full' },
    { type: 'text', name: 'publicContattiPanelCollabTitle', label: 'Titolo panel collab' },
    { type: 'textarea', name: 'publicContattiPanelCollabSubtitle', label: 'Sottotitolo panel collab', rows: 3, className: 'full' },
    { type: 'text', name: 'publicContattiCollabItem1', label: 'Voce lista collab 1', className: 'full' },
    { type: 'text', name: 'publicContattiCollabItem2', label: 'Voce lista collab 2', className: 'full' },
    { type: 'text', name: 'publicContattiCollabItem3', label: 'Voce lista collab 3', className: 'full' },
    { type: 'text', name: 'publicContattiCollabItem4', label: 'Voce lista collab 4', className: 'full' },
    { type: 'text', name: 'publicContattiSendCandidaturaLabel', label: 'Label CTA candidatura' },
    { type: 'text', name: 'publicContattiInstagramCtaLabel', label: 'Label CTA Instagram' }
  ];

  readonly eventiPageFields: DynamicField[] = [
    { type: 'text', name: 'publicEventiTimelineCtaLabel', label: 'Label CTA timeline eventi' }
  ];

  ngOnInit(): void {
    this.studioProfile.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((profile) => {
        this.settingsForm.patchValue(profile, { emitEvent: false });
      });
  }

  async saveSettings(): Promise<void> {
    if (this.settingsForm.invalid || this.saving) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      await this.studioProfile.saveProfile(this.settingsForm.getRawValue() as Partial<StudioProfile>);
      this.ui.success('Impostazioni studio salvate.');
    } catch (err) {
      console.error('[StudioSettings] save failed', err);
      this.ui.error('Errore salvataggio impostazioni studio.');
    } finally {
      this.saving = false;
    }
  }

  isUploading(slot: string): boolean {
    return this.mediaUploading[slot] === true;
  }

  uploadProgress(slot: string): number {
    return Number(this.mediaUploadProgress[slot] ?? 0);
  }

  async onOwnerPhotoUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'ownerPhoto',
      controlName: 'ownerPhotoUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadHomeImage('owner-photo', 'thumbnail', file, onProgress)
    });
  }

  async onHomeHeroBackgroundUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'homeHeroBg',
      controlName: 'homeHeroBackgroundImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadHomeImage('hero-background', 'background', file, onProgress)
    });
  }

  async onHomeBackgroundUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'homeBg',
      controlName: 'homeBackgroundImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadHomeImage('home-background', 'background', file, onProgress)
    });
  }

  async onChiSiamoHeroUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'chiHero',
      controlName: 'publicChiSiamoHeroImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadPageSectionImage('chi-siamo', 'hero', 'hero', file, onProgress)
    });
  }

  async onChiSiamoBackgroundUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'chiBg',
      controlName: 'publicChiSiamoBackgroundImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadPageSectionImage('chi-siamo', 'background', 'background', file, onProgress)
    });
  }

  async onContattiHeroUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'contattiHero',
      controlName: 'publicContattiHeroImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadPageSectionImage('contatti', 'hero', 'hero', file, onProgress)
    });
  }

  async onContattiBackgroundUpload(event: Event): Promise<void> {
    await this.uploadStudioImage(event, {
      slot: 'contattiBg',
      controlName: 'publicContattiBackgroundImageUrl',
      upload: (file, onProgress) => this.mediaStorage.uploadPageSectionImage('contatti', 'background', 'background', file, onProgress)
    });
  }

  private async uploadStudioImage(
    event: Event,
    cfg: {
      slot: string;
      controlName: keyof StudioProfile;
      upload: (file: File, onProgress?: (value: number) => void) => Promise<{ downloadUrl: string }>;
    }
  ): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0);
    if (!file || this.isUploading(cfg.slot)) return;

    this.mediaUploading[cfg.slot] = true;
    this.mediaUploadProgress[cfg.slot] = 0;
    try {
      const asset = await cfg.upload(file, value => {
        this.mediaUploadProgress[cfg.slot] = value;
      });
      const url = String(asset.downloadUrl ?? '').trim();
      if (url) {
        this.settingsForm.get(String(cfg.controlName))?.setValue(url);
        this.settingsForm.get(String(cfg.controlName))?.markAsDirty();
        this.ui.success('Immagine caricata con successo');
      }
    } catch (err) {
      console.error('[StudioSettings] upload image failed', err);
      this.ui.error('Errore upload immagine');
    } finally {
      this.mediaUploading[cfg.slot] = false;
      this.mediaUploadProgress[cfg.slot] = 0;
      if (input) input.value = '';
    }
  }
}
