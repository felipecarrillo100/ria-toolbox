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
  createAzureMapsTileSetModel,
  AzureMapsTileSetModelCreateOptions
} from "@luciad/ria/model/tileset/AzureMapsTileSetModel.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {Map} from "@luciad/ria/view/Map.js";
import AzureLogoUrl from "./azureLogo.png";

export enum AzureMapsType {
  IMAGERY = "microsoft.imagery",
  BASE_ROAD = "microsoft.base.road",
  BASE_DARKGREY = "microsoft.base.darkgrey",
  BASE_HYBRID_ROAD = "microsoft.base.hybrid.road",
  BASE_HYBRID_DARKGREY = "microsoft.base.hybrid.darkgrey",
  BASE_LABELS_ROAD = "microsoft.base.labels.road",
  BASE_LABELS_DARKGREY = "microsoft.base.labels.darkgrey",
  SHADED_RELIEF = "microsoft.terra.main",
  TRAFFIC_ABSOLUTE = "microsoft.traffic.absolute.main",
  TRAFFIC_DELAY = "microsoft.traffic.delay.main",
  TRAFFIC_REDUCED = "microsoft.traffic.reduced.main",
  WEATHER_INFRAFRED = "microsoft.weather.infrared.main",
  WEATHER_RADAR = "microsoft.weather.radar.main",
}

export interface AzureMapsDataLoaderOptions {
  /**
   * The desired Azure Maps map style
   * @default AzureMapsType.IMAGERY
   */
  tileSetId?: AzureMapsType;
  /**
   * The label of the Azure layer. This will be shown in the map layer control.
   * @default "Azure Maps Imagery"
   */
  layerLabel?: string;
  /**
   * The API key to connect with Azure Maps' rendering services.
   * */
  subscriptionKey: string;
  /**
   * The map that the layer is intended for.
   * If specified, the layer's detailFactor will be set to the map's displayScale for pixel-perfect raster rendering.
   */
  map?: Map;
}

export const AzureMapsDataLoader = {
  /**
   * Creates a layer for Azure Maps data.
   *
   * Summary:
   * - Create a @luciad/ria/model/tileset/AzureMapsTileSetModel
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   *
   * @param options {AzureMapsDataLoaderOptions} The options to create the layer.
   * @return {Promise} A promise for a layer.
   */
  createLayer: async (options: AzureMapsDataLoaderOptions): Promise<RasterTileSetLayer> => {
    const subscriptionKey = options?.subscriptionKey;
    if (!subscriptionKey) {
      throw new Error(
          "No Azure Maps subscription key found."
      )
    }
    const tileSetId = options?.tileSetId ?? AzureMapsType.IMAGERY;
    const label = options?.layerLabel ?? "Imagery (Azure)";
    const map = options?.map;
    //#snippet createModel
    const tileSetModelOptions: AzureMapsTileSetModelCreateOptions = {
      subscriptionKey,
      tileSetId
    };
    const model = await createAzureMapsTileSetModel(tileSetModelOptions);
    model.getLogo = function(): string {
      return AzureLogoUrl;
    };
    let isBaseLayer = AzureMapsDataLoader.isBaseLayer(tileSetId);
    const rasterTileSetLayer = new RasterTileSetLayer(model, {
      label,
      layerType: isBaseLayer ? LayerType.BASE : LayerType.STATIC
    });
    if (map) {
      rasterTileSetLayer.detailFactor = map.displayScale;
    }
    return rasterTileSetLayer;
    //#endsnippet createModel
  },

  /**
   * Returns whether the given tileSetId represents an Azure Maps base layer.
   * These are opaque layers that should be positioned as the last layer in the map.
   * @param tileSetId {AzureMapsType} An Azure Maps map style
   * @return True if the given tileSetId represents an Azure Maps base layer, false otherwise.
   */
  isBaseLayer: (tileSetId: AzureMapsType): boolean => {
    return tileSetId === AzureMapsType.IMAGERY ||
           tileSetId === AzureMapsType.BASE_ROAD ||
           tileSetId === AzureMapsType.BASE_DARKGREY;
  }
};