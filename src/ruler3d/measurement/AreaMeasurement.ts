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
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createPolygon, createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {
  CARTESIAN_GEODESY,
  Measurement,
  MeasurementPaintStyles,
  MEASUREMENTS_MODEL_REFERENCE,
  MeasurementSegment,
} from "./Measurement.js";
import {drawAreaLabel, drawDistanceLabel} from "./MeasurementUtil.js";
import {formatArea, formatDistance} from "@luciad/ria-toolbox-core/util/FormatUtil.js";

export const AREA_MEASUREMENT_TYPE = "Area";

export interface AreaMeasurementSegment extends MeasurementSegment {
  shape?: Polygon;
  area: number;
}

export interface AreaMeasurementInfo {
  surface: number;
  perimeter: number;
  closingSegment?: MeasurementSegment;
}

export class AreaMeasurement extends Measurement<AreaMeasurementSegment,
    AreaMeasurementInfo> {
  constructor() {
    super(AREA_MEASUREMENT_TYPE);
  }

  protected createSegment(p1: Point, p2: Point): AreaMeasurementSegment {
    const p0 = this.pointCount > 0 ? this.points[0] : p1;
    const {distance, shape, area} = calculateSegmentProperties(p0, p1, p2);

    return {
      line: createPolyline(MEASUREMENTS_MODEL_REFERENCE, [p1, p2]),
      p1,
      p2,
      distance,
      shape,
      area,
    };
  }

  recomputeSegment(segment: AreaMeasurementSegment): void {
    super.recomputeSegmentLine(segment);

    const {distance, shape, area} = calculateSegmentProperties(
        this.points[0],
        segment.p1,
        segment.p2
    );

    segment.distance = distance;
    segment.shape = shape;
    segment.area = area;
  }

  paintBody(
      geoCanvas: GeoCanvas,
      {mainLineStyles, areaStyles, pointStyles}: MeasurementPaintStyles
  ): void {
    for (const {line, shape} of this.segments) {
      for (const style of mainLineStyles) {
        geoCanvas.drawShape(line, style);
      }
      if (shape) {
        for (const style of areaStyles) {
          geoCanvas.drawShape(shape, style);
        }
      }
    }
    const {closingSegment} = this.totalInfo;
    if (closingSegment) {
      for (const style of mainLineStyles) {
        geoCanvas.drawShape(closingSegment.line, style);
      }
    }

    for (const point of this.points) {
      for (const style of pointStyles) {
        geoCanvas.drawIcon(point, style);
      }
    }
  }

  paintLabel(labelCanvas: LabelCanvas, styles: MeasurementPaintStyles): void {
    if (this.pointCount === 0) {
      return;
    }
    const p0 = this.points[0];
    drawAreaLabel(labelCanvas, p0, styles.helperLabelHtmlStyle, this.totalInfo.surface);

    for (const {distance, line} of this.segments) {
      drawDistanceLabel(labelCanvas, line, styles.mainLabelHtmlStyle, distance);
    }
    const {closingSegment} = this.totalInfo;
    if (closingSegment) {
      drawDistanceLabel(
          labelCanvas,
          closingSegment.line,
          styles.mainLabelHtmlStyle,
          closingSegment.distance
      );
    }
  }

  calculateTotalInfo(): AreaMeasurementInfo {
    let surface = 0;
    let perimeter = 0;

    for (const segment of this.segments) {
      surface += segment.area;
      perimeter += segment.distance;
    }

    let closingSegment = undefined;
    if (this.segments.length > 0) {
      const p0 = this.segments[0].p1;
      const pLast = this.segments[this.segments.length - 1].p2;
      const distance = CARTESIAN_GEODESY.distance3D(p0, pLast);
      closingSegment = {
        p1: pLast,
        p2: p0,
        distance,
        line: createPolyline(MEASUREMENTS_MODEL_REFERENCE, [pLast, p0]),
      };
    }

    if (closingSegment) {
      perimeter += closingSegment.distance;
    }

    return {surface, perimeter, closingSegment};
  }

  getFormattedTotalInfo() {
    return [
      {
        label: "Surface",
        value: formatArea(this.totalInfo.surface),
      },
      {
        label: "Perimeter",
        value: formatDistance(this.totalInfo.perimeter),
      },
    ];
  }
}

function calculateSegmentProperties(p0: Point, p1: Point, p2: Point) {
  const distance = CARTESIAN_GEODESY.distance3D(p1, p2);
  if (p0 == p1) {
    return {
      distance,
      area: 0
    }
  }
  return {
    distance,
    shape: createPolygon(MEASUREMENTS_MODEL_REFERENCE, [p0, p1, p2]),
    area: calculateArea(
        CARTESIAN_GEODESY.distance3D(p0, p1),
        CARTESIAN_GEODESY.distance3D(p0, p2),
        CARTESIAN_GEODESY.distance3D(p1, p2)
    ),
  };
}

function calculateArea(a: number, b: number, c: number): number {
  // based on  Heron's Formula for the area of a triangle
  const p = (a + b + c) / 2;
  return Math.sqrt(p * (p - a) * (p - b) * (p - c));
}
