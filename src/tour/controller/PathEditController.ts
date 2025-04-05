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
import {add, distance, scale, sub, normalize, projectPointOnLine} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {ControllerHandle} from '@luciad/ria-toolbox-controller/handle/ControllerHandle.js';
import {createPolyline} from '@luciad/ria/shape/ShapeFactory.js';
import {Controller} from '@luciad/ria/view/controller/Controller.js';
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from '@luciad/ria/view/controller/HandleEventResult.js';
import {GestureEventType} from '@luciad/ria/view/input/GestureEventType.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {Map} from '@luciad/ria/view/Map.js';
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {OutOfBoundsError} from '@luciad/ria/error/OutOfBoundsError.js';
import {PerspectiveCamera} from '@luciad/ria/view/camera/PerspectiveCamera.js';
import {Transformation} from '@luciad/ria/transformation/Transformation.js';
import {Vector3} from '@luciad/ria/util/Vector3.js';
import {TourPathSupport} from '../TourPathSupport.js';
import {TourStyle} from '../view/TourStyles.js';
import {getTouchedPathPointFeature} from './PathControllerUtil.js';
import {LookFrom} from "@luciad/ria/view/camera/LookFrom.js";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {EditMode, PathController} from "./PathController.js";
import {ImageIconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {
  linearMovePointInteraction,
  planarMovePointInteraction
} from "@luciad/ria-toolbox-controller/handle/ControllerHandleInteractionFactory.js";
import {PathPointFeature} from "../model/PathPointFeature.js";

/**
 * Contains style options for `PathEditController`.
 */
export interface PathEditControllerStyles {
  /** The style applied to the hovered point */
  pointHoverStyle: ImageIconStyle;
  /** The style applied to the icons during editing. */
  iconStyle: ImageIconStyle;
  /** The style applied to the icons when they are focused or selected during editing. */
  iconFocusedStyle: ImageIconStyle;
  /** The style applied to the altitude line during editing. */
  altitudeStyle: ShapeStyle;
  /** The style applied to the altitude line when it is focused. */
  altitudeFocusStyle: ShapeStyle;
}

enum GeoHandle {
  NONE,
  MOVE,
  ALTITUDE,
}

// Sensitivity factor for camera rotation
const ROTATE_SCALING = 0.1;
// Max distance in pixels to qualify a point touched
const TOUCH_POINT_THRESHOLD = 20;
// Max distance in pixels to qualify a vertical handle touched
const TOUCH_VERTICAL_THRESHOLD = 15;

const dummyViewPoint = [-1, -1];

/**
 * `PathEditController` manages the edition of path points' position and orientation.
 */
export class PathEditController extends Controller {
  private readonly _pathSupport: TourPathSupport;
  private readonly _pathController: PathController;

  private readonly _moveHandle: ControllerHandle;
  private readonly _altitudeHandle: ControllerHandle<Vector3>;
  private _styles: PathEditControllerStyles = TourStyle.pathController;

  private _activeGeoHandle: GeoHandle = GeoHandle.NONE;
  private _previousViewPos: number[] = dummyViewPoint;
  private _touchedPoint: PathPointFeature | undefined = undefined;

  constructor(pathSupport: TourPathSupport,
              pathController: PathController) {
    super();
    this._pathSupport = pathSupport;
    this._pathController = pathController;
    this._moveHandle = new ControllerHandle();
    this._altitudeHandle = new ControllerHandle();
  }

  /**
   * Sets the styles for the `PathEditController`.
   */
  setStyle(styles: Partial<PathEditControllerStyles> = {}) {
    this._styles = {
      pointHoverStyle: styles.pointHoverStyle ?? TourStyle.pathController.pointHoverStyle,
      iconStyle: styles.iconStyle ?? TourStyle.pathController.iconStyle,
      iconFocusedStyle: styles.iconFocusedStyle ?? TourStyle.pathController.iconFocusedStyle,
      altitudeStyle: styles.altitudeStyle ?? TourStyle.pathController.altitudeStyle,
      altitudeFocusStyle: styles.altitudeFocusStyle ?? TourStyle.pathController.altitudeFocusStyle,
    }
  }

  override onDraw(geoCanvas: GeoCanvas): void {
    const pathPoint = this._pathController.editPathPointFeature;
    if (this._touchedPoint) {
      geoCanvas.drawIcon(this._touchedPoint.shape, this._styles.pointHoverStyle);
    }
    if (!pathPoint) {
      return;
    }

    const geoStyle = this._moveHandle.focused ? this._styles.iconFocusedStyle : this._styles.iconStyle;
    if (this._activeGeoHandle === GeoHandle.MOVE || this._activeGeoHandle === GeoHandle.NONE) {
      geoCanvas.drawIcon(pathPoint.shape, geoStyle);
    }

    const {focusedShape, defaultShape, focused} = this._altitudeHandle;
    if (this._activeGeoHandle === GeoHandle.ALTITUDE && focusedShape && focused) {
      geoCanvas.drawShape(focusedShape, this._styles.altitudeFocusStyle);
    } else if (defaultShape) {
      geoCanvas.drawShape(defaultShape, this._styles.altitudeStyle);
    }
  }

  override onGestureEvent(event: GestureEvent): HandleEventResult {
    const {map} = this;

    if (!map || this._pathController.editMode === EditMode.INACTIVE) {
      return EVENT_IGNORED;
    }

    const {type, viewPosition} = event;

    let result = EVENT_IGNORED;

    const pathIndex = this._pathController.editPointIndex;
    const editMode = this._pathController.editMode;
    if (pathIndex !== null && editMode === EditMode.ORIENTATION) {
      if (type === GestureEventType.DRAG) {
        const [mouseX, mouseY] = viewPosition;
        const [previousMouseX, previousMouseY] = this._previousViewPos;
        if (previousMouseX > 0 && previousMouseY > 0) {
          this.rotateCamera(map, previousMouseX - mouseX, previousMouseY - mouseY);
        }
        this._previousViewPos = viewPosition;
      }
      if (type === GestureEventType.DRAG_END) {
        this._previousViewPos = dummyViewPoint;
        // Emit the data path change event for the whole path
        this._pathSupport.emitPathDataChange();
      }
      result = EVENT_HANDLED;
    }

    if (pathIndex !== null && editMode === EditMode.POSITION) {
      const handled =
          this.implOnGestureEventForHandle(event, GeoHandle.MOVE) ||
          this.implOnGestureEventForHandle(event, GeoHandle.ALTITUDE);

      const focusedHandle = this._moveHandle.focused
                            ? GeoHandle.MOVE
                            : this._altitudeHandle.focused
                              ? GeoHandle.ALTITUDE
                              : GeoHandle.NONE;

      if (handled || this._activeGeoHandle !== focusedHandle) {
        this._activeGeoHandle = focusedHandle;
        this.invalidate();
        result = EVENT_HANDLED;
      }
    }

    const touchedPoint = getTouchedPathPointFeature(event.viewPoint, this._pathSupport, map);
    if (touchedPoint !== this._touchedPoint) {
      this._touchedPoint = touchedPoint;
      this.invalidate();
      result = EVENT_HANDLED
    }

    const cursor =
        this._activeGeoHandle === GeoHandle.MOVE
        ? 'move'
        : this._activeGeoHandle === GeoHandle.ALTITUDE
          ? 'row-resize'
          : touchedPoint ? 'pointer' : 'default';
    this.setCursorStyle(cursor);

    return result;
  }

  private setCursorStyle(cursor: string) {
    if (this.map) {
      this.map.domNode.style.cursor = cursor;
    }
  }

  override onActivate(map: Map): void {
    super.onActivate(map);
    this.updateHandles();
  }

  override onDeactivate(map: Map) {
    this.setCursorStyle('default');
    // force re-drawing phase to remove old drawings
    this.invalidate();
    return super.onDeactivate(map);
  }

  private rotateCamera(map: Map, dx: number, dy: number): void {
    const pathPoint = this._pathController.editPathPointFeature;
    if (!pathPoint) {
      return;
    }
    const camera = map.camera as PerspectiveCamera;
    const lookFromCamera = createRotationCamera(camera, dx * ROTATE_SCALING, dy * ROTATE_SCALING);
    map.camera = camera.lookFrom(lookFromCamera);
    pathPoint.updateOrientation(map.camera);
    this._pathSupport.pathPainter.invalidateAll();
  }

  updateHandles(): void {
    this.updateMoveHandle();
    this.updateAltitudeHandle();
    this.invalidate();
    if (this.map && !this._pathController.editPathPointFeature) {
      this.map.domNode.style.cursor = 'default';
    }
  }

  private implOnGestureEventForHandle(event: GestureEvent, geoHandle: GeoHandle): boolean {
    try {
      if (geoHandle === GeoHandle.MOVE) {
        return this.onGestureEventMove(event);
      } else if (geoHandle === GeoHandle.ALTITUDE) {
        return this.onGestureEventAltitude(event);
      }
    } catch (e) {
      if (!(e instanceof OutOfBoundsError)) {
        throw e;
      }
    }
    return true;
  }

  private updateMoveHandle(): void {
    const pathPoint = this._pathController.editPathPointFeature;
    if (!pathPoint || !this.map) {
      return;
    }

    const point3D = pathPoint.shape;
    const tx = this.map.mapToViewTransformation;
    const interactionTest = (viewPoint: Point) => touchesViewPoint(viewPoint, point3D, tx);

    this._moveHandle.update(point3D, point3D, interactionTest);
  }

  private updateAltitudeHandle(): void {
    const pathPoint = this._pathController.editPathPointFeature;
    if (!pathPoint || !this.map) {
      return;
    }

    const p3D = pathPoint.shape;
    const up = normalize(p3D);
    const pBottom = add(p3D, scale(up, -100));
    const pTop = add(p3D, scale(up, 50));

    const vector = createPolyline(p3D.reference, [
      [pBottom.x, pBottom.y, pBottom.z],
      [pTop.x, pTop.y, pTop.z],
    ]);

    const pRef = sub(p3D, up) as Point;

    const tx = this.map.mapToViewTransformation;
    const interactionTest = (viewPoint: Point) => touchesAltitudeLine(viewPoint, [p3D, pRef], tx);
    this._altitudeHandle.update(vector, vector, interactionTest);
  }

  private onGestureEventAltitude(event: GestureEvent): boolean {
    const pathPoint = this._pathController.editPathPointFeature;
    if (!pathPoint || !this.map) {
      return false;
    }

    const {type, inputType, viewPoint} = event;
    if (
        type === GestureEventType.MOVE ||
        (inputType === 'touch' && type === GestureEventType.DRAG && !this._altitudeHandle.focused)
    ) {
      return handleInteraction(this._altitudeHandle, viewPoint);
    } else if (type === GestureEventType.DRAG) {
      if (this._altitudeHandle.focused) {
        if (!this._altitudeHandle.interactionFunction) {
          this._altitudeHandle.interactionFunction = linearMovePointInteraction(
              this.map,
              viewPoint,
              pathPoint.shape.copy(),
              normalize(pathPoint.shape)
          );
        }
        const new3D = this._altitudeHandle.interactionFunction(viewPoint);
        this.updatePoint(new3D);
        return true;
      }
    } else if (type === GestureEventType.DRAG_END) {
      if (this._altitudeHandle.focused) {
        this._altitudeHandle.endInteraction();
        // Emit the data path change event for the whole path
        this._pathSupport.emitPathDataChange();
        return true;
      }
    }
    return false;
  }

  private updatePoint(p3D: Vector3): void {
    const pathPoint = this._pathController.editPathPointFeature;
    if (pathPoint) {
      pathPoint.updatePosition(p3D);
      this.updateHandles();
      this._pathSupport.pathPainter.invalidateAll();
    }
  }

  private onGestureEventMove(event: GestureEvent): boolean {
    const pathPoint = this._pathController.editPathPointFeature;
    if (!pathPoint || !this.map) {
      return false;
    }
    const {type, inputType, viewPoint} = event;

    if (
        type === GestureEventType.MOVE ||
        (type === GestureEventType.DRAG && inputType === 'touch' && !this._moveHandle.focused)
    ) {
      return handleInteraction(this._moveHandle, viewPoint);
    } else if (type === GestureEventType.DRAG) {
      if (this._moveHandle.focused) {
        if (!this._moveHandle.interactionFunction) {
          this._moveHandle.interactionFunction = planarMovePointInteraction(
              this.map,
              viewPoint,
              pathPoint.shape.copy(),
              normalize(pathPoint.shape) // up vector
          );
        }
        const new3D = this._moveHandle.interactionFunction(viewPoint);
        this.updatePoint(new3D);
        return true;
      }
    } else if (type === GestureEventType.DRAG_END) {
      if (this._moveHandle.focused) {
        this._moveHandle.endInteraction();
        // Emit the data path change event for the whole path
        this._pathSupport.emitPathDataChange();
        return true;
      }
    }
    return false;
  }
}

function handleInteraction(handle: ControllerHandle<Vector3>, viewPoint: Point): boolean {
  const focusedBefore = handle.focused;
  handle.focused = handle.interactsWithMouseFunction ? handle.interactsWithMouseFunction(viewPoint) : false;
  return focusedBefore !== handle.focused;
}

function touchesAltitudeLine(viewPoint: Point, altitudePoints: [Point, Point], mapToViewTx: Transformation): boolean {
  try {
    const viewPoint1 = mapToViewTx.transform(altitudePoints[0]);
    const viewPoint2 = mapToViewTx.transform(altitudePoints[1]);
    const pointOnLine = projectPointOnLine(viewPoint, viewPoint1, sub(viewPoint2, viewPoint1));
    return distance(viewPoint, pointOnLine) < TOUCH_VERTICAL_THRESHOLD;
  } catch (e) {
    return false;
  }
}

function touchesViewPoint(viewPoint: Vector3, p3D: Point, mapToViewTx: Transformation): boolean {
  try {
    const pView = mapToViewTx.transform(p3D);
    return distance(viewPoint, pView) < TOUCH_POINT_THRESHOLD;
  } catch (e) {
    return false;
  }
}

function createRotationCamera(camera: PerspectiveCamera, dx: number, dy: number): LookFrom {
  const lookFromCamera = camera.asLookFrom();
  lookFromCamera.eye = camera.eyePoint;
  lookFromCamera.pitch = clamp(lookFromCamera.pitch - dy, -89, 89);
  lookFromCamera.yaw = (lookFromCamera.yaw + dx) % 360;
  return lookFromCamera;
}