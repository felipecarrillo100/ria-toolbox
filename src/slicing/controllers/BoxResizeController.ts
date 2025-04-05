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
import {OrientedBox} from "@luciad/ria/shape/OrientedBox.js";
import {BOX_CHANGED_EVENT, OrientedBoxEditingSupport} from "../OrientedBoxEditingSupport.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {Map} from "@luciad/ria/view/Map.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {
  absoluteAngle,
  add,
  average,
  distance,
  interpolateVectors,
  negate,
  normalize,
  rayRectangleIntersection,
  sub,
  toPoint
} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {ControllerHandle} from "@luciad/ria-toolbox-controller/handle/ControllerHandle.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {
  closeToPointCheck,
  directionalMovePointInteraction
} from "@luciad/ria-toolbox-controller/handle/ControllerHandleInteractionFactory.js";
import {createFacePolygons} from "@luciad/ria-toolbox-core/util/AdvancedShapeFactory.js";
import {drawFacePolygon} from "../OrientedBoxDrawUtil.js";

const resizeIcon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCA0MCA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZWxsaXBzZSBjeD0iMjAiIGN5PSIyMC41IiByeD0iMjAuNSIgcnk9IjIwIiB0cmFuc2Zvcm09InJvdGF0ZSg5MCAyMCAyMC41KSIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNOS45NTQzOSAyMC43NTE2SDE0LjUwODhMMTQuNTA4OCAxOS4xODQ2SDkuOTU0MzlMMTIuMjMxNiAxNy4xNTg2TDEwLjk4NjQgMTYuMDUwOEw2LjU4MzQ5IDE5Ljk2ODFMMTAuOTg2NCAyMy44ODU0TDEyLjIzMTYgMjIuNzc3Nkw5Ljk1NDM5IDIwLjc1MTZaIiBmaWxsPSJibGFjayIvPgogIDxwYXRoIGQ9Ik0yMy4zMTMyIDMwLjkzN0wyMy4zMTMyIDlMMTYuMjY4NSA5TDE2LjI2ODUgMzAuOTM3SDIzLjMxMzJaTTE4LjAyOTcgMjkuMzcwMUwxOC4wMjk3IDEwLjU2NjlMMjEuNTUyMSAxMC41NjY5TDIxLjU1MjEgMjkuMzcwMUgxOC4wMjk3WiIgZmlsbD0iYmxhY2siLz4KICA8cGF0aCBkPSJNMjkuNjI5MSAxOS4xODQ2SDI1LjA3NDdWMjAuNzUxNkgyOS42MjkxTDI3LjM1MTkgMjIuNzc3NkwyOC41OTcxIDIzLjg4NTRMMzMgMTkuOTY4MUwyOC41OTcxIDE2LjA1MDhMMjcuMzUxOSAxNy4xNTg2TDI5LjYyOTEgMTkuMTg0NloiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=';

const DEFAULT_HANDLE_STYLE = {
  url: resizeIcon,
  width: '40px',
  height: '40px',
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
}

const FOCUSED_HANDLE_STYLE = {
  url: resizeIcon,
  width: '40px',
  height: '40px',
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
  opacity: 0.5,
};

/**
 * Minimal distance in meters between two opposite sides of an oriented box when resizing
 */
const MINIMAL_INTERVAL_WIDTH = 0.01;

/**
 * Max interval length in meters, to avoid issues with the fact that oriented boxes do not curve with the earth
 */
const MAX_INTERVAL_WIDTH = 10_000;

export interface BoxResizeControllerCreateOptions {
  /**
   * Defines what needs to happen when a user clicks on the map.
   * @param intersectsBox whether the user clicked inside the box that is being edited or not.
   */
  onClick?: (intersectsBox: boolean) => void
}

/**
 * Controller used to resize an oriented box.
 * The box is resized by dragging the box's 6 face planes in the direction perpendicular to the respective planes.
 */
export class BoxResizeController extends Controller {
  private readonly _support: OrientedBoxEditingSupport;
  private readonly _resizeHandle = new BoxResizeHandle();
  private readonly _onClick?: (intersectsBox: boolean) => void;
  private readonly _defaultHandleStyle: IconStyle = Object.assign({}, DEFAULT_HANDLE_STYLE);
  private readonly _focusedHandleStyle: IconStyle = Object.assign({}, FOCUSED_HANDLE_STYLE);

  private _facePolygons: Polygon[];
  private _hoveredFaceIndex: number | null = null;
  private _boxCenter: Vector3;
  private _upVector: Vector3 = {x: 0, y: 0, z: 0};
  private _hoverListenHandle: Handle | null = null;

  constructor(support: OrientedBoxEditingSupport, options?: BoxResizeControllerCreateOptions) {
    super();
    this._support = support;
    this._onClick = options?.onClick;

    const initialBox = support.getBox();
    this._facePolygons = createFacePolygons(initialBox);

    this._boxCenter = toPoint(initialBox.reference, average(initialBox.getCornerPoints()));

    this._support.on(BOX_CHANGED_EVENT, (box: OrientedBox) => {
      this._facePolygons = createFacePolygons(box);
      this._boxCenter = toPoint(box.reference, average(box.getCornerPoints()));
      if (this._resizeHandle.resizingFaceId !== null && this.map) {
        this.updateResizeHandle(this._resizeHandle.resizingFaceId);
      }
    });
  }

  onActivate(map: Map) {
    const northFacingCamera = (map.camera as PerspectiveCamera).lookFrom({
      eye: map.camera.eye,
      roll: 0,
      yaw: 0,
      pitch: 0,
    });
    this._upVector = normalize(northFacingCamera.up);

    super.onActivate(map);
  }

  private updateResizeHandle(faceId: number) {
    if (!this.map) {
      return;
    }
    const hoveredFace = this._facePolygons[faceId];
    const botLeft = hoveredFace.getPoint(0);
    const topRight = hoveredFace.getPoint(2);
    const center = interpolateVectors(botLeft, topRight, 0.5);
    const centerPoint = createPoint(hoveredFace.reference, [
      center.x,
      center.y,
      center.z,
    ]);
    this._resizeHandle.update(
        centerPoint,
        centerPoint,
        closeToPointCheck(this.map, centerPoint, {sensitivity: 20})
    );

    const dir = sub(center, this._boxCenter);
    //icon rotation only works correctly in 90° increments (otherwise it depends on which angle you're looking from)
    const rotation =
        Math.round((90 - absoluteAngle(dir, this._upVector)) / 90) * 90;
    this._defaultHandleStyle.rotation = rotation;
    this._focusedHandleStyle.rotation = rotation;

    this._resizeHandle.resizingFaceId = faceId;
    this._resizeHandle.validInterval = this.getResizableInterval(faceId);
  }

  onDeactivate(map: Map): void {
    this._hoverListenHandle?.remove();
    super.onDeactivate(map);
  }

  onDraw(geoCanvas: GeoCanvas) {
    if (this._hoveredFaceIndex !== null) {
      drawFacePolygon(geoCanvas, this._facePolygons[this._hoveredFaceIndex], true);
    }

    if (this._resizeHandle.defaultShape) {
      if (this._resizeHandle.focused) {
        geoCanvas.drawShape(
            this._resizeHandle.defaultShape,
            this._focusedHandleStyle
        );
      } else {
        geoCanvas.drawShape(
            this._resizeHandle.defaultShape,
            this._defaultHandleStyle
        );
      }
    }
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    if (!this.map) {
      return HandleEventResult.EVENT_HANDLED;
    }
    const domEvent = event.domEvent;
    if (
        domEvent instanceof MouseEvent &&
        event.type === GestureEventType.MOVE
    ) {
      return this.handleMove(event);
    } else if (
        event.type === GestureEventType.DRAG &&
        this._resizeHandle.focused
    ) {
      return this.handleDrag(event);
    } else if (event.type === GestureEventType.DRAG_END) {
      this._resizeHandle.endInteraction();
      this.invalidate();
    } else if (event.type === GestureEventType.SINGLE_CLICK_UP && this._onClick) {
      this._onClick(this.findClosestIntersectedFace(event.viewPoint) != null)
      return HandleEventResult.EVENT_HANDLED;
    } else if (event.type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      return HandleEventResult.EVENT_HANDLED;
    }
    return super.onGestureEvent(event);
  }

  private handleMove(event: GestureEvent) {
    let invalidate = false;

    const previousHoveredFace = this._hoveredFaceIndex;
    this._hoveredFaceIndex = this.findClosestIntersectedFace(event.viewPoint);
    if (previousHoveredFace === this._hoveredFaceIndex) {
      if (this._hoveredFaceIndex !== null) {
        this.updateResizeHandle(this._hoveredFaceIndex)
      } else {
        this._resizeHandle.clear();
      }
      invalidate = true;
    }

    if (this._resizeHandle.interactsWithMouseFunction) {
      this._resizeHandle.focused =
          this._resizeHandle.interactsWithMouseFunction(event.viewPoint);
      invalidate = true;
    }
    if (invalidate) {
      this.invalidate();
    }
    return HandleEventResult.EVENT_IGNORED;
  }

  private handleDrag(event: GestureEvent) {
    if (!this._resizeHandle.interactionFunction) {
      const faceCenter = this._resizeHandle.defaultShape;
      if (faceCenter instanceof Point) {
        this._resizeHandle.interactionFunction =
            directionalMovePointInteraction(
                this.map!,
                faceCenter,
                add(faceCenter, negate(this._boxCenter))
            );
      } else {
        return super.onGestureEvent(event);
      }
    }
    const newFaceCenter = this._resizeHandle.interactionFunction!(event.viewPoint);
    const faceId = this._resizeHandle.resizingFaceId as number;
    const [minDistance, maxDistance] = this._resizeHandle.validInterval as [number, number];
    this.setDistance(
        faceId,
        clamp(this.calculateDistance(faceId, newFaceCenter), minDistance, maxDistance)
    );
    this.invalidate();
    return HandleEventResult.EVENT_HANDLED;
  }

  private setDistance(faceId: number, value: number) {
    switch (faceId) {
    case 0:
      return this._support.setXInterval(value);
    case 1:
      return this._support.setXInterval(undefined, value);
    case 2:
      return this._support.setYInterval(value);
    case 3:
      return this._support.setYInterval(undefined, value);
    case 4:
      return this._support.setZInterval(value);
    case 5:
      return this._support.setZInterval(undefined, value);
    }
  }

  /**
   * Calculates the distance from the given point to the origin of this controller's support, along the normal of the
   * given face.
   */
  private calculateDistance(faceId: number, point: Vector3) {
    if (faceId < 2) {
      return this._support.calculateXDistance(point);
    } else if (faceId < 4) {
      return this._support.calculateYDistance(point);
    } else {
      return this._support.calculateZDistance(point);
    }
  }

  private getResizableInterval(faceId: number): [number, number] {
    switch (faceId) {
    case 0:
      return [this._support.getXInterval()[1] - MAX_INTERVAL_WIDTH,
              this._support.getXInterval()[1] - MINIMAL_INTERVAL_WIDTH];
    case 1:
      return [this._support.getXInterval()[0] + MINIMAL_INTERVAL_WIDTH,
              this._support.getXInterval()[0] + MAX_INTERVAL_WIDTH];
    case 2:
      return [this._support.getYInterval()[1] - MAX_INTERVAL_WIDTH,
              this._support.getYInterval()[1] - MINIMAL_INTERVAL_WIDTH];
    case 3:
      return [this._support.getYInterval()[0] + MINIMAL_INTERVAL_WIDTH,
              this._support.getYInterval()[0] + MAX_INTERVAL_WIDTH];
    case 4:
      return [this._support.getZInterval()[1] - MAX_INTERVAL_WIDTH,
              this._support.getZInterval()[1] - MINIMAL_INTERVAL_WIDTH];
    case 5:
      return [this._support.getZInterval()[0] + MINIMAL_INTERVAL_WIDTH,
              this._support.getZInterval()[0] + MAX_INTERVAL_WIDTH];
    default:
      throw new Error(`unexpected face id: ${faceId}`);
    }
  }

  private findClosestIntersectedFace(viewPoint: Vector3) {
    if (!this.map) {
      return null;
    }
    const eye = (this.map.camera as PerspectiveCamera).eye;
    const pointingDirection = calculatePointingDirection(this.map, viewPoint);
    let minDistance = Number.MAX_SAFE_INTEGER;
    let closestFeature: number | null = null;
    for (let i = 0; i < 6; i++) {
      const rectangle = this._facePolygons[i];
      const intersectionPoint = rayRectangleIntersection(
          eye,
          pointingDirection,
          rectangle
      );
      if (intersectionPoint) {
        const intersectionDistance = distance(intersectionPoint, eye);
        if (intersectionDistance < minDistance) {
          minDistance = intersectionDistance;
          closestFeature = i;
        }
      }
    }
    return closestFeature;
  }
}

/**
 * Controller handle used to resize an oriented box by moving one of it's 6 faces.
 */
class BoxResizeHandle extends ControllerHandle<Vector3> {
  private _resizingFaceId: number | null = null;
  private _validInterval: [number, number] | null = null;

  /**
   * Distance interval for which it is valid to move the plane towards.
   * This is used to avoid moving a plane further than it's opposite plane.
   */
  get validInterval(): [number, number] | null {
    return this._validInterval;
  }

  set validInterval(value: [number, number] | null) {
    this._validInterval = value;
  }

  /**
   * The index of the face that is being moved.
   * The order of faces is defined by {@link createFacePolygons}.
   */
  get resizingFaceId(): number | null {
    return this._resizingFaceId;
  }

  set resizingFaceId(value: number | null) {
    this._resizingFaceId = value;
  }

  clear() {
    this.update(null, null, () => false)
    this._resizingFaceId = null;
    this._validInterval = null;
  }
}
