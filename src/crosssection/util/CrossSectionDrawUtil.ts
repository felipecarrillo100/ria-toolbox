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
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";

const axisColor = 'rgb(255,255,255)';
const axisColorObscured = 'rgb(150,150,150)';
const backgroundColor = 'rgb(0,0,0,0.6)';
const backgroundColorObscured = 'rgba(139,139,139,0.4)';
const gridColor = 'rgb(255,255,255,0.2)';
const gridColorObscured = 'rgb(255,255,255,0.15)';

const STYLE_PLANE = {
  fill: {color: backgroundColor},
  stroke: {width: 2, color: axisColor},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
const STYLE_PLANE_OBSCURED = {
  fill: {color: backgroundColorObscured},
  stroke: {width: 2, color: axisColorObscured},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};
export const STYLE_GRID = {
  stroke: {width: 2, color: gridColor},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
const STYLE_GRID_OBSCURED = {
  stroke: {width: 2, color: gridColorObscured},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};

/**
 * Paints the cross section plane
 */
export function paintPlane(
    geoCanvas: GeoCanvas,
    shape: Shape,
    focused: boolean
): void {
  if (focused) {
    geoCanvas.drawShape(shape, STYLE_PLANE_OBSCURED);
    geoCanvas.drawShape(shape, STYLE_PLANE);
  } else {
    geoCanvas.drawShape(shape, STYLE_PLANE);
  }
}

/**
 * Paints the grid of the cross-section plane
 */
export function paintPlaneGrid(
    geoCanvas: GeoCanvas,
    shape: Shape,
    focused: boolean
): void {
  if (focused) {
    geoCanvas.drawShape(shape, STYLE_GRID_OBSCURED);
    geoCanvas.drawShape(shape, STYLE_GRID);
  } else {
    geoCanvas.drawShape(shape, STYLE_GRID);
  }
}

const arrowStyle = {
  stroke: {color: axisColor, width: 2},
  fill: {color: axisColor},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};

const focusedArrowStyle = {
  stroke: {color: axisColor, width: 3},
  fill: {color: axisColor},
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

/**
 * Paints the rotate-handle of the cross-section plane
 */
export function paintRotateHandle(
    geoCanvas: GeoCanvas,
    arrow: Shape,
    focused: boolean
): void {
  geoCanvas.drawShape(
      arrow,
      focused ? focusedArrowStyle : arrowStyle
  );
}

const planeStyleVisible = {
  stroke: {color: axisColor, width: 2},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
const planeStyleOccluded = {
  stroke: {color: axisColor, width: 2},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};
const focusedPlaneStyleVisible = {
  stroke: {color: axisColor, width: 3},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};
const focusedPlaneStyleOccluded = {
  stroke: {color: axisColor, width: 3},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};

/**
 * Paints the move handle of the cross-section plane
 */
export function paintMoveHandle(
    geoCanvas: GeoCanvas,
    arrow: Shape,
    focused: boolean
): void {
  geoCanvas.drawShape(
      arrow,
      focused ? focusedPlaneStyleOccluded : planeStyleOccluded
  );
  geoCanvas.drawShape(
      arrow,
      focused ? focusedPlaneStyleVisible : planeStyleVisible
  );
}