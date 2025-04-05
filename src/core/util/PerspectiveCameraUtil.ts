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
import {DEG2RAD, RAD2DEG} from "./Math.js";
import {addArray, cross, normalize, scale} from "./Vector3Util.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";

export interface Vector2 {
  x: number;
  y: number;
}

/**
 * Returns the x & y angles between the forward vector of the given map's camera and
 * the vector going from the camera's eye point in the direction of the viewPoint.
 */
export function calculatePointingAngles(
    map: Map,
    viewPoint: Vector2
): { angleX: number, angleY: number } {
  if (!(map.camera instanceof PerspectiveCamera)) {
    throw new Error("This function only works for maps with a perspective camera");
  }

  const camera = map.camera as PerspectiveCamera;
  const fovY = camera.fovY;
  const fovX =
      2 *
      Math.atan(Math.tan((camera.fovY * DEG2RAD) / 2) * camera.aspectRatio) *
      RAD2DEG;

  const angleX =
      Math.atan(
          (viewPoint.x - map.viewSize[0] / 2) /
          (map.viewSize[0] / 2 / Math.tan((fovX * DEG2RAD) / 2))
      ) * RAD2DEG;
  const angleY =
      -Math.atan(
          (viewPoint.y - map.viewSize[1] / 2) /
          (map.viewSize[1] / 2 / Math.tan((fovY * DEG2RAD) / 2))
      ) * RAD2DEG;

  return {angleX, angleY};
}

/**
 * Returns a vector in world coordinates, representing the direction that
 * a given viewPoint is pointing to.
 */
export function calculatePointingDirection(
    map: Map,
    viewPoint: Vector2
): Vector3 {
  const {angleX: yaw, angleY: pitch} = calculatePointingAngles(map, viewPoint);

  const camera = map.camera as PerspectiveCamera;

  const near = 10;
  const x = Math.tan(yaw * DEG2RAD) * near;
  const y = Math.tan(pitch * DEG2RAD) * near;

  const cameraRight = cross(camera.forward, camera.up);

  const deltaForward = scale(normalize(camera.forward), near);
  const deltaY = scale(normalize(camera.up), y);
  const deltaX = scale(normalize(cameraRight), x);

  return addArray([deltaForward, deltaX, deltaY]);
}