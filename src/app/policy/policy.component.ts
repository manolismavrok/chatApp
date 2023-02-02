import { Component, OnInit } from '@angular/core';
import { FooterService } from '../footer/footer.service';
import { HeaderService } from '../header/header.service';

@Component({
  selector: 'app-policy',
  templateUrl: './policy.component.html',
  styleUrls: ['./policy.component.css']
})
export class PolicyComponent implements OnInit {

  constructor(private headerService: HeaderService, public footerService: FooterService) {
    this.headerService.rotate();
  }

  ngOnInit(): void {
  }

}
