/**
 * dependencies for using ROS2D and ROSLIB, imported from assets
 * "easeljs": "^1.0.2",
 * "eventemitter2": "^6.4.9",
 * "ros2d": "^0.10.0",
 * "roslib": "^1.4.1",
 */

/**
 * for ros2djs, refer to: https://github.com/RobotWebTools/ros2djs/blob/develop/examples/map.html
 * update ros2d.js so to support ros2
 * refer to: https://answers.ros.org/question/397997/rosbridge_server-and-ros2djs-on-ros2-galactic-not-working-rosbridge_websocket-exception-calling-subscribe-callback-a-bytes-like-object-is-required-not/
 * 1. in ImageMapClient, change topic from /map_metadata to /map, change messageType to nav_msgs/OccupancyGrid
 * 2. in OccupancyGridClient, comment line of the parameter: compression: png
 */

declare var ROS2D: any; // declare ros2djs
declare var ROSLIB: any;  // declare roslibjs

