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
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {LayerTreeNodeType} from "@luciad/ria/view/LayerTreeNodeType.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";

/**
 * Utility function to retrieve bounds to fit on for different types of layers and layer groups.
 * @param layerTreeNode The LayerTreeNode to get fit bounds for
 */
export async function getFitBounds(layerTreeNode: LayerTreeNode): Promise<Bounds | null> {
  if (layerTreeNode.treeNodeType === LayerTreeNodeType.LAYER) {
    if (layerTreeNode instanceof FeatureLayer) {
      if (layerTreeNode.bounds) {
        return Promise.resolve(layerTreeNode.bounds);
      } else {
        return new Promise((resolve, reject) => {
          const queryFinishedHandle = layerTreeNode.workingSet.on("QueryFinished", () => {
            queryFinishedHandle?.remove();
            queryErrorHandle?.remove();
            resolve(layerTreeNode.bounds || null);
          });
          const queryErrorHandle = layerTreeNode.workingSet.on("QueryError", () => {
            queryFinishedHandle?.remove();
            queryErrorHandle?.remove();
            resolve(layerTreeNode.bounds || null);
          });
        });
      }
    } else {
      if (layerTreeNode instanceof TileSet3DLayer && layerTreeNode.model.reference.referenceType ===
          ReferenceType.CARTESIAN && layerTreeNode.transformation) {
        // non-georeferenced TileSet3DLayers have model bounds that are cartesian (not-georeferenced), so cannot fit on those
        // layer.bounds can be used, as long as there is a transformation on the layer. These bounds are the result
        // of transforming the cartesian model bounds with the geolocateTransformation
        return layerTreeNode.bounds;
      }
      // prefer model bounds over layer bounds, so you always fit on the entire dataset in case of spatial loading
      return ((layerTreeNode as any).model && (layerTreeNode as any).model.bounds) || (layerTreeNode as any).bounds;
    }
  } else if (layerTreeNode.treeNodeType === LayerTreeNodeType.LAYER_GROUP) {
    const layers: Layer[] = [];
    const visitor: LayerTreeVisitor = {
      visitLayer: (layer): LayerTreeVisitor.ReturnValue => {
        layers.push(layer);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      },
      visitLayerGroup: (layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue => {
        layerGroup.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      }
    };
    layerTreeNode.accept(visitor);
    return Promise.all(layers.map(l => getFitBounds(l))).then(childLayerBounds => {
      let result: Bounds | null = null;
      for (const bounds of childLayerBounds) {
        if (!result && bounds) {
          result = bounds;
        } else if (result && bounds) {
          const toResultRef = createTransformation(bounds.reference!, result.reference!);
          const boundsInResultRef = toResultRef.transformBounds(bounds);
          result.setTo2DUnion(boundsInResultRef);
        }
      }
      return result;
    });
  }
  return Promise.resolve(null);
}