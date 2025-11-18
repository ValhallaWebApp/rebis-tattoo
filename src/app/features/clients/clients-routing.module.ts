import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProfileComponent } from './components/profile/profile.component';
import { BookingHistoryComponent } from './components/booking-history/booking-history.component';
import { MessagingComponent } from './components/messaging/messaging.component';
import { ReviewsComponent } from './components/reviews/reviews.component';
import { SettingsComponent } from './components/settings/settings.component';
import { PromoReferralComponent } from './components/promo-referral/promo-referral.component';

const routes: Routes = [

    { path: '', component: ProfileComponent },
    { path: 'booking-history', component: BookingHistoryComponent },
    { path: 'buoni', component: PromoReferralComponent },
    { path: 'reviews', component: ReviewsComponent },
    { path: 'settings', component: SettingsComponent },
    { path: 'chat', component: MessagingComponent }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientsRoutingModule { }
