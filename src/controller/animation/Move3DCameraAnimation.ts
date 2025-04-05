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
import {clamp, interpolate, interpolateAngle} from "@luciad/ria-toolbox-core/util/Math.js";
import {Geodesy} from "@luciad/ria/geodesy/Geodesy.js";
import {createCartesianGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Animation} from "@luciad/ria/view/animation/Animation.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Map} from "@luciad/ria/view/Map.js";
import {easeInOutCubic} from "@luciad/ria-toolbox-core/util/Easing.js";

/**
 * Camera animation that linearly interpolates the current camera to the given camera properties
 */
export class Move3DCameraAnimation extends Animation {
  private readonly _targetPosition: Point;
  private readonly _targetPitch: number;
  private readonly _targetYaw: number;
  private readonly _targetRoll: number;
  private readonly _targetFovY: number;
  private readonly _map: Map;
  private readonly _geodesy: Geodesy;
  private readonly _sourcePosition: Point;
  private readonly _sourcePitch: number;
  private readonly _sourceYaw: number;
  private readonly _sourceRoll: number;
  private readonly _sourceFovY: number;

  constructor(map: Map, targetPosition: Point, targetYaw: number, targetPitch: number,
              targetRoll: number, targetFovY: number, duration: number) {
    super(duration);
    const toWorld = createTransformation(targetPosition.reference!, map.reference);
    this._targetPosition = toWorld.transform(targetPosition);
    this._targetPitch = targetPitch;
    this._targetYaw = targetYaw;
    this._targetRoll = targetRoll;
    this._targetFovY = targetFovY;
    this._map = map;
    this._geodesy = createCartesianGeodesy(map.reference);

    const perspectiveCamera = map.camera as PerspectiveCamera;
    const lookFrom = perspectiveCamera.asLookFrom();
    this._sourcePosition = perspectiveCamera.eyePoint;
    this._sourcePitch = lookFrom.pitch;
    this._sourceYaw = lookFrom.yaw;
    this._sourceRoll = lookFrom.roll;
    this._sourceFovY = perspectiveCamera.fovY;
  }

  update(fraction: number): void {
    fraction = clamp(easeInOutCubic(fraction), 0.0, 1.0);
    this._map.camera = (this._map.camera as PerspectiveCamera).lookFrom({
      eye: this._geodesy.interpolate(this._sourcePosition, this._targetPosition, fraction),
      yaw: interpolateAngle(this._sourceYaw, this._targetYaw, fraction),
      pitch: interpolate(this._sourcePitch, this._targetPitch, fraction),
      roll: interpolateAngle(this._sourceRoll, this._targetRoll, fraction)
    }).copyAndSet({
      fovY: interpolate(this._sourceFovY, this._targetFovY, fraction)
    });
  }
}

/**
 * Returns an animation that linearly interpolates the current map's camear to the given target camera
 */
export function create3DCameraAnimation(map: Map, targetCamera: PerspectiveCamera, duration: number) {
  const lookFrom = targetCamera.asLookFrom();
  return new Move3DCameraAnimation(map, targetCamera.eyePoint, lookFrom.yaw, lookFrom.pitch, lookFrom.roll,
      targetCamera.fovY, duration)
}