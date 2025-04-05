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
import {distance} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {Map} from '@luciad/ria/view/Map.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {Vector3} from '@luciad/ria/util/Vector3.js';
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {TourPathSupport} from "../TourPathSupport.js";

// Defines the maximum distance in pixels needed to qualify a path point as interacted with.
const TOUCH_POINT_THRESHOLD = 20;

export function getTouchedPathPointFeature(viewPoint: Point, pathSupport: TourPathSupport, map: Map) {
  const pathPoints = pathSupport.pathFeature?.getPathPointFeatures();
  return pathPoints?.find(pathPoint =>
      touchesViewPoint(viewPoint, pathPoint.shape, map.mapToViewTransformation)
  );
}

function touchesViewPoint(viewPoint: Vector3, p3D: Point, mapToViewTx: Transformation): boolean {
  try {
    const pView = mapToViewTx.transform(p3D);
    return distance(viewPoint, pView) < TOUCH_POINT_THRESHOLD;
  } catch (e) {
    return false;
  }
}
