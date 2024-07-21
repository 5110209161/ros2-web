import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OccupancyGridSlamComponent } from './occupancy-grid-slam.component';

describe('OccupancyGridSlamComponent', () => {
  let component: OccupancyGridSlamComponent;
  let fixture: ComponentFixture<OccupancyGridSlamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OccupancyGridSlamComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OccupancyGridSlamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
