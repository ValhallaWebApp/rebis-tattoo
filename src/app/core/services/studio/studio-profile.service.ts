import { Injectable } from '@angular/core';
import { Database, onValue, ref, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

export interface StudioProfile {
  studioName: string;
  tagline: string;
  mission: string;
  teamIntro: string;
  ownerName: string;
  ownerRoleLabel: string;
  ownerBio: string;
  ownerPhotoUrl: string;
  homeBackgroundImageUrl: string;
  homeHeroBackgroundImageUrl: string;
  address: string;
  phoneDisplay: string;
  email: string;
  instagramUrl: string;
  instagramHandle: string;
  homeUpdatesKicker: string;
  homeUpdatesTitle: string;
  homeUpdatesSubtitle: string;
  homeCollabBadge: string;
  homeCollabTitle: string;
  homeCollabDescription: string;
  homeCollabHighlights: string;
  homeCollabCtaLabel: string;
  homeEventsBadge: string;
  homeEventsTitle: string;
  homeEventsDescription: string;
  homeEventsHighlights: string;
  homeEventsCtaLabel: string;

  homeHeroHeadlineLine1: string;
  homeHeroHeadlineLine2: string;
  homeHeroSubtext: string;
  homeHeroDescription: string;
  homeHeroCtaLine1: string;
  homeHeroCtaLine2: string;

  homeAboutTitle: string;
  homeAboutParagraph1: string;
  homeAboutCta: string;

  homeServicesTitle: string;
  homeServicesSubtitle: string;
  homeServicesEmptyTitle: string;
  homeServicesEmptySubtitle: string;

  homeProjectsTitle: string;
  homeProjectsSubtitle: string;
  homeProjectsEmpty: string;
  homeProjectsViewAll: string;

  homeShowcaseTitle: string;
  homeShowcaseSubtitle: string;
  homeShowcaseDescription: string;
  homeShowcaseCta: string;

  homeFaqTitle: string;
  homeContactTitlePrefix: string;
  homeContactTitleSuffix: string;

  publicChiSiamoHeroKicker: string;
  publicChiSiamoHeroTitle: string;
  publicChiSiamoPrimaryCta: string;
  publicChiSiamoSecondaryCta: string;
  publicChiSiamoHeroImageUrl: string;
  publicChiSiamoBackgroundImageUrl: string;
  publicChiSiamoStudioProfileTitle: string;
  publicChiSiamoTeamSnapshotTitle: string;
  publicChiSiamoArtistsTitle: string;
  publicChiSiamoArtistsSubtitle: string;
  publicChiSiamoNoTeamText: string;

  publicContattiHeroKicker: string;
  publicContattiHeroTitle: string;
  publicContattiHeroSubtitle: string;
  publicContattiTag1: string;
  publicContattiTag2: string;
  publicContattiTag3: string;
  publicContattiButtonBook: string;
  publicContattiButtonChat: string;
  publicContattiButtonWhatsapp: string;
  publicContattiHeroImageUrl: string;
  publicContattiBackgroundImageUrl: string;
  publicContattiMediaOverlayTitle: string;
  publicContattiMediaOverlaySubtitle: string;
  publicContattiPanelFormTitle: string;
  publicContattiPanelFormSubtitle: string;
  publicContattiPanelCollabTitle: string;
  publicContattiPanelCollabSubtitle: string;
  publicContattiCollabItem1: string;
  publicContattiCollabItem2: string;
  publicContattiCollabItem3: string;
  publicContattiCollabItem4: string;
  publicContattiSendCandidaturaLabel: string;
  publicContattiInstagramCtaLabel: string;

  publicEventiTimelineCtaLabel: string;
}

export const DEFAULT_STUDIO_PROFILE: StudioProfile = {
  studioName: 'Rebis Tattoo',
  tagline: 'Studio di tatuaggi a Sassari',
  mission:
    'In Rebis Tattoo ogni tatuaggio e una narrazione visiva. La nostra missione e creare arte che rifletta la tua identita, con attenzione e professionalita.',
  teamIntro:
    'Lo studio e guidato direttamente dalla titolare, che segue ogni fase del tatuaggio dalla consulenza alla guarigione.',
  ownerName: 'Sara Pushi',
  ownerRoleLabel: 'Tatuatrice - Titolare',
  ownerBio:
    'Rebis Tattoo nasce da una visione precisa: pochi progetti, curati davvero. Ogni tatuaggio viene seguito personalmente, con attenzione al posizionamento e alla durata nel tempo.',
  ownerPhotoUrl: '/personale/1.jpg',
  homeBackgroundImageUrl: '',
  homeHeroBackgroundImageUrl: '',
  address: 'Via al Carmine 1A, 07100 Sassari (SS)',
  phoneDisplay: '+39 340 099 8312',
  email: 'sarapushi@rebistattoo.info',
  instagramUrl: 'https://www.instagram.com/rebis_tattoo/',
  instagramHandle: '@rebis_tattoo',
  homeUpdatesKicker: 'In studio',
  homeUpdatesTitle: 'Collab e Eventi',
  homeUpdatesSubtitle:
    'Una sezione dedicata a partnership e appuntamenti speciali, ordinata per priorita e azione.',
  homeCollabBadge: 'Collab',
  homeCollabTitle: 'Collaborazioni Artisti',
  homeCollabDescription: 'Guest, resident e partnership per progetti condivisi in studio.',
  homeCollabHighlights:
    'Finestra candidature aperta su portfolio coerente con lo stile studio\nDisponibilita slot guest e supporto organizzativo dedicato\nAllineamento su qualita, igiene e customer care prima della conferma',
  homeCollabCtaLabel: 'Proponi una collaborazione',
  homeEventsBadge: 'Eventi',
  homeEventsTitle: 'Eventi In Studio',
  homeEventsDescription: 'Open day, flash day e sessioni tematiche con planning dedicato.',
  homeEventsHighlights:
    'Calendario eventi con disponibilita limitata per data\nPriorita prenotazione per clienti registrati\nAggiornamenti pubblicati su progetti e canali social dello studio',
  homeEventsCtaLabel: 'Scopri i progetti live',

  homeHeroHeadlineLine1: 'PENSAVO',
  homeHeroHeadlineLine2: 'PEGGIO.',
  homeHeroSubtext: '(la frase piu detta dai nostri clienti appena finito il tatuaggio)',
  homeHeroDescription: 'Paura del dolore? Ce l hanno tutti. Poi entrano da Rebis e capiscono che...',
  homeHeroCtaLine1: 'PRENOTA ORA',
  homeHeroCtaLine2: 'IL TUO TATUAGGIO',

  homeAboutTitle: 'APPROCCIO AL CLIENTE',
  homeAboutParagraph1: 'Da Rebis Tattoo ogni tatuaggio e un opera unica.',
  homeAboutCta: 'Scopri di piu',

  homeServicesTitle: 'I Nostri Servizi',
  homeServicesSubtitle: 'Scopri i diversi stili e approcci artistici',
  homeServicesEmptyTitle: 'Nessun servizio disponibile',
  homeServicesEmptySubtitle: 'Torna a trovarci presto.',

  homeProjectsTitle: 'I Progetti Recenti',
  homeProjectsSubtitle: 'Una selezione dei nostri lavori piu rappresentativi.',
  homeProjectsEmpty: 'Nessun progetto pubblico disponibile al momento.',
  homeProjectsViewAll: 'Guarda tutti i progetti',

  homeShowcaseTitle: 'La nostra vetrina artistica',
  homeShowcaseSubtitle:
    'Rebis Tattoo e il luogo dove i migliori tatuatori mostrano le loro opere.<strong>Ti invitiamo a scoprire i nostri lavori piu straordinari.</strong>',
  homeShowcaseDescription:
    'Il nostro studio offre uno spazio creativo a ogni artista per esprimere talento e idee uniche. Clienti e visitatori sono sempre benvenuti a esplorare i nostri migliori tatuaggi e opere, realizzati dagli artisti Rebis. Dai un occhiata alla nostra galleria e lasciati ispirare per il tuo prossimo tattoo.',
  homeShowcaseCta: 'VEDI TUTTI I LAVORI ->',

  homeFaqTitle: 'DOMANDE FREQUENTI',
  homeContactTitlePrefix: 'Prenota',
  homeContactTitleSuffix: 'un Appuntamento',

  publicChiSiamoHeroKicker: 'Rebis Tattoo',
  publicChiSiamoHeroTitle: 'Chi siamo',
  publicChiSiamoPrimaryCta: 'Prenota consulenza',
  publicChiSiamoSecondaryCta: 'Guarda i lavori',
  publicChiSiamoHeroImageUrl: '/personale/1.jpg',
  publicChiSiamoBackgroundImageUrl: '',
  publicChiSiamoStudioProfileTitle: 'Studio profile',
  publicChiSiamoTeamSnapshotTitle: 'Team snapshot',
  publicChiSiamoArtistsTitle: 'Artisti',
  publicChiSiamoArtistsSubtitle: 'Team operativo e collaborazioni in studio.',
  publicChiSiamoNoTeamText: 'Nessun artista disponibile al momento.',

  publicContattiHeroKicker: 'Rebis Tattoo',
  publicContattiHeroTitle: 'Contatti + Collab',
  publicContattiHeroSubtitle:
    'Scrivici per consulenze, informazioni o proposte di collaborazione. Rispondiamo in tempi rapidi via chat, mail o WhatsApp.',
  publicContattiTag1: 'Consulenze',
  publicContattiTag2: 'Supporto rapido',
  publicContattiTag3: 'Collab artisti',
  publicContattiButtonBook: 'Prenota consulenza',
  publicContattiButtonChat: 'Apri chat studio',
  publicContattiButtonWhatsapp: 'WhatsApp',
  publicContattiHeroImageUrl: '/personale/sara.webp',
  publicContattiBackgroundImageUrl: '',
  publicContattiMediaOverlayTitle: 'Consult first. Ink after.',
  publicContattiMediaOverlaySubtitle: 'Ogni progetto parte dalla consulenza, non dal caso.',
  publicContattiPanelFormTitle: 'Scrivici un messaggio',
  publicContattiPanelFormSubtitle: 'Compila il form e ti ricontattiamo rapidamente.',
  publicContattiPanelCollabTitle: 'Collab',
  publicContattiPanelCollabSubtitle:
    'Sei un artista o un creator e vuoi collaborare con lo studio? Inviaci una proposta completa.',
  publicContattiCollabItem1: 'Portfolio aggiornato con lavori recenti',
  publicContattiCollabItem2: 'Stile artistico e disponibilita settimanale',
  publicContattiCollabItem3: 'Canali social o contatti professionali',
  publicContattiCollabItem4: 'Obiettivo della collaborazione',
  publicContattiSendCandidaturaLabel: 'Invia candidatura',
  publicContattiInstagramCtaLabel: 'Scrivici su Instagram',

  publicEventiTimelineCtaLabel: 'Vedi evento',
};

@Injectable({ providedIn: 'root' })
export class StudioProfileService {
  private readonly path = 'studioProfile/public';

  constructor(private db: Database) {}

  getProfile(): Observable<StudioProfile> {
    return new Observable<StudioProfile>((observer) => {
      const r = ref(this.db, this.path);
      const unsub = onValue(
        r,
        (snap) => {
          const raw = snap.exists() ? (snap.val() as Partial<StudioProfile>) : {};
          observer.next(this.mergeWithDefault(raw));
        },
        (_err) => observer.next(DEFAULT_STUDIO_PROFILE)
      );
      return () => unsub();
    });
  }

  async saveProfile(patch: Partial<StudioProfile>): Promise<void> {
    const payload = this.sanitizePatch(patch);
    if (Object.keys(payload).length === 0) return;
    await update(ref(this.db, this.path), payload);
  }

  private mergeWithDefault(raw: Partial<StudioProfile>): StudioProfile {
    const out: StudioProfile = { ...DEFAULT_STUDIO_PROFILE, ...(raw || {}) };
    for (const key of Object.keys(DEFAULT_STUDIO_PROFILE) as Array<keyof StudioProfile>) {
      const v = out[key];
      if (typeof v !== 'string' || !v.trim()) {
        out[key] = DEFAULT_STUDIO_PROFILE[key];
      } else {
        out[key] = v.trim();
      }
    }
    return out;
  }

  private sanitizePatch(raw: Partial<StudioProfile>): Partial<StudioProfile> {
    const out: Partial<StudioProfile> = {};
    const keys = Object.keys(DEFAULT_STUDIO_PROFILE) as Array<keyof StudioProfile>;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(raw ?? {}, key)) continue;
      const value = raw[key];
      if (value === undefined || value === null) continue;
      const clean = String(value).trim();
      out[key] = clean || DEFAULT_STUDIO_PROFILE[key];
    }
    return out;
  }
}
