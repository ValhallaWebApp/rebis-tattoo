import { Routes } from '@angular/router';
import { ProfileComponent } from './components/profile/profile.component';
import { BookingHistoryComponent } from './components/booking-history/booking-history.component';
import { MessagingComponent } from './components/messaging/messaging.component';
import { ReviewsComponent } from './components/reviews/reviews.component';
import { PromoReferralComponent } from './components/promo-referral/promo-referral.component';
import { MyProjectsComponent } from './components/my-projects/my-projects.component';

export const CLIENTS_ROUTES: Routes = [

    { path: '', component: ProfileComponent },
    { path: 'booking-history', component: BookingHistoryComponent },
    { path: 'projects', redirectTo: 'tatuaggi', pathMatch: 'full' },
    { path: 'tatuaggi', component: MyProjectsComponent },
    { path: 'ticket', component: MessagingComponent },
    { path: 'invoices', component: BookingHistoryComponent },
    { path: 'buoni', component: PromoReferralComponent },
    { path: 'reviews', component: ReviewsComponent },
    { path: 'chat', component: MessagingComponent }

];
