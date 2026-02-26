import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { Booking, BookingChatDraft, BookingService } from '../../../../core/services/bookings/booking.service';
import { UserService } from '../../../../core/services/users/user.service';
import { PaymentApiService } from '../../../../core/services/payments/payment-api.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

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

type FastBookingDraft = {
  artistId: string | null;
  artistName: string | null;
  date: string | null;
  time: string | null;
  name: string | null;
  contact: string | null;
  description: string | null;
};

type E2EFastBookingGlobal = {
  __E2E_FASTBOOKING_MOCK__?: boolean;
};

function isE2EFastBookingMockEnabled(): boolean {
  return Boolean((globalThis as unknown as E2EFastBookingGlobal).__E2E_FASTBOOKING_MOCK__);
}

@Injectable({ providedIn: 'root' })
export class FastBookingStore {
  readonly isE2EMockMode = isE2EFastBookingMockEnabled();
  private readonly staffService = inject(StaffService);
  private readonly bookingService = inject(BookingService);
  private readonly userService = inject(UserService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);

 readonly HOME_SEED_KEY = 'FAST_BOOKING_HOME_SEED';

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
  readonly confirmingPayment = signal(false);

  // UI ERROR
  readonly error = signal<string | null>(null);

  // DRAFT (client)
  readonly draft = signal<FastBookingDraft>({
    artistId: null,
    artistName: null,
    date: null, // YYYY-MM-DD
    time: null, // HH:mm
    name: null,
    contact: null, // email o telefono
    description: null,
  });

  constructor() {
    // ✅ PREFILL: quando l'utente è disponibile, precompila SOLO i campi vuoti
    effect(
      () => {
        const u = this.auth.userSig();
        if (!u) return;

        const nameFromUser = u.name || null;
        const emailFromUser = u.email || null;
        const phoneFromUser = u.phone || null;

        // preferisci email, altrimenti phone
        const contactFromUser = emailFromUser ?? phoneFromUser ?? null;

        this.draft.update((d) => {
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

  this.draft.update((prev) => ({
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
      const artistId = d.artistId;

      if (s !== 'when') return;
      if (!artistId) return;
      if (!date) return;

      queueMicrotask(() => this.fetchSlots(artistId, date));
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
    this.draft.update((d) => ({
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
    this.draft.update((d) => ({ ...d, date, time: null }));
  }

  setWhen(date: string | null, time: string | null) {
    this.draft.update((d) => ({ ...d, date, time }));
  }

  // ACTIONS: details
  setDetails(payload: { name: string; contact: string; description: string }) {
    this.draft.update((d) => ({
      ...d,
      name: payload.name,
      contact: payload.contact,
      description: payload.description,
    }));
  }

  // DATA FETCH: artists (REAL)
  async fetchArtists() {
    if (this.isE2EMockMode) {
      this.artists.set([
        {
          id: 'e2e_artist_01',
          name: 'E2E Artist',
          role: 'tatuatore',
          photoUrl: '/personale/1.jpg',
          isActive: true
        } as StaffMember
      ]);
      this.loadingArtists.set(false);
      this.error.set(null);
      return;
    }

    try {
      this.loadingArtists.set(true);
      this.error.set(null);

      const all = await firstValueFrom(this.staffService.getAllStaff());

      const active = (all ?? []).filter(a => a.isActive !== false);
      const artists = active.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      this.artists.set(artists);
      if (artists.length === 0) {
        this.error.set('Nessun membro staff attivo disponibile al momento.');
      }
    } catch (e: unknown) {
      console.error(e);
      this.error.set('Impossibile caricare gli artisti. Riprova.');
    } finally {
      this.loadingArtists.set(false);
    }
  }

  // DATA FETCH: slots (REAL)
  async fetchSlots(artistId: string, date: string) {
    if (this.isE2EMockMode) {
      this.slots.set([
        { time: '10:00' },
        { time: '11:00' },
        { time: '15:00' }
      ]);
      this.loadingSlots.set(false);
      this.error.set(null);
      return;
    }

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
    if (this.isE2EMockMode) {
      const d = this.draft();
      if (!d.artistId || !d.date || !d.time || !d.name || !d.contact || !d.description) {
        this.error.set('Completa i dati prima di avviare il pagamento.');
        return;
      }

      this.error.set(null);
      this.bookingId.set(`e2e_bk_${Date.now()}`);
      this.paymentClientSecret.set(`e2e_cs_${Date.now()}`);
      this.paymentIntentId.set(`e2e_pi_${Date.now()}`);
      return;
    }

    try {
      if (this.paying()) return;
      if (this.paymentClientSecret()) return;

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

      const draftRes = await this.bookingService.addDraftFromChatSafe(chatDraft, {
        clientId: uid,
        clientName: d.name,
        source: 'fast-booking'
      });
      if (!draftRes.ok) {
        this.error.set(draftRes.error);
        this.ui.error(draftRes.error);
        return;
      }
      const bookingId = draftRes.data;

      this.bookingId.set(bookingId);

      // 2) crea PaymentIntent (caparra)
      const amountCents = Math.round(this.depositEuro() * 100);

      const payRes = await this.paymentApi.createPaymentIntentSafe({
        amount: amountCents,
        currency: 'eur',
        description: `Caparra consulenza Rebis Tattoo - booking ${bookingId}`,
        bookingId,
      });

      if (!payRes.ok) {
        // La bozza esiste ma il pagamento non e stato inizializzato.
        // Portiamo la bozza in pending per retry controllato lato admin/cliente.
        await this.bookingService.safeSetStatusSafe(bookingId, 'pending', {
          updatedAt: new Date().toISOString(),
          notes: `${d.description ?? ''}\n[payment-init-failed] ${payRes.error}`.trim()
        } as Partial<Booking>);
        this.error.set(payRes.error);
        this.ui.error(payRes.error);
        return;
      }

      this.paymentClientSecret.set(payRes.data.clientSecret);
      this.paymentIntentId.set(payRes.data.paymentIntentId);
      this.ui.success('Pagamento inizializzato correttamente.');

      // 3) Stripe Elements gestito nello step payment
    } catch (e: unknown) {
      console.error(e);
      const msg = this.getErrorMessage(e, 'Errore durante la creazione del pagamento. Riprova.');
      this.error.set(msg);
      this.ui.error(msg);
    } finally {
      this.paying.set(false);
    }
  }

  // CHIAMA QUESTO QUANDO STRIPE CONFERMA OK (webhook o return-url)
  async confirmPaymentSuccess() {
    if (this.isE2EMockMode) {
      this.error.set(null);
      this.go('success');
      return;
    }

    if (this.confirmingPayment()) return;

    try {
      this.confirmingPayment.set(true);
      const id = this.bookingId();
      if (!id) {
        this.error.set('Booking non trovato.');
        return;
      }

      const paid = this.depositEuro();
      const booking = await this.bookingService.getBookingById(id);
      if (!booking) {
        this.error.set('Booking non trovato.');
        this.ui.error('Booking non trovato.');
        return;
      }

      if (booking.status === 'paid') {
        this.go('success');
        return;
      }

      if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
        const msg = `Stato booking non valido per conferma pagamento: ${booking.status}`;
        this.error.set(msg);
        this.ui.error(msg);
        return;
      }

      // Transizione valida: draft/pending -> confirmed -> paid
      if (booking.status === 'draft' || booking.status === 'pending') {
        const toConfirmed = await this.bookingService.safeSetStatusSafe(id, 'confirmed');
        if (!toConfirmed.ok) {
          this.error.set(toConfirmed.error);
          this.ui.error(toConfirmed.error);
          return;
        }
      }

      const toPaid = await this.bookingService.safeSetStatusSafe(id, 'paid', {
        paidAmount: paid,
        price: paid,
        updatedAt: new Date().toISOString(),
      } as Partial<Booking>);
      if (!toPaid.ok) {
        const fresh = await this.bookingService.getBookingById(id);
        if (fresh?.status === 'paid') {
          this.go('success');
          return;
        }

        this.error.set(toPaid.error);
        this.ui.error(toPaid.error);
        return;
      }

      this.go('success');
      this.ui.success('Pagamento registrato con successo.');
    } catch (e: unknown) {
      console.error(e);
      const msg = 'Pagamento registrato? Non riesco ad aggiornare lo stato booking.';
      this.error.set(msg);
      this.ui.error(msg);
    } finally {
      this.confirmingPayment.set(false);
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
  const nameFromUser = u ? (u.name || null) : null;
  const emailFromUser = u ? (u.email || null) : null;
  const phoneFromUser = u ? (u.phone || null) : null;
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
  this.draft.update((d) => ({
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

  this.draft.update((d) => ({
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

private getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const maybeMessage = (error as { message?: unknown } | null)?.message;
  if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  return fallback;
}

}


