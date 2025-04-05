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
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {Polyline} from '@luciad/ria/shape/Polyline.js';
import {createPoint, createPolyline} from '@luciad/ria/shape/ShapeFactory.js';
import {PathPointFeature} from './PathPointFeature.js';
import {CatmullRomCurve} from './CatmullRomCurve.js';
import {vectorsToPolyline} from "../view/TourDrawUtils.js";
import {PathData, PathKeyframe, PathPointVectors} from "../PathData.js";
import {copy, sameVectors} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {TOUR_MODEL_REFERENCE, TourPathSupport} from "../TourPathSupport.js";

/**
 * The internal `PathFeature` class defines a LuciadRIA feature representing a path object.
 * Note: This class is used internally and is not intended for API use.
 * If you wish to update a `PathFeature`, use appropriate methods provided by the `TourPathSupport` class.
 */
export class PathFeature extends Feature<Polyline> {
  private _name: string;
  private _duration: number; // in milliseconds
  private _keyframeIds: string[] = [];
  private _eyeSpline = new CatmullRomCurve([], false);
  private _forwardSpline = new CatmullRomCurve([], false);
  private _upSpline = new CatmullRomCurve([], false);
  private _pathPointFeatures: PathPointFeature[] = [];

  constructor({id, name, closed, duration, keyframes}: PathData) {
    super(createPolyline(TOUR_MODEL_REFERENCE, []), {}, id);

    this.resetSplines(keyframes, closed);

    this._name = name;
    this._duration = duration;
  }

  getPathData(): PathData {
    const {id, name, closed, duration, keyframes} = this;
    return {id, name, closed, duration, keyframes};
  }

  override get id(): string {
    return super.id as string;
  }

  override set id(id: string) {
    super.id = id;
  }

  /**
   * Gets the name of the current path.
   * @returns The name as a string.
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the duration for the complete tour playback.
   * @returns The duration in milliseconds.
   */
  get duration(): number {
    return this._duration;
  }

  /**
   * Returns whether the tour path is 'closed' (circular).
   * @returns `true` if the path is circular; `false` otherwise.
   */
  get closed(): boolean {
    return this._eyeSpline.closed;
  }

  /**
   * Gets the keyframes that build up the path.
   * @returns An array of `PathKeyframe` objects.
   */
  get keyframes(): PathKeyframe[] {
    const keyframes: PathKeyframe[] = [];
    for (let i = 0; i < this.getSize(); i++) {
      keyframes.push({
        id: this._keyframeIds[i],
        tension: this._eyeSpline.tensions[i],
        eye: {...this._eyeSpline.vectors[i]},
        forward: {...this._forwardSpline.vectors[i]},
        up: {...this._upSpline.vectors[i]}
      });
    }
    return keyframes;
  }

  /**
   * Updates the name of the path feature.
   * @param value - The new name to set.
   * @returns `true` if the name was updated.
   */
  setPathName(value: string): boolean {
    if (value === this._name) {
      return false;
    }
    this._name = value;
    return true;
  }

  /**
   * Updates the duration of the path feature.
   * @param value - The new duration in milliseconds.
   * @returns `true` if the duration was updated (i.e., the new value is different from the current duration).
   */
  setPathDuration(value: number): boolean {
    if (value === this._duration) {
      return false;
    }
    this._duration = value;
    return true;
  }

  /**
   * Determines whether the path should be closed (circular) or not.
   * @param value - `true` if the path is to be closed; `false` otherwise.
   * @returns `true` if the 'closed' setting was updated.
   */
  setPathClosed(value: boolean): boolean {
    if (value === this.closed) {
      return false;
    }
    this._eyeSpline.closed = value;
    this._forwardSpline.closed = value;
    this._upSpline.closed = value;
    this.invalidateTrajectory();
    return true;
  }

  /**
   * Updates the keyframes (path points) of the path feature.
   *
   * Note: This method should not be used directly as it is intended for internal use.
   * If you wish to update Keyframes of a `PathFeature`, use appropriate methods provided by the `TourPathSupport` class,
   * e.g. `setPathKeyframes`.
   */
  setPathKeyframes(value: PathKeyframe[]): boolean {
    const pathKeyframes = value.map(copyKeyframe);

    if (this.getSize() !== pathKeyframes.length) {
      this.resetSplines(pathKeyframes, this.closed);
      return true;
    }

    // tells if any property has changed
    let changed = false;
    // tells if the trajectory polyline should be recreated. This happens when an eye or a tension changed.
    let shouldInvalidateTrajectory = false;
    // tells if a keyframe id has changed.
    let keyframeIdChanged = false;

    this.keyframes.forEach((keyframe, index) => {
      const {id, tension, eye, forward, up} = pathKeyframes[index];
      if (keyframe.tension !== tension || !sameVectors(keyframe.eye, eye)) {
        this._eyeSpline.update(index, eye, tension);
        shouldInvalidateTrajectory = true;
        changed = true;
      }
      if (!sameVectors(keyframe.forward, forward)) {
        this._forwardSpline.update(index, forward);
        changed = true;
      }
      if (!sameVectors(keyframe.up, up)) {
        this._upSpline.update(index, up);
        changed = true;
      }
      if (id !== this._keyframeIds[index]) {
        this._keyframeIds[index] = id;
        keyframeIdChanged = true;
        changed = true;
      }
    });

    if (shouldInvalidateTrajectory) {
      this.invalidateTrajectory();
    }
    if (keyframeIdChanged) {
      this.invalidatePathPoints();
    }
    return changed;
  }

  /**
   * Retrieves the list of point features making up the path.
   * @returns An array of `PathPointFeature` objects representing the points in the path.
   */
  getPathPointFeatures(): PathPointFeature[] {
    return this._pathPointFeatures;
  }

  /**
   * Checks if the path is empty.
   * @returns `true` if the path contains no points, `false` otherwise.
   */
  isEmpty(): boolean {
    return this.getSize() === 0;
  }

  /**
   * Returns the number of points in the path.
   * @returns The total number of points in the path.
   */
  getSize(): number {
    return this._eyeSpline.vectors.length;
  }

  /**
   * Gets the interpolated camera vectors for the given fraction.
   */
  getVectorsAtFraction(fraction: number): PathPointVectors {
    if (this.isEmpty()) {
      throw new Error('The tour path is empty');
    }
    fraction = this.getSize() > 1 ? fraction : 0;
    return {
      eye: this._eyeSpline.getPoint(fraction),
      forward: this._forwardSpline.getPoint(fraction),
      up: this._upSpline.getPoint(fraction),
    };
  }

  /**
   * Gets nearest path point that is before the given fraction.
   * @param fraction the path fraction, value between 0-1.
   */
  getPathPointBefore(fraction: number): PathPointFeature | null {
    if (this.isEmpty()) {
      return null;
    }
    const points = this.getPathPointFeatures();
    const nearestPoint = [...points].reverse().find(point => point.fraction < fraction);
    return nearestPoint || points[points.length - 1];
  }

  /**
   * Gets nearest path point that is after the given fraction.
   * @param fraction the path fraction, value between 0-1.
   */
  getPathPointAfter(fraction: number): PathPointFeature | null {
    if (this.isEmpty()) {
      return null;
    }

    const points = this.getPathPointFeatures();
    const nearestPoint = points.find(point => point.fraction > fraction);
    return nearestPoint || points[0];
  }

  /**
   * Recreates the path's trajectory (a fine polyline over the path points).
   */
  invalidateTrajectory() {
    const size = this.getSize();
    if (size === 1) {
      this.shape = vectorsToPolyline(TOUR_MODEL_REFERENCE, this._eyeSpline.vectors);
    } else if (size > 1) {
      // Ensure a minimum number of divisions (for smoothness) and maximum (for performance).
      const divisions = Math.min(20 * size, 400);
      const eyeVec = this._eyeSpline.getPoints(divisions);
      this.shape = vectorsToPolyline(TOUR_MODEL_REFERENCE, eyeVec);
    } else {
      this.shape = createPolyline(TOUR_MODEL_REFERENCE, []);
    }

    this.invalidatePathPoints();
  }

  private resetSplines(keyframes: PathKeyframe[], closed: boolean) {
    const eyes = keyframes.map(k => copy(k.eye));
    const forwardVectors = keyframes.map(k => copy(k.forward));
    const pathPointTensions = keyframes.map(k => k.tension);
    const upVectors = keyframes.map(k => copy(k.up));

    this._eyeSpline = new CatmullRomCurve(eyes, closed, pathPointTensions);
    this._forwardSpline = new CatmullRomCurve(forwardVectors, closed);
    this._upSpline = new CatmullRomCurve(upVectors, closed);
    this._keyframeIds = keyframes.map(k => k.id);

    this.invalidateTrajectory();
  }

  /**
   * Recreates the collection of path point features.
   */
  private invalidatePathPoints() {
    const pathPointFeatures: PathPointFeature[] = [];

    for (let index = 0; index < this.getSize(); index++) {
      const {x, y, z} = this._eyeSpline.vectors[index];
      const pathPoint = createPoint(TOUR_MODEL_REFERENCE, [x, y, z]);
      pathPointFeatures.push(new PathPointFeature(pathPoint, {parent: this, index}, this._keyframeIds[index]));
    }
    this._pathPointFeatures = pathPointFeatures;
  }

  /**
   * Returns the total length of the path, in meters.
   */
  getTrajectoryLength() {
    return this.getSize() > 1 ? this._eyeSpline.getLength() : 0;
  }

  /**
   * Gets the path point vectors (eye, forward, up) for the given point index.
   */
  getPathPointVectors(index: number): PathPointVectors {
    if (index < 0 || index >= this._eyeSpline.vectors.length) {
      throw new Error(`Tour tool: the path point index (${index}) out of range`);
    }
    return {
      eye: this._eyeSpline.vectors[index],
      forward: this._forwardSpline.vectors[index],
      up: this._upSpline.vectors[index]
    }
  }
}

function copyKeyframe({eye, forward, up, tension, id}: PathKeyframe): PathKeyframe {
  return {
    eye: copy(eye),
    forward: copy(forward),
    up: copy(up),
    tension,
    id
  }
}