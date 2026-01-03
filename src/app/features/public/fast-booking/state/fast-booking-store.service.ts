import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { BookingChatDraft, BookingService } from '../../../../core/services/bookings/booking.service';
import { UserService } from '../../../../core/services/users/user.service';
import { PaymentApiService } from '../../../../core/services/payments/payment-api.service';


type Step =
  | 'intro'
  | 'artist'
  | 'when'
  | 'details'
  | 'summary'
  | 'payment'
  | 'success';

type Slot = { time: string };

@Injectable({ providedIn: 'root' })
export class FastBookingStore {
  private readonly staffService = inject(StaffService);
  private readonly bookingService = inject(BookingService);
  private readonly userService = inject(UserService);
  private readonly paymentApi = inject(PaymentApiService);

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

      // 3) qui normalmente apri Stripe Elements e confermi il pagamento.
      // In questa versione: lo fai nello StepPayment (bottone conferma / hook).
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

      await this.bookingService.safeSetStatus(id, 'paid', {
        paidAmount: paid,
        price: paid,
        updateAt: new Date().toISOString(),
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

    this.draft.set({
      artistId: null,
      artistName: null,
      date: null,
      time: null,
      name: null,
      contact: null,
      description: null,
    });

    this.step.set('intro');
  }
}
