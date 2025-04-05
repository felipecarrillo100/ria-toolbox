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
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {clamp, DEG2RAD, interpolate, RAD2DEG} from "./Math.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";

/**
 * Returns a copy of the given vector
 */
export function copy(a: Vector3): Vector3 {
  return {x: a.x, y: a.y, z: a.z}
}

/**
 * Returns the addition of the two given vectors
 */
export function add(a: Vector3, b: Vector3): Vector3 {
  return addArray([a, b]);
}

/**
 * Returns the addition of the given vectors
 */
export function addArray(array: Vector3[]): Vector3 {
  let result = {
    x: 0,
    y: 0,
    z: 0
  };

  for (const vector of array) {
    result = {
      x: result.x + vector.x,
      y: result.y + vector.y,
      z: result.z + vector.z
    }
  }

  return result;
}

/**
 * Returns the subtraction of the second given vector from the first
 */
export function sub(a: Vector3, b: Vector3) {
  return subArray([a, b]);
}

/**
 * Returns the subtraction of the non-first vectors from the first
 */
export function subArray(array: Vector3[]): Vector3 {
  let result = {
    x: array[0].x,
    y: array[0].y,
    z: array[0].z
  };
  for (let i = 1; i < array.length; i++) {
    const vector = array[i];
    result = {
      x: result.x - vector.x,
      y: result.y - vector.y,
      z: result.z - vector.z
    }
  }
  return result;
}

/**
 * Returns the average of the given array of vectors
 */
export const average = (array: Vector3[]) => {
  return scale(addArray(array), 1 / array.length);
};

/**
 * Returns a vector representing the linear interpolation between the two given vectors with given ratio
 */
export function interpolateVectors(begin: Vector3, end: Vector3, ratio: number): Vector3 {
  return {
    x: interpolate(begin.x, end.x, ratio),
    y: interpolate(begin.y, end.y, ratio),
    z: interpolate(begin.z, end.z, ratio),
  };
}

/**
 * Returns the given vector, scaled with a given value
 */
export function scale(vec: Vector3, scalar: number): Vector3 {
  return {
    x: vec.x * scalar,
    y: vec.y * scalar,
    z: vec.z * scalar
  }
}

/**
 * Returns the cross product of the two given vectors
 */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

/**
 * Returns the dot (scalar) product of the two given vectors.
 */
export function dot(a: Vector3, b: Vector3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Returns a vector that represents the negated given vector.
 */
export function negate(a: Vector3): Vector3 {
  return {
    x: -a.x,
    y: -a.y,
    z: -a.z
  }
}

/**
 * Returns the square of the length of the given vector.
 */
export function length2(a: Vector3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

/**
 * Returns the length of the given vector
 */
export function length(a: Vector3): number {
  return Math.sqrt(length2(a));
}

/**
 * Returns the distance between the two given vectors
 */
export function distance(a: Vector3, b: Vector3): number {
  return length(sub(a, b));
}

/**
 * Returns the smallest angle between the two given vectors
 */
export function absoluteAngle(a: Vector3, b: Vector3): number {
  if (length2(a) === 0 || length2(b) === 0) {
    throw new Error(
        `Cannot calculate the angle between vectors with length 0. ` +
        `Length of given vectors: ${length(a)} and ${length(b)}`
    );
  }

  //clamp to handle precision issues (Math.acos cannot handle numbers > 1)
  return Math.acos(clamp(dot(a, b) / (length(a) * length(b)), -1, 1)) * RAD2DEG;
}

/**
 * Returns the angle from a to b, using the given axis to determine whether the angle is positive or not.
 * We assume that the given axis is either equal (or very close to) to the cross product of a & b or b & a.
 */
export function angle(a: Vector3, b: Vector3, axis: Vector3): number {
  const absAngle = absoluteAngle(a, b);

  const dotProduct = dot(axis, cross(a, b));
  if (dotProduct < 0) {
    return -absAngle;
  } else {
    return absAngle
  }
}

/**
 * Returns the given vector rotated with given angle (in degrees) around the given axis.
 */
export function rotateAroundAxis(vector: Vector3, axis: Vector3, angleInDegrees: number): Vector3 {
  //Rodrigues formula
  const angle = angleInDegrees * DEG2RAD;
  const unitAxis = normalize(axis);
  return addArray([scale(vector, Math.cos(angle)),
                   scale(cross(unitAxis, vector), Math.sin(angle)),
                   scale(unitAxis, dot(unitAxis, vector) * (1 - Math.cos(angle)))
  ])
}

/**
 * Returns the given vector rotated with given angle (in degrees) around the given line.
 */
export function rotatePointAroundLine(point: Vector3, pointOnLine: Vector3, lineDirection: Vector3,
                                      angleInDegrees: number): Vector3 {
  const localPoint = sub(point, pointOnLine);
  const rotatedLocalPoint = rotateAroundAxis(localPoint, lineDirection, angleInDegrees);
  return add(rotatedLocalPoint, pointOnLine);
}

/**
 * Returns the distance between the given origin and the orthogonal projection of the given vector on the line starting
 * at the origin, with given direction
 */
export function distanceAlongDirection(point: Vector3, origin: Vector3, direction: Vector3): number {
  const originToPoint = sub(point, origin);
  return dot(originToPoint, normalize(direction))
}

/**
 * Returns the orthogonal projection of the first given vector on the second.
 */
export function projectOnVector(a: Vector3, b: Vector3) {
  return scale(normalize(b), dot(a, b) / length(b));
}

/**
 * Returns the orthogonal projection of the given vector on the infinite line defined by the given direction and point
 * on that line.
 */
export function projectPointOnLine(point: Vector3, pointOnLine: Vector3, lineDirection: Vector3): Vector3 {
  return add(projectOnVector(sub(point, pointOnLine), lineDirection), pointOnLine,);
}

/**
 * Returns the orthogonal projection of the given vector on the plane defined by the given normal and point on plane.
 */
export function projectPointOnPlane(point: Vector3, planeNormal: Vector3, pointOnPlane: Vector3): Vector3 {
  return sub(point, projectOnVector(sub(point, pointOnPlane), planeNormal))
}

/**
 * Returns the orthogonal projection of the given point on the plane defined by the given normal.
 */
export function projectVectorOnPlane(vector: Vector3, planeNormal: Vector3): Vector3 {
  return sub(vector, projectOnVector(vector, planeNormal));
}

/**
 * Returns the intersection point (if any) between the given ray and plane.
 */
export function rayPlaneIntersection(rayOrigin: Vector3, rayDirection: Vector3, planeNormal: Vector3,
                                     pointOnPlane: Vector3): Vector3 | null {
  const numerator = dot(sub(pointOnPlane, rayOrigin), planeNormal);
  const denominator = dot(rayDirection, planeNormal);
  if (denominator !== 0) {
    //the plane and ray are not parallel
    const rayToPlaneDistance = numerator / denominator;
    if (rayToPlaneDistance < 0) {
      return null; //the intersection is behind the ray
    }
    return add(rayOrigin, scale(rayDirection, rayToPlaneDistance));
  } else if (numerator === 0) {
    //the origin of the ray is on the plane
    return copy(rayOrigin);
  } else {
    return null;
  }
}

/**
 * Returns the intersection point (if any) between the given ray and rectangle.
 * The given rectangle is assumed to be in the same (cartesian) reference as the given ray.
 */
export function rayRectangleIntersection(
    rayOrigin: Vector3,
    rayDirection: Vector3,
    rectangle: Polygon
): Vector3 | null {
  const edge1 = sub(rectangle.getPoint(1), rectangle.getPoint(0));
  const edge2 = sub(rectangle.getPoint(3), rectangle.getPoint(0));
  const intersectionPoint = rayPlaneIntersection(
      rayOrigin,
      rayDirection,
      cross(edge1, edge2),
      rectangle.getPoint(0)
  );
  if (intersectionPoint) {
    //check that the ray plane intersection is inside the rectangle
    const dotDir1 = dot(edge1, sub(intersectionPoint, rectangle.getPoint(0)));
    const dotDir2 = dot(edge2, sub(intersectionPoint, rectangle.getPoint(0)));
    if (
        0 <= dotDir1 && dotDir1 <= dot(edge1, edge1) &&
        0 <= dotDir2 && dotDir2 <= dot(edge2, edge2)
    ) {
      return intersectionPoint;
    }
  }
  return null;
}

/**
 * Checks if the two vectors have the same coordinates.
 */
export function sameVectors(vec1: Vector3, vec2: Vector3): boolean {
  return vec1.x === vec2.x && vec1.y === vec2.y && vec1.z === vec2.z;
}

/**
 * Returns a normalized version of the given vector
 */
export const normalize = (vec: Vector3): Vector3 => scale(vec, 1 / length(vec));

/**
 * Returns a LuciadRIA point with given reference, using the given vector for the coordinates
 */
export const toPoint = (reference: CoordinateReference | null, vec: Vector3): Point => createPoint(reference,
    [vec.x, vec.y, vec.z]);