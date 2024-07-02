import { trigger, state, style, transition, animate } from '@angular/animations';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from './app.service';
import { Title, Meta } from '@angular/platform-browser';

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

  constructor(private router: Router, public appService: AppService, private changeDetectorRef: ChangeDetectorRef, private metaTagService: Meta, private titleService: Title) {
  }

  ngOnInit(): void {
    this.changeDetectorRef.detectChanges();
    setInterval(() => {
      this.rotate()
    }, 1000);
    this.router.navigate(['']);
    this.titleService.setTitle('Chat Now! - An Omegle alternative');
    this.metaTagService.addTags([
      { name: 'keywords', content: 'chat roulette, omegle alternative, random chat, online chat, chatting apps' },
      { name: 'description', content: 'An Omegle alternative to chat online with strangers in random!' },
      { name: 'robots', content: 'index, follow' },
      { name: 'author', content: 'Emmanouil Mavrokoukoulakis' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'date', content: '2024-07-01', scheme: 'YYYY-MM-DD' },      
      { charset: 'UTF-8' }
    ]);
  }

  rotate() {
    this.appService.state = (this.appService.state === 'default' ? 'rotated' : 'default');
  }

}
