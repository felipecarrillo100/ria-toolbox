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
import {Move3DCameraAnimation} from '@luciad/ria-toolbox-controller/animation/Move3DCameraAnimation.js';
import {AnimationManager} from '@luciad/ria/view/animation/AnimationManager.js';
import {PerspectiveCamera} from '@luciad/ria/view/camera/PerspectiveCamera.js';
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {PathFeature} from './model/PathFeature.js';
import {PathPointVectors} from "./PathData.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";

/**
 * Places the camera at an interpolated position along the specified path.
 *
 * @param map - The RIA map instance.
 * @param pathFeature - The path feature defining the path on which the camera will be placed.
 * @param fraction - A number between 0 and 1 representing the position along the path.
 * @param withRollFix - If `true`, the camera's roll will be reset to 0. Defaults to `true`.
 */
export function setCameraOnPath(map: WebGLMap, pathFeature: PathFeature, fraction: number, withRollFix = true): void {
  if (!pathFeature.isEmpty()) {
    const pathCamera = map.camera.copyAndSet(pathFeature.getVectorsAtFraction(fraction));
    if (withRollFix) {
      const asLookFrom = pathCamera.asLookFrom();
      asLookFrom.roll = 0;
      map.camera = pathCamera.lookFrom(asLookFrom);
    } else {
      map.camera = pathCamera;
    }
  }
}

/**
 * Animates the camera to the specified path point to edit its location.
 * @param map - The map instance.
 * @param pathPointVectors - The vectors defining the camera's eye, forward, and up directions.
 * @param distance - The target distance to the point in meters.
 * @param duration - The duration of the animation in milliseconds.
 * @returns A promise that resolves when the animation is complete.
 */
export async function flyToPathPointLocation(
    map: WebGLMap,
    pathPointVectors: PathPointVectors,
    distance: number,
    duration = 500
): Promise<void> {
  const camera = map.camera as PerspectiveCamera;
  const cameraAt = camera.copyAndSet(pathPointVectors);
  const {eye, yaw} = cameraAt.asLookFrom();
  const targetCamera = camera.lookAt({
    ref: eye,
    distance,
    pitch: -20,
    yaw: yaw + 5,
    roll: 0,
  });

  return animateCamera(map, targetCamera, duration, true);
}

/**
 * Animates the camera to the specified tour path.
 * @param map - The map instance.
 * @param pathBounds - The bounds of the path to which the camera should fly.
 * @param duration - The duration of the animation in milliseconds (default is 1000).
 * @returns A promise that resolves when the animation is complete.
 */
export async function flyToPath(map: WebGLMap, pathBounds: Bounds, duration = 1000): Promise<void> {
  const {width, height, focusPoint} = pathBounds;
  const distance = 1.5 * Math.max(width, height) || 100;
  const camera = map.camera as PerspectiveCamera;
  const {yaw} = camera.asLookFrom();
  const targetCamera = camera.lookAt({
    ref: focusPoint,
    pitch: -20,
    roll: 0,
    distance,
    yaw,
  });

  return animateCamera(map, targetCamera, duration, true);
}

export async function animateCamera(
    map: WebGLMap,
    targetCamera: PerspectiveCamera,
    duration: number,
    withRollFix: boolean
): Promise<void> {
  const targetLookFrom = targetCamera.asLookFrom();
  const targetRoll = withRollFix ? 0 : targetLookFrom.roll;
  const animation = new Move3DCameraAnimation(
      map,
      targetCamera.eyePoint,
      targetLookFrom.yaw,
      targetLookFrom.pitch,
      targetRoll,
      targetCamera.fovY,
      duration
  );

  return AnimationManager.putAnimation(map.cameraAnimationKey, animation, false).catch(() => undefined);
}
