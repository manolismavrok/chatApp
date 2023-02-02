import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, Renderer2, RendererFactory2, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AppService } from '../app.service';
import { HeaderService } from '../header/header.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewInit {
  searching$: Observable<string> = new Observable();
  messages$: Observable<string> = new Observable();
  messageBox$: Observable<boolean> = new Observable();
  send$: Observable<boolean> = new Observable();
  next$: Observable<string> = new Observable();
  searchingEmitter$ = new BehaviorSubject<string>('Looking for partner...');
  messagesEmitter$ = new Subject<string>;
  messageBoxEmitter$ = new BehaviorSubject<boolean>(true);
  sendEmitter$ = new BehaviorSubject<boolean>(true);
  nextEmitter$ = new BehaviorSubject<string>('Next (Esc)');
  public paired: boolean = false;
  private disconnected: boolean = false;
  private renderer: Renderer2;
  private initialized: boolean = false;
  private typing: boolean = false;
  public typingMessage: boolean = false;
  @ViewChild('messages') messages!: ElementRef
  @ViewChild('message') message!: ElementRef

  constructor(private rendererFactory: RendererFactory2, private appService: AppService, private headerService: HeaderService, private changeDetectorRef: ChangeDetectorRef) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.appService.ws.onmessage = ({ data }) => {
      if (this.isJson(data)) {
        this.checkConnection(data);
        this.checkTyping(data);
        return;
      }
      let info = {
        message: '',
        source: ''
      }
      info.message = data;
      info.source = 'partner';
      this.showMessage(info);
    }
  }

  ngAfterViewInit(): void {
    this.initialized = true;
  }

  showMessage(data: { message: string, source: string }): void {
    if (this.initialized) {
      const div = this.renderer.createElement('div');
      const text = this.renderer.createText(data.message);
      this.renderer.appendChild(div, text);
      if (data.source === 'client') {
        this.renderer.setStyle(div, 'width', 'fit-content');
        this.renderer.setStyle(div, 'max-width', '50%');
        this.renderer.setStyle(div, 'overflow-wrap', 'break-word');
        this.renderer.setStyle(div, 'align-self', 'flex-end');
        this.renderer.setStyle(div, 'border-radius', '8px');
        this.renderer.setStyle(div, 'color', 'var(--chat-room_you-color)');
        this.renderer.setStyle(div, 'background-color', '#5E35B1');
        this.renderer.setStyle(div, 'padding', '4px');
        this.renderer.setStyle(div, 'margin', '4px');
      }
      if (data.source === 'partner') {
        this.renderer.setStyle(div, 'width', 'fit-content');
        this.renderer.setStyle(div, 'max-width', '50%');
        this.renderer.setStyle(div, 'overflow-wrap', 'break-word');
        this.renderer.setStyle(div, 'border-radius', '8px');
        this.renderer.setStyle(div, 'color', 'var(--chat-room_partner-color)');
        this.renderer.setStyle(div, 'background-color', '#FFA726');
        this.renderer.setStyle(div, 'padding', '4px');
        this.renderer.setStyle(div, 'margin', '4px');
      }
      this.renderer.appendChild(this.messages.nativeElement, div);
    }
  }

  ngOnInit(): void {
    this.searching$ = this.searchingEmitter$.asObservable();
    this.messages$ = this.messagesEmitter$.asObservable();
    this.messageBox$ = this.messageBoxEmitter$.asObservable();
    this.send$ = this.sendEmitter$.asObservable();
    this.next$ = this.nextEmitter$.asObservable();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.nextPartner();
    }
  }

  inputEvent(forced: boolean): void {
    if (this.initialized) {
      if (this.message.nativeElement.value.length >= 1 && this.typing === false) {
        this.typing = true;
        this.appService.sendToServer(JSON.stringify({ typing: this.typing }));
      }
      if ((this.message.nativeElement.value.length === 0 && this.typing === true) || forced) {
        this.typing = false;
        this.appService.sendToServer(JSON.stringify({ typing: this.typing }));
      }
      console.log(this.typing);
    }
  }

  onSubmit(message: string) {
    if (message.length === 0) { return; }
    this.appService.sendToServer(JSON.stringify(message));
    let data = {
      message: '',
      source: ''
    }
    data.message = message;
    data.source = 'client'
    this.showMessage(data);
    this.inputEvent(true);
  }

  isJson(data: string): boolean {
    try {
      JSON.parse(data);
    } catch (e) {
      return false;
    }
    return true;
  }

  nextPartner(): void {
    if (this.disconnected === true) {
      this.appService.reconnect();
      this.appService.ws.onmessage = ({ data }) => {
        if (this.isJson(data)) {
          this.checkConnection(data);
          this.checkTyping(data);
          return;
        }
        let info = {
          message: '',
          source: ''
        }
        info.message = data;
        info.source = 'partner';
        this.showMessage(info);
      }
      this.searchingEmitter$.next('Looking for partner...');
      this.messageBoxEmitter$.next(true);
      this.sendEmitter$.next(true);
      this.nextEmitter$.next('Next (Esc)');
      this.messagesEmitter$.next(' ');
      this.message.nativeElement.value = '';
      this.disconnected = false;
      this.paired = false;
      this.headerService.rotate();

      return;
    }
    this.nextEmitter$.next('Are you sure? (Esc)');
    this.disconnected = true;
  }

  toLobby(): void {
    location.replace('/');
  }

  checkConnection(data: string): boolean {
    let info = JSON.parse(data);

    if (info.hasOwnProperty('disconnected')) {
      this.searchingEmitter$.next("Partner disconnected.");
      this.messageBoxEmitter$.next(true);
      this.sendEmitter$.next(true);
      this.disconnected = true;
      this.typing = false;
      this.typingMessage = false;
      return false;
    }

    // Skip message containing number of users online
    if (info.hasOwnProperty('online')) {
      return false;
    }

    if (!this.paired) {
      let gender = info.gender;
      let age = info.age;
      let country = info.country;
      this.searchingEmitter$.next(`You're talking with a ${gender} of age ${age}, in ${country}!`)
      this.messagesEmitter$.next('');
      this.messageBoxEmitter$.next(false);
      this.sendEmitter$.next(false);
      this.typing = false;
    }

    this.paired = true;

    return true;

  }

  checkTyping(data: string) {
    let info = JSON.parse(data);
    if (info.hasOwnProperty('typing')) {
      this.typingMessage = false;
      if (info.typing) {
        this.typingMessage = true;
      }
    }
  }

}
