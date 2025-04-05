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
import {Point} from "@luciad/ria/shape/Point.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Animation} from "@luciad/ria/view/animation/Animation.js";
import {Camera} from "@luciad/ria/view/camera/Camera.js";
import {LookFrom} from "@luciad/ria/view/camera/LookFrom.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Map} from "@luciad/ria/view/Map.js";
import {DEG2RAD, interpolate, RAD2DEG} from "@luciad/ria-toolbox-core/util/Math.js";

const ZOOM_ANIM_DURATION = 250;
const ZOOM_ANIM_EASE = function expOut(t: number): number {
  return (t === 1) ? 1 : -Math.exp(-3 * t + 0.03) + 1.03;
};

const toNDC = (viewPoint: Point, camera: Camera): Point => {
  const x = (viewPoint.x / (camera.width / 2)) - 1.0;
  const y = -((viewPoint.y / (camera.height / 2)) - 1.0);
  const z = (viewPoint.z * 2.0) - 1.0;
  return createPoint(null, [x, y, z]);
};

/**
 * Animation that zooms to the given field of view
 */
export class LookFromZoomAnimation extends Animation {

  private readonly _map: Map;
  private readonly _lookFrom: LookFrom;
  private readonly _startFOVy: number;
  private readonly _startFOVx: number;
  private readonly _startYaw: number;
  private readonly _startPitch: number;
  private readonly _targetFOVy: number;
  private readonly _targetFOVx: number;
  private readonly _targetYaw: number;
  private readonly _targetPitch: number;

  constructor(map: Map, targetFOVy: number, viewPoint: Point) {
    super(ZOOM_ANIM_DURATION);
    this._map = map;
    const camera = map.camera as PerspectiveCamera;
    this._startFOVy = camera.fovY;
    this._targetFOVy = targetFOVy;

    this._startFOVx = 2 * Math.atan(Math.tan(this._startFOVy * DEG2RAD / 2) * camera.aspectRatio) * RAD2DEG;
    this._targetFOVx = 2 * Math.atan(Math.tan(this._targetFOVy * DEG2RAD / 2) * camera.aspectRatio) * RAD2DEG;

    const ndc = toNDC(viewPoint, camera); // NDC: left = x=-1, right x=1, bottom = y=-1, top = y=1
    this._lookFrom = camera.asLookFrom();
    this._startYaw = this._lookFrom.yaw;
    const yawAtViewPoint = this._lookFrom.yaw + (ndc.x * (this._startFOVx / 2));
    this._targetYaw = yawAtViewPoint - (ndc.x * (this._targetFOVx / 2));

    this._startPitch = this._lookFrom.pitch;
    const pitchAtViewPoint = this._lookFrom.pitch + (ndc.y * (this._startFOVy / 2));
    this._targetPitch = pitchAtViewPoint - (ndc.y * (this._targetFOVy / 2));
  }

  update(fraction: number): void {
    const t = ZOOM_ANIM_EASE(fraction);
    const fovY = interpolate(this._startFOVy, this._targetFOVy, t);
    const yaw = interpolate(this._startYaw, this._targetYaw, t);
    const pitch = interpolate(this._startPitch, this._targetPitch, t);
    const lookFrom = {...this._lookFrom, yaw, pitch};
    const camera = this._map.camera as PerspectiveCamera;
    this._map.camera = camera.lookFrom(lookFrom).copyAndSet({fovY});
  }
}