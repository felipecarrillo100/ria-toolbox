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
import {distance, normalize, sub} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {Vector3} from '@luciad/ria/util/Vector3.js';

/**
 * Base implementation of a Curve.
 *
 * Note on parameters `t` and `u`
 *
 * In the `Curve` class there are 2 parameters, `t` and `u`. They both help to determine positions along the curve, but their usage differs.
 *
 * - Parameter `t`: Represents a direct proportion along the control points of the curve.
 *   When we use `getPoint(t)`, we're asking for the point at the position `t` proportionally along the direct path of control points.
 *   `t` ranges from `0` - representing the curve's start, to `1` - representing the curve's end.
 *   Note that the points obtained using `t` may not be evenly distributed along the curve's path, as `t` merely follows the direct line between each set of control points.
 *
 * - Parameter `u`: Represents the position relative to the arc length of the curve.
 *   When we use `getPointAt(u)`, we're requesting the point at a certain proportion `u` along the actual path of the curve.
 *   Like `t`, `u` ranges from `0` (start) to `1` (end).
 *   However, unlike `t`, `u` ensures the points are evenly distributed relative to the curve's path and not just along the lines connecting the control points.
 *
 * In general, parameter `t` offers a simple linear interpolation between control points, while `u` provides a more complex interpolation to ensure uniform spacing along the curved path.
 */
export abstract class Curve {
  private _arcLengthDivisions = 200;
  private _cacheArcLengths: number[] = [];
  private _needsUpdate = false;

  /**
   * Generates a vector point on the curve for a given parameter value.
   * This method applies an interpolation over the curve's control points.
   * @param t - The parameter value in the range [0, 1].
   *            For t=0, the curve's start point is returned. For t=1, the end point of the curve is returned.
   *            For any value in between, an intermediate point on the curve is calculated and returned.
   */
  abstract getPoint(t: number): Vector3;

  /**
   * Retrieves a point on the curve at a relative position defined by the arc length.
   *
   * This function first converts a unitless parameter `u`, representing a normalized measure of arc length,
   * into the corresponding parameter `t` of the curve. It then evaluates the curve at parameter `t` to produce a point.
   *
   * @param u - The relative position on the curve based on arc length, within the range [0, 1].
   *            For u=0, it returns the curve's start point; for u=1, the curve's end point.
   *            For any value in between, this function calculates and returns an intermediate point on the curve.
   *
   * @returns {Vector3} The point on the curve at the relative position `u`.
   */
  getPointAt(u: number): Vector3 {
    const t = this.getUtoT(u);
    return this.getPoint(t);
  }

  /**
   * Generates a sequence of point vectors positioned along the curve.
   * This method divides the curve into a specified number of segments and returns the end points of these segments as a series of vectors.
   * @param divisions - Specifies the number of segments the curve is divided into.
   */
  getPoints(divisions: number): Vector3[] {
    if (divisions === undefined) {
      divisions = 5;
    }

    const points = [];

    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPoint(d / divisions));
    }

    return points;
  }

  /**
   * Generates an evenly spaced sequence of points along the curve.
   *
   * This function divides the curve into a given number of segments and returns the
   * points located on the curve at the end of these segments. The operation uses the
   * `getPointAt(u)` method, which positions points relative to the curve's arc length.
   *
   * @param divisions - The number of segments to divide the curve into for point selection.
   */
  getSpacedPoints(divisions = 5): Vector3[] {
    const points = [];

    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPointAt(d / divisions));
    }

    return points;
  }

  /**
   * Computes the total length of the curve.
   * This method calculates the cumulative lengths of segments on the curve and returns the final cumulative
   * length, which represents the total length of the curve.
   */
  getLength(): number {
    const lengths = this.getLengths();
    return lengths[lengths.length - 1];
  }

  /**
   * Returns an array containing cumulative lengths of segments in the curve.
   *
   * This function splits the curve into a number of segments (defined by `divisions`),
   * and for each segment, calculates its length and adds it to the total of the previous lengths.
   * @param The number of segments to be used for the arc length computation.
   */
  private getLengths(divisions?: number): number[] {
    if (divisions === undefined) {
      divisions = this._arcLengthDivisions;
    }

    if (this._cacheArcLengths && this._cacheArcLengths.length === divisions + 1 && !this._needsUpdate) {
      return this._cacheArcLengths;
    }

    this._needsUpdate = false;

    const cache: number[] = [];
    let last = this.getPoint(0);
    let sum = 0;

    cache.push(0);

    for (let p = 1; p <= divisions; p++) {
      const current = this.getPoint(p / divisions);
      sum += distance(current, last);
      cache.push(sum);
      last = current;
    }

    this._cacheArcLengths = cache;
    return cache;
  }

  /**
   * Marks the object for recalculation of arc lengths and triggers the recalculation.
   * It's used to ensure that the internal arc length data is accurate after any modification to the curve.
   */
  updateArcLengths(): void {
    this._needsUpdate = true;
    this.getLengths();
  }

  /**
   * Converts a relative position (u) into the corresponding parameter (t) on the curve.
   * This conversion facilitates capturing points that are equidistant along the curve.
   *
   * @param u - The relative position on the curve based on arc length, within the range [0, 1].
   * @param distance - An alternative target distance on the curve.
   */
  private getUtoT(u: number, distance?: number): number {
    const arcLengths = this.getLengths();

    const il = arcLengths.length;

    let targetArcLength; // The targeted u distance value to get

    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }

    let low = 0;
    let high = il - 1;
    let i;

    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);

      const comparison = arcLengths[i] - targetArcLength;

      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;
      }
    }

    i = high;

    if (arcLengths[i] === targetArcLength) {
      return i / (il - 1);
    }

    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];

    const segmentLength = lengthAfter - lengthBefore;

    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

    return (i + segmentFraction) / (il - 1);
  }

  /**
   * Retrieves a unit vector that represents the tangent to the curve at the specified parameter (`t`).
   *
   * If a sub curve does not provide a method for tangent derivation, this function approximates the tangent
   * using the gradient between two points that are a small delta apart at `t`.
   *
   * @param t - the parameter on the curve where the tangent is provided, within the range [0, 1].
   */
  private getTangent(t: number): Vector3 {
    const delta = 0.0001;
    const t1 = Math.max(t - delta, 0);
    const t2 = Math.min(t + delta, 1);

    const pt1 = this.getPoint(t1);
    const pt2 = this.getPoint(t2);

    return normalize(sub(pt2, pt1));
  }

  private getTangentAt(u: number): Vector3 {
    const t = this.getUtoT(u);
    return this.getTangent(t);
  }
}
