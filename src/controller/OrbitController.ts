/*
 *
 * Copyright (c) 1999-2025 Luciad All Rights Reserved.
 *
 * Luciad grants you ("Licensee") a non-exclusive, royalty free, license to use,
 * modify and redistribute this software in source and binary code form,
 * provided that i) this copyright notice and license appear on all copies of
 * the software; and ii) Licensee does not utilize the software in a manner
 * which is disparaging to Luciad.
 *
 * This software is provided "AS IS," without a warranty of any kind. ALL
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING ANY
 * IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
 * NON-INFRINGEMENT, ARE HEREBY EXCLUDED. LUCIAD AND ITS LICENSORS SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING
 * OR DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES. IN NO EVENT WILL LUCIAD OR ITS
 * LICENSORS BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT,
 * INDIRECT, SPECIAL, CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER
 * CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF THE USE OF
 * OR INABILITY TO USE SOFTWARE, EVEN IF LUCIAD HAS BEEN ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGES.
 */
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Animation} from "@luciad/ria/view/animation/Animation.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {PinchEvent} from "@luciad/ria/view/input/PinchEvent.js";
import {ScrollEvent} from "@luciad/ria/view/input/ScrollEvent.js";
import {Map} from "@luciad/ria/view/Map.js";

export interface OrbitControllerConstructorOptions {
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  pitch?: number;
  yaw?: number;
  mouseVerticalScaling?: number;
  mouseHorizontalScaling?: number;
  mouseWheelScaling?: number;
}

/**
 * An OrbitController is a controller that allows you to look at a specified point, and rotate around it.
 * <p/>
 * The center point is always at the center of the map.
 * <p/>
 * You can change the center point at any time, for example when tracking a moving object.
 */
export class OrbitController extends Controller {
  private readonly _autoRotate: boolean;
  private readonly _autoRotateSpeed: number;
  private readonly _initialDistance: number;
  private readonly _minDistance: number;
  private readonly _maxDistance: number;
  private readonly _pitch: number;
  private readonly _yaw: number;
  private readonly _damping: number;
  private readonly _mouseVerticalScaling: number;
  private readonly _mouseHorizontalScaling: number;
  private readonly _mouseWheelScaling: number;

  private _centerPoint: Point;
  private _animation: null | OrbitAnimation;
  private _mouseStartX: number | null;
  private _mouseStartY: number | null;

  /**
   * Creates an OrbitController, with the specified arguments. An OrbitController is a controller that
   * allows you to look at a specified point, and rotate around it. The center point is always at the center of the map.
   * @param centerPoint The center point of rotation. This is the only mandatory parameter.
   * @param options An object literal with some optional parameters
   *        options.autoRotate A boolean that indicates whether this controller should automatically rotate when idle. Defaults to false.
   *        options.autoRotateSpeed A number to indicate the speed at which auto-rotation should occur. This number is expressed as a fixed radial acceleration around the yaw.
   *        options.distance The initial distance (in meters) of the camera from the centerPoint.
   *        options.minDistance The minimum distance (in meters) of the camera from the centerPoint.
   *        options.maxDistance The maximum distance (in meters) of the camera from the centerPoint.
   *        options.mouseVerticalScaling The scaling applied to vertical mouse motions when tilting the controller.
   *        options.mouseHorizontalScaling The scaling applied to horizontal mouse motions when rotating the controller.
   *        options.mouseWheelScaling The scaling applied to mouse wheel events when zooming in the dataset.
   * @constructor
   */
  constructor(centerPoint: Point, options: OrbitControllerConstructorOptions) {
    super();
    if (!centerPoint) {
      throw new Error('Need to specify a centerPoint for OrbitController');
    }
    const parameters = options || {};
    this._autoRotate = parameters.autoRotate || false;
    this._autoRotateSpeed = parameters.autoRotateSpeed || 30;
    this._initialDistance = parameters.distance || 200;
    this._minDistance = parameters.minDistance || 10;
    this._maxDistance = parameters.maxDistance || 10000;
    this._pitch = parameters.pitch || -20;
    this._yaw = parameters.yaw || 0;
    this._centerPoint = centerPoint;
    this._damping = 0.88;
    this._mouseVerticalScaling = parameters.mouseVerticalScaling || 30;
    this._mouseHorizontalScaling = parameters.mouseHorizontalScaling || 120;
    this._mouseWheelScaling = parameters.mouseWheelScaling || 6000;

    this._animation = null;
    this._mouseStartX = null;
    this._mouseStartY = null;
  }

  get initialDistance(): number {
    return this._initialDistance;
  }

  get damping(): number {
    return this._damping;
  }

  get autoRotateSpeed(): number {
    return this._autoRotateSpeed;
  }

  get autoRotate(): boolean {
    return this._autoRotate;
  }

  get centerPoint(): Point {
    return this._centerPoint;
  }

  set centerPoint(value: Point) {
    this._centerPoint = createTransformation(value.reference!, this._centerPoint.reference!).transform(value);
    this._animation?.update();
  }

  get maxDistance(): number {
    return this._maxDistance;
  }

  get minDistance(): number {
    return this._minDistance;
  }

  onActivate(map: Map): void {
    super.onActivate(map);

    map.camera = map.camera.copyAndSet({
      near: map.camera instanceof PerspectiveCamera ? 0.3 : -this._maxDistance * 1.5,
      far: this._maxDistance * 1.5
    });

    const transformation = createTransformation(
        this._centerPoint.reference!,
        map.reference
    );
    this._centerPoint = transformation.transform(this._centerPoint);

    map.camera = map.camera.lookAt({
      ref: this._centerPoint,
      distance: this._initialDistance,
      yaw: this._yaw,
      pitch: this._pitch,
      roll: 0
    });

    this._animation = new OrbitAnimation(this);
    AnimationManager.putAnimation(map.cameraAnimationKey, this._animation, true);
  }

  onDeactivate(map: Map): void {
    super.onDeactivate(map);
    AnimationManager.removeAnimation(map.cameraAnimationKey);
    this._animation = null;
  }

  /**
   * The OrbitController handles DRAG, PINCH, DRAG_END and SCROLL events. These events
   * will cause the controller to orbit around the centerpoint, as well as zoom
   * in and out.
   * @param event The gesture event to handle
   * @returns Always returns HandleEventResult.EVENT_HANDLED to override all other interactions with the map.
   */
  onGestureEvent(event: GestureEvent): HandleEventResult {
    if (this._animation) {
      if (event.type === GestureEventType.DRAG) {
        const x = event.viewPosition[0];
        const y = event.viewPosition[1];
        if (this._mouseStartX === null || this._mouseStartY === null) {
          this._mouseStartX = x;
          this._mouseStartY = y;
        }
        const yawDelta = this._mouseHorizontalScaling * (x - this._mouseStartX);
        const pitchDelta = this._mouseVerticalScaling * (this._mouseStartY - y);
        this._animation.acceleration.yaw += yawDelta;
        this._animation.acceleration.pitch += pitchDelta;
        this._mouseStartX = x;
        this._mouseStartY = y;
      } else if (event.type === GestureEventType.DRAG_END) {
        this._mouseStartX = null;
        this._mouseStartY = null;
      } else if (event.type === GestureEventType.SCROLL) {
        const distanceDelta = -(event as unknown as ScrollEvent).amount * this._mouseWheelScaling;
        this._animation.acceleration.distance += distanceDelta;
      } else if (event.type === GestureEventType.PINCH) {
        let scaleFactor = (event as unknown as PinchEvent).scaleFactor;
        if (scaleFactor > 0 &&
            !isNaN(scaleFactor) &&
            !(scaleFactor === Number.POSITIVE_INFINITY || scaleFactor === Number.NEGATIVE_INFINITY)) {
          if (scaleFactor < 1.0) {
            scaleFactor = -1 / scaleFactor;
          }
          this._animation.acceleration.distance -= scaleFactor * this._mouseWheelScaling * 0.5;
        }
        return HandleEventResult.EVENT_HANDLED;
      }
    }
    return HandleEventResult.EVENT_HANDLED;
  }
}

/**
 * OrbitAnimation is an infinite animation that simulates inertia while orbiting around the
 * centerpoint in the OrbitController.
 * @constructor
 */
class OrbitAnimation extends Animation {

  private readonly _controller: OrbitController;

  private _previousTimeStamp: number;
  private _distance: number;
  private _velocity: { distance: number; pitch: number; yaw: number };
  private _acceleration: { distance: number; pitch: number; yaw: number };

  constructor(orbitController: OrbitController) {
    super(1000);
    this._controller = orbitController;
    this._previousTimeStamp = performance.now();
    this._distance = orbitController.initialDistance;
    this._velocity = {
      pitch: 0,
      yaw: 0,
      distance: 0
    };
    this._acceleration = {
      pitch: 0,
      yaw: 0,
      distance: 0
    };
  }

  get acceleration(): { distance: number; pitch: number; yaw: number } {
    return this._acceleration;
  }

  /**
   * Animates a single frame of this controller, using the internal acceleration and velocity values, and the
   * time that has passed since the previous invocation of this function.
   */
  update(): void {
    const orbitController = this._controller;
    const lookAtCamera = orbitController.map!.camera.asLookAt(this._distance);

    const timeDelta = (performance.now() - this._previousTimeStamp) / 1000;
    this._previousTimeStamp = performance.now();

    this._velocity.pitch += this._acceleration.pitch * timeDelta;
    this._velocity.yaw += this._acceleration.yaw * timeDelta;
    this._velocity.distance += this._acceleration.distance * timeDelta;

    this._velocity.pitch *= orbitController.damping * clamp(1 - timeDelta, 0, 1);
    this._velocity.yaw *= orbitController.damping * clamp(1 - timeDelta, 0, 1);
    this._velocity.distance *= orbitController.damping * clamp(1 - timeDelta, 0, 1);

    this._acceleration.pitch *= orbitController.damping * clamp(1 - timeDelta, 0, 1);
    this._acceleration.yaw *= orbitController.damping * clamp(1 - timeDelta, 0, 1);
    this._acceleration.distance *= orbitController.damping * clamp(1 - timeDelta, 0, 1);

    if (orbitController.autoRotate) {
      this._acceleration.yaw = orbitController.autoRotateSpeed;
    }

    this._distance = clamp(
        this._distance + this._velocity.distance * timeDelta,
        orbitController.minDistance,
        orbitController.maxDistance
    );

    orbitController.map!.camera = orbitController.map!.camera.lookAt({
      ref: orbitController.centerPoint,
      distance: this._distance,
      yaw: lookAtCamera.yaw + this._velocity.yaw * timeDelta,
      pitch: clamp(
          lookAtCamera.pitch + this._velocity.pitch * timeDelta, -75, -5
      ),
      roll: lookAtCamera.roll
    });
  }
}


