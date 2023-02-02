import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { HeaderService } from "./header/header.service";

// Azure IP: 20.86.40.98
@Injectable({ providedIn: 'root' })
export class AppService {
    public ws: WebSocket = new WebSocket('ws://20.86.40.98:8080');
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
        this.ws = new WebSocket('ws://20.86.40.98:8080');
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