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
import {UrlTileSetModel} from "@luciad/ria/model/tileset/UrlTileSetModel.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";

const webMercatorReference = getReference("EPSG:3857");
const webMercatorBounds = createBounds(webMercatorReference,
    [-20037508.3427892, 2 * 20037508.3427892, -20037508.3427892, 2 * 20037508.3427892]);

export const OSMDataLoader = {
  /**
   * Creates a layer for OpenStreetMap tile services.
   *
   * This class uses Web Mercator as reference by default.
   */
  createLayer: (url: string): RasterTileSetLayer => {
    // Define the base URL for the tile service:
    if (url.substr(-1) !== '/') {
      url = url + '/';
    }
    url = url + '{z}/{x}/{-y}.png';
    const modelOptions = {
      structure: {
        bounds: webMercatorBounds,
        level0Columns: 1,
        level0Rows: 1,
        tileWidth: 256,
        tileHeight: 256,
        reference: webMercatorReference
      },
      baseURL: url,
    };
    const model = new UrlTileSetModel(modelOptions);
    return new RasterTileSetLayer(model, {
      label: "OpenStreetMap"
    });
  },
};
