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
import {CodecDecodeOptions} from "@luciad/ria/model/codec/Codec.js";
import {GeoJsonCodec, GeoJsonCodecConstructorOptions} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {Cursor} from "@luciad/ria/model/Cursor.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {createExtrudedShape} from "@luciad/ria/shape/ShapeFactory.js";

export interface AirspaceGeoJsonCodecConstructorOptions extends GeoJsonCodecConstructorOptions{
  lowerLimitProperty: string;
  upperLimitProperty: string;
}

/**
 * A GeoJson codec that creates extruded shapes for airspaces.
 */
export class AirspaceGeoJsonCodec extends GeoJsonCodec {

  private readonly _lowerLimitProperty: string;
  private readonly _upperLimitProperty: string;

  constructor(options: AirspaceGeoJsonCodecConstructorOptions) {
    super(options);
    this._lowerLimitProperty = options.lowerLimitProperty;
    this._upperLimitProperty = options.upperLimitProperty;
  }

  /**
   * Override decode to convert the decoded base shape to extruded shapes using lower and upper limit properties.
   */
  decode(object: CodecDecodeOptions): Cursor {

    const getHeightInMeters = (height: string): number => {
      height = height.toLowerCase();

      if (height.indexOf("fl") >= 0) {
        height = height.replace("fl", "").trim();
        return parseInt(height) * 100 * 0.3048;
      }

      if (height.indexOf("ft") >= 0) {
        height = height.replace("ft", "").trim();
        return parseInt(height) * 0.3048;
      }

      if (height.indexOf("none") >= 0) {
        //FL 10000
        return 10000 * 100 * 0.3048;
      }

      return 0;
    }

    const extrude = (feature: Feature, lowerLimitProperty: string, upperLimitProperty: string): Feature => {
      const baseShape = feature.shape!;
      const low = getHeightInMeters(feature.properties[lowerLimitProperty]);
      const high = getHeightInMeters(feature.properties[upperLimitProperty]);
      feature.shape = createExtrudedShape(baseShape.reference, baseShape, low, high);
      return feature;
    }

    const cursor = super.decode(object);
    const lowerLimit = this._lowerLimitProperty;
    const upperLimit = this._upperLimitProperty;

    return {
      hasNext: () => {
        return cursor.hasNext();
      },
      next: () => {
        return extrude(cursor.next(), lowerLimit, upperLimit);
      }
    };
  }
}
