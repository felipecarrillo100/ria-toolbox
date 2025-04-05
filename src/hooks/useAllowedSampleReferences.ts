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
import {Map} from "@luciad/ria/view/Map.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {useMapReference} from "./useMapReference.js";

export interface LabeledReference {
  id: string; // EPSG code
  label: string
}

export const LABELED_REFERENCES_2D: LabeledReference[] = Object.entries({
  "EPSG:4087": "Equidistant Cylindrical",
  "EPSG:3395": "Mercator",
  "EPSG:3857": "Web Mercator",
  "EPSG:3995": "Polar Stereographic",
  "EPSG:3031": "Polar Stereographic (South pole)",
  "EPSG:2154": "Lambert Conformal",
}).map(([id, label]) => ({id, label}));

export const LABELED_REFERENCE_3D: LabeledReference = {id: "EPSG:4978", label: "Geocentric (3D)"};

/**
 * React hook that looks at the given map and '<meta name="sample.modes"' part of the current index.html to decide
 * which references can be switched to in a LuciadRIA sample
 */
export const useAllowedSampleReferences = (map: Map): LabeledReference[] => {
  const mapReference = useMapReference(map);

  if (!(map instanceof WebGLMap) || mapReference.referenceType === ReferenceType.CARTESIAN) {
    return []
  }

  const sampleModes = (document.querySelector(
      'meta[name="sample.modes"]') as HTMLMetaElement | undefined)?.content?.split(",");
  if (!sampleModes) {
    console.warn("Allowed sample references can not be parsed from the sample's meta tags");
    return [];
  }

  const allowedReferences: LabeledReference[] = [];
  if (sampleModes.includes("webgl3d")) {
    allowedReferences.push(LABELED_REFERENCE_3D)
  }
  if (sampleModes.includes("webgl2d")) {
    allowedReferences.push(...LABELED_REFERENCES_2D)
  }

  return allowedReferences;
}