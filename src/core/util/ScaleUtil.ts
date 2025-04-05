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
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";
import {createCartesianGeodesy, createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {LineType} from "@luciad/ria/geodesy/LineType.js";
import {Axis} from "@luciad/ria/reference/Axis.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";
import {Map} from "@luciad/ria/view/Map.js";
import {distance} from "./Vector3Util.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {Point} from "@luciad/ria/shape/Point.js";

const WGS84 = getReference("CRS:84");
const meterUOM = getUnitOfMeasure("Meter");
const ROUNDING_FACTOR = 100000000;

function truncate(aNumber: number): number {
  return Math.round(aNumber * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

/**
 * Calculates the ratio between world units and meters, at the center of the view (contrary to the ratio of 1 at the
 * center of the projection).
 *
 * This is done by transforming two world points to model points, and comparing the distance in world and model
 * coordinates. Therefor it takes into account the distortion caused by the projection.
 */
function calculateMapUnitPerMeterRatioAtMapCenter(map: Map): number {
  const viewSize = map.viewSize;
  const viewPoint = [viewSize[0] / 2, viewSize[1] / 2];
  const worldReference = map.reference;
  const mapToModelTransformation = createTransformation(worldReference,
      map.reference.referenceType == ReferenceType.CARTESIAN ? map.reference : WGS84);
  const geodesy = map.reference.referenceType == ReferenceType.CARTESIAN ? createCartesianGeodesy(map.reference)
                                                                         : createEllipsoidalGeodesy(WGS84);

  try {
    // The points on the world reference
    const viewToModel = (point: Point) => {
      const mapPoint = map.getViewToMapTransformation(LocationMode.TERRAIN).transform(point);
      return createTransformation(map.reference, map.reference, {normalizeWrapAround: map.wrapAroundWorld}).transform(mapPoint);
    }

    const mapLeftPoint = viewToModel(createPoint(null, [viewPoint[0] - 50, viewPoint[1]]));
    const mapRightPoint = viewToModel(createPoint(null, [viewPoint[0] + 50, viewPoint[1]]));

    // The points on the model reference
    const modelLeftPoint = mapToModelTransformation.transform(mapLeftPoint);
    const modelRightPoint = mapToModelTransformation.transform(mapRightPoint);

    // The distance between the points
    const distanceInMeters = geodesy.distance(modelLeftPoint, modelRightPoint, LineType.SHORTEST_DISTANCE);

    if (distanceInMeters === 0.0) {
      //This happens when we are zoomed in a lot
      return 1;
    } else {
      const mapDistance = distance(mapLeftPoint, mapRightPoint);
      const mapUnitPerMeterRatio = mapDistance / distanceInMeters;

      // Now we discretize the results of the calculations. This makes sure getting the map scale
      // after it was just set yields the same result.
      return truncate(mapUnitPerMeterRatio);
    }
  } catch (e) {
    if (e instanceof OutOfBoundsError) {
      return 1;
    } else {
      throw e;
    }
  }
}

/**
 * Returns the scale at the center of the current map extents as the ratio between the distance, as it is measured
 * on the screen of the device, to the distance in the real world.
 */
export const getScaleAtMapCenter = (map: Map): number => {
  const mapUnitPerMeterAtMapCenter = calculateMapUnitPerMeterRatioAtMapCenter(map);

  const axisUom = map.reference.getAxis(Axis.Name.X).unitOfMeasure;
  let distortion;
  if (axisUom.quantityKind.baseQuantityKind === meterUOM.quantityKind.baseQuantityKind) {
    const mapUnitInMeter = meterUOM.convertToUnit(1, axisUom);
    distortion = mapUnitPerMeterAtMapCenter / mapUnitInMeter;
  } else {
    //the fallback case is less meaningful. Maps 1m to whatever the UOM is on the Map.
    distortion = mapUnitPerMeterAtMapCenter;
  }

  return map.mapScale[0] * distortion;
}
