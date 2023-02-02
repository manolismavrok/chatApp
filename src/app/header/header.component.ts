import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AppService } from '../app.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { HeaderService } from './header.service';
import { ErrorService } from '../error/error.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  animations: [
    trigger('rotatedState', [
      state('default', style({ transform: 'rotate(0)' })),
      state('rotated', style({ transform: 'rotate(360deg)' })),
      transition('rotated => default', animate('400ms ease-out')),
      transition('default => rotated', animate('400ms ease-out'))
    ])
  ]
})
export class HeaderComponent implements OnInit {
  public theme: string | null = "dark";
  public checked: boolean = true;
  public state: string = 'default';
  private usersCap: number = 10000;

  constructor(public headerService: HeaderService, private errorService: ErrorService, private appService: AppService, private changeDetectorRef: ChangeDetectorRef, private router: Router) {
    this.appService.ws.onmessage = ({ data }) => {
      let info = JSON.parse(data);
      if (info.hasOwnProperty('online')) {
        if (info.online === 1) {
          this.headerService.usersOnline = info.online + ' user online';
        }
        if (info.online > 1) {
          this.headerService.usersOnline = info.online + ' users online';
        }
        if (info.online >= this.usersCap) {
          errorService.message = "Site is overloaded.<br>We are really sorry for the inconvenience.<br>Please come back later!";
          appService.toErrorPage();
        }
      }
      if (info.hasOwnProperty('connectionsExceeded')) {
        errorService.message = "Number of maximum connections exceeded."
        appService.toErrorPage();
      }
    };
  }

  ngOnInit(): void {
    this.darkTheme();
    if (localStorage.getItem('theme') !== null) {
      if (this.theme !== localStorage.getItem('theme')) {
        this.switchTheme();
        this.checked = false;
      }
    }
    this.changeDetectorRef.detectChanges(); // To avoid NG0100 error
    this.headerService.rotate();
  }

  darkTheme(): void {
    document.documentElement.style.setProperty('--background-color', 'var(--gray-1)');
    document.documentElement.style.setProperty('--text-color', 'var(--gray-7)');
    document.documentElement.style.setProperty('--footer-text-color', 'var(--gray-4)');
    document.documentElement.style.setProperty('--footer-text-color-hover', 'var(--gray-5)');
    document.documentElement.style.setProperty('--chat-room_background-color', 'var(--gray-2)');
    document.documentElement.style.setProperty('--chat-room_border-color', 'var(--gray-3)');
    if (this.router.url === '/' || this.router.url === '/chat' || this.router.url === '/terms' || this.router.url === '/privacy-policy') {
      document.documentElement.style.setProperty('--online-users-color', 'var(--green-1)');
    }
    this.theme = "dark";
  }

  lightTheme(): void {
    document.documentElement.style.setProperty('--background-color', 'var(--gray-6)');
    document.documentElement.style.setProperty('--text-color', 'var(--gray-1)');
    document.documentElement.style.setProperty('--footer-text-color', 'var(--gray-1)');
    document.documentElement.style.setProperty('--footer-text-color-hover', 'var(--gray-4)');
    document.documentElement.style.setProperty('--chat-room_background-color', 'var(--gray-5)');
    document.documentElement.style.setProperty('--chat-room_border-color', 'var(--gray-4)');
    if (this.router.url === '/' || this.router.url === '/chat' || this.router.url === '/terms' || this.router.url === '/privacy-policy') {
      document.documentElement.style.setProperty('--online-users-color', 'var(--gold-1)');
    }
    this.theme = "light";
  }

  switchTheme(): void {
    if (this.theme === 'dark') {
      this.lightTheme();
      localStorage.setItem('theme', 'light');
      this.theme = 'light';
    } else {
      this.darkTheme();
      localStorage.setItem('theme', 'dark')
      this.theme = 'dark';
    }
    this.headerService.rotate();
  }

}
