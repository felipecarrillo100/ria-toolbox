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
import {BingMapsTileSetModel} from "@luciad/ria/model/tileset/BingMapsTileSetModel.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {Map} from "@luciad/ria/view/Map.js";

export type BingMapsType = "aerial" | "road" | "AerialWithLabels" | "CanvasLight" | "CanvasDark" | "CanvasGray";

export const BingMapsDataLoader = {
  /**
   * Creates a layer for Bing Maps data.
   *
   * Summary:
   * - Contact Bing proxy to initialize session
   * - Create a @luciad/ria/model/tileset/BingMapsTileSetModel
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   *
   * @param type {String} One of "road", "aerial" or "AerialWithLabels"
   * @param map The map that the layer is intended for
   * @return {Promise} A promise for a layer.
   */
  createLayer: (type: BingMapsType, map?: Map): Promise<RasterTileSetLayer> => {
    //#snippet createModel
    const layer = fetch(`/sampleservices/bingproxy/${type}`)
        .then(response => response.json())
        .catch(() => {
          throw new Error(
              "Something went wrong while contacting the Bing proxy. Did you configure it with a Bing Maps key?"
          )
        }).then(data => {
          let resource;
          if (data.resourceSets[0] && data.resourceSets[0].resources[0]) {
            resource = data.resourceSets[0].resources[0];
            resource.brandLogoUri = data.brandLogoUri;
          } else {
            resource = data;
          }
          const model = new BingMapsTileSetModel(resource);
          
          const rasterTileSetLayer = new RasterTileSetLayer(model, {
            label: `${type} (Bing)`,
            layerType: LayerType.BASE,
            id: "Background",
            detailFactor: map?.displayScale || 1
          });
          setBingMapsDisplayScale(model, rasterTileSetLayer.detailFactor);
          rasterTileSetLayer.on("DetailFactorChanged", () => {
            setBingMapsDisplayScale(model, rasterTileSetLayer.detailFactor);
          });

          if (map) {
            map?.on("DisplayScaleChanged", () => {
              rasterTileSetLayer.detailFactor = map.displayScale;
            });
          }

          return rasterTileSetLayer;
        });
    //#endsnippet createModel
    return layer;
  }
};

function setBingMapsDisplayScale(model: BingMapsTileSetModel, detailFactor: number) {
  if (detailFactor >= 2) {
    // https://blogs.bing.com/maps/February-2015/High-PPI-maps-now-available-in-the-Bing-Maps-AJAX/
    model.requestParameters = {
      dpi: "d1",
      device: "mobile"
    }
  } else {
    model.requestParameters = null;
  }
  model.invalidate();
}
