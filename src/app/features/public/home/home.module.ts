import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './components/home/home.component';
import { HomeHeroComponent } from "./components/home-hero/home-hero.component";
import { HomeAboutComponent } from "./components/home-about/home-about.component";
import { HomeServicesComponent } from "./components/home-services/home-services.component";
import { HomeProjectsComponent } from "./components/home-projects/home-projects.component";
import { HomeContactComponent } from "./components/home-contact/home-contact.component";
import { HomeFeaturedArtistsComponent } from "./components/home-featured-artists/home-featured-artists.component";
import { HomeFaqComponent } from './components/home-faq/home-faq.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ShowcaseComponent } from './components/showcase/showcase.component';
import { MaterialModule } from '../../../core/modules/material.module';


@NgModule({
  declarations: [
    HomeComponent,
    HomeHeroComponent,
    HomeAboutComponent,
    HomeServicesComponent,
    HomeProjectsComponent,
    HomeContactComponent,
    HomeFeaturedArtistsComponent,
    HomeFaqComponent,
    ShowcaseComponent,

  ],
  imports: [
    CommonModule,
    HomeRoutingModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
]
})
export class HomeModule { }
