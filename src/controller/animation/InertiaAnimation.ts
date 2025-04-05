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
import {Animation} from "@luciad/ria/view/animation/Animation.js";
import {interpolate} from "@luciad/ria-toolbox-core/util/Math.js";

const INFLEXION = 0.15; // Tension lines cross at (INFLEXION, 1)
const FLING_FRICTION = 0.04;
const DPI = 96; //1 CSS px is defined as 1/96th of an inch
const METER_TO_INCH = 39.37;
const DECELERATION_RATE = Math.log(0.78) / Math.log(0.9);

const GRAVITY_EARTH_ACCELERATION = 9.80665;
const DECELERATION_FRICTION = 6.0 / DPI;
const PHYSICAL_COEFF = GRAVITY_EARTH_ACCELERATION * METER_TO_INCH * DPI * DECELERATION_FRICTION;

const START_TENSION = 0.5;
const END_TENSION = 1.0;
const NB_SAMPLES = 200;

const createSplineEase = (inflexion: number): (t: number) => number => {
  const splinePositions = new Array(NB_SAMPLES + 1);
  const p1 = START_TENSION * inflexion;
  const p2 = 1.0 - END_TENSION * (1.0 - inflexion);

  let x_min = 0.0;
  for (let i = 0; i < NB_SAMPLES; i++) {
    const alpha = i / NB_SAMPLES;

    let x_max = 1.0;
    let x, tx, coef;
    while (true) {
      x = x_min + (x_max - x_min) / 2.0;
      coef = 3.0 * x * (1.0 - x);
      tx = coef * ((1.0 - x) * p1 + x * p2) + x * x * x;
      if (Math.abs(tx - alpha) < 1E-5) {
        break;
      }
      if (tx > alpha) {
        x_max = x;
      } else {
        x_min = x;
      }
    }
    splinePositions[i] = coef * ((1.0 - x) * START_TENSION + x) + x * x * x;
  }
  splinePositions[NB_SAMPLES] = 1.0;

  return (t: number): number => {
    const index = Math.floor(NB_SAMPLES * t);
    if (index < NB_SAMPLES) {
      const t_inf = index / NB_SAMPLES;
      const t_sup = (index + 1) / NB_SAMPLES;
      const d_inf = splinePositions[index];
      const d_sup = splinePositions[index + 1];
      const velocityCoef = (d_sup - d_inf) / (t_sup - t_inf);
      return d_inf + (t - t_inf) * velocityCoef;
    }
    return t;
  };
};

const EASING = createSplineEase(INFLEXION);

function decelaration(velocity: number): number {
  return Math.log(INFLEXION * Math.abs(velocity) / (FLING_FRICTION * PHYSICAL_COEFF));
}

function calculateDuration(velocity: number): number {
  const deceleration = decelaration(velocity);
  return 1000.0 * Math.exp(deceleration / DECELERATION_RATE - 1.0);
}

function calculateDistance(velocity: number): number {
  const deceleration = decelaration(velocity);
  return FLING_FRICTION * PHYSICAL_COEFF * Math.exp((DECELERATION_RATE) / (DECELERATION_RATE - 1.0) * deceleration);
}

/**
 * Drag animation based on Android's Scroller
 */
export class InertiaAnimation extends Animation {

  _dragStartX: number;
  _dragStartY: number;
  _dragEndX: number;
  _dragEndY: number;
  _targetX: number;
  _targetY: number;
  _inertiaUpdateCallback: (dX: number, dY: number, x: number, y: number) => void;

  constructor(dragStartX: number, dragStartY: number, dragEndX: number, dragEndY: number, velocityX: number,
              velocityY: number,
              inertiaUpdateCallback: (startX: number, startY: number, x: number, y: number) => void) {
    const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    const duration = calculateDuration(velocity);
    super(duration);
    const distance = calculateDistance(velocity);
    const coeffX = velocity === 0 ? 1.0 : velocityX / velocity;
    const coeffY = velocity === 0 ? 1.0 : velocityY / velocity;
    this._dragStartX = dragStartX;
    this._dragStartY = dragStartY;
    this._dragEndX = dragEndX;
    this._dragEndY = dragEndY;
    this._targetX = dragEndX + (distance * coeffX);
    this._targetY = dragEndY + (distance * coeffY);
    this._inertiaUpdateCallback = inertiaUpdateCallback;
  }

  update(fraction: number): void {
    const easedFraction = EASING(fraction);
    const x = interpolate(this._dragEndX, this._targetX, easedFraction);
    const y = interpolate(this._dragEndY, this._targetY, easedFraction);
    this._inertiaUpdateCallback(this._dragStartX, this._dragStartY, x, y);
  }
}