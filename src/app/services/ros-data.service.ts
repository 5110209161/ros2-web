import { Injectable } from '@angular/core';
import { environment } from '../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class RosDataService {

  private rosServer;

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
   * @param divId 
   */
  viewRosMap(divId: string): void {
    let viewer = new ROS2D.Viewer({
      divID: divId,
      width: 800,
      height: 600
    });

    let gridClient = new ROS2D.OccupancyGridClient({
      ros: this.rosServer,
      rootObject: viewer.scene
    });

    gridClient.on('change', () => {
      viewer.scaleToDimensions(gridClient.currentGrid.width, gridClient.currentGrid.height);
      viewer.shift(gridClient.currentGrid.pose.position.x, gridClient.currentGrid.pose.position.y);
    });
  }
}
