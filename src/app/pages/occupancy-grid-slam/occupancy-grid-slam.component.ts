import { AfterViewInit, Component } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';

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

  /* Used for the control of the tick loop */
  running = false;
  hasStarted = false;
  moved = false;
  stop = false;
  pathPlanning = false;
  followingPath = false;

  obstacles: Obstacle[] = [];  // a list of obstacle objects, Obstacle[]
  numObstacles = 40; // number of obstacles
  obstacleSizeRange = [0.5, 2.5];  // range of obstacle size
  obstacleSegments = [];  // a list of all segments of all obstacles, Obstacle[][]

  gridWidth = 0;
  gridHeight = 0;
  occupancyGrid = [];

  lastFrameTime: number;

  pixelsPerMeter = 0; //Pixels per meter
  worldWidth = 0;  // world width in meters
  worldHeight = 0; // world height in meter
  worldMaxX = 0;  // the maximum x coordinate shown in the world
  worldMaxY = 0;  // the maximum y coordinate shown in the world

  robotRadius = 0.2;
  robotMarkerTriangleAngle = 30 * (Math.PI / 180);  // the front angle of the triangular robot marker
  robotTurnRate = 120 * (Math.PI / 180);  // robot turn rate, in radians per second
  robotSpeed = 1.0;  // robot speed m/s

  worldWallInnerOffset = 1; //Given in pixels.

  robotPose: Pose;
  estRobotPose: Pose;

  robotPath = [];  // number[][]
  robotEstPath = [];

  path = [];
  currentPathIdx: number;

  worldCtx: CanvasRenderingContext2D;  // canvas drawing context of the world canvas
  mapCtx: CanvasRenderingContext2D;  // canvas drawing context of the map context

  keyStates = {};  // status of each (keyboard) key

  cellWidth = 0.1;  // width of each occupancy grid cell

  keyupSubscription: Subscription;
  keydownSubscription: Subscription;

  constructor() {}

  ngAfterViewInit(): void {
    requestAnimationFrame(() => { this.setup() });
  }

  startButtonClick(): void {
    this.addKeyPressSubscriber();
    if (!this.running && !this.hasStarted && !this.pathPlanning) {
      // start for the first time
      this.reset();
      this.running = true;
      this.hasStarted = true;
      this.lastFrameTime = null;
      this.tick(); // This is the actual loop function. You only need to call it once -- it will keep calling itself as appropriate
    }
    else if (!this.running && !this.pathPlanning && this.hasStarted) {
      // if we aren't running, but we have started yet, resume where we left off
      this.running = true;
      this.lastFrameTime = null;
      this.tick();
    }
  }

  pauseButtonClicK() {

  }

  newWorldButtonClick() {
    this.addKeyPressSubscriber();
    if (!this.running) {
      // if aren't currently running, generate a new world and reset
      this.hasStarted = false;
      this.moved = false;
      this.clearWorld();
      this.generateWorld();
      this.reset();
    }
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
   * The function where all happens
   */
  private tick(): void {
    if (this.stop) {
      this.running = false;
      this.stop = false;
      return;
    }

    if (!this.lastFrameTime) {
      this.lastFrameTime = this.getTimeMS();
    }

    var dt = this.getTimeMS() - this.lastFrameTime;
    this.lastFrameTime += dt;

    let lastRobotPose = JSON.parse(JSON.stringify(this.robotPose));
    if (this.followingPath) {
      this.robotPose.pos = this.gridIdxToXY(this.path[this.currentPathIdx][0], this.path[this.currentPathIdx][1]);
      --this.currentPathIdx;
      if (this.currentPathIdx == 0) {
        this.followingPath = false;
        this.path = [];
        this.currentPathIdx = null;
      }
      this.moved = true;
    }
    else {
      this.updateRobotPos(dt);
    }

    if (this.moved) {
      let dPos = [
        this.robotPose.pos[0] - lastRobotPose.pos[0],
        this.robotPose.pos[1] - lastRobotPose.pos[1]
      ];
      let dOrien = this.robotPose.orien - lastRobotPose.orien;
    }
    else {
      this.estRobotPose = this.robotPose;
    }

    this.drawFrame();

    if (this.moved) {
      this.robotPath.push(this.robotPose.pos.slice());
      this.robotEstPath.push(this.estRobotPose.pos.slice());
    }

    requestAnimationFrame(() => { this.tick(); });
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
   * Clear canvas context
   * @param ctx 
   */
  private clearCanvas(ctx: CanvasRenderingContext2D): void {
    let tf = ctx.getTransform();  // get the current transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset the transformation
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(tf);  // restorte the previous transformation
  }

  /**
   * Clear obstacles in the world
   */
  private clearWorld(): void {
    this.obstacles = [];
    this.obstacleSegments = [];
  }

  //#region Init world & map

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

  //#endregion

  private reset(): void {
    let lidarDistances = [];
    let lidarEnds = [];
    this.robotPose = new Pose([0, 0], 0);
    this.estRobotPose = this.robotPose;
    
    this.constructGrid();
    //resetParticleFilter();

    this.robotPath = [];
    this.robotEstPath = [];
    this.robotPath.push(this.robotPose.pos.slice());
    this.robotEstPath.push(this.estRobotPose.pos.slice());

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

    // draw the robot on to the world
    this.drawRobotPath(this.worldCtx, this.robotPath);
    this.drawRobot(this.worldCtx, this.robotPose);
  }

  /**
   * Draw robot (circle with a filled triangle)
   * @param ctx canvas content
   * @param pose robot pose
   */
  private drawRobot(ctx: CanvasRenderingContext2D, pose: Pose): void {
    // draw the outer circle
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    // we initially move to a positin on the circle itself (draw a circle)
    ctx.moveTo(pose.pos[0] + this.robotRadius, pose.pos[1]);
    ctx.arc(pose.pos[0], pose.pos[1], this.robotRadius, 0, 2 * Math.PI, true);
    ctx.stroke();
    // draw a triangle showing orientation
    // first compute the coordinates of the three points
    let dx = this.robotRadius * Math.cos(pose.orien);
    let dy = this.robotRadius * Math.sin(pose.orien);
    let front = [pose.pos[0] + dx, pose.pos[1] + dy];

    let backLeftAngle = pose.orien + Math.PI - this.robotMarkerTriangleAngle;
    dx = this.robotRadius * Math.cos(backLeftAngle);
    dy = this.robotRadius * Math.sin(backLeftAngle);
    let backLeft = [pose.pos[0] + dx, pose.pos[1] + dy];

    let backRightAngle = pose.orien + Math.PI + this.robotMarkerTriangleAngle;
    dx = this.robotRadius * Math.cos(backRightAngle);
    dy = this.robotRadius * Math.sin(backRightAngle);
    let backRight = [pose.pos[0] + dx, pose.pos[1] + dy];

    ctx.beginPath();
    ctx.moveTo(front[0], front[1]);
    ctx.lineTo(backLeft[0], backLeft[1]);
    ctx.lineTo(backRight[0], backRight[1]);
    ctx.lineTo(front[0], front[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.fill();
  }

  /**
   * 
   * @param ctx canvas content
   * @param path robot path
   * @param color path color
   */
  private drawRobotPath(ctx: CanvasRenderingContext2D, path: number[][], color: string = 'blue') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i][0], path[i][1]);
    }
    ctx.stroke();
  }

  /**
   * Run in every tick loop, based on the keys that are being pressed
   * @param dt 
   */
  private updateRobotPos(dt: number) {
    let upKey = 87; // W
    let leftKey = 65; // A
    let downKey = 83;  // S
    let rightKey = 68;  // D

    let orienChange = 0;
    let posChange = [0, 0];

    let ds = dt / 1000;  // change time in seconds

    // key are undefined before first pressed
    // handle orientation change
    if ((!!this.keyStates[leftKey]) && !this.keyStates[rightKey]) {
      // turning left and not right
      orienChange = ds * this.robotTurnRate;
      this.robotPose.orien += orienChange;
    }
    else if (!this.keyStates[leftKey] && (!!this.keyStates[rightKey])) {
      // turning right and not left
      orienChange = ds * this.robotTurnRate * -1;
      this.robotPose.orien += orienChange;
    }

    // handle position change
    if((!!this.keyStates[upKey]) && !this.keyStates[downKey]) {
      // go forward
      let dx = ds * this.robotSpeed * Math.cos(this.robotPose.orien);
      let dy = ds * this.robotSpeed * Math.sin(this.robotPose.orien);
      let newPos = [
        this.robotPose.pos[0] + dx,
        this.robotPose.pos[1] + dy
      ];
      if (!this.isColliding(newPos)) {
        // if not driving into a wall or off the map, update the position
        posChange = [dx, dy];
      }
    }
    else if (!this.keyStates[upKey] && (!!this.keyStates[downKey])) {
      // go backward
      let dx = ds * this.robotSpeed * Math.cos(this.robotPose.orien) * -1;
      let dy = ds * this.robotSpeed * Math.sin(this.robotPose.orien) * -1;
      let newPos = [
        this.robotPose.pos[0] + dx,
        this.robotPose.pos[1] + dy
      ];
      if (!this.isColliding(newPos)) {
        // if not driving into a wall or off the map, update the position
        posChange = [dx, dy];
      }
    }

    this.robotPose.pos[0] += posChange[0];
    this.robotPose.pos[1] += posChange[1];
    if (!this.moved) {
      if (posChange[0] != 0 || posChange[1] != 0 || orienChange != 0) {
        this.moved = true;
      }
    }
  }

  /**
   * If robot is colliding with obstacles
   * Check current position is inside the obstacle segements
   * @param pos coordinate [x, y]
   */
  private isColliding(pos: number[]): boolean {
    for (let i = 0; i < this.obstacleSegments.length; i++) {
      if (this.lineCircleCollisionTest(this.obstacleSegments[i], pos, this.robotRadius)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate if robot bump into obstacle
   * @param line obstacle positions
   * @param circleCenter circle center position
   * @param radius 
   */
  private lineCircleCollisionTest(line: Obstacle[], circleCenter: number[], radius: number): boolean {
    // https://stackoverflow.com/a/37225895/
    let v1 = [0, 0];
    let v2 = [0, 0];
    let v3 = [0, 0];
    v1[0] = line[1][0] - line[0][0];
    v1[1] = line[1][1] - line[0][1];
    v2[0] = circleCenter[0] - line[0][0];
    v2[1] = circleCenter[1] - line[0][1];
    let u = (v2[0] * v1[0] + v2[1] * v1[1]) / (v1[1] * v1[1] + v1[0] * v1[0]);  // unit dist of point on line
    if (u >= 0 && u <= 1) {
      v3[0] = (v1[0] * u + line[0][0]) - circleCenter[0];
      v3[1] = (v1[1] * u + line[0][1]) - circleCenter[1];
      v3[0] *= v3[0];
      v3[1] *= v3[1];
      return Math.sqrt(v3[1] + v3[0]) < radius;  // return distance from line
    }
    // get distance from end point
    v3[0] = circleCenter[0] - line[1][0];
    v3[1] = circleCenter[1] - line[1][1];
    v3[0] *= v3[0];
    v3[1] *= v3[1];
    v2[0] *= v2[0];
    v2[1] *= v2[1];
    return Math.min(Math.sqrt(v2[1] + v2[0]), Math.sqrt(v3[1] + v3[0])) < radius;  // return smaller of two distances as the result
  }

  //#region Key press subscriber

  /**
   * Subscribe keyup and key down event
   */
  private addKeyPressSubscriber(): void {
    this.keyupSubscription = fromEvent(document, 'keyup').subscribe((keyEvent: KeyboardEvent) => {
      this.keyupHandler(keyEvent);
    });
    this.keydownSubscription = fromEvent(document, 'keydown').subscribe((keyEvent: KeyboardEvent) => {
      this.keydownHandler(keyEvent);
    });
  }

  /**
   * Unsubscribe key press event
   */
  private removeKeyPressSubscriber(): void {
    this.keyupSubscription.unsubscribe();
    this.keydownSubscription.unsubscribe();
  }

  private keyupHandler(event: KeyboardEvent) {
    let keyId = event.which;  // which = keyCode
    this.keyStates[keyId] = false;
  }

  private keydownHandler(event: KeyboardEvent) {
    let keyId = event.which;
    this.keyStates[keyId] = true;
  }

  //#endregion

  private getTimeMS(): number {
    return (new Date()).getTime();
  }

  /**
   * Calculate [x, y] coordinate according to grid position [i, j]
   * @param i 
   * @param j 
   * @returns 
   */
  private gridIdxToXY(i: number, j: number): number[] {
    let x = (j - ((this.gridWidth - 1) / 2) * this.cellWidth);
    let y = (((this.gridHeight - 1) / 2) - i) * this.cellWidth;
    return [x, y];
  }

}


export class Pose {
  pos: number[];
  orien: number;

  constructor(pos: number[], orien: number) {
    this.pos = pos;
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