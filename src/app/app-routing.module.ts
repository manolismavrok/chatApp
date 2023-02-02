import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LobbyComponent } from './lobby/lobby.component';
import { ChatComponent } from './chat/chat.component';
import { PolicyComponent } from './policy/policy.component';
import { TermsComponent } from './terms/terms.component';
import { ErrorComponent } from './error/error.component';

const routes: Routes = [
  { path: '', component: LobbyComponent },
  { path: 'chat', component: ChatComponent },
  { path: 'privacy-policy', component: PolicyComponent },
  { path: 'terms', component: TermsComponent },
  { path: 'error', component: ErrorComponent }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
