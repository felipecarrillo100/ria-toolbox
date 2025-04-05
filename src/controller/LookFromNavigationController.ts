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
import {Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {CompositeController} from "@luciad/ria/view/controller/CompositeController.js";
import {LookFromPanController} from "./LookFromPanController.js";
import {LookFromZoomMouseController, LookFromZoomTouchController} from "./LookFromZoomController.js";

/**
 * Constructor options for a LookFromNavigationController
 */
export interface LookFromNavigationControllerConstructorOptions {
  /**
   * The minimum fov for zooming. The controller will not allow zooming in beyond this point.
   */
  minFOVy?: number;
  /**
   * The maximum fov for zooming. The controller will not allow zooming out beyond this point.
   */
  maxFOVy?: number;

  /**
   * Enable or disable this controller. Useful when chaining this controller with other controllers, as the
   * controller can be active on the map / controller chain, but still be disabled.
   */
  enabled?: boolean;
}

export const ENABLED_CHANGE_EVENT = "EnabledChanged";

/**
 * A controller intended to be used for navigation that keeps the camera at a fixed location, for example with panoramas.
 * The controller keeps the camera locked in the sensor position.
 * Dragging the mouse / finger, pans the camera around the fixed location (changes view direction).
 * Scrolling the mouse / pinching your fingers zooms the camera to the mouse location (or the location between your fingers).
 */
export class LookFromNavigationController extends CompositeController {

  private _enabled: boolean;
  private readonly _zoomMouseController: LookFromZoomMouseController;
  private readonly _eventedSupport: EventedSupport;

  constructor(options?: LookFromNavigationControllerConstructorOptions) {
    super();
    options = options || {};
    this._eventedSupport = new EventedSupport([ENABLED_CHANGE_EVENT]);
    const panController = new LookFromPanController();
    const zoomTouchController = new LookFromZoomTouchController({animated: false, ...options});
    this._zoomMouseController = new LookFromZoomMouseController(options);
    this.appendController(panController);
    this.appendController(zoomTouchController);
    this.appendController(this._zoomMouseController);
    this._enabled = typeof options.enabled !== "undefined" ? options.enabled : true;
  }

  onKeyEvent(keyEvent: KeyEvent): HandleEventResult {
    if (!this._enabled) {
      return EVENT_IGNORED;
    }
    return super.onKeyEvent(keyEvent);
  }

  onGestureEvent(gestureEvent: GestureEvent): HandleEventResult {
    if (!this._enabled) {
      return EVENT_IGNORED;
    }
    return super.onGestureEvent(gestureEvent);
  }

  onDraw(geoCanvas: GeoCanvas): void {
    if (!this._enabled) {
      return;
    }
    return super.onDraw(geoCanvas);
  }

  onDrawLabel(labelCanvas: LabelCanvas): void {
    if (!this._enabled) {
      return;
    }
    return super.onDrawLabel(labelCanvas);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    if (this._enabled != enabled) {
      this._enabled = enabled;
      this.invalidate();
      this._eventedSupport.emit(ENABLED_CHANGE_EVENT, enabled);
    }
  }

  on(event: "Invalidated" | "Activated" | "Deactivated" | typeof ENABLED_CHANGE_EVENT,
     callback: (...args: any[]) => void, context?: any): Handle {
    if (event === ENABLED_CHANGE_EVENT) {
      return this._eventedSupport.on(event, callback, context);
    } else if (event === "Activated") {
      return super.on(event, callback, context);
    } else if (event === "Deactivated") {
      return super.on(event, callback, context);
    }
    return super.on(event, callback, context);
  }

}