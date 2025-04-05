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
import {createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {Map} from "@luciad/ria/view/Map.js";
import {
  add,
  addArray,
  cross,
  distance,
  length,
  normalize,
  rotateAroundAxis,
  scale,
  sub
} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {
  END_POINT_STYLE,
  MAIN_STROKE_OCCLUDED_STYLE,
  MAIN_STROKE_STYLE,
  NORMAL_COLOR,
  START_POINT_STYLE
} from "./HandleStyles.js";
import {findLower125} from "@luciad/ria-toolbox-core/util/Math.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {ParameterizedLinePainter} from "@luciad/ria/view/feature/ParameterizedLinePainter.js";
import {createGradientColorMap} from "@luciad/ria/util/ColorMap.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {MemoryStore} from "@luciad/ria/model/store/MemoryStore.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";

const EPSG_4978 = getReference("EPSG:4978");

function toPolyLine(reference: CoordinateReference, vectors: Vector3[]) {
  return createPolyline(reference, vectors.map(({x, y, z}) => [x, y, z] as [number, number, number]))
}

/**
 *  Class used to calculate and paint the helper styling for geolocation horizontal move handles.
 *  This support adds a layer to the map to paint the helper grid and removes it when `clear` is called.
 */
export class MoveHandleSupport {
  private readonly _start: Point;
  private readonly _dir1: Vector3;
  private readonly _dir2: Vector3;
  private readonly _margin: number;
  private readonly _helperLayer: FeatureLayer;

  private _end: Point;
  private _translateLine: Polyline;
  private _translation: number;

  constructor(map: Map, start: Point, margin: number) {
    this._start = start.copy();
    const up = (map.camera as PerspectiveCamera).lookFrom({
      eye: start,
      yaw: 0,
      pitch: 0,
      roll: 0
    }).up;
    const right = cross((map.camera as PerspectiveCamera).forward, up);

    this._dir1 = normalize(right);
    this._dir2 = normalize(rotateAroundAxis(right, up, 90));
    this._margin = margin;
    this._end = start.copy();
    this._translateLine = createPolyline(EPSG_4978, [this._start, this._end])
    this._translation = 0;

    const helperModel = new FeatureModel(new MemoryStore(), {reference: EPSG_4978});
    this._helperLayer = new FeatureLayer(helperModel, {painter: this.createHelperPainter()});
    map.layerTree.addChild(this._helperLayer);
  }

  clear() {
    (this._helperLayer.parent as LayerGroup)?.removeChild(this._helperLayer);
  }

  addTranslation({x, y, z}: Vector3) {
    this._end.translate3D(x, y, z);
    this._translateLine = createPolyline(EPSG_4978, [this._start, this._end])
    this._translation = distance(this._end, this._start);
    (this._helperLayer.model as FeatureModel).put(new Feature(this.createHelperLines(), {}, 'test'))
  }

  drawBody(geoCanvas: GeoCanvas) {
    geoCanvas.drawIcon(this._start, START_POINT_STYLE);
    geoCanvas.drawIcon(this._end, END_POINT_STYLE);
    geoCanvas.drawShape(this._translateLine, MAIN_STROKE_STYLE);
    geoCanvas.drawShape(this._translateLine, MAIN_STROKE_OCCLUDED_STYLE);
  }

  drawLabel(labelCanvas: LabelCanvas) {
    const html = `<div style="background-color: white; color: black; padding: 6px; border-radius: 6px">${
        this._translation.toFixed(1)}m</div>`
    labelCanvas.drawLabel(html, this._start, {});
  }

  private createHelperLines() {
    const lines = [];
    const segmentSize = findLower125(this._margin / 4);

    const halfSize = this.getGridHalfSize();

    for (let i = 0; i < halfSize; i += segmentSize) {
      lines.push(
          toPolyLine(EPSG_4978, [
            addArray([this._start, scale(this._dir2, i), scale(this._dir1, -1 * halfSize)]),
            add(this._start, scale(this._dir2, i)),
            addArray([this._start, scale(this._dir2, i), scale(this._dir1, halfSize)]),
          ])
      );
      lines.push(
          toPolyLine(EPSG_4978, [
            addArray([this._start, scale(this._dir1, i), scale(this._dir2, -1 * halfSize)]),
            add(this._start, scale(this._dir1, i)),
            addArray([this._start, scale(this._dir1, i), scale(this._dir2, halfSize)]),
          ])
      );

      if (i !== 0) {
        lines.push(
            toPolyLine(EPSG_4978, [
              addArray([this._start, scale(this._dir2, -i), scale(this._dir1, -1 * halfSize)]),
              add(this._start, scale(this._dir2, -i)),
              addArray([this._start, scale(this._dir2, -i), scale(this._dir1, halfSize)]),
            ])
        );

        lines.push(
            toPolyLine(EPSG_4978, [
              addArray([this._start, scale(this._dir1, -i), scale(this._dir2, -1 * halfSize)]),
              add(this._start, scale(this._dir1, -i)),
              addArray([this._start, scale(this._dir1, -i), scale(this._dir2, halfSize)]),
            ])
        );
      }

    }
    return createShapeList(EPSG_4978, lines);
  }

  private createHelperPainter() {
    const colorMap = [];
    for (let i = 0; i < 1; i += 0.05) {
      colorMap.push({
        level: i,
        color: `rgba(255, 255, 255, ${i})`,
      });
    }

    return new ParameterizedLinePainter({
      defaultColor: NORMAL_COLOR,
      rangeColorMap: createGradientColorMap(colorMap),
      rangePropertyProvider: (feature, shape, pointIndex) =>
          (1 -
           length(
               sub((shape as Polyline).getPoint(pointIndex), this._start)
           ) /
           this.getGridHalfSize()) *
          0.999,
    });
  }

  private getGridHalfSize() {
    return distance(this._end, this._start) + this._margin;
  }

}