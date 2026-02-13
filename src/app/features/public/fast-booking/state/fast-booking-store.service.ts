import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { BookingChatDraft, BookingService } from '../../../../core/services/bookings/booking.service';
import { UserService } from '../../../../core/services/users/user.service';
import { PaymentApiService } from '../../../../core/services/payments/payment-api.service';
import { AuthService } from '../../../../core/services/auth/authservice';

type Step =
  | 'intro'
  | 'artist'
  | 'when'
  | 'details'
  | 'summary'
  | 'payment'
  | 'success';

type Slot = { time: string };
type HomeSeed = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  procedure?: string | null;
  artist?: string | null; // qui arriva ARTIST ID
  comments?: string | null;
};

@Injectable({ providedIn: 'root' })
export class FastBookingStore {
  private readonly staffService = inject(StaffService);
  private readonly bookingService = inject(BookingService);
  private readonly userService = inject(UserService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly auth = inject(AuthService);

 HOME_SEED_KEY = 'FAST_BOOKING_HOME_SEED';

  // FLOW
  private readonly steps: Step[] = [
    'intro',
    'artist',
    'when',
    'details',
    'summary',
    'payment',
    'success',
  ];

  readonly step = signal<Step>('intro');

  // CONFIG (caparra)
  readonly depositEuro = signal<number>(50); // <-- metti la tua cifra
  readonly durationMin = signal<number>(60); // consulenza (minuti)

  // DATA: artists
  readonly artists = signal<StaffMember[]>([]);
  readonly loadingArtists = signal(false);

  // DATA: slots
  readonly selectedDate = signal<string | null>(null); // "YYYY-MM-DD"
  readonly slots = signal<Slot[]>([]);
  readonly loadingSlots = signal(false);

  // PAYMENT
  readonly bookingId = signal<string | null>(null);
  readonly paymentClientSecret = signal<string | null>(null);
  readonly paymentIntentId = signal<string | null>(null);
  readonly paying = signal(false);

  // UI ERROR
  readonly error = signal<string | null>(null);

  // DRAFT (client)
  readonly draft = signal<any>({
    artistId: null as string | null,
    artistName: null as string | null,

    date: null as string | null, // YYYY-MM-DD
    time: null as string | null, // HH:mm

    name: null as string | null,
    contact: null as string | null, // email o telefono
    description: null as string | null,
  });

  constructor() {
    // ✅ PREFILL: quando l'utente è disponibile, precompila SOLO i campi vuoti
    effect(
      () => {
        const u = this.auth.userSig();
        if (!u) return;

        const nameFromUser = (u as any).name ?? (u as any).displayName ?? null;

        const emailFromUser = (u as any).email ?? null;
        const phoneFromUser = (u as any).phone ?? (u as any).phoneNumber ?? null;

        // preferisci email, altrimenti phone
        const contactFromUser = emailFromUser ?? phoneFromUser ?? null;

        this.draft.update((d: any) => {
          const next = { ...d };

          if (!next.name || String(next.name).trim() === '') {
            next.name = nameFromUser;
          }

          if (!next.contact || String(next.contact).trim() === '') {
            next.contact = contactFromUser;
          }

          return next;
        });
      },
      { allowSignalWrites: true }
    );
effect(() => {
  const list = this.artists();
  const d = this.draft();

  const id = d.artistId;
  if (!id) return;
  if (!list?.length) return;

  const found = list.find(a => a.id === id);
  if (!found) return;

  const nextName = found.name ?? null;
  const currentName = d.artistName ?? null;

  // ✅ guardia anti-loop
  if (currentName === nextName) return;

  this.draft.update((prev: any) => ({
    ...prev,
    artistName: nextName,
  }));
}, { allowSignalWrites: true });

    // auto-load artist list quando entri nello step artist
    effect(() => {
      if (this.step() === 'artist' && this.artists().length === 0) {
        queueMicrotask(() => this.fetchArtists());
      }
    });

    // auto-load slots quando hai artista + data e sei nello step "when"
    effect(() => {
      const s = this.step();
      const d = this.draft();
      const date = this.selectedDate();

      if (s !== 'when') return;
      if (!d.artistId) return;
      if (!date) return;

      queueMicrotask(() => this.fetchSlots(d.artistId, date));
    });

    queueMicrotask(() => this.hydrateFromHomeSeed());

  }

  // COMPUTED
  readonly stepIndex = computed(() => this.steps.indexOf(this.step()));
  readonly progress = computed(() => ((this.stepIndex() + 1) / this.steps.length) * 100);
  readonly canBack = computed(() => this.stepIndex() > 0 && this.step() !== 'success');

  readonly canNext = computed(() => {
    const s = this.step();
    const d = this.draft();

    if (s === 'artist') return !!d.artistId;
    if (s === 'when') return !!d.date && !!d.time;
    if (s === 'details') return !!d.name && !!d.contact && !!d.description;

    // su payment NON far andare avanti con "Continua" (si paga dal bottone nello step)
    if (s === 'payment') return false;

    return true;
  });

  // ─────────────────────────────────────────────
  // AUTH / LOCK FIELDS (per disabilitare i campi se precompilati)
  // ─────────────────────────────────────────────
  readonly isUserLogged = computed(() => !!this.auth.userSig());

  /**
   * Se l’utente è loggato e il nome è valorizzato, lo blocchiamo.
   * (coerente con richiesta: "disabled se popolati")
   */
  readonly isNameLocked = computed(() => {
    const u = this.auth.userSig();
    const name = this.draft().name;
    return !!u && !!name && String(name).trim().length > 0;
  });

  /**
   * Se l’utente è loggato e il contatto è valorizzato, lo blocchiamo.
   */
  readonly isContactLocked = computed(() => {
    const u = this.auth.userSig();
    const contact = this.draft().contact;
    return !!u && !!contact && String(contact).trim().length > 0;
  });

  // NAV
  back() {
    this.error.set(null);
    if (this.stepIndex() <= 0) return;
    this.step.set(this.steps[this.stepIndex() - 1]);
  }

  next() {
    this.error.set(null);
    if (this.stepIndex() >= this.steps.length - 1) return;
    this.step.set(this.steps[this.stepIndex() + 1]);
  }

  go(step: Step) {
    this.error.set(null);
    this.step.set(step);
  }

  // ACTIONS: artist
  setArtist(artist: StaffMember) {
    this.draft.update((d: any) => ({
      ...d,
      artistId: artist.id ?? null,
      artistName: artist.name ?? null,
    }));

    // reset step when
    this.selectedDate.set(null);
    this.slots.set([]);
    this.setWhen(null, null);
  }

  // ACTIONS: when
  setDate(date: string | null) {
    this.selectedDate.set(date);
    // reset time selezionato quando cambi giorno
    this.draft.update((d: any) => ({ ...d, date, time: null }));
  }

  setWhen(date: string | null, time: string | null) {
    this.draft.update((d: any) => ({ ...d, date, time }));
  }

  // ACTIONS: details
  setDetails(payload: { name: string; contact: string; description: string }) {
    this.draft.update((d: any) => ({
      ...d,
      name: payload.name,
      contact: payload.contact,
      description: payload.description,
    }));
  }

  // DATA FETCH: artists (REAL)
  async fetchArtists() {
    try {
      this.loadingArtists.set(true);

      const all = await firstValueFrom(this.staffService.getAllStaff());

      // filtra: attivi + tatuatori
      const artists = (all ?? [])
        .filter(a => (a.isActive ?? true) === true)
        .filter(a => a.role === 'tatuatore')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      this.artists.set(artists);
    } catch (e: any) {
      console.error(e);
      this.error.set('Impossibile caricare gli artisti. Riprova.');
    } finally {
      this.loadingArtists.set(false);
    }
  }

  // DATA FETCH: slots (REAL)
  async fetchSlots(artistId: string, date: string) {
    try {
      this.loadingSlots.set(true);
      this.error.set(null);

      const duration = this.durationMin();

      // ✅ bookingService ritorna Promise, quindi await diretto
      const slots = await this.bookingService.getFreeSlotsInDay(artistId, date, duration);

      this.slots.set(slots ?? []);
    } catch (e) {
      console.error('[FAST_BOOKING][SLOTS] ERROR', e);
      this.slots.set([]);
      this.error.set('Impossibile caricare gli orari disponibili per questo giorno.');
    } finally {
      this.loadingSlots.set(false);
    }
  }

  // PAYMENT FLOW (REAL DATA + hook)
  async startPayment() {
    try {
      this.error.set(null);
      this.paying.set(true);

      const d = this.draft();
      const uid = this.userService.getCurrentUserId();

      if (!uid) {
        this.error.set('Per procedere serve il login (utente non autenticato).');
        return;
      }

      if (!d.artistId || !d.date || !d.time) {
        this.error.set('Seleziona artista, data e ora prima di pagare.');
        return;
      }
      if (!d.name || !d.contact || !d.description) {
        this.error.set('Completa i dati (nome, contatto, descrizione) prima di pagare.');
        return;
      }

      // 1) crea booking draft su RTDB
      const chatDraft: BookingChatDraft = {
        artistId: d.artistId,
        date: d.date,
        time: d.time,
        duration: this.durationMin(),
        note: d.description,
      };

      const bookingId = await this.bookingService.addDraftFromChat(chatDraft, {
        idClient: uid,
        clientName: d.name,
      });

      this.bookingId.set(bookingId);

      // 2) crea PaymentIntent (caparra)
      const amountCents = Math.round(this.depositEuro() * 100);

      const payRes = await firstValueFrom(
        this.paymentApi.createPaymentIntent({
          amount: amountCents,
          currency: 'eur',
          description: `Caparra consulenza Rebis Tattoo - booking ${bookingId}`,
        })
      );

      this.paymentClientSecret.set(payRes.clientSecret);
      this.paymentIntentId.set(payRes.paymentIntentId);

      // 3) Stripe Elements gestito nello step payment
    } catch (e: any) {
      console.error(e);
      this.error.set('Errore durante la creazione del pagamento. Riprova.');
    } finally {
      this.paying.set(false);
    }
  }

  // CHIAMA QUESTO QUANDO STRIPE CONFERMA OK (webhook o return-url)
  async confirmPaymentSuccess() {
    try {
      const id = this.bookingId();
      if (!id) {
        this.error.set('Booking non trovato.');
        return;
      }

      const paid = this.depositEuro();
      const booking = await this.bookingService.getBookingById(id);
      if (!booking) {
        this.error.set('Booking non trovato.');
        return;
      }

      // Transizione valida: draft/pending -> confirmed -> paid
      if (booking.status === 'draft' || booking.status === 'pending') {
        await this.bookingService.safeSetStatus(id, 'confirmed');
      }

      await this.bookingService.safeSetStatus(id, 'paid', {
        paidAmount: paid,
        price: paid,
        updatedAt: new Date().toISOString(),
      } as any);

      this.go('success');
    } catch (e: any) {
      console.error(e);
      this.error.set('Pagamento registrato? Non riesco ad aggiornare lo stato booking.');
    }
  }

resetAll() {
  this.error.set(null);
  this.bookingId.set(null);
  this.paymentClientSecret.set(null);
  this.paymentIntentId.set(null);
  this.selectedDate.set(null);
  this.slots.set([]);

  const u = this.auth.userSig();
  const nameFromUser = u ? ((u as any).name ?? (u as any).displayName ?? null) : null;
  const emailFromUser = u ? ((u as any).email ?? null) : null;
  const phoneFromUser = u ? ((u as any).phone ?? (u as any).phoneNumber ?? null) : null;
  const contactFromUser = u ? (emailFromUser ?? phoneFromUser ?? null) : null;

  this.draft.set({
    artistId: null,
    artistName: null,
    date: null,
    time: null,

    // ✅ se loggato: riparti già precompilato
    name: nameFromUser,
    contact: contactFromUser,

    // ✅ descrizione la resetti sempre
    description: null,
  });
try { sessionStorage.removeItem(this.HOME_SEED_KEY); } catch {}
try { localStorage.removeItem(this.HOME_SEED_KEY); } catch {}

  this.step.set('intro');
}
/**
 * Chiamato da HomeContact (o da chiunque) per inizializzare il wizard.
 * Imposta artista, precompila details e porta direttamente a WHEN.
 */
seedFromHome(seed: HomeSeed) {
  const artistId = seed.artist ?? null;

  // contact: preferisci email, fallback phone
  const contact = (seed.email && seed.email.trim()) ? seed.email.trim()
                : (seed.phone && seed.phone.trim()) ? seed.phone.trim()
                : null;

  const name = (seed.fullName && seed.fullName.trim()) ? seed.fullName.trim() : null;

  const procedure = seed.procedure?.trim();
  const comments = seed.comments?.trim();

  const description =
    [procedure ? `Procedura: ${procedure}` : null, comments ? comments : null]
      .filter(Boolean)
      .join('\n\n') || null;

  // set artistId (artistName verrà risolto dopo)
  this.draft.update((d: any) => ({
    ...d,
    artistId,
    artistName: d.artistName, // la risolviamo sotto
    date: null,
    time: null,
    name: d.name && String(d.name).trim() ? d.name : name, // non sovrascrivere se già compilato
    contact: d.contact && String(d.contact).trim() ? d.contact : contact,
    description: d.description && String(d.description).trim() ? d.description : description,
  }));

  // reset data slots
  this.selectedDate.set(null);
  this.slots.set([]);

  // vai diretto a WHEN se ho artistId, altrimenti ARTIST
  this.step.set(artistId ? 'when' : 'artist');

  // salva per refresh o navigazioni
  try {
    sessionStorage.setItem(this.HOME_SEED_KEY, JSON.stringify(seed));
  } catch {}
}

/**
 * Da chiamare quando entri nel wizard (o nel constructor),
 * per recuperare eventuale seed dalla Home.
 */
hydrateFromHomeSeed() {
  try {
    const raw = sessionStorage.getItem(this.HOME_SEED_KEY) || localStorage.getItem(this.HOME_SEED_KEY);
    if (!raw) return;

    const seed = JSON.parse(raw) as HomeSeed;
    this.seedFromHome(seed);

    // cleanup: tienilo solo in session (così non rimane “sporco” per giorni)
    localStorage.removeItem(this.HOME_SEED_KEY);
  } catch {}
}
/**
 * STEP 2: compila SOLO i campi del draft a partire dal form Home.
 * - NON cambia step
 * - NON carica slots
 * - NON tocca selectedDate/slots
 * - NON sovrascrive campi già compilati nello store (se non vuoi)
 */
applyHomeSeed(seed: HomeSeed, opts?: { overwrite?: boolean }) {
  const overwrite = opts?.overwrite === true;

  const artistId = seed.artist ?? null;

  const name =
    seed.fullName && seed.fullName.trim()
      ? seed.fullName.trim()
      : null;

  const contact =
    seed.email && seed.email.trim()
      ? seed.email.trim()
      : seed.phone && seed.phone.trim()
        ? seed.phone.trim()
        : null;

  const procedure = seed.procedure?.trim() || null;
  const comments = seed.comments?.trim() || null;

  const description =
    [procedure ? `Procedura: ${procedure}` : null, comments]
      .filter(Boolean)
      .join('\n\n') || null;

  this.draft.update((d: any) => ({
    ...d,

    // artista: se overwrite o era vuoto
    artistId: overwrite ? artistId : (d.artistId ?? artistId),
    // artistName lo risolverai dopo quando carichi artists()
    artistName: d.artistName ?? null,

    // details: se overwrite o erano vuoti
    name: overwrite ? name : (d.name && String(d.name).trim() ? d.name : name),
    contact: overwrite ? contact : (d.contact && String(d.contact).trim() ? d.contact : contact),
    description: overwrite
      ? description
      : (d.description && String(d.description).trim() ? d.description : description),
  }));
}

}
