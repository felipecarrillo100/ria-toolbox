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
/**
 * Formats the given angle in degrees with fixed precision of 1.
 * If the given angle is outside the range of the given minimum and maximum angles, this function will return an
 * empty string.
 */
export function formatAngle(angle: number, min?: number, max?: number): string {
  min = min || 10;
  max = max || 80;
  if (!angle || angle < min || angle > max) {
    return "";
  }
  return `${angle.toFixed(1)} deg`;
}

/**
 * Formats the given distance in meters as meters or kilometers, depending on its size.
 * If the given distance is smaller than the given minimum, this function will return an empty string.
 */
export function formatDistance(distance: number, min?: number): string {
  min = min || 1;
  if (!distance || distance < min) {
    return "";
  }
  if (distance > 1000) {
    distance /= 1000;
    return `${distance.toFixed(2)} km`;
  }
  return `${distance.toFixed(2)} m`;
}

/**
 * Formats the given height in meters with fixed precision of 1.
 */
export function formatHeight(h: number): string {
  return `${h.toFixed(1)} m`;
}

/**
 * Formats the given are in square meters as square meters or kilometers, depending on its size.
 * If the given area is smaller than the given minimum, this function will return an empty string.
 */
export function formatArea(area: number, min?: number): string {
  const M2_to_KM2 = 1000 * 1000;

  min = min || 1;
  if (!area || area < min) {
    return "";
  }
  if (area > M2_to_KM2) {
    area /= M2_to_KM2;
    return `${area.toFixed(2)} km2`;
  }
  return `${area.toFixed(2)} m2`;
}

/**
 * Returns a function that formats a given number as a string using fixed-point notation with an optional given unit
 */
export function getFixedPrecisionFormatter(precision: number, unit: string = "") {
  return (value: number) => value.toFixed(precision) + unit;
}

export const defaultValueFormatter = getFixedPrecisionFormatter(1);

/**
 * Returns a function that formats a given amount of hours as h:mm
 */
export const hourFormatter = (value: number) => {
  const hr = Math.floor(+value);
  const minutes = Math.round((+value % 1) * 60);
  return hr + ":" + (minutes > 9 ? minutes : "0" + minutes);
}

/**
 * Returns a function that formats numbers rounded to their first digit after the decimal point with a % postfix
 */
export const percentFormatter = (value: number) => Math.round(value * 10) / 10 + "%";

/**
 * Converts a given string that represents coordinates in degrees, minutes and seconds to decimal degrees
 */
export function parseDMStoDD(value: string) {
  let deg = 0;
  let min = 0;
  let sec = 0;
  let isNegative = false;
  let start = 0;
  let index = value.indexOf("\u00b0", start);
  if (index < 0) {
    return undefined;
  }

  if (index === 0) {
    deg = 0;
  } else {
    deg = parseInt(value.substring(0, index), 10);
    if (isNaN(deg)) {
      return undefined;
    } else if (deg < 0) {
      deg = Math.abs(deg);
      isNegative = true;
    }
  }

  start = index + 1;
  index = value.indexOf("\'", start);
  if (index < 0) {
    min = 0;
  } else if (index === 0) {
    min = 0;
    start = index + 1;
  } else {
    min = parseInt(value.substr(start, index - start), 10);
    if (isNaN(min) || min < 0.0 || min > 60.0) {
      return undefined;
    }
    start = index + 1;
  }

  index = value.indexOf("\"", start);
  if (index <= 0) {
    sec = 0;
  } else {
    sec = parseFloat(value.substr(start, index - start));
    if (isNaN(sec) || sec < 0.0 || sec > 60.0) {
      return undefined;
    }
  }
  let result = deg + (min / 60.0) + sec / 3600.0;
  if (isNegative) {
    result = -result;
  }
  return result;
}

export function qualityFactorFormatter(qualityFactor: number): string {
  let qualityText = "Fast";
  if (qualityFactor > 0.7) {
    qualityText = "Accurate";
  } else if (qualityFactor > 0.4) {
    qualityText = "Normal";
  }
  return qualityText;
}

export function maxPointCountFormatter(maxPointCount: number) {
  return (pointCount: number) => {
    return pointCount >= maxPointCount ? "Unlimited" : getFixedPrecisionFormatter(1, "Million")(pointCount);
  }
}

// takes a string from an enum in the form MY_ENUM_VALUE and switches '_' to ' ' and keep only the first letter as uppercase.
export function stringEnumToString(enumName: string): string {
  return enumName.charAt(0) + enumName.substring(1).toLowerCase().replace(/_/gi, " ")
}