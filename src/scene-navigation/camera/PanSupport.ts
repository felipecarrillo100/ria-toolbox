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
import {Map} from "@luciad/ria/view/Map.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {
  add,
  addArray,
  cross,
  length,
  normalize,
  projectOnVector,
  scale,
  sub,
} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {DEG2RAD} from "@luciad/ria-toolbox-core/util/Math.js";
import {calculatePointingAngles} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {BoundedCameraSupport} from "./BoundedCameraSupport.js";

/**
 * Support class to help with panning the map over the camera's orthogonal plane.
 */
export class PanSupport extends BoundedCameraSupport {
  private _distanceToPanPlane: number | null = null;

  reset() {
    this._distanceToPanPlane = null;
  }

  /**
   * Pan by shifting the camera over the camera's orthogonal plane, and placing the given anchor under the given view
   * point.
   */
  panCameraOverOrthogonalPlane(map: Map, anchor: Vector3, viewPoint: Point) {
    const {eye, forward, up} = map.camera;

    if (!this._distanceToPanPlane) {
      this._distanceToPanPlane = length(projectOnVector(sub(anchor, eye), forward));
      return;
    }

    const {angleX, angleY} = calculatePointingAngles(map, viewPoint);

    const right = normalize(cross(forward, up));
    const rightFactor = Math.tan(angleX * DEG2RAD) * this._distanceToPanPlane;
    const upFactor = Math.tan(angleY * DEG2RAD) * this._distanceToPanPlane;

    const newPoint3D = addArray([
      eye,
      scale(forward, this._distanceToPanPlane),
      scale(right, rightFactor),
      scale(up, upFactor),
    ]);

    const translation = sub(anchor, newPoint3D);
    const newEye = add(eye, translation);
    this.modifyCameraEye(map, newEye, true);
  }
}
