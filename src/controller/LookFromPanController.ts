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
import {Point} from "@luciad/ria/shape/Point.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {clamp, DEG2RAD, RAD2DEG} from "@luciad/ria-toolbox-core/util/Math.js";
import {InertiaAnimation} from "./animation/InertiaAnimation.js";
import {GestureSpeedTracker} from "./GestureSpeedTracker.js";

const INERTIA_DRAG_HISTORY_SIZE = 10;
const INERTIA_SPEED_MULTIPLIER = 0.5;
const INERTIA_MIN_SPEED = 40;
const INERTIA_DRAG_STOP_TIME_MOUSE = 25; // if the time between the last DRAG event and DRAG_END is less than this, inertia will kick in. If it's more (user stopped at the end of the drag), it won't kick in. Milliseconds.
const INERTIA_DRAG_STOP_TIME_TOUCH = 50; // DRAG_END fires significantly later for touch events

/**
 * Controller that pans the camera in "lookFrom" mode, with inertia
 */
export class LookFromPanController extends Controller {

  private _dragStartPosition: Point | null;
  private _dragSpeedTracker: GestureSpeedTracker;
  private _lastDragTime: number;
  private readonly _panCamera: (startX: number, startY: number, x: number, y: number) => void;
  private _dragStartYaw: number;
  private _dragStartPitch: number;

  constructor() {
    super();
    this._dragStartPosition = null;
    this._dragSpeedTracker = new GestureSpeedTracker(INERTIA_DRAG_HISTORY_SIZE);
    this._dragStartYaw = 0;
    this._dragStartPitch = 0;
    this._lastDragTime = 0;
    this._panCamera = (startX: number, startY: number, currX: number, currY: number): void => {
      if (!this.map || !(this.map.camera instanceof PerspectiveCamera)) {
        return;
      }
      const camera = this.map.camera;
      const cameraFovY = this.map.camera.fovY;
      const cameraFovX = 2 * RAD2DEG * Math.atan(Math.tan(cameraFovY / 2 * DEG2RAD) * camera.aspectRatio);
      const yawPerPixel = cameraFovX / this.map.viewSize[0];
      const pitchPerPixel = cameraFovY / this.map.viewSize[1];
      const lookFromCamera = camera.asLookFrom();
      const deltaYaw = yawPerPixel * (startX - currX);
      lookFromCamera.yaw = this._dragStartYaw + deltaYaw;
      const deltaPitch = pitchPerPixel * (currY - startY);
      lookFromCamera.pitch = clamp(this._dragStartPitch + deltaPitch, -89, 89);
      this.map.camera = camera.lookFrom(lookFromCamera);
    };
  }

  onGestureEvent(gestureEvent: GestureEvent): HandleEventResult {
    if (!this.map || !(this.map.camera instanceof PerspectiveCamera)) {
      return HandleEventResult.EVENT_IGNORED;
    }
    const viewPoint = gestureEvent.viewPoint;
    if (gestureEvent.type === GestureEventType.DRAG) {
      if (this._dragStartPosition === null) {
        AnimationManager.removeAnimation(this.map.cameraAnimationKey);
        this._dragStartPosition = viewPoint;
        this._dragSpeedTracker.reset();
        const lookFrom = this.map.camera.asLookFrom();
        this._dragStartYaw = lookFrom.yaw;
        this._dragStartPitch = lookFrom.pitch;
      }
      this._panCamera(this._dragStartPosition.x, this._dragStartPosition.y, viewPoint.x, viewPoint.y);
      this._dragSpeedTracker.track(gestureEvent);
      this._lastDragTime = performance.now();
      return HandleEventResult.EVENT_HANDLED;
    } else if (gestureEvent.type === GestureEventType.DRAG_END) {
      const dragStopTime = (performance.now() - this._lastDragTime);
      const maxDragStopTime = gestureEvent.inputType === "touch" ? INERTIA_DRAG_STOP_TIME_TOUCH
                                                                 : INERTIA_DRAG_STOP_TIME_MOUSE;
      const dragStopped = dragStopTime >= maxDragStopTime;
      const {speed, speedX, speedY} = this._dragSpeedTracker.getSpeed();
      if (!dragStopped && speed > INERTIA_MIN_SPEED) {
        const panInertiaAnimation = new InertiaAnimation(
            this._dragStartPosition!.x, this._dragStartPosition!.y,
            viewPoint.x, viewPoint.y,
            speedX * INERTIA_SPEED_MULTIPLIER, speedY * INERTIA_SPEED_MULTIPLIER,
            this._panCamera
        );
        AnimationManager.putAnimation(this.map.cameraAnimationKey, panInertiaAnimation, false).catch(() => undefined);
      }
      this._dragStartPosition = null;
    }
    return HandleEventResult.EVENT_IGNORED;
  }

}