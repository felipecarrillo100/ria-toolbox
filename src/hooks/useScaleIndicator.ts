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
import {useEffect, useState} from "react";
import {UnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasure.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";
import {findLower125} from "@luciad/ria-toolbox-core/util/Math.js";

const INCH_TO_CM = 2.54;
const CM_TO_METER = 100;
const DPI = 96; //canvas DPI is guaranteed to be 96.

/**
 * This hook can be used to get the text and size of a scale indicator, given a scale ratio and maximum pixel width.
 */
export const useScaleIndicator = (mapScale: number, maxWidthPixels: number, uom?: UnitOfMeasure) => {

  const [sizes, setSizes] = useState({
    width: 200,
    left: 0,
  });
  const [text, setText] = useState('---');

  useEffect(() => {
    // mapScale is a paper scale -> how many real world cm are displayed in 1cm.
    // recalculate to pixels per meter
    const pixelScale = mapScale * (DPI / INCH_TO_CM) * CM_TO_METER
    const barWidthInMeter = maxWidthPixels / pixelScale;
    const localDistanceUnit = findBestDistanceUOM(uom ?? METER, barWidthInMeter);
    const barWidthInDistanceUnit = findLower125(localDistanceUnit.convertFromStandard(barWidthInMeter));
    const barWidthInPixels = pixelScale * localDistanceUnit.convertToStandard(barWidthInDistanceUnit);
    setSizes({
      width: barWidthInPixels,
      left: (maxWidthPixels - barWidthInPixels) / 2
    });
    setText(barWidthInDistanceUnit + ' ' + localDistanceUnit.symbol);
  }, [mapScale, uom]);

  return {
    sizes,
    text
  }
};

const METER = getUnitOfMeasure("Meter");
const CM = getUnitOfMeasure("Centimeter");
const KM = getUnitOfMeasure("Kilometer");
const MILE = getUnitOfMeasure("Mile");
const FT = getUnitOfMeasure("Foot");

const findBestDistanceUOM = (aCurrentDistanceUnit: UnitOfMeasure, aLengthInMeter: number): UnitOfMeasure => {
  const aLengthInDistanceUnit = aCurrentDistanceUnit.convertFromStandard(aLengthInMeter);
  if (aCurrentDistanceUnit === METER && aLengthInDistanceUnit > 1000) {
    return KM;
  }
  if (aCurrentDistanceUnit === METER && aLengthInDistanceUnit < 1) {
    return CM;
  }
  if (aCurrentDistanceUnit === KM && aLengthInDistanceUnit < 1) {
    return METER;
  }
  if (aCurrentDistanceUnit === FT && MILE.convertFromStandard(aLengthInMeter) > 1) {
    return MILE;
  }
  if (aCurrentDistanceUnit === MILE && aLengthInDistanceUnit < 1) {
    return FT;
  }
  return aCurrentDistanceUnit;
}
