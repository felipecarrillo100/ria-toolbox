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
import {createEllipse, createPolygon} from "@luciad/ria/shape/ShapeFactory.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createCartesianGeodesy, createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {Map} from "@luciad/ria/view/Map.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {Ellipse} from "@luciad/ria/shape/Ellipse.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {
  add,
  cross,
  distance,
  distanceAlongDirection,
  length,
  normalize,
  projectPointOnLine,
  rayPlaneIntersection,
  scale,
  sub,
  toPoint
} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";

const WGS_84 = getReference("CRS:84");
const EPSG_4978 = getReference("EPSG:4978");
const GEODESY_WGS84 = createEllipsoidalGeodesy(WGS_84);

/**
 * Creates a horizontal move point interaction function that is valid for the duration of a single interaction (
 * which usually equates a single drag operation)
 * @param map the map to perform the operations on
 * @param viewPoint the original viewpoint at the start of the interaction
 * @param modelPoint the original georeferenced point that needs to be moved.
 * @param options Optional object literal
 * @param options.fixedHeight if true, will operate at a fixed height. If false, will have the horizontal move follow the terrain. Default true.
 * @param options.restrictionFunction If set, this function will be invoked on the result, before it is returned in the main function.
 *                                    Can be used to restrict certain interactions, such as limiting movement to a bounding box.
 * @returns a function that returns updates values for wgs84point, given new values of the mouse location
 */
export const horizontalMovePointInteraction = (map: Map, viewPoint: Point, modelPoint: Point,
                                               options?: {
                                                 fixedHeight?: boolean,
                                                 restrictionFunction?: (point: Point) => Point
                                               }): (point: Point) => Point => {
  const fixedHeight = options?.fixedHeight !== false;
  const restrictionFunction = options?.restrictionFunction || null;

  const modelPointToWgs84 = createTransformation(modelPoint.reference!, WGS_84);
  const modelPointWGS84 = modelPointToWgs84.transform(modelPoint);
  const modelPointHeight = modelPointWGS84.z;
  const mapToWgs84Transformation = createTransformation(map.reference, WGS_84);

  const viewToMapTransformation = fixedHeight ?
                                  map.getViewToMapTransformation(LocationMode.ELLIPSOID,
                                      {heightOffset: modelPointWGS84.z}) :
                                  map.getViewToMapTransformation(LocationMode.TERRAIN);

  const modelPointInMapRef = createTransformation(modelPoint.reference!, map.reference).transform(modelPoint);
  const startPoint = viewToMapTransformation.transform(viewPoint);
  const offset = sub(modelPointInMapRef, startPoint);

  return (updatedViewPoint: Point): Point => {
    let newWgs84Point = mapToWgs84Transformation.transform(
        toPoint(map.reference, add(offset, viewToMapTransformation.transform(updatedViewPoint))));
    if (fixedHeight) {
      newWgs84Point.z = modelPointHeight;
    }
    if (restrictionFunction) {
      newWgs84Point = restrictionFunction(newWgs84Point);
    }
    return newWgs84Point;
  }
};

/**
 * Creates a vertical move point interaction function that is valid for the duration of a single interaction (
 * which usually equates a single drag operation)
 * @param map the map to perform the operations on
 * @param viewPoint the original viewpoint at the start of the interaction
 * @param modelPoint the original georeferenced point that needs to be moved.
 * @returns a function that returns updates values for wgs84point, given new values of the mouse location. This
 *                     function guarantees that the X and Y coordinates of the updated wgs84 point have the same values,
 *                     and that only the Z coordinate is updated For non-3D maps, a trivial function is returned that
 *                     returns the initial wgs84 point.
 */
export const verticalMovePointInteraction = (map: Map, viewPoint: Point,
                                             modelPoint: Point): (point: Point) => Point => {
  if (!map.reference.equals(getReference("EPSG:4978"))) {
    //Disable vertical movement on 2D maps
    return (): Point => modelPoint;
  }
  const modelPointToWgs84 = createTransformation(modelPoint.reference!, WGS_84);
  const modelPointToEpsg4978 = createTransformation(modelPoint.reference!, EPSG_4978);
  const wgs84ToEpsg4978 = createTransformation(WGS_84, EPSG_4978);
  const modelPointWGS84 = modelPointToWgs84.transform(modelPoint);
  const abovePointWGS84 = modelPointWGS84.copy();
  abovePointWGS84.z += 1;

  const modelPointEPSG4978 = modelPointToEpsg4978.transform(modelPoint);
  const abovePointEPSG4978 = wgs84ToEpsg4978.transform(abovePointWGS84);
  const upDirection = sub(abovePointEPSG4978, modelPointEPSG4978);
  const rightDirection = cross(sub(modelPointEPSG4978, map.camera.eye), upDirection);
  const planeNormal = cross(rightDirection, upDirection);

  const touchedPointAtStart = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, viewPoint),
      planeNormal, modelPointEPSG4978)!;

  return (updatedViewPoint: Point): Point => {
    const touchedPoint = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, updatedViewPoint),
        planeNormal, modelPointEPSG4978);
    if (touchedPoint) {
      const heightDiff = distanceAlongDirection(touchedPoint, touchedPointAtStart, upDirection);
      const updatedModelPoint = modelPointWGS84.copy();
      updatedModelPoint.z += heightDiff;
      return updatedModelPoint;
    } else {
      throw new Error("Updated view point should be touching the up-plane. " +
                      "Have you moved the camera while doing the vertical move interaction?")
    }
  }
};

/**
 * Creates a planar move point interaction function that is valid for the duration of a single interaction (
 * which usually equates a single drag operation)
 * @param map the EPSG_4978 map to perform the operations on
 * @param viewPoint the original viewpoint at the start of the interaction
 * @param originalPoint the original 3D point that needs to be moved.
 * @param planeNormal the normal (specified in EPSG_4978) of the plane that the 3D point can move on
 * @returns function that returns updated 3D point, given new values of the mouse location.
 */
export function planarMovePointInteraction(
    map: Map,
    viewPoint: Point,
    originalPoint: Point,
    planeNormal: Vector3
): (p: Point) => Point {
  if (!map.reference.equals(EPSG_4978)) {
    throw new Error('planar move point interaction can only be used on 3D maps');
  }

  if (!EPSG_4978.equals(originalPoint.reference)) {
    originalPoint = createTransformation(originalPoint.reference!, EPSG_4978).transform(originalPoint);
  }

  const touchedPointAtStart = rayPlaneIntersection(
      map.camera.eye,
      calculatePointingDirection(map, viewPoint),
      planeNormal,
      originalPoint
  );

  if (!touchedPointAtStart) {
    throw new Error('Given view point should be touching the move plane.');
  }

  const lastMovedPoint = originalPoint.copy();

  return (updatedViewPoint: Point): Point => {
    const touchedPoint = rayPlaneIntersection(
        map.camera.eye,
        calculatePointingDirection(map, updatedViewPoint),
        planeNormal,
        originalPoint
    );
    if (touchedPoint) {
      const movementDiff = sub(touchedPoint, touchedPointAtStart);
      const movePoint = add(originalPoint, movementDiff);
      lastMovedPoint.move3DToCoordinates(movePoint.x, movePoint.y, movePoint.z);
    }
    return lastMovedPoint;
  };
}

/**
 * Creates a rotation interaction function that is valid for the duration of a single interaction (
 * which usually equates a single drag operation)
 * @param map the map to perform the operations on
 * @param viewPoint the original viewpoint at the start of the interaction
 * @param modelRotationPoint the point that should be the center of rotation
 * @param options Optional object literal
 * @param options.azimuthOffset A fixed offset to add to the returned azimuth. Used to calculate relative offsets.
 * @returns a function that returns a new azimuth between the latest viewpoint and the original
 *                     center of rotation.
 */
export const horizontalRotateInteraction = (map: Map, viewPoint: Point, modelRotationPoint: Point,
                                            options?: { azimuthOffset?: number }): (point: Point) => number => {
  const azimuthOffset = options?.azimuthOffset || 0;

  const modelPointToWgs84 = createTransformation(modelRotationPoint.reference!, WGS_84);
  const modelPointWGS84 = modelPointToWgs84.transform(modelRotationPoint);

  const viewToMapTransformation = map.getViewToMapTransformation(LocationMode.ELLIPSOID,
      {heightOffset: modelPointWGS84.z});
  const mapToWgs84Transformation = createTransformation(map.reference, WGS_84);

  const handleLLH = mapToWgs84Transformation.transform(viewToMapTransformation.transform(viewPoint));
  const azimuthStart = GEODESY_WGS84.forwardAzimuth(handleLLH, modelPointWGS84);

  return (updatedViewPoint: Point): number => {
    const rotatedLLH = mapToWgs84Transformation.transform(viewToMapTransformation.transform(updatedViewPoint));
    const azimuthNow = GEODESY_WGS84.forwardAzimuth(rotatedLLH, modelPointWGS84);
    return (azimuthNow - azimuthStart) + azimuthOffset;
  };
};

/**
 * Creates a function that returns whether the viewPoint argument is close enough to a horizontal, circular arc,
 * defined by its given properties.
 *
 * @param map the map to perform the checks on
 * @param handleCenter the center of the arc to perform the checks on
 * @param radius the radius of the arc
 * @param startAzimuthDegrees the start azimuth of the arc
 * @param arcSize the arc size in degrees
 * @param arcMargin the margin in degrees in which given view point is still considered close enough from the arc
 */
export function horizontalMouseRotateCheck(
    map: Map,
    handleCenter: Point,
    radius: number,
    startAzimuthDegrees: number,
    arcSize: number,
    arcMargin = 1,
): (viewPoint: Point) => boolean {
  if (handleCenter.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    handleCenter = createTransformation(handleCenter.reference, WGS_84).transform(handleCenter);
  }
  const rotateHandleBaseEllipse = createEllipse(
      handleCenter.reference,
      handleCenter,
      radius,
      radius,
      0
  );

  const modelHeight = handleCenter.z;
  const modelCornerPoints = discretizeArc(
      rotateHandleBaseEllipse,
      startAzimuthDegrees - arcMargin,
      arcSize + arcMargin * 2,
      8
  );
  for (const point of modelCornerPoints) {
    point.move3D(point.x, point.y, modelHeight);
  }
  const modelPolygon = createPolygon(handleCenter.reference!, modelCornerPoints);

  const viewToMapTransformation = map.getViewToMapTransformation(LocationMode.ELLIPSOID,
      {heightOffset: handleCenter.z,});
  const mapToModelTransformation = createTransformation(map.reference, handleCenter.reference!);

  return (viewPoint: Point): boolean => {
    try {
      const mapPoint = viewToMapTransformation.transform(viewPoint);
      const modelPoint = mapToModelTransformation.transform(mapPoint);
      return modelPolygon.contains2DPoint(modelPoint);
    } catch (e) {
      if (!(e instanceof OutOfBoundsError)) {
        throw e
      }
      return false;
    }
  };
}

/**
 * Creates a move point interaction function (following a given direction) that is valid for the duration of a
 * single interaction (which usually equates a single drag operation)
 */
export const directionalMovePointInteraction = (
    map: Map,
    startWorldPoint: Vector3,
    worldDirection: Vector3
) => {
  const camera = map.camera as PerspectiveCamera;
  const cameraRight = cross(camera.forward, camera.up);

  const pointingPlaneNormal = normalize(cross(worldDirection, cameraRight));

  return (viewPoint: Point): Vector3 => {
    const pointingDir = calculatePointingDirection(map, viewPoint);
    const intersectionPoint = rayPlaneIntersection(
        camera.eye,
        pointingDir,
        pointingPlaneNormal,
        startWorldPoint
    );
    if (!intersectionPoint) {
      return startWorldPoint;
    } else {
      return projectPointOnLine(
          intersectionPoint,
          startWorldPoint,
          worldDirection
      );
    }
  };
};

/**
 * Creates a linear move point interaction function that is valid for the duration of a single interaction (
 * which usually equates a single drag operation).
 * It differs from the `directionalMovePointInteraction` with that the dragging view point can be located anywhere on the lineVector.
 * @param map the EPSG_4978 map to perform the operations on
 * @param viewPoint the original viewpoint at the start of the interaction
 * @param originalPoint the original 3D point that needs to be moved.
 * @param lineVector the direction (specified in EPSG_4978) that the 3D point can be moved in
 * @returns function that returns updated 3D point, given new values of the mouse location.
 */
export function linearMovePointInteraction(
    map: Map,
    viewPoint: Point,
    originalPoint: Point,
    lineVector: Vector3
): (point: Point) => Point {
  if (!map.reference.equals(EPSG_4978)) {
    throw new Error('linear move point interaction can only be used on 3D maps');
  }

  lineVector = normalize(lineVector);

  if (!EPSG_4978.equals(originalPoint.reference)) {
    originalPoint = createTransformation(originalPoint.reference!, EPSG_4978).transform(originalPoint);
  }

  const closestPointOnLineToCamera = projectPointOnLine(map.camera.eye, originalPoint, lineVector);
  const planeNormal = sub(closestPointOnLineToCamera, map.camera.eye);

  const touchedPointAtStart = rayPlaneIntersection(
      map.camera.eye,
      calculatePointingDirection(map, viewPoint),
      planeNormal,
      originalPoint
  );

  if (!touchedPointAtStart) {
    throw new Error('Given view point should be touching the move plane.');
  }

  const lastMovedPoint = originalPoint.copy();

  return (updatedViewPoint: Point): Point => {
    const touchedPoint = rayPlaneIntersection(
        map.camera.eye,
        calculatePointingDirection(map, updatedViewPoint),
        planeNormal,
        originalPoint
    );
    if (touchedPoint) {
      const movementDiff = distanceAlongDirection(touchedPoint, touchedPointAtStart, lineVector);
      const movePoint = add(originalPoint, scale(lineVector, movementDiff));
      lastMovedPoint.move3DToCoordinates(movePoint.x, movePoint.y, movePoint.z);
    }
    return lastMovedPoint;
  };
}

/**
 * Creates a function that returns whether the viewPoint argument is close enough to the given modelPoint.
 * @param map the map to perform the check on
 * @param modelPoint the model point to perform distance checks on
 * @param options optional object literal
 * @param options.sensitivity the maximum distance in pixel coordinates to return true. default 10.
 */
export const closeToPointCheck = (map: Map, modelPoint: Point,
                                  options?: { sensitivity?: number }): (point: Point) => boolean => {
  const sensitivity = options?.sensitivity || 10;
  const cornerPointToMapTransformation = createTransformation(modelPoint.reference!, map.reference);
  const cartesianGeodesy = createCartesianGeodesy(map.reference);
  return (viewPoint: Point): boolean => {
    try {
      const cornerPointMap = cornerPointToMapTransformation.transform(modelPoint);
      const cornerPointView = map.mapToViewTransformation.transform(cornerPointMap);
      return cartesianGeodesy.distance(cornerPointView, viewPoint) < sensitivity;
    } catch (e) {
      return false;
    }
  }
};

/**
 * Creates a function that returns whether the viewPoint argument is horizontally close enough to the given modelPoint.
 */
export const closeToHorizontalPointCheck = (map: Map, point: Point,
                                            options: {
                                              maxPixelDistance?: number,
                                              maxWorldDistance?: number
                                            }): (point: Point) => boolean => {
  if (!map.reference.equals(EPSG_4978)) {
    throw new Error("This check only works with a geocentric map");
  }
  if (!map.reference.equals(point.reference)) {
    point = createTransformation(point.reference!, map.reference).transform(point);
  }

  if (!options.maxPixelDistance) {
    options.maxPixelDistance = 10;
  }

  const planeNormal = normalize(point);
  return (viewPoint: Point): boolean => {

    const touchedPoint = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, viewPoint), planeNormal,
        point);

    if (touchedPoint) {
      if (options.maxWorldDistance) {
        return distance(point, touchedPoint) < options.maxWorldDistance;
      } else {
        return distance(viewPoint, map.mapToViewTransformation.transform(toPoint(EPSG_4978, touchedPoint))) <
               options.maxPixelDistance!;
      }
    } else {
      return false;
    }
  }

}

/**
 * Creates a function that returns whether the viewPoint argument is close enough to the given vertical line.
 */
export const closeToVerticalLineCheck = (map: Map, start: Point, end: Point, clampToSegment: boolean,
                                         options: {
                                           maxPixelDistance?: number,
                                           maxWorldDistance?: number
                                         }): (point: Point) => boolean => {
  if (!map.reference.equals(EPSG_4978)) {
    throw new Error("This check only works with a geocentric map");
  }
  if (!map.reference.equals(start.reference)) {
    start = createTransformation(start.reference!, map.reference).transform(start);
  }
  if (!map.reference.equals(end.reference)) {
    end = createTransformation(end.reference!, map.reference).transform(end);
  }

  if (!options.maxPixelDistance) {
    options.maxPixelDistance = 10;
  }

  const right = cross(map.camera.forward, map.camera.up);
  const planeNormal = cross(right, start);

  const startToEnd = sub(end, start)
  const lineDir = normalize(startToEnd);
  const lineLength = length(startToEnd);

  return (viewPoint: Point): boolean => {

    const touchedPoint = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, viewPoint), planeNormal,
        start);
    if (touchedPoint) {
      let distanceAlongLine = distanceAlongDirection(touchedPoint, start, lineDir);
      if (clampToSegment) {
        if (distanceAlongLine < 0) {
          distanceAlongLine = 0;
        } else if (distanceAlongLine > lineLength) {
          distanceAlongLine = lineLength;
        }
      }

      const closestPointOnLine = toPoint(map.reference, add(start, scale(lineDir, distanceAlongLine)));
      if (options.maxWorldDistance) {
        return distance(touchedPoint, closestPointOnLine) < options.maxWorldDistance;
      } else {
        return distance(viewPoint, map.mapToViewTransformation.transform(closestPointOnLine)) <
               options.maxPixelDistance!;
      }
    } else {
      return false;
    }
  }
}

/**
 * Creates a function that returns whether the viewPoint argument is inside the given modelPolygon, assuming that it is
 * horizontally oriented.
 */
export const inHorizontalPolygonCheck = (map: Map, modelPolygon: Polygon): (point: Point) => boolean => {
  const viewToMapTransformation = map.getViewToMapTransformation(LocationMode.ELLIPSOID,
      {heightOffset: modelPolygon.focusPoint!.z});
  const mapToModelTransformation = createTransformation(map.reference, modelPolygon.reference!);

  return (viewPoint: Point): boolean => {
    try {
      const mapPoint = viewToMapTransformation.transform(viewPoint);
      const modelPoint = mapToModelTransformation.transform(mapPoint);
      return modelPolygon.contains2DPoint(modelPoint);

    } catch (e) {
      if (!(e instanceof OutOfBoundsError)) {
        throw e
      }
      return false;
    }
  };
};

/**
 * A factory function to limit horizontal movement of a WGS84 point in a predetermined bounds.
 * @param boundsLimitWGS84 The WGS84 bounds to limit movement to
 */
export const limitHorizontalMoveToBounds = (boundsLimitWGS84: Bounds) => (wgs84Point: Point): Point => {
  const restrictedWgs84Point = wgs84Point.copy();
  if (restrictedWgs84Point.x > boundsLimitWGS84.x + boundsLimitWGS84.width) {
    restrictedWgs84Point.x = boundsLimitWGS84.x + boundsLimitWGS84.width;
  }
  if (restrictedWgs84Point.x < boundsLimitWGS84.x) {
    restrictedWgs84Point.x = boundsLimitWGS84.x;
  }
  if (restrictedWgs84Point.y > boundsLimitWGS84.y + boundsLimitWGS84.height) {
    restrictedWgs84Point.y = boundsLimitWGS84.y + boundsLimitWGS84.height;
  }
  if (restrictedWgs84Point.y < boundsLimitWGS84.y) {
    restrictedWgs84Point.y = boundsLimitWGS84.y;
  }
  return restrictedWgs84Point;
};

/**
 * Discretize an arc into a set of points
 * @param ellipse the ellipse to discretize
 * @param startAzimuth
 * @param sweepAngle
 * @param pointCount the amount of desired points
 * @returns An array of points that lie on the ellipse
 */
function discretizeArc(
    ellipse: Ellipse,
    startAzimuth: number,
    sweepAngle: number,
    pointCount: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < pointCount; i++) {
    const fraction = i / pointCount;
    const degree = fraction * sweepAngle + startAzimuth;
    const t = degree / 360;
    points.push(ellipse.interpolate(t));
  }
  points.push(ellipse.center);
  return points;
}