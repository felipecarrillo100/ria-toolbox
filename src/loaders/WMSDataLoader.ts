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
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {WMSCapabilities} from "@luciad/ria/model/capabilities/WMSCapabilities.js";
import {WMSCapabilitiesLayer} from "@luciad/ria/model/capabilities/WMSCapabilitiesLayer.js";
import {WMSImageModel} from "@luciad/ria/model/image/WMSImageModel.js";
import {WMSTileSetModel} from "@luciad/ria/model/tileset/WMSTileSetModel.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {WMSImageLayer} from "@luciad/ria/view/image/WMSImageLayer.js";
import {WMSTileSetLayer} from "@luciad/ria/view/tileset/WMSTileSetLayer.js";

const webMercatorReference = getReference("EPSG:3857");
const webMercatorBounds = createBounds(webMercatorReference,
    [-20037508.34278924, 40075016.68557848, -20037508.3520, 40075016.7040]);

export const WMSDataLoader = {
  /**
   * Creates a layer for WMS data.
   *
   * This class uses Web Mercator as reference by default.
   *
   * Summary:
   * - Create a @luciad/ria/model/tileset/WMSTileSetModel
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   *
   * Alternatively, to use single-image WMS:
   * - Create a @luciad/ria/model/image/WMSImageModel
   * - Create a @luciad/ria/view/image/RasterImageLayer
   */
  createLayerBasic: (url: string, layerName: string, tiled: boolean, queryable: boolean,
                     bounds: Bounds): WMSImageLayer | WMSTileSetLayer => {
    const modelOptions = {
      getMapRoot: url,
      layers: [layerName],
      reference: webMercatorReference,
      transparent: true,
      queryLayers: queryable ? [layerName] : [],
      bounds
    };
    if (tiled) {
      return new WMSTileSetLayer(new WMSTileSetModel(modelOptions), {
        label: `${layerName} (WMS)`
      });
    } else {
      return new WMSImageLayer(new WMSImageModel(modelOptions), {
        label: `${layerName} (WMS)`
      });
    }
  },
  /**
   * Creates a layer for WMS data.
   *
   * This class uses Web Mercator as reference by default.
   *
   * Summary:
   * - Create a @luciad/ria/model/tileset/WMSTileSetModel
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   *
   * Alternatively, to use single-image WMS:
   * - Create a @luciad/ria/model/image/WMSImageModel
   * - Create a @luciad/ria/view/image/RasterImageLayer
   */
  createLayer: (capabilities: WMSCapabilities,
                layers: { layer: WMSCapabilitiesLayer, style: string }[],
                modelReference: CoordinateReference,
                tiled: boolean): WMSImageLayer | WMSTileSetLayer => {

    const layerName = layers.map(l => l.layer.title).join(", ");
    const layersConfig = layers.map(l => ({
      layer: l.layer.name,
      style: l.style
    }));

    const modelOptions = {
      reference: modelReference
    };

    if (tiled) {
      return new WMSTileSetLayer(WMSTileSetModel.createFromCapabilities(capabilities, layersConfig, modelOptions), {
        label: `${layerName} (WMS)`
      });
    } else {
      return new WMSImageLayer(WMSImageModel.createFromCapabilities(capabilities, layersConfig, modelOptions), {
        label: `${layerName} (WMS)`
      });
    }
  }
};
