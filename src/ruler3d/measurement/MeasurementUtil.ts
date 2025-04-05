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
import {Measurement} from "./Measurement.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {DISTANCE_MEASUREMENT_TYPE, DistanceMeasurement} from "./DistanceMeasurement.js";
import {ORTHOGONAL_MEASUREMENT_TYPE, OrthogonalMeasurement} from "./OrthogonalMeasurement.js";
import {AREA_MEASUREMENT_TYPE, AreaMeasurement} from "./AreaMeasurement.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {PointLabelPosition} from "@luciad/ria/view/style/PointLabelPosition.js";
import {formatAngle, formatArea, formatDistance, formatHeight} from "@luciad/ria-toolbox-core/util/FormatUtil.js";
import {PointLabelStyle} from "@luciad/ria/view/style/PointLabelStyle.js";

export const MIN_MEASURE_DISTANCE = 0.02;
export const MIN_MEASURE_ANGLE = 0.1;
export const MIN_MEASURE_AREA = MIN_MEASURE_DISTANCE * MIN_MEASURE_DISTANCE;

const LABEL_STYLE: PointLabelStyle = {
  group: "ruler3DLabel",
  padding: 2,
  priority: -100,
  positions: [PointLabelPosition.NORTH]

}

export function createMeasurement(type: string, points: Point[] = []): Measurement {
  let measurement;
  if (type === DISTANCE_MEASUREMENT_TYPE) {
    measurement = new DistanceMeasurement();
  } else if (type === ORTHOGONAL_MEASUREMENT_TYPE) {
    measurement = new OrthogonalMeasurement();
  } else if (type === AREA_MEASUREMENT_TYPE) {
    measurement = new AreaMeasurement();
  } else {
    throw new Error("Unsupported measurement type: " + type);
  }
  for (const point of points) {
    measurement.addPoint(point);
  }

  return measurement;
}

function drawLabel(labelCanvas: LabelCanvas, shape: Shape, style: string, text: string) {
  const html = `<div style='${style}'>${text}</div>`;
  labelCanvas.drawLabel(html, shape, LABEL_STYLE);

}

export function drawDistanceLabel(labelCanvas: LabelCanvas, shape: Shape, style: string, distance: number) {
  if (distance < MIN_MEASURE_DISTANCE) {
    return;
  }
  drawLabel(labelCanvas, shape, style, formatDistance(distance, MIN_MEASURE_DISTANCE));
}

export function drawAngleLabel(labelCanvas: LabelCanvas, shape: Shape, style: string, angle: number) {
  if (angle < MIN_MEASURE_ANGLE) {
    return;
  }
  drawLabel(labelCanvas, shape, style, formatAngle(angle, MIN_MEASURE_ANGLE));
}

export function drawAreaLabel(labelCanvas: LabelCanvas, shape: Shape, style: string, area: number) {
  if (area < MIN_MEASURE_AREA) {
    return;
  }
  drawLabel(labelCanvas, shape, style, formatArea(area, MIN_MEASURE_AREA));
}

export function drawHeightLabel(labelCanvas: LabelCanvas, shape: Shape, style: string, height: number) {
  drawLabel(labelCanvas, shape, style, formatHeight(height));
}
