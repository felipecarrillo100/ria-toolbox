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
import {CARTESIAN_REFERENCE, ThreePointProjector, WORLD_TO_MODEL} from "./ThreePointProjector.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {rayPlaneIntersection, toPoint} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";
import {Map} from "@luciad/ria/view/Map.js";

export const RAYCASTED_PROJECTION_TYPE = "Raycasted";

export class ThreePointRaycastedProjector extends ThreePointProjector {

  constructor(map: Map, planeMeshUrl: string) {
    super(map, RAYCASTED_PROJECTION_TYPE, planeMeshUrl);
  }

  project(viewPoint: Point): Point {
    if (!this.planeCenter || !this.planeNormal) {
      throw new Error('The measure plane should be defined when intersecting.');
    }

    const intersection = rayPlaneIntersection(this.map.camera.eye, calculatePointingDirection(this.map, viewPoint),
        this.planeNormal, this.planeCenter);

    if (!intersection) {
      throw new OutOfBoundsError();
    }
    return WORLD_TO_MODEL.transform(toPoint(CARTESIAN_REFERENCE, intersection));
  }

}