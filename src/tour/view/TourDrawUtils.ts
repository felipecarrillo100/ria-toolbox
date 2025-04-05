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
import { clamp } from '@luciad/ria-toolbox-core/util/Math.js';
import { add, cross, negate, normalize, scale } from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import { ShapeList } from '@luciad/ria/shape/ShapeList.js';
import { Vector3 } from '@luciad/ria/util/Vector3.js';
import {createPolyline, createShapeList} from '@luciad/ria/shape/ShapeFactory.js';
import { Map } from '@luciad/ria/view/Map.js';
import { PathFeature } from '../model/PathFeature.js';
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {PointCoordinates} from "@luciad/ria/shape/PointCoordinate.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {PathPointVectors} from "../PathData.js";
import {TOUR_MODEL_REFERENCE} from "../TourPathSupport.js";

interface FrustumSizeInfo {
  frustumSize: number;
  whRatio: number;
}

const HTML_TEMPLATE_PATTERN = '__CONTENT__';
const HTML_TEMPLATE_REGEX = new RegExp(HTML_TEMPLATE_PATTERN, 'g');
const HTML_TEMPLATE = createSimpleLabelTemplate();

function createSimpleLabelTemplate(textColor = '#FFFFFF', haloColor = '#3C3C3C') {
  const shadowHalo = `1px 1px ${haloColor}, 1px -1px ${haloColor}, -1px 1px ${haloColor}, -1px -1px ${haloColor};`;
  return `<div style="font: bold 15px sans-serif; color: ${textColor}; text-shadow: ${shadowHalo}">${HTML_TEMPLATE_PATTERN}</div>`;
}

export function createPathLabel(text: string, templateLabel = HTML_TEMPLATE) {
  return templateLabel.replace(HTML_TEMPLATE_REGEX, text);
}

/**
 * Provides a frustum size aspects.
 * @internal
 */
export function getFrustumSizeInfo(path: PathFeature, map: Map): FrustumSizeInfo {
  const { width, height, depth } = path.shape.bounds!;
  const avgSize = Math.max(width, height, depth);
  const frustumSize = clamp(0.1 * avgSize, 0.5, 100);

  const [mapWidth, mapHeight] = map.viewSize;
  const whRatio = mapHeight ? mapWidth / mapHeight : 1;

  return { frustumSize, whRatio };
}

/**
 * Provides a frustum representation on the path
 * @internal
 */
export function getFrustumShape(
  { eye, forward, up }: PathPointVectors,
  { frustumSize, whRatio }: FrustumSizeInfo
): ShapeList {
  const normal = normalize(cross(forward, up));
  const halfHeight = 0.3 * frustumSize;
  const halfWidth = whRatio * halfHeight;

  const offsetPoint = (p: Vector3, v: Vector3, len: number): Vector3 => add(p, scale(v, len));

  const end = offsetPoint(eye, forward, frustumSize);
  const pUp = offsetPoint(end, up, halfHeight);
  const p1 = offsetPoint(pUp, normal, halfWidth);
  const p2 = offsetPoint(pUp, negate(normal), halfWidth);
  const pDown = offsetPoint(end, negate(up), halfHeight);
  const p3 = offsetPoint(pDown, negate(normal), halfWidth);
  const p4 = offsetPoint(pDown, normal, halfWidth);

  const ref = TOUR_MODEL_REFERENCE;
  return createShapeList(ref, [
    vectorsToPolyline(ref, [p1, p2, p3, p4, p1]),
    vectorsToPolyline(ref, [p1, eye, p4]),
    vectorsToPolyline(ref, [p2, eye, p3]),
  ]);
}

export function vectorsToPolyline(reference: CoordinateReference, vectors: Vector3[]): Polyline {
  return createPolyline(
      reference,
      vectors.map(({ x, y, z }) => [x, y, z] as PointCoordinates)
  );
}