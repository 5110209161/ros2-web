import { Injectable } from '@angular/core';
import { environment } from '../../environment/environment';
import * as createjs from 'createjs-module';

@Injectable({
  providedIn: 'root'
})
export class RosDataService {

  private rosServer;
  private viewer;
  private gridClient;

  constructor() { 
    this.rosServer = new ROSLIB.Ros({
      url: environment.wsEndpoint
    });

    this.rosServer.on('connection', () => {
      console.log('Connected to ROS websocket server');
    });

    this.rosServer.on('error', (error) => {
      console.log('Error connecting to ROS websocket server: ', error);
    });

    this.rosServer.on('close', () => {
      console.log('Disconnected from ROS websocket server');
    });
  }

  /**
   * Publish ROS topic
   * @param topic 
   * @param msgType 
   * @param msg 
   */
  publish(topic: string, msgType: string, msg: any): void {
    if (!this.rosServer) {
      throw Error('ROS server not connected');
    }
    
    const topicPublisher = new ROSLIB.Topic({
      ros: this.rosServer,
      name: topic,
      messageType: msgType
    });

    const message = new ROSLIB.Message(msg);
    topicPublisher.publish(message);
  }

  /**
   * Subscribe ROS topic
   * @param topic 
   * @param msgType 
   * @param callback 
   */
  subscribe(topic: string, msgType: string, callback: (msg: any) => void): void {
    if (!this.rosServer) {
      throw Error('ROS server not connected');
    }

    const topicSubscriber = new ROSLIB.Topic({
      ros: this.rosServer,
      name: topic,
      messageType: msgType
    });

    topicSubscriber.subscribe((message) => {
      callback(message);
    });
  }

  /**
   * Render ROS map
   * refer to: https://github.com/RobotWebTools/ros2djs/issues/39
   * @param divId 
   */
  viewRosMap(divId: string, width: number = 600, height: number = 400): void {
    if (!this.rosServer) {
      throw Error('ROS server not connected');
    }

    this.viewer = new ROS2D.Viewer({
      divID: divId,
      width: width,
      height: height
    });

    this.gridClient = new ROS2D.OccupancyGridClient({
      ros: this.rosServer,
      rootObject: this.viewer.scene,
      continuous: true  //Use this property in case of continuous updates
    });

    this.gridClient.on('change', () => {
      this.viewer.scaleToDimensions(this.gridClient.currentGrid.width, this.gridClient.currentGrid.height);
      this.viewer.shift(this.gridClient.currentGrid.pose.position.x, this.gridClient.currentGrid.pose.position.y);
    });

    let robotMarker = new ROS2D.NavigationArrow({
      size: 0.25,
      strokeSize: 0.05,
      pulse: true,
      fillColor: createjs.Graphics.getRGB(255, 0, 0, 0.65),
      strokeColor: createjs.Graphics.getRGB(255, 0, 0, 0.65)
    });

    let robotPosition = new ROSLIB.Topic({
      ros: this.rosServer,
      name: '/amcl_pose',
      messageType: 'geometry_msgs/PoseWithCovarianceStamped'
    });

    robotPosition.subscribe((pose) => {
      robotMarker.x = pose.pose.pose.position.x;
      robotMarker.y = -pose.pose.pose.position.y;
      let quaZ = pose.pose.pose.orientation.z;
      let degreeZ = 0;
      if (quaZ >= 0) {
        degreeZ = quaZ / 1 * 180;
      } else {
        degreeZ = (-quaZ / 1 * 180) + 180;
      }
      robotMarker.rotation = degreeZ;
    });

    this.gridClient.rootObject.addChild(robotMarker);
  }

  addWaypoint(x: any, y: any, z: any): void {
    if (!this.rosServer || !this.viewer) {
      throw Error('ROS server not connected or viewer not initialized');
    }

    let waypointMarker = new ROS2D.NavigationArrow({
      size: 0.1,
      strokeSize: 0.1,
      pulse: true,
      strokeColor : createjs.Graphics.getRGB(0, 0, 255),
      fillColor: createjs.Graphics.getRGB(0, 0, 255, 0.35)
    });

    waypointMarker.x = x;
    waypointMarker.y = -y;
    waypointMarker.rotation = z;
    this.gridClient.rootObject.addChild(waypointMarker);
  }
}
