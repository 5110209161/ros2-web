import { AfterViewInit, Component } from '@angular/core';

@Component({
  selector: 'app-occupancy-grid-slam',
  standalone: true,
  imports: [],
  templateUrl: './occupancy-grid-slam.component.html',
  styleUrl: './occupancy-grid-slam.component.scss'
})
export class OccupancyGridSlamComponent implements AfterViewInit {

  canvasSize = [0.45, 0.7];  // size of each canvas
  worldScale = 40;  // the width of the entire browser viewport
  canvasLineWidth = 0.015;

  obstacles: Obstacle[] = [];  // a list of obstacle objects, Obstacle[]
  numObstacles = 40; // number of obstacles
  obstacleSizeRange = [0.5, 2.5];  // range of obstacle size
  obstacleSegments = [];  // a list of all segments of all obstacles, Obstacle[][]

  gridWidth = 0;
  gridHeight = 0;
  occupancyGrid = [];

  pixelsPerMeter = 0; //Pixels per meter
  worldWidth = 0;  // world width in meters
  worldHeight = 0; // world height in meter
  worldMaxX = 0;  // the maximum x coordinate shown in the world
  worldMaxY = 0;  // the maximum y coordinate shown in the world

  robotRadius = 0.2;

  worldWallInnerOffset = 1; //Given in pixels.

  robotPose: Pose;
  estRobotPose: Pose;

  worldCtx: CanvasRenderingContext2D;  // canvas drawing context of the world canvas
  mapCtx: CanvasRenderingContext2D;  // canvas drawing context of the map context

  cellWidth = 0.1;  // width of each occupancy grid cell

  constructor() {}

  ngAfterViewInit(): void {
    requestAnimationFrame(() => { this.setup() });
  }

  startButtonClick(): void {

  }

  pauseButtonClicK() {

  }

  newWorldButtonClick() {

  }

  private setup(): void {
    // init canvas
    let worldCanvas = <HTMLCanvasElement>document.getElementById('worldCanvas');
    let mapCanvas = <HTMLCanvasElement>document.getElementById('mapCanvas');
    // set canvas size
    worldCanvas.setAttribute("width", String(window.innerWidth * this.canvasSize[0]) + "px");
    worldCanvas.setAttribute("height", String(window.innerHeight * this.canvasSize[1]) + "px");
    mapCanvas.setAttribute("width", String(window.innerWidth * this.canvasSize[0]) + "px");
    mapCanvas.setAttribute("height", String(window.innerHeight * this.canvasSize[1]) + "px");

    this.pixelsPerMeter = window.innerWidth / this.worldScale;
    this.worldWidth = this.canvasSize[0] * window.innerWidth / this.pixelsPerMeter;
    this.worldHeight = this.canvasSize[1] * window.innerHeight / this.pixelsPerMeter;
    this.worldMaxX = this.worldWidth / 2;
    this.worldMaxY = this.worldHeight / 2;

    // occupancy grid parameters
    this.gridWidth = Math.ceil(this.worldWidth / this.cellWidth);
    this.gridHeight = Math.ceil(this.worldHeight / this.cellWidth);
    if (this.gridHeight % 2 == 0) {
      this.gridHeight++;
    }
    if (this.gridWidth % 2 == 0) {
      this.gridWidth++;
    }

    // create the canvas contexts
    this.worldCtx = worldCanvas.getContext('2d');
    this.mapCtx = mapCanvas.getContext('2d');

    this.resetCtx(this.worldCtx);
    this.resetCtx(this.mapCtx);

    this.generateWorld();
    this.reset();
  }

  /**
   * Reset canvas context
   * @param ctx 
   */
  private resetCtx(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset transformation
    ctx.transform(1, 0, 0, -1, 0, 0);  // make y+ point up
    ctx.transform(1, 0, 0, 1, ctx.canvas.width / 2, -ctx.canvas.height / 2);  // center 0, 0 in the middle of the canvas
    ctx.transform(this.pixelsPerMeter, 0, 0, this.pixelsPerMeter, 0, 0);  // scale according browser scaling
    ctx.lineWidth = this.canvasLineWidth;  //set the appropriate line width
  }

  /**
   * Generate obstacles in the world
   */
  private generateWorld(): void {
    for (let i = 0; i < this.numObstacles; ++i) {
      this.obstacles.push(this.randomObstacle());
    }
    this.updateObstacleSegments();
  }

  /**
   * Generate an obstacle
   */
  private randomObstacle(): Obstacle {
    let width = (Math.random() * (this.obstacleSizeRange[1] - this.obstacleSizeRange[0])) + this.obstacleSizeRange[0];
    let pos = [null, null];
    do {
      pos[0] = Math.random() * this.worldWidth - this.worldMaxX;
      pos[1] = Math.random() * this.worldHeight - this.worldMaxY
    } while (
      pos[0] < this.robotRadius + width && pos[0] > this.robotRadius - width
      &&
      pos[1] < this.robotRadius + width && pos[1] > this.robotRadius - width
    );
    let orien = Math.random() * 2 + Math.PI;
    return new Obstacle(pos, orien, width);
  }

  private updateObstacleSegments(): void {
    this.obstacleSegments = [];
    for (let i = 0; i < this.numObstacles; i++) {
      let segments = this.obstacles[i].segments();
      for (let j = 0; j < segments.length; j++) {
        this.obstacleSegments.push(segments[j]);
      }
    }

    // add in the outer walls
    let wallBoundaryX = this.worldMaxX - (this.worldWallInnerOffset / this.pixelsPerMeter);
    let wallBoundaryY = this.worldMaxY - (this.worldWallInnerOffset / this.pixelsPerMeter);
    this.obstacleSegments.push([
      [wallBoundaryX, wallBoundaryY],
		  [wallBoundaryX, -1 * wallBoundaryY]
    ]);
    this.obstacleSegments.push([
      [wallBoundaryX, -1 * wallBoundaryY],
		  [-1 * wallBoundaryX, -1 * wallBoundaryY]
    ]);
    this.obstacleSegments.push([
      [-1 * wallBoundaryX, -1 * wallBoundaryY],
		  [-1 * wallBoundaryX, wallBoundaryY]
    ]);
    this.obstacleSegments.push([
      [-1 * wallBoundaryX, wallBoundaryY],
		  [wallBoundaryX, wallBoundaryY]
    ]);
  }

  private reset(): void {
    let lidarDistances = [];
    let lidarEnds = [];
    this.robotPose = new Pose([0, 0], 0);
    this.estRobotPose = this.robotPose;
    
    this.constructGrid();
    //resetParticleFilter();

    // this.robotPath = [];
    // this.robotEstPath = [];
    // this.robotPath.push(this.robotPose.pos.slice());
    // this.robotEstPath.push(this.estRobotPose.pos.slice());

    this.drawFrame();
  }

  private constructGrid(): void {
    this.occupancyGrid = [];
    for (let i = 0; i < this.gridHeight; i++) {
      this.occupancyGrid.push([]);
      for (let j = 0; j < this.gridWidth; j++) {
        this.occupancyGrid[i].push(0);
      }
    }
  }

  /**
   * Draw frame (obstacles, robot and grid)
   */
  private drawFrame(): void {
    this.clearCanvas(this.worldCtx);
    this.clearCanvas(this.mapCtx);

    // draw the obstacles onto the world
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].draw(this.worldCtx);
    }

    //TODO draw robot
  }

  /**
   * Clear canvas context
   * @param ctx 
   */
  private clearCanvas(ctx: CanvasRenderingContext2D): void {
    let tf = ctx.getTransform();  // get the current transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset the transformation
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(tf);  // restorte the previous transformation
  }

}


export class Pose {
  pose: number[];
  orien: number;

  constructor(pose: number[], orien: number) {
    this.pose = pose;
    this.orien = orien;
  }
}

export class Obstacle {
  pos = [];
  orien: number;
  width: number;

  constructor(pos: Pose[], orien: number, width: number) {
    this.pos = pos.slice();
    this.orien = orien;
    this.width = width;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    let segments = this.segments();
    ctx.strokeStyle = 'black';
    for (let i = 0; i < segments.length; i++) {
      ctx.beginPath();
      ctx.moveTo(segments[i][0][0], segments[i][0][1]);
			ctx.lineTo(segments[i][1][0], segments[i][1][1]);
			ctx.stroke();
    }
  }

  segments() {
    let corners = this.corners();
    let segments = [
      [corners[0], corners[1]],
			[corners[1], corners[2]],
			[corners[2], corners[3]],
			[corners[3], corners[0]]
    ];
    return segments;
  }

  corners() {
    let dx = 0.5 * this.width * Math.cos(this.orien);
    let dy = 0.5 * this.width * Math.sin(this.orien);
    let corners = [
      [this.pos[0] + dx, this.pos[1] + dy],
			[this.pos[0] + dy, this.pos[1] - dx],
			[this.pos[0] - dx, this.pos[1] - dy],
			[this.pos[0] - dy, this.pos[1] + dx]
    ];
    return corners;
  }
}