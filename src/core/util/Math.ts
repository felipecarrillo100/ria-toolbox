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
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/**
 * Returns the given value clamped by the given minimum and maximum
 */
export const clamp = (val: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, val));
}

/**
 * Returns the linear interpolation of given start and end numbers with given fraction
 */
export const interpolate = (start: number, end: number, t: number): number => {
  return start + t * (end - start);
};

/**
 * Returns the difference between the two given angles in degrees, normalized between -180 and 180
 */
export const shortestAngle = (a0: number, a1: number): number => {
  const max = 360;
  const da = Math.sign(a1 - a0) * (Math.abs(a1 - a0) % max);
  return Math.sign(a1 - a0) * (2 * Math.abs(da) % max) - da;
};

/**
 * Returns the linear interpolation of the given start and end angles in degrees with the given fraction
 */
export const interpolateAngle = (start: number, end: number, t: number): number => {
  return start + shortestAngle(start, end) * t;
};

/**
 * Returns the highest number that is smaller than or equal to the given number and starts with one,
 * two or five and only has trailing zeros.
 * This can be used for example to label scale indicators.
 */
export const findLower125 = (aNumber: number) => {
  const lowestValue = Math.pow(10, Math.floor(Math.log(aNumber) / Math.log(10)));
  if (aNumber > 5 * lowestValue) {
    return 5 * lowestValue;
  }
  if (aNumber > 2 * lowestValue) {
    return 2 * lowestValue;
  }
  return lowestValue;
}