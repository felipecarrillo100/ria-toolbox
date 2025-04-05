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
import {LTSCapabilities} from "@luciad/ria/model/capabilities/LTSCapabilities.js";
import {LTSCapabilitiesCoverage} from "@luciad/ria/model/capabilities/LTSCapabilitiesCoverage.js";
import {
  FusionTileSetModel,
  FusionTileSetModelConstructorOptions
} from "@luciad/ria/model/tileset/FusionTileSetModel.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";

export const LuciadFusionDataLoader = {
  /**
   * Creates a layer for LuciadFusion raster tile coverages.
   *
   * Summary:
   * - Create a @luciad/ria/model/tileset/FusionTileSetModel with all details about the coverage
   * - Create a @luciad/ria/view/tileset/RasterTileSetLayer
   */
  createLayer: (layerName: string, options: FusionTileSetModelConstructorOptions): RasterTileSetLayer => {
    return new RasterTileSetLayer(new FusionTileSetModel(options), {
      label: layerName + " (Fusion)",
      layerType: LayerType.BASE
    });
  },

  createLayerFromCapabilities: (capabilities: LTSCapabilities, coverage: LTSCapabilitiesCoverage): RasterTileSetLayer => {
    return new RasterTileSetLayer(FusionTileSetModel.createFromCapabilities(capabilities, coverage.id), {
      label: coverage.name + " (Fusion)",
      layerType: LayerType.BASE
    });
  }
};