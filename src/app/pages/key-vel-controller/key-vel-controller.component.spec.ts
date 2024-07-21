import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyVelControllerComponent } from './key-vel-controller.component';

describe('KeyVelControllerComponent', () => {
  let component: KeyVelControllerComponent;
  let fixture: ComponentFixture<KeyVelControllerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyVelControllerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(KeyVelControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
