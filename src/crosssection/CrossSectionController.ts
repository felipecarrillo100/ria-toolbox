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
import {createPoint, createPolygon} from "@luciad/ria/shape/ShapeFactory.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {Map} from "@luciad/ria/view/Map.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {paintMoveHandle, paintPlane, paintPlaneGrid, paintRotateHandle} from "./util/CrossSectionDrawUtil.js";
import {CROSS_SECTION_GEODESY, CROSS_SECTION_MODEL_REFERENCE, CrossSectionPlane} from "./CrossSectionPlane.js";
import {CrossSectionView} from "./CrossSectionView.js";
import {ControllerHandle} from "@luciad/ria-toolbox-controller/handle/ControllerHandle.js";
import {
  horizontalMouseRotateCheck,
  horizontalMovePointInteraction,
  horizontalRotateInteraction,
  inHorizontalPolygonCheck
} from "@luciad/ria-toolbox-controller/handle/ControllerHandleInteractionFactory.js";
import {
  createHorizontalArcArrow,
  createHorizontalSquare
} from "@luciad/ria-toolbox-core/util/AdvancedShapeFactory.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {
  cross,
  distanceAlongDirection,
  rayPlaneIntersection,
  sub
} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {MAX_CARTESIAN_MAP_SCALE, MIN_CARTESIAN_MAP_SCALE} from "./util/CrossSectionMapUtil.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";

/**
 * Event triggered when the cross-section plane has been fully defined or removed by the user.
 * */
export const PLANE_PLACED_CHANGED_EVENT = "PlanePlacedChangedEvent";
/**
 * Event triggered when the anchor point is placed.
 * */
export const ANCHOR_PLACED_EVENT = "AnchorPlacedEvent";

const GEOCENTRIC_REFERENCE = getReference("EPSG:4978");
const CROSS_SECTION_MODEL_2_GEOCENTRIC = createTransformation(CROSS_SECTION_MODEL_REFERENCE, GEOCENTRIC_REFERENCE);
const INCH_TO_CM = 2.54;
const CM_TO_METER = 100;
const DPI = 96; //canvas DPI is guaranteed to be 96.

enum PlacementState {
  NOTHING_PLACED,
  ANCH0R_PLACED,
  PLANE_PLACED
}

/**
 * Controller used to place and move the cross-section plane.
 */
export class CrossSectionController extends Controller {

  private readonly _eventedSupport: EventedSupport;
  private readonly _mainMap: Map;
  private readonly _crossSectionView: CrossSectionView;
  private readonly _modelToMapTransformation: Transformation;
  private readonly _mapToModelTransformation: Transformation;
  private readonly _crossSectionPlane: CrossSectionPlane;
  private readonly _moveHandle: ControllerHandle;
  private readonly _rotateHandle: ControllerHandle<number>;

  private _currentState: PlacementState = PlacementState.NOTHING_PLACED;
  private _isSliceTouched: boolean = false;
  private _lastClickEvent: GestureEvent | null = null;

  constructor(mainMap: Map, crossSectionView: CrossSectionView) {
    super();
    this._eventedSupport = new EventedSupport([PLANE_PLACED_CHANGED_EVENT, ANCHOR_PLACED_EVENT], true);
    this._mainMap = mainMap;
    this._crossSectionView = crossSectionView;
    this._modelToMapTransformation = createTransformation(CROSS_SECTION_MODEL_REFERENCE, mainMap.reference);
    this._mapToModelTransformation = createTransformation(mainMap.reference, CROSS_SECTION_MODEL_REFERENCE);
    this._crossSectionPlane = crossSectionView.plane;
    this._moveHandle = new ControllerHandle();
    this._rotateHandle = new ControllerHandle();
  }

  /**
   * Starts the initial placement of the cross-section plane again.
   */
  replaceSlicePlane(): void {
    this._isSliceTouched = false;
    this._currentState = PlacementState.NOTHING_PLACED;
    updateMapCursor(this._mainMap, 'crosshair');
    this._crossSectionPlane.updateAnchorPoint(createPoint(CROSS_SECTION_MODEL_REFERENCE, [0, 0, 0]), true);
    this._crossSectionView.clearMeasurements();
    this._crossSectionView.updateSliceMaps();
    this.invalidate();
    this._eventedSupport.emit(PLANE_PLACED_CHANGED_EVENT, false);
  }

  onActivate(map: Map): void {
    super.onActivate(map);
    this.replaceSlicePlane();
  }

  onDeactivate(map: Map): void {
    updateMapCursor(this._mainMap, 'default');
    super.onDeactivate(map);
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    const {type} = event;

    if (type === GestureEventType.SINGLE_CLICK_UP) {
      //we wait single_click_confirmed to not do anything on double click, or select objects under the cursor
      this._lastClickEvent = event;
      return EVENT_HANDLED;
    } else if (type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      return this.onClickConfirmed();
    } else if (type === GestureEventType.DRAG) {
      return this.onDrag(event);
    } else if (type === GestureEventType.MOVE) {
      return this.onMove(event);
    } else if (!this._moveHandle.focused && !this._rotateHandle.focused) {
      this.checkForHandleFocus(event);
    } else if (type === GestureEventType.DRAG_END) {
      updateMapCursor(this._mainMap, 'default');
      if (this._moveHandle.focused || this._rotateHandle.focused) {
        this._moveHandle.endInteraction();
        this._rotateHandle.endInteraction();
        this.invalidate();
        return EVENT_HANDLED;
      }
    }

    return EVENT_IGNORED;
  }

  onDraw(geoCanvas: GeoCanvas): void {
    if (this._currentState === PlacementState.NOTHING_PLACED) {
      return;
    }
    const {plane, grid} = this._crossSectionPlane;
    const {focusedShape: moveShape, focused: moveFocused} = this._moveHandle;
    const {focusedShape: rotateShape, focused: rotateFocused} = this._rotateHandle;

    const focused = moveFocused || rotateFocused || this._isSliceTouched;

    if (plane) {
      paintPlane(geoCanvas, plane, focused);
      paintPlaneGrid(geoCanvas, grid!, focused);
    }

    if (focused) {
      if (moveShape) {
        paintMoveHandle(geoCanvas, moveShape, this._moveHandle.focused);
      }

      if (rotateShape) {
        paintRotateHandle(geoCanvas, rotateShape, this._rotateHandle.focused);
      }
    }
  }

  private onClickConfirmed(): HandleEventResult {
    if (!this._lastClickEvent) {
      throw new Error("Can not confirm click if there has not been a SINGLE_CLICK_UP event yet.")
    }
    if (this._currentState === PlacementState.PLANE_PLACED) {
      return EVENT_IGNORED;
    }

    const [x, y] = this._lastClickEvent.viewPosition;
    const viewPoint = createPoint(null, [x, y]);
    if (this._currentState === PlacementState.NOTHING_PLACED) {
      this.placeAnchor(viewPoint);
      this._currentState = PlacementState.ANCH0R_PLACED;
    } else {
      this.invalidateHandles();
      this._currentState = PlacementState.PLANE_PLACED;
      updateMapCursor(this._mainMap, 'default');
      this._eventedSupport.emit(PLANE_PLACED_CHANGED_EVENT, true);
    }

    return EVENT_HANDLED;
  }

  private placeAnchor(viewPoint: Point): void {
    try {
      const touchWorldPoint = this.map!.getViewToMapTransformation(
          LocationMode.CLOSEST_SURFACE
      ).transform(viewPoint);
      this._crossSectionPlane.updateAnchorPoint(this._mapToModelTransformation.transform(touchWorldPoint), true);
      this._crossSectionPlane.azimuth = (this.map!.camera as PerspectiveCamera).asLookFrom().yaw;
      this._eventedSupport.emit(ANCHOR_PLACED_EVENT);

    } catch (ex) {
      console.error(ex);
      return;
    }
  }

  /**
   * Resizes the plane such that its border touches the given viewPoint (as long as it's in the valid min/max range).
   */
  private resizePlane(viewPoint: Point): void {
    if (!this.map) {
      return
    }

    const center = CROSS_SECTION_MODEL_2_GEOCENTRIC.transform(this._crossSectionPlane.anchorPoint);
    const right = sub(
        CROSS_SECTION_MODEL_2_GEOCENTRIC.transform(
            CROSS_SECTION_GEODESY.interpolate(this._crossSectionPlane.anchorPoint, 1,
                this._crossSectionPlane.azimuth + 90))
        , center);
    const above = this._crossSectionPlane.anchorPoint.copy();
    above.z += 1;
    const up = sub(CROSS_SECTION_MODEL_2_GEOCENTRIC.transform(above), center);

    const mousePlaneIntersection = rayPlaneIntersection(this.map.camera.eye,
        calculatePointingDirection(this.map, viewPoint), cross(right, up), center)
    if (mousePlaneIntersection) {
      const halfWidth = Math.abs(distanceAlongDirection(mousePlaneIntersection, center, right));
      const halfHeight = Math.abs(distanceAlongDirection(mousePlaneIntersection, center, up));

      const aspectRatio = this._crossSectionView.cartesianMap.viewSize[0] /
                          this._crossSectionView.cartesianMap.viewSize[1];
      const minWidth = this._crossSectionView.cartesianMap.viewSize[0] /
                       (MAX_CARTESIAN_MAP_SCALE * (DPI / INCH_TO_CM) * CM_TO_METER);
      const maxWidth = this._crossSectionView.cartesianMap.viewSize[0] /
                       (MIN_CARTESIAN_MAP_SCALE * (DPI / INCH_TO_CM) * CM_TO_METER);
      const width = clamp(Math.max(halfWidth * 2, halfHeight * 2 * aspectRatio), minWidth, maxWidth);

      this._crossSectionPlane.updateDimensions(width, width / aspectRatio);
      this._crossSectionView.updateSliceMaps();
    }
  }

  private onDrag(event: GestureEvent): HandleEventResult {
    if (this._currentState !== PlacementState.PLANE_PLACED) {
      return EVENT_IGNORED;
    }

    let handled = false;
    try {
      if (this._moveHandle.focused) {
        if (!this._moveHandle.interactionFunction) {
          this._moveHandle.interactionFunction = horizontalMovePointInteraction(this.map!, event.viewPoint,
              this._crossSectionPlane.handleTop!, {fixedHeight: true});
        }
        const newAnchor = this._moveHandle.interactionFunction!(event.viewPoint) as Point;
        newAnchor.z = this._crossSectionPlane.anchorPoint.z
        this._crossSectionPlane.updateAnchorPoint(newAnchor, true);
        handled = true;
      }

      if (this._rotateHandle.focused) {
        if (!this._rotateHandle.interactionFunction) {
          const {azimuth, handleTop} = this._crossSectionPlane;
          this._rotateHandle.interactionFunction = horizontalRotateInteraction(
              this.map!,
              event.viewPoint,
              handleTop!,
              {azimuthOffset: azimuth}
          );
        }

        this._crossSectionPlane.azimuth = this._rotateHandle.interactionFunction!(
            event.viewPoint) as number;
        handled = true;
      }
    } catch (e) {
      console.error(e);
      return EVENT_HANDLED;
    }

    if (handled) {
      this._crossSectionView.clearMeasurements();
      this._crossSectionView.updateSliceMaps();
      this.invalidateHandles();
      return EVENT_HANDLED;
    } else {
      return EVENT_IGNORED;
    }
  }

  private onMove(event: GestureEvent): HandleEventResult {
    if (this._currentState === PlacementState.NOTHING_PLACED) {
      return EVENT_IGNORED;
    } else if (this._currentState === PlacementState.ANCH0R_PLACED) {
      this.resizePlane(event.viewPoint);
      this.invalidate();
      return EVENT_HANDLED;
    } else {
      this.checkForHandleFocus(event);
      return EVENT_IGNORED;
    }
  }

  private checkForHandleFocus(event: GestureEvent): void {
    if (this._currentState !== PlacementState.PLANE_PLACED) {
      return;
    }

    const {viewPoint} = event;
    const wasMoveHandleFocused = this._moveHandle.focused;
    const wasRotateHandleFocused = this._rotateHandle.focused;
    const wasTouched = this._isSliceTouched;

    this._moveHandle.focused = this._moveHandle.interactsWithMouseFunction!(viewPoint);
    this._rotateHandle.focused =
        !this._moveHandle.focused &&
        this._rotateHandle.interactsWithMouseFunction!(viewPoint);

    let needsRepaint = false;
    if (this._crossSectionPlane.plane && !this._moveHandle.focused) {
      try {
        const viewPlane = this.modelToView(this._crossSectionPlane.plane);
        this._isSliceTouched = viewPlane.contains2DPoint(viewPoint);
        needsRepaint = this._isSliceTouched !== wasTouched;
      } catch (e) {
        if (!(e instanceof OutOfBoundsError)) {
          throw e;
        }
      }
    }

    if (
        wasMoveHandleFocused !== this._moveHandle.focused ||
        wasRotateHandleFocused !== this._rotateHandle.focused
    ) {
      const cursor =
          this._moveHandle.focused || this._rotateHandle.focused
          ? 'pointer'
          : 'default';
      updateMapCursor(this._mainMap, cursor);
      needsRepaint = true;
    }

    if (needsRepaint) {
      this.invalidate();
    }
  }

  invalidateHandles() {
    this.updateMoveHandle();
    this.updateRotateHandle();
    this.invalidate();
  }

  private updateMoveHandle() {
    const {handleTop, azimuth} = this._crossSectionPlane;

    if (!handleTop) {
      return this._moveHandle.endInteraction();
    }

    const semiDiagonal = this._crossSectionPlane.width / 25;
    const handleShape = createHorizontalSquare(
        handleTop,
        semiDiagonal,
        azimuth,
        CROSS_SECTION_GEODESY
    );

    this._moveHandle.update(null, handleShape, inHorizontalPolygonCheck(this.map!, handleShape,));
  }

  private updateRotateHandle() {
    const {handleTop, azimuth} = this._crossSectionPlane;

    if (!handleTop) {
      return this._rotateHandle.endInteraction();
    }

    const radius = this._crossSectionPlane.width / 2;
    const startAzimuthDegrees = azimuth + 70;
    const arcSizeDegrees = 40;
    const handleShape = createHorizontalArcArrow(
        handleTop,
        radius,
        startAzimuthDegrees,
        arcSizeDegrees,
        radius * 0.02,
        CROSS_SECTION_GEODESY
    );

    this._rotateHandle.update(null, handleShape, horizontalMouseRotateCheck(
        this.map!,
        handleTop,
        radius,
        startAzimuthDegrees,
        arcSizeDegrees,
    ));
  }

  private modelToView(polygon: Polygon) {
    const viewPolygon = createPolygon(null!, []);
    for (let i = 0; i < polygon.pointCount; i++) {
      viewPolygon.insertPoint(i,
          this.map!.mapToViewTransformation.transform(this._modelToMapTransformation.transform(polygon.getPoint(i))));
    }
    return viewPolygon;
  }

  on(event: "Activated" | "Deactivated" | "Invalidated" | typeof PLANE_PLACED_CHANGED_EVENT | typeof ANCHOR_PLACED_EVENT,
     callback: ((map: Map) => void) | ((placed: boolean) => void), context?: any): Handle {
    if (event === PLANE_PLACED_CHANGED_EVENT || event === ANCHOR_PLACED_EVENT) {
      return this._eventedSupport.on(event, callback);
    }
    // @ts-ignore
    return super.on(event, callback, context);
  }
}

function updateMapCursor(map: Map | null, cursor: string): void {
  if (map) {
    map.domNode.style.cursor = cursor;
  }
}
