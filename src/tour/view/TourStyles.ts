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
import {createCircle} from '@luciad/ria-toolbox-core/util/IconFactory.js';
import {ShapeStyle} from '@luciad/ria/view/style/ShapeStyle.js';
import {OcclusionMode} from '@luciad/ria/view/style/OcclusionMode.js';
import {IconStyle} from '@luciad/ria/view/style/IconStyle.js';
import {PointLabelStyle} from '@luciad/ria/view/style/PointLabelStyle.js';

const altitudeFocusStyle: ShapeStyle = {
  stroke: {
    width: 10,
    color: `rgba(255,255,255,0.8)`,
  },
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};

const altitudeStyle: ShapeStyle = {
  stroke: {color: 'rgba(255,255,255,0.5)', width: 2},
  zOrder: 3,
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
};

const iconFocusedStyle: IconStyle = {
  image: createIcon('rgba(255,255,255,0.8)', 5),
  width: '40px',
  height: '40px',
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const iconStyle: IconStyle = {
  image: createIcon('rgba(255,255,255,0.5)', 2),
  width: '30px',
  height: '30px',
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

function createIcon(stroke: string, strokeWidth = 2): HTMLCanvasElement {
  return createCircle({
    width: 30,
    height: 30,
    fill: 'rgba(0,0,0,0)',
    stroke,
    strokeWidth,
  });
}

const pathStyle: ShapeStyle = {
  stroke: {color: '#96d4e3', width: 3},
  occlusionMode: OcclusionMode.VISIBLE_ONLY,
  zOrder: 100,
};

/** Styling of the path that is behind something, "ghost mode" */
const pathStyleObscured: ShapeStyle = {
  stroke: {color: '#0d424f', width: 4},
  occlusionMode: OcclusionMode.OCCLUDED_ONLY,
};

const frustumStyle: ShapeStyle = {
  stroke: {color: 'rgba(235,251,254,0.2)', width: 2},
};

const currentFrustumStyle: ShapeStyle = {
  stroke: {color: '#c3e6f1', width: 3},
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const pointStyle: IconStyle = {
  image: createCircle({
    width: 15,
    height: 15,
    stroke: '#c3e6f1',
    fill: '#1c8ea9',
  }) as HTMLCanvasElement,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const pointHoverStyle: IconStyle = {
  image: createCircle({
    width: 17,
    height: 17,
    stroke: '#92ebff',
    fill: '#92ebff',
  }) as HTMLCanvasElement,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const currentPointStyle: IconStyle = {
  image: createCircle({
    width: 16,
    height: 16,
    stroke: '#d7d3d3',
    fill: '#fff',
  }) as HTMLCanvasElement,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const labelStyle: PointLabelStyle = {
  group: 'tourLabels',
  padding: 2,
  priority: -100,
};

export const TourStyle = {
  pathController: {
    altitudeStyle,
    altitudeFocusStyle,
    iconStyle,
    iconFocusedStyle,
    pointHoverStyle,
    frustumStyle: currentFrustumStyle,
  },
  pathPainter: {
    pathStyle,
    pathStyleObscured,
    pointStyle,
    currentPointStyle,
    frustumStyle,
    labelStyle,
  },
};
