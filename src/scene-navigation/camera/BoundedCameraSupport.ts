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
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {Map} from "@luciad/ria/view/Map.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {LookFrom} from "@luciad/ria/view/camera/LookFrom.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {toPoint} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {isPointInBounds} from "@luciad/ria-toolbox-core/util/BoundsUtil.js";

export class BoundedCameraSupport {
  private readonly _bounds: Bounds | null;

  constructor(bounds: Bounds | null = null) {
    this._bounds = bounds;
  }

  /**
   * Checks whether the camera-eye-to-be for the given map's camera will fit within the bounds passed to the
   * constructor. If no bounds was passed at creation time, this function will always return true.
   *
   * @param map The map whose camera eye should be set to the new eye.
   * @param eye The new camera position, expressed as a {@link Vector3}.
   */
  acceptsCameraEye(map: Map, eye: Vector3) {
    const eyePoint = toPoint(map.camera.worldReference, eye);
    return !this._bounds || isPointInBounds(eyePoint, this._bounds);
  }

  /**
   * Sets the camera of the given map to a copy of the current camera with the given {@link Vector3} as new eye. Only
   * works on a map with a PerspectiveCamera. Calls {@link acceptsCameraEye} first to determine if the new camera
   * position is still in bounds.
   *
   * @param map The map whose camera to modify.
   * @param eye The eye of the modified camera.
   * @param stopAnimations Whether to stop any currently running camera animations.
   *
   * @throws - When the map camera is not a {@link PerspectiveCamera}
   */
  modifyCameraEye(map: Map, eye: Vector3, stopAnimations = false) {
    if (!(map.camera instanceof PerspectiveCamera)) {
      throw new Error("Expected provided Map instance to have a PerspectiveCamera");
    }

    if (this.acceptsCameraEye(map, eye)) {
      if (stopAnimations) {
        AnimationManager.removeAnimation(map.cameraAnimationKey);
      }
      map.camera = map.camera.copyAndSet({eye});
    }
  }

  /**
   * Sets the camera of the given map to a camera that matches the given LookFrom. Only works on a map with a
   * PerspectiveCamera. Calls {@link acceptsCameraEye} first to determine if the new camera position is still in bounds.
   *
   * @param map The map whose camera to modify.
   * @param lookFrom The LookFrom to which the camera will be set.
   * @param stopAnimations Whether to stop any currently running camera animations.
   *
   * @throws - When the map camera is not a {@link PerspectiveCamera}
   */
  modifyCameraLookFrom(map: Map, lookFrom: LookFrom, stopAnimations = false) {
    if (!(map.camera instanceof PerspectiveCamera)) {
      throw new Error("Expected provided Map instance to have a PerspectiveCamera");
    }

    if (this.acceptsCameraEye(map, lookFrom.eye)) {
      if (stopAnimations) {
        AnimationManager.removeAnimation(map.cameraAnimationKey);
      }
      map.camera = map.camera.lookFrom(lookFrom);
    }
  }
}
