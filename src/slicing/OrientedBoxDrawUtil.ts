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
import {OrientedBox} from "@luciad/ria/shape/OrientedBox.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";

const OUTLINE_COLOR = "rgb(255,255,255)";
const OUTLINE_COLOR_OCCLUDED = "rgba(255, 255, 255, 0.2)";
const FILL_COLOR = "rgba(171,232,229, 0.3)";

export interface DrawBoxOptions {
  hightlighted?: boolean;
  withOccludedPart?: boolean;
}

/**
 * Draws the given box on the given canvas
 */
export function drawBox(geoCanvas: GeoCanvas, box: OrientedBox, options?: DrawBoxOptions) {
  const highlighted = !!options?.hightlighted;
  const withOccludedPart = !!options?.withOccludedPart;

  geoCanvas.drawShape(box, {
    stroke: {
      width: highlighted ? 4 : 2,
      color: OUTLINE_COLOR
    },
    fill: highlighted ? {
      color: FILL_COLOR,
    } : undefined
  });

  if (withOccludedPart) {
    geoCanvas.drawShape(box, {
      stroke: {
        width: highlighted ? 4 : 2,
        color: OUTLINE_COLOR_OCCLUDED
      },
      fill: highlighted ? {
        color: FILL_COLOR,
      } : undefined,
      occlusionMode: OcclusionMode.OCCLUDED_ONLY
    });
  }
}

/**
 * Draws the given box face on the given canvas
 */
export function drawFacePolygon(geoCanvas: GeoCanvas, polygon: Polygon, hovered: boolean) {
  geoCanvas.drawShape(polygon, {
    stroke: {
      width: hovered ? 4 : 2,
      color: OUTLINE_COLOR
    },
    fill: hovered ? {
      color: FILL_COLOR,
    } : undefined
  });
}
