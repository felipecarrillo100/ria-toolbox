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
import {createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {
  CARTESIAN_GEODESY,
  GEODESIC_GEODESY,
  Measurement,
  MeasurementPaintStyles,
  MEASUREMENTS_MODEL_REFERENCE,
  MeasurementSegment,
} from "./Measurement.js";
import {drawDistanceLabel} from "./MeasurementUtil.js";
import {formatDistance} from "@luciad/ria-toolbox-core/util/FormatUtil.js";

export const DISTANCE_MEASUREMENT_TYPE = "Distance";
const MAX_CARTESIAN_DISTANCE = 100000;

export interface DistanceMeasurementInfo {
  distance: number;
}

function calculateDistance(p1: Point, p2: Point) {
  const cartesianDistance = CARTESIAN_GEODESY.distance3D(p1, p2);
  return cartesianDistance < MAX_CARTESIAN_DISTANCE
         ? cartesianDistance
         : GEODESIC_GEODESY.distance3D(p1, p2);
}

export class DistanceMeasurement extends Measurement<MeasurementSegment,
    DistanceMeasurementInfo> {
  constructor() {
    super(DISTANCE_MEASUREMENT_TYPE);
  }

  protected createSegment(p1: Point, p2: Point): MeasurementSegment {
    return {
      line: createPolyline(MEASUREMENTS_MODEL_REFERENCE, [p1, p2]),
      p1,
      p2,
      distance: calculateDistance(p1, p2),
    };
  }

  recomputeSegment(segment: MeasurementSegment): void {
    super.recomputeSegmentLine(segment);
    segment.distance = calculateDistance(segment.p1, segment.p2);
  }

  paintBody(
      geoCanvas: GeoCanvas,
      {mainLineStyles, pointStyles}: MeasurementPaintStyles
  ): void {
    for (const {line} of this.segments) {
      for (const style of mainLineStyles) {
        geoCanvas.drawShape(line, style);
      }
    }
    for (const point of this.points) {
      for (const style of pointStyles) {
        geoCanvas.drawIcon(point, style);
      }
    }
  }

  paintLabel(labelCanvas: LabelCanvas, styles: MeasurementPaintStyles): void {
    for (const {distance, line} of this.segments) {
      drawDistanceLabel(labelCanvas, line, styles.mainLabelHtmlStyle, distance);
    }
  }

  calculateTotalInfo(): DistanceMeasurementInfo {
    let distance = 0;
    for (const segment of this.segments) {
      distance += segment.distance;
    }

    return {distance};
  }

  getFormattedTotalInfo() {
    return [
      {
        label: "Distance",
        value: formatDistance(this.totalInfo.distance),
      },
    ];
  }

}
