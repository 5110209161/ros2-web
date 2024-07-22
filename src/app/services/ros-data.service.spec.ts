import { TestBed } from '@angular/core/testing';

import { RosDataService } from './ros-data.service';

describe('RosDataService', () => {
  let service: RosDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RosDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
