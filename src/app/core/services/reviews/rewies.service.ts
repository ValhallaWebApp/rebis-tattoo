import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get,
  query,
  orderByChild,
  equalTo
} from '@angular/fire/database';
import { Observable } from 'rxjs';

export interface Review {
  id: string;
  userId: string;
  tattooId?: string;
  tattooTitle: any;
  comment: string;
  rating: number;
  status: 'approved' | 'pending' | 'rejected';
  date: number;
  bookingId?: string;
  artistId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewsService {
  private readonly path = 'reviews';

  constructor(private db: Database) {}

  addReview(review: any): Promise<void> {
    const newRef = push(ref(this.db, this.path));
    return set(newRef, {
      ...review,
      id: newRef.key
    });
  }

  deleteReview(id: string): Promise<void> {
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  updateReview(id: string, updatedData: Partial<Review>): Promise<void> {
    return update(ref(this.db, `${this.path}/${id}`), updatedData);
  }

  getAllReviews(): Observable<Review[]> {
    return new Observable<Review[]>((observer) => {
      const reviewsRef = ref(this.db, this.path);
      const unsub = onValue(
        reviewsRef,
        (snapshot) => {
          const data = snapshot.val();
          const reviews: Review[] = data
            ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
            : [];
          observer.next(reviews);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getRecentReviews(limit: number = 5): Observable<Review[]> {
    return new Observable<Review[]>((observer) => {
      const reviewsRef = ref(this.db, this.path);
      const unsub = onValue(
        reviewsRef,
        (snapshot) => {
          const data = snapshot.val();
          let reviews: Review[] = [];

          if (data) {
            reviews = Object.entries(data)
              .map(([id, val]: any) => ({ id, ...val }))
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, limit);
          }

          observer.next(reviews);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getReviewById(id: string): Promise<Review | null> {
    return get(ref(this.db, `${this.path}/${id}`)).then(snapshot =>
      snapshot.exists() ? { id, ...snapshot.val() } : null
    );
  }

  getReviewsByUser(userId: string): Observable<Review[]> {
    return new Observable<Review[]>((observer) => {
      const reviewQuery = query(
        ref(this.db, this.path),
        orderByChild('userId'),
        equalTo(userId)
      );
      const unsub = onValue(
        reviewQuery,
        (snapshot) => {
          const data = snapshot.val();
          const reviews: Review[] = data
            ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
            : [];
          observer.next(reviews);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getReviewsByBookingId(bookingId: string): Observable<Review[]> {
    return new Observable<Review[]>((observer) => {
      const q = query(ref(this.db, this.path), orderByChild('bookingId'), equalTo(bookingId));
      const unsub = onValue(
        q,
        (snapshot) => {
          const data = snapshot.val();
          const reviews: Review[] = data
            ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
            : [];
          observer.next(reviews);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getReviewsByArtist(artistId: string): Observable<Review[]> {
    return new Observable<Review[]>((observer) => {
      const reviewsRef = ref(this.db, this.path);
      const unsub = onValue(
        reviewsRef,
        (snapshot) => {
          const data = snapshot.val();
          const reviews: Review[] = data
            ? Object.entries(data)
                .map(([id, val]: any) => ({ id, ...val }))
                .filter(r => r.artistId === artistId && r.status === 'approved')
            : [];
          observer.next(reviews);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  async checkIfAlreadyReviewed(bookingId: string, userId: string): Promise<boolean> {
    const snapshot = await get(ref(this.db, this.path));
    if (!snapshot.exists()) return false;
    const allReviews = Object.values(snapshot.val()) as Review[];
    return allReviews.some(r => r.bookingId === bookingId && r.userId === userId);
  }
}
