# LuciadRIA Scene Navigation tool

This package contains the `SceneNavigationController` API, along with its constituents which may be used to create your
own controller.

## Overview

The `SceneNavigationController` is a controller that allows you to look at 3D by panning, rotating and zooming in and
out. The `Gizmos` that are used to represent visually which gesture is currently being performed must be provided while
creating a `SceneNavigationController`.

Use of this controller allows the following interactions:
- Panning orthogonally to the camera's forward direction with left mouse drags or one finger touch drags
- Rotating around an anchor under your mouse with right mouse drags or two finger touch drags
- Rotating around the camera eye with left + right mouse drags or the normal rotation controls with ctrl pressed, or
  with normal rotation controls if `NavigationKeysMode.CAMERA_FORWARD` is set.
- Zooming in to and away from an anchor under your mouse with the scroll wheel or pinch gestures.
- Zooming in on a clicked point, when both `useZoomAnimations` and `allowZoomOnClick` are enabled.
- Move horizontally relative to the earth's surface with the arrow or WASD keys (or corresponding keys if you don't have
  a QWERTY keyboard) when using `NavigationKeysMode.TANGENT_FORWARD`, or relative to the camera's forward and right
  vector with `NavigationKeysMode.CAMERA_FORWARD`.
- Move vertically relative to the earth's surface with the Q and E keys (or corresponding keys if you don't have a
  QWERTY keyboard) when using `NavigationKeysMode.TANGENT_FORWARD`, or relative to the camera's up direction with
  `NavigationKeysMode.CAMERA_FORWARD`.

A `Bounds` object must be passed to create an instance of `SceneNavigationController`. The navigation gestures will
always be performed within these bounds, so it is highly recommended to provide bounds that are large enough to
encompass your entire 3D object, and a bit of margin to "move around in". You can think of this as a "room" in which you
put your 3D object; you want your room to be big enough so that you can walk around your 3D object, and come closer and
go further away as you please. Note that `Bounds` is mutable, so resizing the bounds passed to the controller
effectively resizes the space in which you can navigate.

For detailed API information, please refer to the `SceneNavigationController` file in the source code.

## Limitations

- The map's camera must be an instance of type `PerspectiveCamera`.

## Usage

Code below shows a typical use of the tool.

```js
// Retrieve a 3D layer from somewhere.
// const layer = ...

map.layerTree.addChild(layer);

// Declare the gizmos to use for the different navigation types.
const gizmos = {
   [NavigationType.ROTATION]: new NavigationGizmo("url/to/rotation-gizmo.glb"),
   [NavigationType.PAN]: new NavigationGizmo("url/to/pan-gizmo.glb"),
   [NavigationType.ZOOM]: new NavigationGizmo("url/to/zoom-gizmo.glb", { sizeInPixels: 40 })
};

// Create a controller with varying options.
const navigateController = new SceneNavigationController(gizmos, layer.model.bounds, {
  navigationMode: NavigationKeysMode.CAMERA_FORWARD, // navigate along camera paths
  defaultSpeed: 8, // ~28km/h
  allowZoomOnClick: true, // clicking on a spot zooms in on to that location by a set fraction
  useZoomAnimations: false, // don't use smooth animations when zooming or out
  fasterMultiplier: 2, // go two times as fast when shift is pressed
  slowerMultiplier: 0.5, // go only half as fast when space is pressed
});

map.defaultController = new DefaultController({ navigateController });
```

