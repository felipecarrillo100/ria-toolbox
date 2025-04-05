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
import bezier from "bezier-easing";
import {easeInOutCubic} from "@luciad/ria-toolbox-core/util/Easing.js";

export class MoveSpeedSupport {
  private readonly totalDistance: number;
  private readonly totalTime: number;

  private currentSpeed: number;
  private lastTimeFraction: number;
  private lastDistanceFraction: number;

  constructor(totalDistance: number, totalTime: number) {
    this.totalDistance = totalDistance; // m
    this.totalTime = totalTime / 1000; // ms => s
    this.currentSpeed = 0;
    this.lastTimeFraction = 0;
    this.lastDistanceFraction = 0;
  }

  update(timeFraction: number, distanceFraction: number): void {
    const timeDelta = (timeFraction - this.lastTimeFraction) * this.totalTime;
    const distanceDelta =
      (distanceFraction - this.lastDistanceFraction) * this.totalDistance;
    this.currentSpeed = timeDelta
      ? distanceDelta / timeDelta
      : this.currentSpeed;
    this.lastTimeFraction = timeFraction;
    this.lastDistanceFraction = distanceFraction;
  }

  getSpeed(): number {
    return this.currentSpeed;
  }

  getCurrentDistanceAndDurationLeft(fraction: number) {
    const left = 1 - fraction;
    return {
      distance: left * this.totalDistance,
      duration: left * this.totalTime * 1000, // ms
    };
  }

  createVelocityEasing(startSpeed: number) {
    if (startSpeed > 0) {
      const dTime = 0.1;
      const dDistance =
        (dTime * startSpeed * this.totalTime) / this.totalDistance;
      return bezier(dTime, dDistance, 0.8, 1);
    }
    return easeInOutCubic;
  }

  stop() {
    this.currentSpeed = 0;
  }
}
