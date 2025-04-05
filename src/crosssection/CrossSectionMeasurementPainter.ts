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
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Measurement, MeasurementPaintStyles} from "@luciad/ria-toolbox-ruler3d/measurement/Measurement.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {DEFAULT_POINT_STYLE} from "./CartesianRulerController.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";

const MAIN_LINE_COLOR = '#0693E3';
const HELPER_LINE_COLOR = '#0693E3';
const AREA_COLOR = 'rgb(152,194,60, 0.6)';

const OCCLUDED_MAIN_LINE_COLOR = 'rgba(250,250,250,0.6)';
const OCCLUDED_HELPER_LINE_COLOR = 'rgba(250,250,250,0.6)';
const OCCLUDED_AREA_COLOR = 'rgba(250,250,250,0.3)';

const HTML_LABEL_STYLE =
    'font: bold 14px sans-serif;color:white;user-select: none';

const PAINT_STYLES: MeasurementPaintStyles = {
  mainLineStyles: [
    {
      stroke: {
        color: MAIN_LINE_COLOR,
        width: 2,
      },
      occlusionMode: OcclusionMode.VISIBLE_ONLY,
    },
    {
      stroke: {
        color: OCCLUDED_MAIN_LINE_COLOR,
        width: 2,
      },
      occlusionMode: OcclusionMode.OCCLUDED_ONLY,
    },
  ],
  helperLineStyles: [
    {
      stroke: {
        color: HELPER_LINE_COLOR,
        width: 2,
      },
      occlusionMode: OcclusionMode.VISIBLE_ONLY,
    },
    {
      stroke: {
        color: OCCLUDED_HELPER_LINE_COLOR,
        width: 2,
      },
      occlusionMode: OcclusionMode.OCCLUDED_ONLY,
    },
  ],
  areaStyles: [
    {
      fill: {
        color: AREA_COLOR,
      },
      occlusionMode: OcclusionMode.VISIBLE_ONLY,
    },
    {
      fill: {
        color: OCCLUDED_AREA_COLOR,
      },
      occlusionMode: OcclusionMode.OCCLUDED_ONLY,
    },
  ],
  pointStyles: [],
  mainLabelHtmlStyle: HTML_LABEL_STYLE,
  helperLabelHtmlStyle: HTML_LABEL_STYLE,
};

/**
 * Painter used to draw cross-section measurements on the main map.
 */
export class CrossSectionMeasurementPainter extends FeaturePainter {

  paintBody(geoCanvas: GeoCanvas, feature: Feature, shape: Shape): void {
    if (!!feature.properties.measurement) {
      const measurement = feature.properties.measurement as Measurement;
      measurement.paintBody(geoCanvas, PAINT_STYLES);
    } else {
      geoCanvas.drawIcon(shape, DEFAULT_POINT_STYLE);
    }
  }

  paintLabel(labelCanvas: LabelCanvas, feature: Feature): void {
    if (!!feature.properties.measurement) {
      const measurement = feature.properties.measurement as Measurement;
      measurement.paintLabel(labelCanvas, PAINT_STYLES);
    }
  }
}