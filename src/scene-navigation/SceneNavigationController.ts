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
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {createTopocentricReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createBounds, createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {getNavigationType, getSpeedMultiplier, getZoomFactor, NavigationType} from "./GestureUtil.js";
import {PanSupport} from "./camera/PanSupport.js";
import {RotationSupport} from "./camera/RotationSupport.js";
import {ZoomSupport} from "./camera/ZoomSupport.js";
import {KeyNavigationSupport, NavigationKeysMode, NavigationKeysOptions} from "./KeyNavigationSupport.js";
import {AnchorSupport, Gizmos} from "./AnchorSupport.js";

/**
 * The factor applied to the scroll amount when zooming with the mouse wheel. Increase/decrease to exaggerate/downplay
 * the zooming distance.
 */
const SCROLL_ZOOM_MULTIPLIER = 0.12;

/**
 * The factor of the total distance between the camera and the anchor that should be flown forwards. Only applied when
 * performing flying zoom.
 */
const FRACTION_FLY_FORWARD = 0.75;

/**
 * The factor of the total distance between the camera and the anchor that should be flown backwards. Only applied when
 * performing flying zoom.
 */
const FRACTION_FLY_BACK = -0.9;

export interface SceneNavigationControllerOptions extends NavigationKeysOptions {
  /**
   * Whether zooming on click is allowed. Zooming on click only works when {@link useZoomAnimations} is `true`! False
   * by default.
   */
  allowZoomOnClick?: boolean;

  /**
   * Whether to use animations for zooming. False by default.
   */
  useZoomAnimations?: boolean;
}

/**
 * Navigation controller meant to look at 3D objects from close-by, while visualizing navigational anchor points with
 * 3D gizmos. Using this controller, users can interact with the map in the following ways:
 *
 * Use of this controller allows the following interactions:
 * - Panning orthogonally to the camera's forward direction with left mouse drags or one finger touch drags
 * - Rotating around an anchor under your mouse with right mouse drags or two finger touch drags
 * - Rotating around the camera eye with left + right mouse drags or the normal rotation controls with ctrl pressed, or
 *   with normal rotation controls if `NavigationKeysMode.CAMERA_FORWARD` is set.
 * - Zooming in to and away from an anchor under your mouse with the scroll wheel or pinch gestures.
 * - Zooming in on a clicked point, when both `useZoomAnimations` and `allowZoomOnClick` are enabled.
 * - Move horizontally relative to the earth's surface with the arrow or WASD keys (or corresponding keys if you don't
 *   have a QWERTY keyboard) when using `NavigationKeysMode.TANGENT_FORWARD`, or relative to the camera's forward and
 *   right vector with `NavigationKeysMode.CAMERA_FORWARD`.
 * - Move vertically relative to the earth's surface with the Q and E keys (or corresponding keys if you don't have a
 *   QWERTY keyboard) when using `NavigationKeysMode.TANGENT_FORWARD`, or relative to the camera's up direction with
 *   `NavigationKeysMode.CAMERA_FORWARD`.
 *
 * For zooming behaviour, one can set `useZoomAnimations` to `true` to smoothly animate the zooming by a predetermined
 * percentage as opposed to increments based on the zoom amount determined by the gesture (scroll wheel or pinch).
 *
 * This controller also guarantees that when it moves the camera, it will always stay in the given bounds. The center of
 * the given bounds is also used to calculate the interaction anchors if none could be found under or close to the mouse
 * position.
 *
 * Note that you _must_ specify a bounds to the constructor that is large enough to encompass the asset that you want
 * to navigate around in; if the bounds do not fit around your asset, you are not able to move around in the asset.
 *
 * When working with georeferenced data, note that the bounds should typically be in a topocentric reference, so that
 * they're aligned with the earth surface. This is unlike geocentric (EPSG:4978) bounds, which often stick slanted
 * through the surface. If you _do_ pass in geocentric bounds, these will automatically be converted to a topocentric
 * reference.
 *
 * This controller only works with a PerspectiveCamera.
 */
export class SceneNavigationController extends Controller {
  private readonly _bounds: Bounds;
  private readonly _gizmos: Gizmos;
  private readonly _panSupport: PanSupport;
  private readonly _rotationSupport: RotationSupport;
  private readonly _zoomSupport: ZoomSupport;
  private readonly _keySupport: KeyNavigationSupport;
  private readonly _allowedInteractions: NavigationType[];
  private readonly _useZoomAnimations: boolean;

  private _anchorSupport: AnchorSupport | null = null;
  private _navigationType: NavigationType = NavigationType.NONE;
  private _keyEnabled = true;

  constructor(
    gizmos: Gizmos,
    bounds: Bounds,
    {allowZoomOnClick = false, useZoomAnimations = false, ...keyNavigationSupportOptions}: SceneNavigationControllerOptions = {},
  ) {
    super();

    if (bounds.reference?.referenceType === ReferenceType.GEOCENTRIC) {
      // Geocentric bounds are not aligned to the earth surface and might give issues.
      // Switch to using topocentric navigation bounds
      const topoRef = createTopocentricReference({
        origin: bounds.focusPoint,
      });
      // include all 8 corners of the geocentric bounds in the new topocentric bounds
      const geocCorners = boundsCorners(bounds);
      const geoc2Topo = createTransformation(bounds.reference, topoRef);
      let topoBounds: Bounds | null = null;
      for (const geocCorner of geocCorners) {
        const topoCorner = geoc2Topo.transform(geocCorner);
        if (!topoBounds) {
          topoBounds = createBounds(topoRef, [topoCorner.x, 0, topoCorner.y, 0, topoCorner.z, 0]);
        } else {
          topoBounds.setToIncludePoint3D(topoCorner);
        }
      }
      if (topoBounds) {
        bounds = topoBounds;
      }
    }

    this._allowedInteractions = [
      NavigationType.ROTATION,
      NavigationType.FIRST_PERSON_ROTATION,
      NavigationType.PAN,
      NavigationType.ZOOM,
    ]
    if (allowZoomOnClick) {
      this._allowedInteractions.push(NavigationType.ZOOM_ON_CLICK);
    }

    this._useZoomAnimations = useZoomAnimations;
    this._panSupport = new PanSupport(bounds);
    this._rotationSupport = new RotationSupport(bounds);
    this._zoomSupport = new ZoomSupport(bounds);
    this._keySupport = new KeyNavigationSupport(bounds, keyNavigationSupportOptions);
    this._bounds = bounds;
    this._gizmos = gizmos;
  }

  /**
   * Whether this controller currently interprets key events.
   */
  get keyNavigationEnabled(): boolean {
    return this._keyEnabled;
  }

  set keyNavigationEnabled(enabled: boolean) {
    if (this._keyEnabled !== enabled && this.map) {
      if (enabled) {
        this._keySupport.activate(this.map);
      } else {
        this._keySupport.deactivate();
      }
    }
    this._keyEnabled = enabled;
  }

  override onActivate(map: WebGLMap) {
    super.onActivate(map);

    if (!(map.camera instanceof PerspectiveCamera)) {
      throw new Error("SceneNavigationController only works with a PerspectiveCamera");
    }

    this._anchorSupport = new AnchorSupport(map, this._bounds);
    this._keySupport.activate(map);
  }

  override onDeactivate(map: WebGLMap) {
    super.onDeactivate(map);
    this._keySupport.deactivate();
  }

  /**
   * If you want to draw on the canvas based on the current {@link NavigationType}, override
   * {@link onDrawNavigationType} instead!
   */
  override onDraw(geoCanvas: GeoCanvas) {
    this.onDrawNavigationType(geoCanvas, this._navigationType);
  }

  /**
   * Called whenever the controller is allowed to draw on the canvas. Gets passed the {@link NavigationType} that was
   * determined with the last call to {@link onGestureEvent}. By default, it determines the {@link NavigationGizmo}
   * based on that navigation type and draws it. Subclasses can override this to change this behaviour or draw
   * additional things based on the navigation type.
   */
  onDrawNavigationType(geoCanvas: GeoCanvas, navigationType: NavigationType) {
    const anchor = this._anchorSupport?.anchor;
    const gizmo = this._gizmos[navigationType];
    if (gizmo && anchor) {
      geoCanvas.drawIcon3D(anchor, gizmo.style);
    }
  }

  override onGestureEvent(event: GestureEvent) {
    if (!this._anchorSupport || !this.map) {
      return HandleEventResult.EVENT_IGNORED;
    }

    const {viewPoint, viewPosition} = event;
    const newNavigationType = getNavigationType(
      event,
      this._navigationType,
      this._allowedInteractions,
      this._keySupport.navigationKeysMode === NavigationKeysMode.TANGENT_FORWARD,
    );

    if (this._navigationType !== newNavigationType) {
      this.invalidate();
      if (newNavigationType === NavigationType.NONE) {
        this._panSupport.reset();
        this._rotationSupport.reset();
      } else {
        // compute gizmo anchor when navigation type changed
        this._anchorSupport.computeAnchor(viewPoint, newNavigationType);
        this._gizmos[newNavigationType]?.rescaleForFixedViewSize(this.map, this._anchorSupport.anchor);
      }
    }

    this._navigationType = newNavigationType;

    //stop current camera animations if the user moves
    if (this._navigationType !== NavigationType.NONE) {
      AnimationManager.removeAnimation(this.map.cameraAnimationKey);
    }

    const {anchor} = this._anchorSupport;

    if (this._navigationType === NavigationType.FIRST_PERSON_ROTATION) {
      this._rotationSupport.rotateAroundCameraEye(this.map, viewPosition);
    } else if (this._navigationType === NavigationType.ROTATION) {
      this._rotationSupport.rotateAroundPivot(this.map, anchor, viewPosition);
    } else if (this._navigationType === NavigationType.PAN) {
      this._panSupport.panCameraOverOrthogonalPlane(this.map, anchor, viewPoint);
    } else if (this._navigationType === NavigationType.ZOOM || this._navigationType === NavigationType.ZOOM_ON_CLICK) {
      const zoomFactor = this.getZoomFactor(event);
      const speedRate = getSpeedMultiplier(event);
      const ghostMode = (event.domEvent as MouseEvent | TouchEvent).ctrlKey;
      const surfaceCrossed = this._zoomSupport.zoomToAnchor(this.map, anchor, zoomFactor, {
        flying: this._useZoomAnimations,
        speedRate,
        ghostMode,
      });
      // A new zoom anchor will be computed when camera crossed surface or on zooming out
      if (zoomFactor < 0 || surfaceCrossed) {
        this._navigationType = NavigationType.NONE;
        this._panSupport.reset();
        this._rotationSupport.reset();
      }
    } else {
      return HandleEventResult.EVENT_IGNORED;
    }
    return HandleEventResult.EVENT_HANDLED;
  }

  override onKeyEvent(event: KeyEvent): HandleEventResult {
    const target = event.domEvent?.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      // Events on input targets are disregarded.
      return HandleEventResult.EVENT_IGNORED;
    }

    const result = this._keySupport.onKeyEvent(event);
    if (result === HandleEventResult.EVENT_HANDLED && this.map) {
      AnimationManager.removeAnimation(this.map.cameraAnimationKey);
    }
    return result;
  }

  /**
   * Calculates the zoom factor from the given gesture event. This should return a negative number if the zoom gesture
   * should fly backward. By default, it returns a constant fraction for animated zooming, and a gesture-dependent
   * factor determined by the {@link getZoomFactor} util method from `GestureUtil.ts`.
   */
  getZoomFactor(event: GestureEvent) {
    const zoomFactor = getZoomFactor(event, SCROLL_ZOOM_MULTIPLIER);
    return !this._useZoomAnimations
      ? zoomFactor
      : zoomFactor < 0 ? FRACTION_FLY_BACK : FRACTION_FLY_FORWARD
  }
}

function boundsCorners(bounds: Bounds): Point[] {
  return [
    createPoint(bounds.reference, [bounds.x, bounds.y, bounds.z]),
    createPoint(bounds.reference, [bounds.x + bounds.width, bounds.y, bounds.z]),
    createPoint(bounds.reference, [bounds.x + bounds.width, bounds.y + bounds.height, bounds.z]),
    createPoint(bounds.reference, [bounds.x + bounds.width, bounds.y + bounds.height, bounds.z + bounds.depth]),
    createPoint(bounds.reference, [bounds.x, bounds.y + bounds.height, bounds.z + bounds.depth]),
    createPoint(bounds.reference, [bounds.x, bounds.y + bounds.height, bounds.z]),
    createPoint(bounds.reference, [bounds.x + bounds.width, bounds.y, bounds.z + bounds.depth]),
    createPoint(bounds.reference, [bounds.x, bounds.y, bounds.z + bounds.depth]),
  ];
}