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
import {Animation} from "@luciad/ria/view/animation/Animation.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {distance, interpolateVectors} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {interpolateAngle} from "@luciad/ria-toolbox-core/util/Math.js";
import {MoveSpeedSupport} from "./MoveSpeedSupport.js";

export interface FlyAnimationOptions {
  map: Map;
  startSpeed: number;
  targetEye: Vector3;
  targetYaw?: number;
  duration: number;
}

/**
 * The FlyAnimation animates the camera towards a new camera position, animating the yaw and pitch camera orientation.
 */
export class FlyAnimation extends Animation {
  private readonly map: Map;
  private readonly startYaw: number;
  private readonly startEye: Vector3;
  private readonly easeFunc: (t: number) => number;
  private readonly targetEye: Vector3;
  private readonly targetYaw: number | null;
  private readonly speedSupport: MoveSpeedSupport;
  private lastFraction: number;

  constructor({
                map,
                targetEye,
                targetYaw,
                duration,
                startSpeed,
              }: FlyAnimationOptions) {
    super(duration);

    this.map = map;
    const startLookFrom = (map.camera as PerspectiveCamera).asLookFrom();
    this.startYaw = startLookFrom.yaw % 360;
    this.startEye = startLookFrom.eye;

    this.targetEye = targetEye;
    this.targetYaw = targetYaw ?? null;
    this.lastFraction = 0;

    const distanceToTravel = distance(this.startEye, this.targetEye);
    this.speedSupport = new MoveSpeedSupport(distanceToTravel, duration);
    this.easeFunc = this.speedSupport.createVelocityEasing(startSpeed);
  }

  /**
   * Finds out if the animation is being played.
   */
  isPlaying(): boolean {
    return this.lastFraction > 0 && this.lastFraction < 1.0;
  }

  getCurrentSpeed(): number {
    return this.speedSupport.getSpeed();
  }

  override update(fraction: number) {
    this.lastFraction = fraction;
    fraction = this.easeFunc(fraction);

    const camera = this.map.camera as PerspectiveCamera;
    const lookFromCamera = camera.asLookFrom();

    lookFromCamera.eye = interpolateVectors(this.startEye, this.targetEye, fraction);

    if (this.targetYaw !== null) {
      lookFromCamera.yaw = interpolateAngle(this.startYaw, this.targetYaw, fraction);
    }

    lookFromCamera.roll = 0;

    this.map.camera = camera.lookFrom(lookFromCamera);
    this.speedSupport.update(this.lastFraction, fraction);
  }

  override onStop() {
    super.onStop();
    this.lastFraction = 1;
    this.speedSupport.stop();
  }
}
