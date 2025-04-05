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
import {CARTESIAN_REFERENCE, ThreePointProjector, WORLD_TO_MODEL} from "./ThreePointProjector.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {projectPointOnPlane, toPoint} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {Map} from "@luciad/ria/view/Map.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";

export const ORTHOGONAL_PROJECTION_TYPE = "Orthogonal";

export class ThreePointOrthogonalProjector extends ThreePointProjector {

  private _helperLine: Polyline | null = null;

  constructor(map: Map, planeMeshUrl: string) {
    super(map, ORTHOGONAL_PROJECTION_TYPE, planeMeshUrl);
  }

  project(viewPoint: Point): Point {
    if (!this.planeCenter || !this.planeNormal) {
      throw new Error("You should only call project once the projector is ready.")
    }

    const worldPoint = this.map.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE).transform(viewPoint);
    const projectedWorldPoint = projectPointOnPlane(worldPoint, this.planeNormal, this.planeCenter);

    this._helperLine = createPolyline(CARTESIAN_REFERENCE,
        [toPoint(CARTESIAN_REFERENCE, worldPoint), toPoint(CARTESIAN_REFERENCE, projectedWorldPoint)]);

    return WORLD_TO_MODEL.transform(toPoint(CARTESIAN_REFERENCE, projectedWorldPoint));
  }

  paintProjection(geoCanvas: GeoCanvas) {
    super.paintProjection(geoCanvas);
    if (this._helperLine) {
      geoCanvas.drawShape(this._helperLine, {stroke: {color: "rgb(255,0,0"}})
      geoCanvas.drawShape(this._helperLine,
          {stroke: {color: "rgba(255,0,0,0.1"}, occlusionMode: OcclusionMode.OCCLUDED_ONLY})
    }
  }

}