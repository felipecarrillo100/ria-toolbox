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
import {Vector3} from '@luciad/ria/util/Vector3.js';
import {Curve} from './Curve.js';

class CubicPolyline {
  c0 = 0;
  c1 = 0;
  c2 = 0;
  c3 = 0;

  /*
   * cubic polynomial coefficients
   *  p(v) = c0 + c1*v + c2*v^2 + c3*v^3
   * where:
   *  p(0) = v1, p(1) = v2
   *  p'(0) = tm1, p'(1) = tm2.
   */
  initCatmullRom(v0: number, v1: number, v2: number, v3: number, t1: number, t2: number): void {
    // tension magnitudes
    const tm1 = t1 * (v2 - v0);
    const tm2 = t2 * (v3 - v1);

    this.c0 = v1;
    this.c1 = tm1;
    this.c2 = -3 * v1 + 3 * v2 - 2 * tm1 - tm2;
    this.c3 = 2 * v1 - 2 * v2 + tm1 + tm2;
  }

  calc(t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return this.c0 + this.c1 * t + this.c2 * t2 + this.c3 * t3;
  }
}

const px = new CubicPolyline();
const py = new CubicPolyline();
const pz = new CubicPolyline();

const DEFAULT_TENSION = 0.5;

/**
 * Based on
 *  - http://stackoverflow.com/questions/9489736/catmull-rom-curve-with-no-cusps-and-no-self-intersections/
 *  - http://www.cemyuksel.com/research/catmullrom_param/catmullrom.pdf
 *
 * Note: This class is used internally and is not intended for API use.
 */
export class CatmullRomCurve extends Curve {
  private readonly _vectors: Vector3[];
  private readonly _tensions: number[];
  private _closed: boolean;

  constructor(points: Vector3[], closed: boolean, tensions?: number[]) {
    super();
    this._vectors = points;
    this._tensions = tensions ?? Array(points.length).fill(DEFAULT_TENSION);
    this._closed = closed;
  }

  /**
   * Updates a control point and its corresponding tension on the curve using the provided index.
   * @param index - The index of the control point to be updated.
   * @param vector - The new position for the control point at the provided index.
   * @param tension - The new tension for the control point at the index, defaults to DEFAULT_TENSION if not provided.
   */
  update(index: number, vector: Vector3, tension = DEFAULT_TENSION) {
    if (index < this._vectors.length) {
      this._vectors[index] = vector;
      this._tensions[index] = tension;
      this.updateArcLengths();
    }
  }

  /**
   * Adds a new control point to the curve, with a corresponding tension.
   * @param vector - The point to be appended to the curve.
   * @param tension - The tension at the point being added.
   */
  add(vector: Vector3, tension = DEFAULT_TENSION) {
    const index = this._vectors.length;
    this._vectors[index] = vector;
    this._tensions[index] = tension;
    this.updateArcLengths();
  }

  /**
   * Retrieves the array of control points (vectors) that define the shape of the curve.
   */
  get vectors(): Vector3[] {
    return this._vectors;
  }

  /**
   * Retrieves the array of tensions at each control point of the curve.
   */
  get tensions(): number[] {
    return this._tensions;
  }

  /**
   * Returns whether the curve is closed.
   */
  get closed(): boolean {
    return this._closed;
  }

  set closed(value: boolean) {
    if (this._closed !== value) {
      this._closed = value;
      this.updateArcLengths();
    }
  }

  /**
   * Generates a vector point on the curve for a given parameter value.
   * This method applies the Catmull-Rom interpolation over the curve's control points.
   */
  override getPoint(t: number): Vector3 {
    const points = this._vectors;
    const len = points.length;
    const isClosed = this._closed;

    if (points.length === 0) {
      return {x: 0, y: 0, z: 0};
    }
    if (points.length === 1) {
      const {x, y, z} = points[0];
      return {x, y, z};
    }

    const p = (len - (isClosed ? 0 : 1)) * t;
    let idx = Math.floor(p);
    let weight = p - idx;

    if (this._closed) {
      idx += idx > 0 ? 0 : (Math.floor(Math.abs(idx) / len) + 1) * len;
    } else if (weight === 0 && idx === len - 1) {
      idx = len - 2;
      weight = 1;
    }

    const idx1 = idx % len;
    const idx2 = (idx + 1) % len;
    const p1 = points[idx1];
    const p0 = isClosed || idx > 0 ? points[(idx - 1) % len] : p1;
    const p2 = points[idx2];
    const p3 = isClosed || idx + 2 < len ? points[(idx + 2) % len] : p2;

    const t1 = this._tensions[idx1];
    const t2 = this._tensions[idx2];

    px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, t1, t2);
    py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, t1, t2);
    pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, t1, t2);

    return {
      x: px.calc(weight),
      y: py.calc(weight),
      z: pz.calc(weight),
    };
  }
}
