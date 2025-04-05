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
import {ExtrudedShape} from "@luciad/ria/shape/ExtrudedShape.js";
import {ShapeList} from "@luciad/ria/shape/ShapeList.js";
import {
  createArcBand,
  createCircleByCenterPoint,
  createExtrudedShape,
  createPolyline,
  createShapeList
} from "@luciad/ria/shape/ShapeFactory.js";
import {createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {
  END_POINT_STYLE,
  HELPER_LINES_OCCLUDED_STYLE,
  HELPER_LINES_STYLE,
  MAIN_FILLED_OCCLUDED_STYLE,
  MAIN_FILLED_STYLE,
  MAIN_STROKE_OCCLUDED_STYLE,
  MAIN_STROKE_STYLE,
  START_POINT_STYLE
} from "./HandleStyles.js";

const CRS_84 = getReference("CRS:84");
const GEODESY = createEllipsoidalGeodesy(CRS_84);

/**
 *  Class used to calculate and paint the helper styling for geolocation rotate handles.
 */
export class RotateHandleSupport {
  private readonly _center: Point;
  private readonly _start: Point;
  private readonly _circle: ExtrudedShape;
  private readonly _lines: ShapeList;
  private readonly _radius: number;
  private readonly _startAzimuth: number;

  private _end: Point;
  private _band: ExtrudedShape;
  private _lastRotation: number;

  constructor(centerLLH: Point, startLLH: Point) {
    this._center = centerLLH;
    this._start = startLLH;
    this._radius = GEODESY.distance(this._center, this._start!);
    this._startAzimuth = GEODESY.forwardAzimuth(this._center, this._start!);
    this._circle = this.toExtrudedShape(
        createCircleByCenterPoint(CRS_84, this._center, GEODESY.distance(this._center, this._start)));
    this._lines = createShapeList(CRS_84);
    this._lines.addShape(this.toExtrudedShape(createCircleByCenterPoint(CRS_84, this._center, this._radius * 0.85)))
    for (let i = 0; i < 360; i += 15) {
      const azimuth = this._startAzimuth + i;
      this._lines.addShape(createPolyline(CRS_84, [
        GEODESY.interpolate(this._center, this._radius * 0.9, azimuth),
        GEODESY.interpolate(this._center, this._radius, azimuth),
      ]))
    }

    this._end = this._start.copy();
    this._band = this.createArcBand(0);
    this._lastRotation = 0;
  }

  update(rotation: number) {
    this._end = GEODESY.interpolate(this._center, this._radius,
        this._startAzimuth + rotation);
    if (rotation * this._lastRotation < 0 && Math.abs(rotation - this._lastRotation) > 180) {
      this._lastRotation = rotation + (rotation < 0 ? 360 : -360);
    } else {
      this._lastRotation = rotation;
    }
    this._band = this.createArcBand(this._lastRotation);
  }

  private createArcBand(rotation: number) {
    return this.toExtrudedShape(
        createArcBand(CRS_84, this._center, 0, this._radius, this._startAzimuth, rotation));
  }

  drawBody(geoCanvas: GeoCanvas) {
    geoCanvas.drawIcon(this._start, START_POINT_STYLE);
    geoCanvas.drawIcon(this._end, END_POINT_STYLE);
    geoCanvas.drawShape(this._circle, MAIN_STROKE_STYLE);
    geoCanvas.drawShape(this._circle, MAIN_STROKE_OCCLUDED_STYLE);
    geoCanvas.drawShape(this._band, MAIN_FILLED_STYLE);
    geoCanvas.drawShape(this._band, MAIN_FILLED_OCCLUDED_STYLE);
    geoCanvas.drawShape(this._lines, HELPER_LINES_STYLE);
    geoCanvas.drawShape(this._lines, HELPER_LINES_OCCLUDED_STYLE);
  }

  drawLabel(labelCanvas: LabelCanvas) {
    const html = `<div style="background-color: white; color: black; padding: 6px; border-radius: 6px">${
        Math.abs(this._lastRotation).toFixed(1)}°</div>`
    labelCanvas.drawLabel(html, this._start, {});
  }

  private toExtrudedShape(shape: Shape) {
    return createExtrudedShape(CRS_84, shape, this._center.z, this._center.z);
  }
}