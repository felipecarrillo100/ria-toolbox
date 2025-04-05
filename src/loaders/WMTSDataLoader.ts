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
import {WMTSCapabilities} from "@luciad/ria/model/capabilities/WMTSCapabilities.js";
import {
  WMTSCapabilitiesLayer,
  WMTSCapabilitiesLayerStyle
} from "@luciad/ria/model/capabilities/WMTSCapabilitiesLayer.js";
import {WMTSTileSetModel, WMTSTileSetModelCreateOptions} from "@luciad/ria/model/tileset/WMTSTileSetModel.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";

export const WMTSDataLoader = {
  /**
   * Creates a layer for WMTS data.
   *
   * Summary:
   * - Create a WMTS tileset model for a given url, layer identifier / layer name and options.
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   */
  createLayer: async (url: string, layerIdentifier: string, layerName: string,
                      options?: WMTSTileSetModelCreateOptions): Promise<RasterTileSetLayer> => {
    const model = await WMTSTileSetModel.createFromURL(url, {layer: layerIdentifier}, options);
    return new RasterTileSetLayer(model, {
      label: layerName + " (WMTS)"
    });
  },

  createLayerFromCapabilities: (capabilities: WMTSCapabilities,
                                layer: WMTSCapabilitiesLayer,
                                style: WMTSCapabilitiesLayerStyle,
                                options?: WMTSTileSetModelCreateOptions): RasterTileSetLayer => {
    const model = WMTSTileSetModel.createFromCapabilities(capabilities, {layer: layer.identifier, style: style.identifier}, options);
    return new RasterTileSetLayer(model, {
      label: layer.title + " (WMTS)"
    });
  }
};
