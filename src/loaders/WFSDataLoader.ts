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
import {WFSCapabilities} from "@luciad/ria/model/capabilities/WFSCapabilities.js";
import {WFSCapabilitiesFeatureType} from "@luciad/ria/model/capabilities/WFSCapabilitiesFeatureType.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {WFSFeatureStore} from "@luciad/ria/model/store/WFSFeatureStore.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {LoadSpatially} from "@luciad/ria/view/feature/loadingstrategy/LoadSpatially.js";
import {QueryProvider} from "@luciad/ria/view/feature/QueryProvider.js";
import {Map} from "@luciad/ria/view/Map.js";

class MaxFeaturesQueryProvider extends QueryProvider {
  getQueryForLevel(level: number): any {
    return {maxFeatures: 10000};
  }

  getQueryLevelScales(layer: FeatureLayer, map: Map): number[] {
    return [];
  }
}

export const WFSDataLoader = {
  /**
   * Creates a layer for WFS data.
   *
   * You can style WFS data using a FeaturePainter.
   * See for example the <i>Vector Data<i> sample.
   *
   * Summary:
   * - Create a @luciad/ria/model/store/WFSFeatureStore to access the server
   * - Create a @luciad/ria/model/feature/FeatureModel for the store
   * - Create a @luciad/ria/view/feature/FeatureLayer
   * - Create a @luciad/ria/view/feature/FeaturePainter to style the layer (optional)
   */
  createLayer: async (url: string, featureTypeName: string, title: string,
                      options: { painter?: FeaturePainter } = {}): Promise<FeatureLayer> => {
    const painter = options.painter;
    const store = await WFSFeatureStore.createFromURL(url, featureTypeName);
    return new FeatureLayer(new FeatureModel(store), {
      label: `${title} (WFS)`,
      selectable: true,
      painter,
      loadingStrategy: new LoadSpatially({
        queryProvider: new MaxFeaturesQueryProvider()
      })
    });
  },

  /**
   * Creates layers for given feature types.
   *
   * @param capabilities WFSCapabilities object,
   * @param featureTypes An array of objects that define the WFS feature types.
   * Summary:
   * For every selected feature type:
   * - Create a @luciad/ria/model/store/WFSFeatureStore to access the server
   * - Create a @luciad/ria/model/feature/FeatureModel for the store
   * - Create a @luciad/ria/view/feature/FeatureLayer
   * - Create a @luciad/ria/view/feature/FeaturePainter to style the layer (optional)
   */
  createLayers: (capabilities: WFSCapabilities, featureTypes: WFSCapabilitiesFeatureType[]): FeatureLayer[] => {
    const layers: FeatureLayer[] = [];
    const crs84 = getReference("CRS:84");
    featureTypes.forEach(featureType => {
      const featureTypeReference = getReference(featureType.defaultReference);
      const defaultReferenceTransformation = createTransformation(crs84, featureTypeReference);
      const featureTypeBounds = featureType.getWGS84Bounds().length > 0
                                ? defaultReferenceTransformation.transformBounds(featureType.getWGS84Bounds()[0]) :
                                createBounds(crs84, [-180, 360, -90, 180]);
      const layer = new FeatureLayer(
          // We initialize the feature model with the complete bounds of the feature type,
          // to make sure that fit operations show the complete feature type's extent.
          new FeatureModel(
              WFSFeatureStore.createFromCapabilities(capabilities, featureType.name), {
                reference: featureTypeReference,
                bounds: featureTypeBounds
              }
          ), {
            label: `${featureType.title} (WFS)`,
            selectable: true,
            loadingStrategy: new LoadSpatially({
              queryProvider: new MaxFeaturesQueryProvider()
            })
          }
      );
      layers.push(layer);
    });

    return layers;
  }
};