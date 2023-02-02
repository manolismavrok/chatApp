import { Injectable } from "@angular/core"
import { Router } from "@angular/router";

@Injectable({ providedIn: 'root' })
export class FooterService {

    constructor(private router: Router) { }


    toTerms(): void {
        this.router.navigate(['/terms'], { skipLocationChange: true });
    }

    toPolicy(): void {
        this.router.navigate(['/privacy-policy'], { skipLocationChange: true });
    }
}