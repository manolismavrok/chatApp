import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AppService } from '../app.service';
import { HeaderService } from '../header/header.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css']
})
export class LobbyComponent implements AfterViewInit {
  myGender: string | null = '';
  @ViewChild('myAge') myAge!: ElementRef;
  country: string | null = '';
  initialized: boolean = false;
  validationError = {
    myGender: false,
    myAge: false
  }
  warningMessage: string = ""
  apiKey: string = "c73bd3214f964be282d1a6987b3c3fd4";

  constructor(private router: Router, private appService: AppService, private headerService: HeaderService) {
    this.myGender = this.isNull(localStorage.getItem('myGender')) ? '' : localStorage.getItem("myGender");
    fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${this.apiKey}`)
    .then((response) => response.json()).then((data) => this.setCountry(data))
    .catch((error => {
      console.error(error)
      this.setCountry({ country_name: 'random' });
    }));
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    this.myAge.nativeElement.value = localStorage.getItem('myAge');
  }

  onSubmit(f: NgForm) {
    if (this.initialized) {
      f.value.sessionId = this.uuidv4();
      f.value.myAge = this.myAge.nativeElement.value;
      f.value.country = this.country;
      this.appService.filters = JSON.stringify(f.value);
      if (!this.validateFilters(this.appService.filters)) {
        return false;
      }
      this.appService.sendToServer(this.appService.filters);
      localStorage.setItem('myGender', f.value.myGender);
      localStorage.setItem('myAge', f.value.myAge);
      localStorage.setItem('country', f.value.country);
      console.log(this.appService.filters);
      this.toChat(this.router);
    }
    return true;
  }

  validateFilters(filters: string) {
    let body = JSON.parse(filters);
    Object.keys(this.validationError).forEach(key => {
      this.validationError[key as keyof typeof this.validationError] = false;
    });
    if (body.myGender !== "Male" && body.myGender !== "Female" && body.myGender !== "Other") {
      this.validationError.myGender = true;
      this.warningMessage = "Please select a valid gender"
      return false;
    }
    if (isNaN(Number(body.myAge))) {
      this.validationError.myAge = true;
      this.warningMessage = "Please select a valid age"
      return false;
    }
    if (Number(body.myAge) === 0) {
      this.validationError.myAge = true;
      this.warningMessage = "Please select a valid age"
      return false;
    }
    if (Number(body.myAge) < 18) {
      this.validationError.myAge = true;
      this.warningMessage = "You must be over 18"
      return false;
    }
    if (Number(body.myAge) > 99) {
      this.validationError.myAge = true;
      this.warningMessage = "Please select a valid age"
      return false;
    }
    return true;
  }

  toChat(router: Router): void {
    this.headerService.rotate();
    router.navigate(['/chat'], { skipLocationChange: true });
  }

  ageKeyHandler($event: any) {
    if ($event.key.match(/[0-9]/i) === null && ($event.key !== 'Backspace' && $event.key !== 'ArrowLeft' && $event.key !== 'ArrowRight'
      && $event.key !== 'End' && $event.key !== 'Home')) {
      return false;
    }
    return true;
  }

  onFocus(myAge: any) {
    setTimeout(function () {
      myAge.selectionStart = myAge.selectionEnd = 2;
    }, 10);
  }

  ageDec() {
    if (this.initialized) {
      if (this.myAge.nativeElement.value > 18) {
        this.myAge.nativeElement.value--;
      }
      if (this.myAge.nativeElement.value < 18) {
        this.myAge.nativeElement.value = 18;
      }
    }
    return false;
  }

  ageInc() {
    if (this.initialized) {
      if (this.myAge.nativeElement.value < 99) {
        this.myAge.nativeElement.value++;
      }
      if (this.myAge.nativeElement.value < 18) {
        this.myAge.nativeElement.value = 18;
      }
    }
    return false;
  }

  hasWarning() {
    let result = false;
    Object.values(this.validationError).forEach((error) => {
      if (error) {
        result = true;
      }
    });
    return result;
  }

  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  setCountry(data: { country_name: string }) {
    this.country = data.country_name;
  }

  isNull(n: any): boolean {
    return n === null;
  }

}
