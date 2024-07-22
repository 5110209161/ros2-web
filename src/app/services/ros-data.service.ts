import { Injectable } from '@angular/core';
import { environment } from '../../environment/environment';
import * as ROSLIB from 'roslib';

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
}
