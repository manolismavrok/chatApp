import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  public error: boolean = true;
  public message: string = `Servers are currently offline.</br>We are really sorry for the inconvenience.</br>Please try again later.`;
  constructor() {
    document.documentElement.style.setProperty('--online-users-color', 'var(--pink-2)');
  }
}
