import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './components/home/home.component';
import { HomeHeroComponent } from "./components/home-hero/home-hero.component";
import { HomeAboutComponent } from "./components/home-about/home-about.component";
import { HomeServicesComponent } from "./components/home-services/home-services.component";
import { HomeProjectsComponent } from "./components/home-projects/home-projects.component";
import { HomeContactComponent } from "./components/home-contact/home-contact.component";
import { HomeFaqComponent } from './components/home-faq/home-faq.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ShowcaseComponent } from './components/showcase/showcase.component';
import { MaterialModule } from '../../../core/modules/material.module';
import { DynamicFormComponent } from '../../../shared/components/form/dynamic-form/dynamic-form.component';
import { HomeCollabEventsComponent } from './components/home-collab-events/home-collab-events.component';


@NgModule({
  declarations: [
    HomeComponent,
    HomeHeroComponent,
    HomeAboutComponent,
    HomeServicesComponent,
    HomeProjectsComponent,
    HomeContactComponent,
    HomeFaqComponent,
    ShowcaseComponent,
    HomeCollabEventsComponent,

  ],
  imports: [
    CommonModule,
    HomeRoutingModule,
    MaterialModule,
    ReactiveFormsModule,
    DynamicFormComponent,
]
})
export class HomeModule { }
