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
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {
  createGoogleMapsTileSetModel,
  GoogleMapsTileSetModelCreateOptions
} from "@luciad/ria/model/tileset/GoogleMapsTileSetModel.js";
import GoogleLogoUrl from "./google_logo.png";

export const DefaultGoogleMapsTileSetModelCreateOptions: GoogleMapsTileSetModelCreateOptions = {
  mapType: "roadmap",
  language: "en-US",
  region: "US",
}

export const GoogleMapsDataLoader = {
  /**
   * Creates a layer for Google Maps data.
   *
   * @param apiKey The API key to connect with Google Maps.
   * @param detailFactor The detail factor modifies the quality/detail of the loaded data.
   * @param options (Default DefaultGoogleMapsTileSetModelCreateOptions)
   * @return {Promise} A promise for a layer.
   */
  createLayer: async (apiKey: string,
                      detailFactor: number,
                      options: GoogleMapsTileSetModelCreateOptions = DefaultGoogleMapsTileSetModelCreateOptions):
      Promise<RasterTileSetLayer> => {
     //#snippet ADD_GOOGLE_LOGO
    const googleMapsModel = await createGoogleMapsTileSetModel(apiKey, options);
    googleMapsModel.getLogo = function(): string {
      return GoogleLogoUrl;
    };
    //#endsnippet ADD_GOOGLE_LOGO

    return new RasterTileSetLayer(googleMapsModel, {
      label: `${options.mapType} (Google)`,
      layerType: options.overlay ? LayerType.STATIC : LayerType.BASE,
      id: options.overlay ? "Overlay" : "Background",
      detailFactor: detailFactor
    });
  },
};