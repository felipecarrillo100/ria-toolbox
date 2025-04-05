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
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Map} from "@luciad/ria/view/Map.js";
import {add, distance, projectPointOnLine, scale, toPoint} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {isPointInBounds} from "@luciad/ria-toolbox-core/util/BoundsUtil.js";
import {NavigationGizmo} from "./NavigationGizmo.js";
import {NavigationType} from "./GestureUtil.js";

export type Gizmos = { [type in NavigationType]?: NavigationGizmo };

const MAX_STICKY_RADIUS = 400; // pixels

/**
 * The support responsibilities:
 * - computes the anchor point, that is on surface or hovered in 3D, for the above navigations
 * - paints a corresponding gizmo representation at the computed anchor point
 */
export class AnchorSupport {
  private readonly _map: Map;
  private readonly _v2m: Transformation;
  private readonly _anchor: Point;
  private readonly _bounds: Bounds;
  private readonly _boundsCenter: Point;

  constructor(map: Map, bounds: Bounds) {
    this._map = map;
    this._bounds = bounds;
    this._boundsCenter = map.reference.equals(bounds.reference)
      ? bounds.focusPoint
      : createTransformation(bounds.reference!, map.reference).transform(
        bounds.focusPoint,
      );
    this._v2m = map.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE);
    this._anchor = createPoint(map.reference, [0, 0, 0]);
  }

  get anchor(): Point {
    return this._anchor;
  }

  /**
   * Computes the anchor associated with the given viewPoint.
   * This world point is guaranteed to be under the given viewPoint.
   * If there is no painted object under the given viewPoint, an approximation
   * is made by looking at nearby painted objects or the bounds.
   */
  computeAnchor(viewPoint: Point, navigationType: NavigationType) {
    const anchor = this.getAnchorAtViewPoint(viewPoint);
    if (anchor) {
      this.anchor.move3D(anchor.x, anchor.y, anchor.z);
    } else {
      const stickyPoint =
        this.findStickyPoint(viewPoint) ||
        this.findFallbackStickyPoint(navigationType);

      const anchor = projectPointOnLine(
        stickyPoint,
        this._map.camera.eye,
        calculatePointingDirection(this._map, viewPoint),
      );
      this.anchor.move3D(anchor.x, anchor.y, anchor.z);
    }
  }

  /**
   * Returns the world point painted under the given viewPoint if it is inside the bounds.
   * If no point could be found, null is returned.
   */
  private getAnchorAtViewPoint(viewPoint: Point): Vector3 | null {
    try {
      const anchor = this._v2m.transform(viewPoint);
      if (isPointInBounds(anchor, this._bounds)) {
        return anchor;
      } else {
        return null;
      }
    } catch (e) {
      if (e instanceof OutOfBoundsError) {
        return null;
      } else {
        throw e;
      }
    }
  }

  /**
   * Tries to find a world point inside this support's bounds that is close in view-space to the given viewPoint.
   * This function starts looking for pixels at given startRadius distance and iteratively widens the search until
   * MAX_STICKY_RADIUS is reached.
   * If no point could be found, null is returned.
   */
  private findStickyPoint(viewPoint: Point, startRadius = 1): Vector3 | null {
    const coordinateCandidates = getSurroundingCoordinates(
      viewPoint,
      startRadius,
      this._map.viewSize,
    );

    let nearest = Number.MAX_VALUE;
    let best: Vector3 | null = null;

    //we don't check all coordinate candidates to improve performance when startRadius is large
    const delta = clamp(Math.round(startRadius / 40), 1, 7);
    for (let i = 0; i < coordinateCandidates.length; i += delta) {
      const [x, y] = coordinateCandidates[i];
      const anchorCandidate = this.getAnchorAtViewPoint(
        toPoint(null, {x, y, z: 0}),
      );
      if (anchorCandidate) {
        const d = distance(anchorCandidate, this._map.camera.eye);
        if (d < nearest) {
          nearest = d;
          best = anchorCandidate;
        }
      }
    }
    if (best) {
      return best;
    }

    if (startRadius < MAX_STICKY_RADIUS) {
      const radiusDelta =
        startRadius < 7 ? 1 : Math.max(1, Math.ceil(0.15 * startRadius));
      return this.findStickyPoint(viewPoint, startRadius + radiusDelta);
    }

    return null;
  }

  /**
   * Returns a fallback point for findStickyPoint.
   */
  private findFallbackStickyPoint(navigationType: NavigationType) {
    const {eye, forward} = this._map.camera;

    const eyeToCenter = distance(this._boundsCenter, this._map.camera.eye);
    if (this.isBoundsCenterInView()) {
      //fallback 1: point in the center of the screen, at eye-to-center distance from the camera
      return add(eye, scale(forward, eyeToCenter));
    } else {
      //fallback 2: point in the center of the screen, positioned relatively to how far the camera is from the camera
      const distance =
        navigationType === NavigationType.ROTATION ? 1 : eyeToCenter / 4;
      return add(eye, scale(forward, distance));
    }
  }

  private isBoundsCenterInView(): boolean {
    try {
      const {x, y} = this._map.mapToViewTransformation.transform(this._boundsCenter);
      const [w, h] = this._map.viewSize;
      return x > 0 && x < w && y > 0 && y < h;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Returns view coordinates around the given view point at given pixelDistance, which is interpreted as manhattan
 * distance (measured at right angles).
 * View coordinates outside the given viewSize are not returned
 */
function getSurroundingCoordinates(
  {x, y}: Point,
  pixelDistance: number,
  viewSize: [number, number],
): [number, number][] {
  const result: [number, number][] = [];

  for (let i = -pixelDistance; i <= pixelDistance; i++) {
    result.push([x + i, y - pixelDistance]);
    result.push([x + i, y + pixelDistance]);
    if (i !== -pixelDistance && i !== pixelDistance) {
      result.push([x - pixelDistance, y + i]);
      result.push([x + pixelDistance, y + i]);
    }
  }
  return result.filter(([x, y]) => isInView(x, y, viewSize));
}

function isInView(x: number, y: number, [w, h]: [number, number]): boolean {
  return x > 0 && x < w && y > 0 && y < h;
}
