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
import {Point} from "@luciad/ria/shape/Point.js";
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {distance, interpolateVectors} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {createGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {FlyAnimation} from "../animations/FlyAnimation.js";
import {BoundedCameraSupport} from "./BoundedCameraSupport.js";

/**
 * The minimum distance away from an anchor on a surface before we need to use ghost mode to zoom in further.
 */
const DEFAULT_MIN_DISTANCE_TO_SURFACE = 0.5;

/**
 * The duration of the animation (in milliseconds) of flying towards a new camera position.
 */
const DEFAULT_FLY_DURATION = 2_000;

/**
 * This value allows for a small buffer in which repeated calls to zoomAnimated will not do anything. Increase this
 * value to "debounce" the animated zooming.
 */
const FLY_REVERSE_DELAY = 100;

/**
 * Calculates the yaw to which the map camera should be set in order to look from the camera at the given point
 * `target`. If the change in degrees is smaller than the given `margin`, returns the current yaw (which would mean
 * the camera's yaw does not need to change).
 *
 * @param map The map of which to change the camera.
 * @param target The {@link Point}, in long/lat coordinates, at which the camera should look.
 * @param margin An optional degree maximum in which the yaw will not change. By default, 10 degrees.
 */
function computeTargetYaw(map: Map, target: Point, margin = 10) {
  const camera = map.camera as PerspectiveCamera;
  const {yaw} = camera.asLookFrom();
  const geodesy = createGeodesy(map.reference);
  const azimuth = geodesy.forwardAzimuth(camera.eyePoint, target);

  return Math.abs(azimuth - yaw) >= margin ? azimuth : yaw;
}

interface ZoomToAnchorOptions {
  /**
   * Whether to fly towards the anchor, or zoom a fraction "statically" (not animated).
   *
   * @default false
   */
  flying?: boolean;

  /**
   * Used to zoom faster (>1) or slower (<1).
   *
   * @default 1
   */
  speedRate?: number;

  /**
   * States if it is allowed to cross the anchor (surface).
   *
   * @default false
   */
  ghostMode?: boolean;

  /**
   * The minimum distance away from an anchor on a surface before we need to use ghost mode to zoom in further.
   *
   * @default 0.5
   */
  minDistanceToSurface?: number;

  /**
   * The duration of animated zooming, in milliseconds. Has no effect when {@link flying} is `false`.
   *
   * @default 2000
   */
  flyDuration?: number;
}

/**
 * Support class to help with zooming towards and behind a given anchor point
 */
export class ZoomSupport extends BoundedCameraSupport {
  private _flyAnimation: FlyAnimation | null = null;
  private _isFlyingBack = false;
  private _lastReverseFlyChangeTime = performance.now();

  /**
   * Zoom a given factor towards (factor > 0) or away from (factor < 0) the given anchor. The anchor will stay at the
   * same view position on the map.
   *
   * @return `true` if the surface was crossed (in ghost mode), otherwise `false`.
   */
  zoomToAnchor(
    map: Map,
    anchor: Point,
    factor: number,
    {
      flying = false,
      speedRate = 1,
      ghostMode = false,
      flyDuration = DEFAULT_FLY_DURATION,
      minDistanceToSurface = DEFAULT_MIN_DISTANCE_TO_SURFACE
    }: ZoomToAnchorOptions = {},
  ) {
    const options = {flying, speedRate, ghostMode, flyDuration, minDistanceToSurface};
    return flying
      ? this.zoomAnimated(map, anchor, factor, options)
      : this.zoomImmediate(map, anchor, factor, options);
  }

  /**
   * Zooms the map camera by a given fraction towards (or away from) the given anchor.
   */
  private zoomImmediate(
    map: Map,
    anchor: Point,
    factor: number,
    {speedRate, ghostMode, minDistanceToSurface}: Required<ZoomToAnchorOptions>,
  ): boolean {
    let fraction = factor * speedRate;
    const {eye} = map.camera;
    const distanceToAnchor = distance(anchor, eye);
    const newDistance = distanceToAnchor * (1 - fraction);
    let surfaceCrossed = false;

    if (fraction > 0 && newDistance < minDistanceToSurface) {
      if (ghostMode) {
        fraction = 2; // fly through the anchor (surface)
        surfaceCrossed = true;
      } else {
        // refuse to cross surface - move forward to the min distance
        fraction = 1 - minDistanceToSurface / distanceToAnchor;
      }
    }

    const newEye = interpolateVectors(eye, anchor, fraction);
    this.modifyCameraEye(map, newEye);
    return surfaceCrossed;
  }

  /**
   * Zoom the map camera by a given factor towards (or away from) the given anchor by animating to the new position to
   * be. If an animation was already running, and we're changing direction, we stop instead.
   */
  private zoomAnimated(
    map: Map,
    anchor: Point,
    factor: number,
    {speedRate, ghostMode, flyDuration, minDistanceToSurface}: Required<ZoomToAnchorOptions>,
  ): boolean {
    if (!(map.camera instanceof PerspectiveCamera)) {
      throw new Error("Expected provided Map instance to have a PerspectiveCamera");
    }

    const isFlyingBack = factor < 0;
    const now = performance.now();
    const isDirectionReversed = this._isFlyingBack !== isFlyingBack;
    if (isDirectionReversed && this._flyAnimation?.isPlaying()) {
      this._isFlyingBack = isFlyingBack;
      this._lastReverseFlyChangeTime = now;
      AnimationManager.removeAnimation(map.cameraAnimationKey);
      return false;
    }
    this._isFlyingBack = isFlyingBack;

    // Wait a small delay to prevent abrupt direction reversal.
    if (isDirectionReversed && (now - this._lastReverseFlyChangeTime <= FLY_REVERSE_DELAY)) {
      return false;
    }

    const camera = map.camera as PerspectiveCamera;
    const fraction = factor < 0
      ? factor
      : this.adjustForwardFlyFraction(camera.eye, anchor, factor, ghostMode, minDistanceToSurface);

    // Do not animate if we're not moving.
    if (fraction === 0) {
      return false;
    }

    const targetEye = interpolateVectors(camera.eye, anchor, fraction);
    if (this.acceptsCameraEye(map, targetEye)) {
      const duration = flyDuration / speedRate;
      const targetYaw = computeTargetYaw(map, anchor);
      this.runAnimation(map, targetEye, targetYaw, duration);
    }
    return fraction > 0;
  }

  /**
   * Adjusts the given forward zooming fraction to make sure it doesn't go past the minimum distance to the surface,
   * unless `ghostMode` is true, in which case it recalculates to fly a reasonable distance past that boundary.
   */
  private adjustForwardFlyFraction(
    eye: Vector3,
    anchor: Vector3,
    fraction: number,
    ghostMode: boolean,
    minDistanceToSurface: number,
  ): number {
    const distanceToAnchor = distance(eye, anchor);
    const distanceToFly = fraction * distanceToAnchor;
    const distanceToAnchorAfterFly = distanceToAnchor - distanceToFly;
    if (distanceToAnchorAfterFly < minDistanceToSurface) {
      if (!ghostMode) {
        // Stop or fly to anchor as close as it is possible.
        return 1.03 * distanceToAnchorAfterFly <= minDistanceToSurface
          ? 0
          : 1 - minDistanceToSurface / distanceToAnchor;
      }
      // Fly through the surface.
      return (distanceToAnchor + minDistanceToSurface) / distanceToAnchor;
    }

    // We're not in danger of "crashing into the surface", just fly forward.
    return fraction;
  }

  private runAnimation(
    map: Map,
    targetEye: Vector3,
    targetYaw: number,
    duration: number,
  ) {
    const startSpeed = this._flyAnimation?.getCurrentSpeed() || 0;
    this._flyAnimation = new FlyAnimation({
      map,
      targetEye,
      targetYaw,
      duration,
      startSpeed,
    });
    AnimationManager.putAnimation(map.cameraAnimationKey, this._flyAnimation, false)
      .then(() => (this._flyAnimation = null))
      .catch(() => undefined);
  }
}
