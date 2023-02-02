import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class HeaderService {
    public state: string = 'default';
    public usersOnline: string = '';

    constructor() { }

    rotate() {
        this.state = (this.state === 'default' ? 'rotated' : 'default');
    }
}