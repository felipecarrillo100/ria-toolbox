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
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {createPoint, createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {Map} from "@luciad/ria/view/Map.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {createCartesianGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {Geodesy} from "@luciad/ria/geodesy/Geodesy.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {createCross} from "@luciad/ria-toolbox-core/util/IconFactory.js";
import {formatAngle, formatDistance} from "@luciad/ria-toolbox-core/util/FormatUtil.js";
import {RAD2DEG} from "@luciad/ria-toolbox-core/util/Math.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";

export const CARTESIAN_MEASUREMENT_CHANGED_EVENT = "CartesianMeasurementChangedEvent";

const DEFAULT_HORIZONTAL_MARGIN: number = 200;
export const DEFAULT_POINT_STYLE: IconStyle = {
  image: createCross({
    width: 20,
    height: 20,
    stroke: 'rgb(250,250,250)',
    strokeWidth: 3,
  }),
};
const DEFAULT_LINE_STYLE: ShapeStyle = {stroke: {color: 'rgb(20,230,238)'}};
const DEFAULT_HEIGHT_LINE_STYLE: ShapeStyle = {stroke: {color: 'rgb(150,174,174)', dash: [5, 10]}};

export interface CartesianRulerControllerCreateOptions {
  /**
   * Horizontal margin used to draw the horizontal height lines outside the current view, in meters
   */
  horizontalMargin?: number;
  /**
   * IconStyle used to paint the measurement points
   */
  pointStyle?: IconStyle;
  /**
   * ShapeStyle used to paint the lines between the measurement points
   */
  lineStyle?: ShapeStyle;
  /**
   * ShapeStyle used to paint the horizontal height lines
   */
  heightLineStyle?: ShapeStyle;
}

export enum MeasureState {
  NO_POINT_PLACED,
  FIRST_POINT_PLACED,
  FULLY_PLACED,
}

export interface CartesianMeasurement {
  state: MeasureState;
  p1: Point;
  p2: Point;
}

/**
 * Controller used to do simple measurements on 2D cartesian maps, assuming that the map's axes are defined in meters.
 */
export class CartesianRulerController extends Controller {

  private readonly _eventedSupport = new EventedSupport([CARTESIAN_MEASUREMENT_CHANGED_EVENT], true);
  private readonly _horizontalMargin: number;
  private readonly _pointStyle: IconStyle;
  private readonly _lineStyle: ShapeStyle;
  private readonly _heightLineStyle: ShapeStyle;
  private _p1!: Point;
  private _p2!: Point;
  private _state: MeasureState = MeasureState.NO_POINT_PLACED;
  private _geodesy!: Geodesy;

  constructor(options?: CartesianRulerControllerCreateOptions) {
    super();
    this._horizontalMargin = options?.horizontalMargin ?? DEFAULT_HORIZONTAL_MARGIN;
    this._pointStyle = options?.pointStyle ?? DEFAULT_POINT_STYLE;
    this._lineStyle = options?.lineStyle ?? DEFAULT_LINE_STYLE;
    this._heightLineStyle = options?.heightLineStyle ?? DEFAULT_HEIGHT_LINE_STYLE;
  }

  onActivate(map: Map) {
    this._geodesy = createCartesianGeodesy(map.reference);
    this._p1 = createPoint(map.reference, [-1000, -1000]);
    this._p2 = createPoint(map.reference, [-1000, -1000]);
    super.onActivate(map);
  }

  onDeactivate(map: Map): any {
    return super.onDeactivate(map);
  }

  reset(): void {
    this._state = MeasureState.NO_POINT_PLACED;
    this._p1.move2DToCoordinates(-1000, -1000);
    this.invalidate();
  }

  onGestureEvent(e: GestureEvent): HandleEventResult {
    const mousePoint = this.map!.viewToMapTransformation.transform(
        e.viewPoint
    );

    let handled = false;

    if (e.type === GestureEventType.SINGLE_CLICK_UP) {
      if (this._state === MeasureState.NO_POINT_PLACED || this._state === MeasureState.FULLY_PLACED) {
        this._p1.move3DToPoint(mousePoint);
        this._p2.move3DToPoint(mousePoint);
        this._state = MeasureState.FIRST_POINT_PLACED;
      } else if (this._state === MeasureState.FIRST_POINT_PLACED) {
        this._p2.move3DToPoint(mousePoint);
        this._state = MeasureState.FULLY_PLACED;
      }
      handled = true;
    } else if (e.type === GestureEventType.MOVE) {
      if (this._state === MeasureState.NO_POINT_PLACED) {
        this._p1.move3DToPoint(mousePoint);
        handled = true;
      } else if (this._state === MeasureState.FIRST_POINT_PLACED) {
        this._p2.move3DToPoint(mousePoint);
        handled = true;
      }
    }

    if (handled) {
      this.invalidate();
      this._eventedSupport.emit(CARTESIAN_MEASUREMENT_CHANGED_EVENT,
          {state: this._state, p1: this._p1.copy(), p2: this._p2.copy()})
    }
    return handled
           ? HandleEventResult.EVENT_HANDLED
           : HandleEventResult.EVENT_IGNORED;
  }

  onDraw(geoCanvas: GeoCanvas): void {
    const {_p1: p1, _p2: p2, map} = this;

    if (!map) {
      return;
    }
    const ref = map.reference;

    const minX = map.viewToMapTransformation.transform(createPoint(null, [0, 0])).x - 1000;
    const maxX = map.viewToMapTransformation.transform(createPoint(null, [map.viewSize[0], 0])).x + 1000;

    //always draw the first point and its height line
    geoCanvas.drawIcon(p1, this._pointStyle);
    drawPolyline(
        geoCanvas,
        createPoint(ref, [minX, p1.y, 0]),
        createPoint(ref, [maxX, p1.y, 0]),
        this._heightLineStyle
    );

    if (this._state !== MeasureState.NO_POINT_PLACED) {
      //only draw the second point and corresponding lines if the first point has already been confirmed
      geoCanvas.drawIcon(p2, this._pointStyle);

      drawPolyline(geoCanvas, p1, p2, this._lineStyle);

      const pX = createPoint(p1.reference, [p2.x, p1.y]);

      drawPolyline(geoCanvas, p1, pX, this._lineStyle);
      drawPolyline(geoCanvas, pX, p2, this._lineStyle);

      drawPolyline(
          geoCanvas,
          createPoint(ref, [minX, p2.y, 0]),
          createPoint(ref, [maxX, p2.y, 0]),
          this._heightLineStyle
      );
    }

  }

  onDrawLabel(labelCanvas: LabelCanvas): void {
    const {_p1: p1, _p2: p2, _state: state, _geodesy: geodesy} = this;

    if (state === MeasureState.NO_POINT_PLACED) {
      return;
    }

    const pX = createPoint(p1.reference, [p2.x, p1.y]);
    const distance = geodesy.distance3D(p1, p2);

    if (distance) {
      drawPolylineLabel(labelCanvas, p1, p2, distance);
      const horizontalDistance = geodesy.distance3D(p1, pX);
      drawPolylineLabel(labelCanvas, p1, pX, horizontalDistance);

      const verticalDistance = geodesy.distance3D(pX, p2);
      drawPolylineLabel(labelCanvas, pX, p2, verticalDistance);

      const angle = Math.asin(verticalDistance / distance) * RAD2DEG;

      if (angle > 0) {
        labelCanvas.drawLabel(formatAngle(angle, 1, 85), p1, {});
      }
    }
  }

  on(event: "Activated" | "Deactivated" | "Invalidated" | typeof CARTESIAN_MEASUREMENT_CHANGED_EVENT,
     callback: ((map: Map) => void) | ((measurement: CartesianMeasurement) => void), context?: any): Handle {
    if (event === CARTESIAN_MEASUREMENT_CHANGED_EVENT) {
      return this._eventedSupport.on(event, callback);
    }
    // @ts-ignore
    return super.on(event, callback, context);
  }
}

function drawPolyline(geoCanvas: GeoCanvas, point1: Point, point2: Point, style: ShapeStyle) {
  const polyline = createPolyline(point1.reference, [point1, point2]);
  geoCanvas.drawShape(polyline, style);
}

function drawPolylineLabel(labelCanvas: LabelCanvas, point1: Point, point2: Point, distance: number): void {
  if (distance > 0) {
    const middlePoint = createPoint(point1.reference, [
      point1.x + (point2.x - point1.x) / 2,
      point1.y + (point2.y - point1.y) / 2,
    ]);
    labelCanvas.drawLabel(
        formatDistance(distance),
        middlePoint,
        {}
    );
  }
}
