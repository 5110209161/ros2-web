import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { fromEvent, Subject, Subscription } from 'rxjs';
import { RosDataService } from '../../services/ros-data.service';
import * as ROS2D from 'ros2d/build/ros2d';

@Component({
  selector: 'app-key-vel-controller',
  standalone: true,
  imports: [],
  templateUrl: './key-vel-controller.component.html',
  styleUrl: './key-vel-controller.component.scss'
})
export class KeyVelControllerComponent implements OnInit, OnDestroy, AfterViewInit {

  angularVelocity = 0;  // angular velocity of the robot
  linearVelocity = 0;  // linear velocity of the robot

  maxAngularVelocity = 1.0;  // max angular velocity
  maxLinearVelocity = 1.0;  // max linear velocity

  keyStates = {};  // status of each (keyboard) key

  robotTurnRate = 10 * (Math.PI / 180);  // robot turn rate, in radians per second
  robotMoveRate = 0.1; // robot move rate, in meters per second

  keyupSubscription: Subscription;
  keydownSubscription: Subscription;

  destroy$ = new Subject<void>();

  @ViewChild('canvas') private canvasRef: ElementRef;
  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  mousePosX: number = 0;
  mousePosY: number = 0;

  constructor(
    private rosDataService: RosDataService
  ) {}

  ngOnInit(): void {
    // this.addKeyPressSubscriber();
  }

  ngAfterViewInit(): void {
    const ctx = this.canvas.getContext('2d');
    let img = new Image();
    img.src = "/assets/zuljin.jpg";
    img.onload = () => {
      // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images
      // ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0, img.width, img.height);
      let pattern = ctx.createPattern(img, 'no-repeat');
      ctx.fillStyle = pattern;
    };
    this.canvas.addEventListener('mousemove', (e) => {
      let cRect = this.canvas.getBoundingClientRect();  // get width height
      this.mousePosX = Math.round(e.clientX - cRect.left);  // Subtract the 'left' of the canvas
      this.mousePosY = Math.round(e.clientY - cRect.top);   // from the X/Y positions to make  
    });

    // this.tick();
  }

  ngOnDestroy(): void {
    this.removeKeyPressSubscriber();

    this.destroy$.next();
    this.destroy$.complete();
  }

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

  private tick(): void {
    let dt = 1000 / 20;  // 20 frames per second
    this.keyVelController(dt);
    this.publishVelocities();
    requestAnimationFrame(() => { this.tick() });
  }

  /**
   * Run in every tick loop, based on the keys that are being pressed
   * @param dt 
   */
  private keyVelController(dt: number): void {
    let upKey = 87; // W
    let leftKey = 65; // A
    let downKey = 83;  // S
    let rightKey = 68;  // D

    let ds = dt / 1000;  // change time in seconds

    // handle angular velocity change
    if ((!!this.keyStates[leftKey]) && !this.keyStates[rightKey]) {
      // turning left and not right
      this.angularVelocity += ds * this.robotTurnRate;;
      if (this.angularVelocity >= this.maxAngularVelocity) {
        this.angularVelocity = this.maxAngularVelocity;
      }
    }
    else if (!this.keyStates[leftKey] && (!!this.keyStates[rightKey])) {
      // turning right and not left
      this.angularVelocity += ds * this.robotTurnRate * -1;
      if (this.angularVelocity <= -this.maxAngularVelocity) {
        this.angularVelocity = -this.maxAngularVelocity;
      }
    }

    // handle linear velocity change
    if((!!this.keyStates[upKey]) && !this.keyStates[downKey]) {
      // go forward
      this.linearVelocity += ds * this.robotMoveRate;
      if (this.linearVelocity >= this.maxLinearVelocity) {
        this.linearVelocity = this.maxLinearVelocity;
      }
    }
    
    if (!!this.keyStates[downKey]) {
      // stop
      this.linearVelocity = 0;
      this.angularVelocity = 0;
    }
  }

  private publishVelocities(): void {
    let twistedStampedVel = {
      header: {
        stamp: {
          sec: 0, nanosec: 0
        },
        frame_id: '',
      },
      twist: {
        linear: {
          x: this.linearVelocity, y: 0, z: 0
        },
        angular: {
          x: 0, y: 0, z: this.angularVelocity
        }
      }
    };
    this.rosDataService.publish('compositebot_controller/cmd_vel', 'geometry_msgs/msg/TwistStamped', twistedStampedVel);
  }

}
