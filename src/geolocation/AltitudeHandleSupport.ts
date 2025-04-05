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
import {Point} from "@luciad/ria/shape/Point.js";
import {ShapeList} from "@luciad/ria/shape/ShapeList.js";
import {createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {Map} from "@luciad/ria/view/Map.js";
import {cross, scale} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {findLower125} from "@luciad/ria-toolbox-core/util/Math.js";
import {
  END_POINT_STYLE,
  HELPER_LINES_OCCLUDED_STYLE,
  HELPER_LINES_STYLE,
  MAIN_STROKE_OCCLUDED_STYLE,
  MAIN_STROKE_STYLE,
  START_POINT_STYLE
} from "./HandleStyles.js";

const CRS_84 = getReference("CRS:84");
const EPSG_4978 = getReference("EPSG:4978");

const LLH_TO_CART = createTransformation(CRS_84, EPSG_4978);
const CART_TO_LLH = createTransformation(EPSG_4978, CRS_84);

/**
 *  Class used to calculate and paint the helper styling for geolocation altitude handles.
 */
export class AltitudeHandleSupport {
  private readonly _startLLH: Point;
  private readonly _margin: number;

  private _endLLH: Point;
  private _translateLine: Polyline;
  private _helperLines: ShapeList;
  private _heightDiff: number;

  constructor(start: Point, margin: number) {
    this._startLLH = CART_TO_LLH.transform(start);
    this._margin = margin;
    this._endLLH = this._startLLH.copy();
    this._translateLine = createPolyline(CRS_84, [this._startLLH, this._endLLH])
    this._helperLines = createShapeList(CRS_84, []);
    this._heightDiff = 0;
  }

  addTranslation(map: Map, {x, y, z}: Vector3) {
    const end = LLH_TO_CART.transform(this._endLLH);
    end.translate3D(x, y, z);
    this._endLLH = CART_TO_LLH.transform(end);
    this._translateLine = createPolyline(CRS_84, [this._startLLH, this._endLLH])
    this._heightDiff = this._endLLH.z - this._startLLH.z;
    this._helperLines = this.createHelperLines(map);
  }

  drawBody(geoCanvas: GeoCanvas) {
    geoCanvas.drawIcon(this._startLLH, START_POINT_STYLE);
    geoCanvas.drawIcon(this._endLLH, END_POINT_STYLE);
    geoCanvas.drawShape(this._translateLine, MAIN_STROKE_STYLE);
    geoCanvas.drawShape(this._translateLine, MAIN_STROKE_OCCLUDED_STYLE);
    geoCanvas.drawShape(this._helperLines, HELPER_LINES_STYLE);
    geoCanvas.drawShape(this._helperLines, HELPER_LINES_OCCLUDED_STYLE);
  }

  drawLabel(labelCanvas: LabelCanvas) {
    const html = `<div style="background-color: white; color: black; padding: 6px; border-radius: 6px">${
        this._heightDiff.toFixed(1)}m</div>`
    labelCanvas.drawLabel(html, this._startLLH, {});
  }

  private createHelperLines(map: Map) {
    const result = createShapeList(CRS_84);
    const interval = findLower125(this._margin / 4);
    const right = scale(cross(map.camera.forward, map.camera.up), interval / 2);
    const lineBottom = this._endLLH.copy();
    lineBottom.z += this._endLLH.z < this._startLLH.z ? -this._margin : this._margin;
    result.addShape(createPolyline(CRS_84, [lineBottom, this._endLLH]));

    for (let i = 0; i < Math.abs(this._heightDiff) + this._margin; i += interval) {
      const firstPointLLH = this._startLLH.copy();
      firstPointLLH.z += this._endLLH.z < this._startLLH.z ? -i : i;
      const secondPoint = LLH_TO_CART.transform(firstPointLLH);
      secondPoint.translate3D(right.x, right.y, right.z)

      result.addShape(createPolyline(CRS_84, [firstPointLLH, CART_TO_LLH.transform(secondPoint)]));
    }
    return result;
  }

}