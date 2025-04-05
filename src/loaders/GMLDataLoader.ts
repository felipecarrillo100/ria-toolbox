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
import {GMLCodec} from "@luciad/ria/model/codec/GMLCodec.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {Store} from "@luciad/ria/model/store/Store.js";
import {UrlStore} from "@luciad/ria/model/store/UrlStore.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {isString} from "@luciad/ria-toolbox-core/util/Lang.js";
import {LocalFileStore} from "@luciad/ria-toolbox-core/store/LocalFileStore.js";

export const GMLDataLoader = {

  /**
   * Creates a layer for the given URL of File, assuming it is GML content.
   *
   * You can style GML data using a FeaturePainter.
   * See for example the "EarthquakesPainter" in the <i>Data Formats<i> sample.
   *
   * Summary:
   * - Create a store to access the data, for example @luciad/ria/model/store/UrlStore
   * - Use @luciad/ria/model/codec/GMLCodec in the store
   * - Create a @luciad/ria/model/feature/FeatureModel for the store
   * - Create a @luciad/ria/view/feature/FeatureLayer
   * - Create a @luciad/ria/view/feature/FeaturePainter to style the layer (optional)
   */
  createLayer: (layerName: string, urlOrFile: string | File, painter?: FeaturePainter,
                swapAxes?: string[]): FeatureLayer => {
    let store: Store;
    if (isString(urlOrFile)) {
      store = new UrlStore({
        target: urlOrFile,
        codec: new GMLCodec({swapAxes: swapAxes})
      });
    } else {
      store = new LocalFileStore(urlOrFile, new GMLCodec({swapAxes: swapAxes}));
    }
    const featureModel = new FeatureModel(store);
    return new FeatureLayer(featureModel, {
      label: layerName + " (GML)",
      selectable: true,
      painter: painter
    });
  }
};
