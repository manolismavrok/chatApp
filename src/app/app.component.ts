import { trigger, state, style, transition, animate } from '@angular/animations';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('rotatedState', [
      state('default', style({ transform: 'rotate(0)' })),
      state('rotated', style({ transform: 'rotate(360deg)' })),
      transition('rotated => default', animate('400ms ease-out')),
      transition('default => rotated', animate('400ms ease-out'))
    ])
  ]
})
export class AppComponent implements OnInit {
  title = 'chatApp'

  constructor(private router: Router, public appService: AppService, private changeDetectorRef: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.changeDetectorRef.detectChanges();
    setInterval(() => {
      this.rotate()
    }, 1000);
    this.router.navigate(['']);
  }

  rotate() {
    this.appService.state = (this.appService.state === 'default' ? 'rotated' : 'default');
  }

}
