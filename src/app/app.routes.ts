import { Routes } from '@angular/router';
import { OccupancyGridSlamComponent } from './pages/occupancy-grid-slam/occupancy-grid-slam.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'occupancy-grid-slam',
    pathMatch: 'full'
  },
  {
    path: 'occupancy-grid-slam',
    component: OccupancyGridSlamComponent
  }
];
