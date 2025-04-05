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
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createPoint, createPolygon, createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {Feature, FeatureProperties} from "@luciad/ria/model/feature/Feature.js";

/**
 * To generate relevant legend-entries for each layer, you need to provide a list
 * of legendInfo objects. Each legendInfo consists of a feature that can be used to
 * render the legend-image, and a description for the legend.
 * Consider using the utility methods to generate meaningful legend features:
 * <ul>
 *   <li>{@link createIconLegendEntryInput}: to create a point legend feature</li>
 *   <li>{@link createLineLegendEntryInput}: to create a line legend feature</li>
 *   <li>{@link createAreaLegendEntryInput}: to create a area legend feature</li>
 * </ul>
 * These utility methods will create an appropriate shape and will make sure that each
 * legend feature has a unique id.
 */
export interface LegendEntryInput {
  feature: Feature,
  description: string,
}

// These are some well-defined shapes in a Cartesian 2D reference to generate nice legend-entry images
const LEGEND_REF = getReference("LUCIAD:XY");
const SHAPE_WIDTH = 0.015;//m
const RATIO_NOM = 2.0;
const RATIO_DENOM = 3.0;
const SHAPE_HEIGHT = SHAPE_WIDTH*RATIO_NOM/RATIO_DENOM;

const DUMMY_POINT = createPoint(LEGEND_REF, [0, 0]);
const DUMMY_LINE = createPolyline(LEGEND_REF, [[-SHAPE_WIDTH, 0], [SHAPE_WIDTH, 0]]);
const DUMMY_POLYGON = createPolygon(LEGEND_REF,
    [[-SHAPE_WIDTH, -SHAPE_HEIGHT], [SHAPE_WIDTH, -SHAPE_HEIGHT], [SHAPE_WIDTH, SHAPE_HEIGHT], [-SHAPE_WIDTH, SHAPE_HEIGHT]]);

let legendId: number = 0;

/**
 * A utility function to create a point/icon {@link LegendEntryInput}
 * @param description what should appear as legend text
 * @param properties the specific properties needed for the feature (that will determine its specific styling)
 */
export function createIconLegendEntryInput(description: string, properties?: FeatureProperties): LegendEntryInput {
  return {
    feature: new Feature(DUMMY_POINT, properties, legendId++),
    description: description,
  }
}

/**
 * A utility function to create a line {@link LegendEntryInput}
 * @param description what should appear as legend text
 * @param properties the specific properties needed for the feature (that will determine its specific styling)
 */
export function createLineLegendEntryInput(description: string, properties?: FeatureProperties): LegendEntryInput {
  return {
    feature: new Feature(DUMMY_LINE, properties, legendId++),
    description: description,
  }
}

/**
 * A utility function to create an area {@link LegendEntryInput}
 * @param description what should appear as legend text
 * @param properties the specific properties needed for the feature (that will determine its specific styling)
 */
export function createAreaLegendEntryInput(description: string, properties?: FeatureProperties): LegendEntryInput {
  return {
    feature: new Feature(DUMMY_POLYGON, properties, legendId++),
    description: description,
  }
}