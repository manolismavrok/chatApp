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
  myCountry: string | null = '';
  partnerGender: string | null = '';
  partnerAge: string | null = '';
  partnerCountry: string | null = '';
  initialized: boolean = false;
  validationError = {
    myGender: false,
    partnerGender: false,
    myAge: false,
    partnerAge: false,
    partnerCountry: false
  }
  warningMessage: string = ""
  apiKey: string = "c73bd3214f964be282d1a6987b3c3fd4";

  constructor(private router: Router, private appService: AppService, private headerService: HeaderService) {
    this.myGender = this.isNull(localStorage.getItem('myGender')) ? '' : localStorage.getItem("myGender");
    fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${this.apiKey}`).then((response) => response.json()).then((data) => this.setCountry(data));
    //this.setCountry({ country_name: 'Greece' });
    this.partnerGender = this.isNull(localStorage.getItem('partnerGender')) ? '' : localStorage.getItem("partnerGender");
    this.partnerAge = this.isNull(localStorage.getItem('partnerAge')) ? '' : localStorage.getItem("partnerAge");
    this.partnerCountry = this.myCountry;
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    this.myAge.nativeElement.value = localStorage.getItem('myAge');
  }

  onSubmit(f: NgForm) {
    if (this.initialized) {
      f.value.sessionId = this.uuidv4();
      f.value.myAge = this.myAge.nativeElement.value;
      f.value.myCountry = this.myCountry;
      this.appService.filters = JSON.stringify(f.value);
      if (!this.validateFilters(this.appService.filters)) {
        return false;
      }
      this.appService.sendToServer(this.appService.filters);
      localStorage.setItem('myGender', f.value.myGender);
      localStorage.setItem('myAge', f.value.myAge);
      localStorage.setItem('partnerGender', f.value.partnerGender);
      localStorage.setItem('partnerAge', f.value.partnerAge);
      this.toChat(this.router);
    }
    return true;
  }

  validateFilters(filters: string) {
    let body = JSON.parse(filters);
    Object.keys(this.validationError).forEach(key => {
      this.validationError[key as keyof typeof this.validationError] = false;
    });
    if (body.myGender !== "Male" && body.myGender !== "Female") {
      this.validationError.myGender = true;
      this.warningMessage = "Please select a valid gender"
      return false;
    }
    if (body.partnerGender !== "Male" && body.partnerGender !== "Female" && body.partnerGender !== "Any") {
      this.validationError.partnerGender = true;
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
    if (body.partnerAge !== '18-24' && body.partnerAge !== '25-29' && body.partnerAge !== '30-34' &&
      body.partnerAge !== '35-39' && body.partnerAge !== '40-44' && body.partnerAge !== '45-49' &&
      body.partnerAge !== '50-59' && body.partnerAge !== '60+' && body.partnerAge !== 'Any') {
      this.validationError.partnerAge = true;
      this.warningMessage = "Please select a valid age group"
      return false;
    }
    if (body.partnerCountry === "") {
      this.validationError.partnerCountry = true;
      this.warningMessage = "Please select a valid country"
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
    this.myCountry = data.country_name;
    this.partnerCountry = data.country_name;
  }

  isNull(n: any): boolean {
    return n === null;
  }

}
