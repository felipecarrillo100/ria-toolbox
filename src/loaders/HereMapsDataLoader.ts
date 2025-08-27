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
import {
  createHereMapsTileSetModel,
  HereMapsTileSetModelCreateOptions
} from "@luciad/ria/model/tileset/HereMapsTileSetModel.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {Map} from "@luciad/ria/view/Map.js";

export enum HereMapsType {
  SATELLITE = "satellite",
  SATELLITE_LABELED = "satellite_labeled",
  ROADS = "roads",
  TRAFFIC = "traffic"
}

const hereMapsConfig: { [key in HereMapsType]: { style: string, server?: string, resource?: string } } = {
  satellite: {
    style: "satellite.day"
  },
  satellite_labeled: {
    style: "explore.satellite.day"
  },
  roads: {
    style: "explore.day"
  },
  traffic: {
    server: "traffic.maps.hereapi.com",
    resource: "flow",
    style: "lite.day"
  }
};

export const HereMapsDataLoader = {
  /**
   * Creates a layer for HERE Maps data.
   *
   * Summary:
   * - Create a @luciad/ria/model/tileset/HereMapsTileSetModel
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   *
   * @param type {String} One of "aerial", "aerialWithLabels", "roads" or "roadsWithTraffic".
   * @param apiKey {String} The API key to connect with HERE's map rendering services.
   * @param layerLabel {String} The label of the HERE Layer. This will be shown in the map layer control.
   * @param map The map that the layer is intended for
   * @return {Promise} A promise for a layer.
   */
  createLayer: (type: HereMapsType, layerLabel: string, apiKey: string, map?: Map): Promise<RasterTileSetLayer> => {
    //#snippet createModel
    const options: HereMapsTileSetModelCreateOptions = {
      apiKey: apiKey,
      style: hereMapsConfig[type].style
    };
    const server = hereMapsConfig[type].server;
    if (server) {
      options.server = server;
    }
    const resource = hereMapsConfig[type].resource;
    if (resource) {
      options.resource = resource;
    }
    if (map) {
      const detailFactor = map.displayScale;
      if (detailFactor > 1.49) {
        options.scale = 2;
        options.size = 512;
      }
    }
    return createHereMapsTileSetModel(options)
        .then((model) => {
          const rasterTileSetLayer = new RasterTileSetLayer(model, {
            label: layerLabel,
            layerType: (type === HereMapsType.TRAFFIC) ? LayerType.STATIC : LayerType.BASE,
          });
          if (map) {
            rasterTileSetLayer.detailFactor = map.displayScale;
          }
          return rasterTileSetLayer;
        });
    //#endsnippet createModel
  }
};
