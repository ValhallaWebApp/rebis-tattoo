import { TestBed } from '@angular/core/testing';

import { RewiesService } from './rewies.service';

describe('RewiesService', () => {
  let service: RewiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RewiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
