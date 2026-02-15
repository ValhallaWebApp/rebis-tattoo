import { Injectable } from '@angular/core';
import { Database, onValue, ref } from '@angular/fire/database';
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
  address: string;
  phoneDisplay: string;
  email: string;
  instagramUrl: string;
  instagramHandle: string;
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
  address: 'Via al Carmine 1A, 07100 Sassari (SS)',
  phoneDisplay: '+39 340 099 8312',
  email: 'sarapushi@rebistattoo.info',
  instagramUrl: 'https://www.instagram.com/rebis_tattoo/',
  instagramHandle: '@rebis_tattoo',
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
}
