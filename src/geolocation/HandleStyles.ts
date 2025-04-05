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
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {createCircle} from "@luciad/ria-toolbox-core/util/IconFactory.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";

export const NORMAL_COLOR = "white";
export const OCCLUDED_COLOR = "rgba(255,255,255,0.1)";

export const START_POINT_STYLE: IconStyle = {
  image: createCircle({
    fill: "rgb(36, 36, 36)",
    width: 18,
    height: 18,
    stroke: "rgb(255, 255, 255)",
    strokeWidth: 2
  }),
  width: `${18}px`,
  height: `${18}px`,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE
}

export const END_POINT_STYLE: IconStyle = {
  image: createCircle({
    fill: "rgb(255, 255, 255)",
    width: 18,
    height: 18,
  }),
  width: `${18}px`,
  height: `${18}px`,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE
}

export const MAIN_STROKE_STYLE: ShapeStyle = {
  stroke: {color: NORMAL_COLOR, width: 3},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
export const MAIN_STROKE_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 3},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};

export const MAIN_FILLED_STYLE: ShapeStyle = {
  stroke: {color: NORMAL_COLOR, width: 2},
  fill: {color: "rgba(255,255,255,0.5)"},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
export const MAIN_FILLED_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 2},
  fill: {color: "rgba(255,255,255,0.2)"},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};

export const HELPER_LINES_STYLE: ShapeStyle = {
  stroke: {color: NORMAL_COLOR, width: 1},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
export const HELPER_LINES_OCCLUDED_STYLE: ShapeStyle = {
  stroke: {color: OCCLUDED_COLOR, width: 1},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};
