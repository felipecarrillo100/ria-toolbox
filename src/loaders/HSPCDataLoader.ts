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
import {HSPCTilesModel} from "@luciad/ria/model/tileset/HSPCTilesModel.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Affine3DTransformation, createTransformationFromGeoLocation} from "@luciad/ria/transformation/Affine3DTransformation.js";
import {ScalingMode} from "@luciad/ria/view/style/ScalingMode.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {Map} from "@luciad/ria/view/Map.js";
import {PointCloudPointShape} from "@luciad/ria/view/style/PointCloudPointShape.js";

let counter = 0;

function getLayerName(url: string): string {
  const urlSplit = url.split("/");
  // Most urls look like this: http://mydomain.com/datasetname/tree.hspc
  // Here we want to use "datasetname" as layer name, as the tree.hspc file doesn't give us any other concrete label
  const urlLabel = urlSplit.length > 2 ? urlSplit[urlSplit.length - 2] : null;
  return urlLabel || "HSPC" + (counter ? "-" + ++counter : "");
}

function getGeoLocationTransformation(modelReference: CoordinateReference, mapReference: CoordinateReference, logInfo: (infoMessage: string) => void): Affine3DTransformation | undefined {
  if (modelReference.referenceType == ReferenceType.CARTESIAN && mapReference.referenceType != ReferenceType.CARTESIAN) {
    //If the model is not georeferenced, we give it a default location on the globe
    logInfo(
        "The loaded OGC 3D Tiles Model did not have a georeference. We have geolocated it on an arbitrary " +
        "location on this globe so that you can still view it."
    );
    const FIXED_GEOLOCATION = createPoint(getReference("CRS:84"), [4.669129, 50.865039, 64]);
    return createTransformationFromGeoLocation(FIXED_GEOLOCATION, {destinationReference: mapReference});
  }
  return undefined;
}

function createLayer(url: string, options: { qualityFactor?: number, logInfo?: (infoMessage: string) => void, map?: Map } = {}): Promise<TileSet3DLayer> {
  return HSPCTilesModel.create(url).then(function(model) {
    return new TileSet3DLayer(model, {
      label: getLayerName(url),
      qualityFactor: options.qualityFactor || 1.0,
      transformation: getGeoLocationTransformation(model.reference, options.map?.reference || getReference("EPSG:4978"), options.logInfo || console.log),
      pointCloudStyle: {pointShape: PointCloudPointShape.DISC, pointSize: {mode: ScalingMode.PIXEL_SIZE, pixelSize: 2.0}},
    });
  });
}

export const HSPCDataLoader = {
  /**
   * Creates a layer for HSPC (Hexagon Smart Point Cloud) datasets.
   *
   * @param url {String} A URL to a tree.hspc file
   * @return {Promise} A promise for a layer.
   */
  createLayer
};
