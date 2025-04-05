# LuciadRIA player/playback tool

This package contains the `PlayerSupport` API for managing advanced animations.

## Overview

The PlayerSupport tool is a LuciadRIA API designed to control the playback of animations.
It allows animations to start from any point in their timeline, and provides the ability to stop (pause), 
play at various speeds, or loop for repeated playbacks.
For a detailed API description, please refer to the `PlayerSupport` file in the source code.

## Usage

Here's how to create a new `PlayerSupport` instance and control the playback of an animation:

```typescript
// Create a new instance
const playerSupport = new PlayerSupport({
  updatable: myUpdatable,      // Responsible for updating the map when playing the animation
  duration: 5000,              // Animation duration in milliseconds
  speedFactor: 1.5,            // Speed up the animation
  playInLoop: true,            // Configure the animation to play in a loop
  animationKey: 'myAnimationKey'
});

// Set the animation fraction to start from 25% of the total duration
playerSupport.fraction = 0.25;

// Start playing the animation 
playerSupport.play();

// Change the speed factor while playing the animation
playerSupport.speedFactor = 0.5;

// Pause the animation
playerSupport.stop();

// Resume playing the animation 
playerSupport.play();

```