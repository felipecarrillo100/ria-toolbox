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
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {ModifierType} from "@luciad/ria/view/input/ModifierType.js";
import {Map} from "@luciad/ria/view/Map.js";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {LookFromZoomAnimation} from "./animation/LookFromZoomAnimaton.js";

export interface LookFromZoomControllerOptions {
  minFOVy?: number;
  maxFOVy?: number;
  animated?: boolean;
}

const DEFAULT_MIN_FOVY = 3;
const DEFAULT_MAX_FOVY = 100;
const ZOOM_PRECISION_MODIFIER = 0.1; //zoom speed multiplier when SHIFT is held down
const BASE_ZOOM_FACTOR = 2.0;

const isZoomAnimationRunning = (map: Map): boolean => {
  return AnimationManager.getAnimation(map.cameraAnimationKey) instanceof LookFromZoomAnimation;
};

/**
 * Base class for touch and mouse lookfrom zoom controllers.
 */
abstract class LookFromZoomController extends Controller {

  private readonly _minFOV: number;
  private readonly _maxFOV: number;
  private readonly _animated: boolean;

  protected constructor(options?: LookFromZoomControllerOptions) {
    super();
    options = options || {};
    this._minFOV = typeof options.minFOVy !== "undefined" ? options.minFOVy : DEFAULT_MIN_FOVY;
    this._maxFOV = typeof options.maxFOVy !== "undefined" ? options.maxFOVy : DEFAULT_MAX_FOVY;
    this._animated = typeof options.animated !== "undefined" ? options.animated : true;
  }

  abstract shouldHandleEvent(gestureEvent: GestureEvent): boolean;

  abstract determineTargetFovY(gestureEvent: GestureEvent): number;

  onGestureEvent(gestureEvent: GestureEvent): HandleEventResult {
    if (!this.map || !(this.map.camera instanceof PerspectiveCamera)) {
      return HandleEventResult.EVENT_IGNORED;
    }

    if (this.shouldHandleEvent(gestureEvent)) {
      const targetFOVy = this.determineTargetFovY(gestureEvent);
      if (targetFOVy) {
        const fovY = clamp(targetFOVy, this._minFOV, this._maxFOV);
        const anim = new LookFromZoomAnimation(this.map, fovY, gestureEvent.viewPoint);
        if (this._animated) {
          AnimationManager.putAnimation(this.map.cameraAnimationKey, anim, false).catch(() => {
          });
        } else {
          anim.onStart();
          anim.update(1.0);
          anim.onStop();
        }
      }
      return HandleEventResult.EVENT_HANDLED;
    }
    return HandleEventResult.EVENT_IGNORED;
  }

  onDeactivate(map: Map): Promise<any> | any {
    if (isZoomAnimationRunning(map)) {
      AnimationManager.removeAnimation(map.cameraAnimationKey);
    }
    return super.onDeactivate(map);
  }
}

/**
 * Zoom controller that keeps the camera fixed in one point and zooms by changing field-of-view.
 * This one handles mouse input (scroll wheel).
 */
export class LookFromZoomMouseController extends LookFromZoomController {

  private _scrollAmountInThisZoom: number;
  private _zoomFactor: number;
  private _startFOVy: number;
  private _targetFOVy: number;

  constructor(options?: LookFromZoomControllerOptions) {
    super(options);
    this._zoomFactor = 0;
    this._startFOVy = 0;
    this._targetFOVy = 0;
    this._scrollAmountInThisZoom = 0;
  }

  shouldHandleEvent(gestureEvent: GestureEvent): boolean {
    return gestureEvent.type === GestureEventType.SCROLL;
  }

  determineTargetFovY(event: GestureEvent): number {
    let scrollAmount = -(event as any).amount;
    scrollAmount *= event.modifier === ModifierType.SHIFT ? ZOOM_PRECISION_MODIFIER : 1.0;
    if (!this.map || !(this.map.camera instanceof PerspectiveCamera) || scrollAmount == 0) {
      return 0;
    }
    const switchedFromZoomInToZoomOut = !((this._zoomFactor >= 1.0 && scrollAmount > 0) ||
                                          (this._zoomFactor <= 1.0 && scrollAmount < 0));
    const zoomAnimRunning = isZoomAnimationRunning(this.map);
    const wasZoomingInThisDirection = zoomAnimRunning && !switchedFromZoomInToZoomOut;
    if (wasZoomingInThisDirection) {
      this._scrollAmountInThisZoom += scrollAmount;
    } else {
      this._startFOVy = (this.map.camera as PerspectiveCamera).fovY;
      this._scrollAmountInThisZoom = scrollAmount;
    }
    this._zoomFactor = Math.pow(BASE_ZOOM_FACTOR, this._scrollAmountInThisZoom);
    return this._startFOVy * this._zoomFactor;
  }
}

/**
 * Zoom controller that keeps the camera fixed in one point and zooms by changing field-of-view.
 * This one handles touch input (pinch gesture).
 */
export class LookFromZoomTouchController extends LookFromZoomController {

  _startFOVy: number | null;

  constructor(options?: LookFromZoomControllerOptions) {
    super(options);
    this._startFOVy = null;
  }

  shouldHandleEvent(gestureEvent: GestureEvent): boolean {
    return gestureEvent.type === GestureEventType.PINCH || gestureEvent.type === GestureEventType.PINCH_END;
  }

  determineTargetFovY(gestureEvent: GestureEvent): number {
    if (!this.map || !(this.map.camera instanceof PerspectiveCamera)) {
      return 0;
    }
    if (gestureEvent.type === GestureEventType.PINCH_END) {
      this._startFOVy = null;
      return 0;
    } else {
      if (this._startFOVy === null) {
        this._startFOVy = (this.map.camera as PerspectiveCamera).fovY;
      }
    }
    return this._startFOVy / (gestureEvent as any).scaleFactorFromStart;
  }
}