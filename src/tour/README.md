# LuciadRIA Tour Tool

The Tour Tool provides support for managing a tour path.
It is responsible for creating and editing a tour path, animating the tour, and recording the tour for playback.

## Overview

The tool allows you to design a tour path, animate a journey along this path, and save the tour for future playback.
It offers options to control the animation's duration, speed, and looping mechanisms.
Additional features include locating the current tour position at any given moment,
pausing and resuming the animation, and adjusting these settings in real time.
With this tool you can showcase points of interest in a city, simulating flights for aviation, 
or creating any other geospatial tour scenarios.

## Limitation

- The tool solely supports WebGLMap instances with the EPSG:4978 reference.
- The tool has dependencies on the Player and Recorder tools, which have their own limitations.

## Usage

The following code snippet illustrates how to initiate a `PathSupport` instance and record a map animation:

```typescript
// Create a new support instance. A path layer instance is automatically added to the map's layer tree at the top.
const pathSupport = new TourPathSupport(webGLMapInstance);

// Set a tour path object to play
pathSupport.setTourPath(path);

// Set the tour total play duration to 15 seconds and make the path closed
pathSupport.setPathDuration(15_000);
pathSupport.setPathClosed(true);

// Start playing the active tour at a slower speed, in loop starting from at the middle of the path 
const player = pathSupport.tourPlayerSupport;
player.speedFactor = 0.8;
player.playInLoop = true;
player.fraction = 0.5;
player.play();

// Stop playback animation
player.stop();

// Start recording the active tour from the beginning
const recorder = recorder.tourRecorderSupport;
recorder.record();

```