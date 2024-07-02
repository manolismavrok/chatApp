import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { HeaderService } from "./header/header.service";

@Injectable({ providedIn: 'root' })
export class AppService {
    // Glitch IP: chatnow-app.glitch.me
    public ws = new WebSocket('wss://chatnow-app.glitch.me/');
    private _filters: string = '';
    public loaded: boolean = false;
    public state: string = 'default';

    constructor(private headerService: HeaderService, private router: Router) {
        this.ws.onopen = () => {
            console.log('Connection opened!');
            this.loaded = true;
        };
        this.ws.onerror = () => {
            console.log("No WebSocket connection :(");
            this.headerService.usersOnline = "Servers currently offline";
            this.loaded = true;
            this.toErrorPage();
            return;
        }
        this.ws.onclose = function () {
            this.close();
        }
    }

    sendToServer(data: string): void {
        this.ws.send(data);
    }

    toErrorPage() {
        this.router.navigate(['error'], { skipLocationChange: true });
    }

    reconnect(): void {
        this.sendToServer(JSON.stringify({ disconnected: true }));
        this.ws.close();
        this.ws = new WebSocket('wss://chatnow-app.glitch.me/');
        this.ws.onopen = () => {
            console.log('Connection reopened!');
            this.sendToServer(this.filters);
        };
        this.ws.onerror = () => {
            console.log("No WebSocket connection :(");
            this.headerService.usersOnline = "Servers currently offline";
            this.toErrorPage();
            return;
        };
        this.ws.onclose = function () {
            this.close();
        };
    }

    public get filters(): string {
        return this._filters;
    }
    public set filters(value: string) {
        this._filters = value;
    }

}
