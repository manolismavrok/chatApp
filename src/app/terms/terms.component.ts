import { Component, OnInit } from '@angular/core';
import { FooterService } from '../footer/footer.service';
import { HeaderService } from '../header/header.service';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.component.html',
  styleUrls: ['./terms.component.css']
})
export class TermsComponent implements OnInit {

  constructor(private headerService: HeaderService, public footerService: FooterService) {
    this.headerService.rotate();
  }

  ngOnInit(): void {
  }

}
