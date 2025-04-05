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
import {Layer} from "@luciad/ria/view/Layer.js";
import {LayerTree} from "@luciad/ria/view/LayerTree.js";
import {useEffect, useState} from "react";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {Handle} from "@luciad/ria/util/Evented.js";

/**
 * Returns an up-to-date flat list of layers that are currently on the given layerTree and satisfy the given filter.
 */
export function useLayers(layerTree: LayerTree, filter: (layer: Layer) => boolean): Layer[] {
  const [layers, setLayers] = useState<Layer[]>([]);

  useEffect(() => {

    function visitLayerTree() {
      const newLayers: Layer[] = [];
      const visitor: LayerTreeVisitor = {
        visitLayer: (layer: Layer): LayerTreeVisitor.ReturnValue => {
          if (filter(layer)) {
            newLayers.push(layer);
          }
          return LayerTreeVisitor.ReturnValue.CONTINUE;
        },
        visitLayerGroup(layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue {
          layerGroup.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
          return LayerTreeVisitor.ReturnValue.CONTINUE;
        }
      };

      layerTree.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
      setLayers(newLayers);
    }

    const handles: Handle[] = [];
    handles.push(layerTree.on("NodeAdded", visitLayerTree));
    handles.push(layerTree.on("NodeRemoved", visitLayerTree));
    visitLayerTree();
    return () => {
      for (const handle of handles) {
        handle.remove();
      }
    }
  }, [])

  return layers;
}