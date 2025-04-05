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
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Map, SelectionChangeEvent} from "@luciad/ria/view/Map.js";
import {PickInfo} from "@luciad/ria/view/PickInfo.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {ScalingMode} from "@luciad/ria/view/style/ScalingMode.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";

/**
 * Synchronizes the selection between the two given maps, by listening for selection
 * changes on one map and applying equivalent changes on the other (and vice versa).
 *
 * You can run additional logic (for example, activate an EditController), by using the onMainMapSelectionChange callback.
 */
export function synchronizeSelection(map1: Map, map2: Map, onSelectionChange?: (sourceMap: Map, event: SelectionChangeEvent, targetMap: Map) => void): Handle {
  let listenForSelectionChanges = true; // avoid infinite selection loops

  const handleSelectionChange = (map: Map, otherMap: Map, event: SelectionChangeEvent) => {
    if (!listenForSelectionChanges) {
      return;
    }
    try {
      listenForSelectionChanges = false;
      onSelectionChange?.(map, event, otherMap);
      copySelection(map, otherMap);
    } catch (error) {
      //ignore error. Expected when selecting an object which is not included in the workingSet of the
      //other layer
    } finally {
      listenForSelectionChanges = true;
    }
  }

  const map1SelectionListener = map1.on("SelectionChanged", (event: SelectionChangeEvent) => {
    handleSelectionChange(map1, map2, event);
  });

  const map2SelectionListener = map2.on("SelectionChanged", (event: SelectionChangeEvent) => {
    handleSelectionChange(map2, map1, event);
  });

  // copy existing selection
  if (map1.selectedObjects.length >= 1) {
    copySelection(map1, map2);
  } else if (map2.selectedObjects.length >= 1) {
    copySelection(map2, map1);
  }

  return {
    remove: () => {
      map1SelectionListener.remove();
      map2SelectionListener.remove();
    }
  }
}

function copySelection(sourceMap: Map, targetMap: Map) {
  const targetSelectedObjects: PickInfo[] = [];
  for (const selectedObj of sourceMap.selectedObjects) {
    const targetLayer = targetMap.layerTree.findLayerById(selectedObj.layer.id);
    if (targetLayer) {
      targetSelectedObjects.push({
        layer: targetLayer as FeatureLayer,
        objects: selectedObj.selected as Feature[]
      });
    }
  }
  targetMap.selectObjects(targetSelectedObjects);
}

/**
 * Synchronizes hovering between the two given maps, by listening for hover
 * changes on one map and applying equivalent changes on the other (and vice versa).
 */
export function synchronizeHovering(map1: Map, map2: Map): Handle {
  let listenForHoverChanges = true; // avoid infinite selection loops

  const handleHoverChange = (map: Map, otherMap: Map) => {
    if (!listenForHoverChanges) {
      return;
    }
    try {
      listenForHoverChanges = false;
      copyHover(map, otherMap);
    } catch (error) {
      //ignore error. Expected when selecting an object which is not included in the workingSet of the
      //other layer
    } finally {
      listenForHoverChanges = true;
    }
  }

  const map1HoverListener = map1.on("HoverChanged", () => {
    handleHoverChange(map1, map2);
  });

  const map2HoverListener = map2.on("HoverChanged", () => {
    handleHoverChange(map2, map1);
  });

  // copy existing hovering
  if (map1.hoveredObjects.length >= 1) {
    copyHover(map1, map2);
  } else if (map2.hoveredObjects.length >= 1) {
    copyHover(map2, map1);
  }

  return {
    remove: () => {
      map1HoverListener.remove();
      map2HoverListener.remove();
    }
  }
}

function copyHover(sourceMap: Map, targetMap: Map) {
  const targetHoverObjects: PickInfo[] = [];
  for (const hoveredObject of sourceMap.hoveredObjects) {
    const targetLayer = targetMap.layerTree.findLayerById(hoveredObject.layer.id);
    if (targetLayer) {
      targetHoverObjects.push({
        layer: targetLayer as FeatureLayer,
        objects: hoveredObject.hovered as Feature[]
      });
    }
  }
  targetMap.hoverObjects(targetHoverObjects);
}

/**
 * Applies effects of the map1 on the map2, and recreates map1's 3D layers on map2.
 */
export function copyMapEffectsAnd3DLayers(map1: Map, map2: WebGLMap) {
  map2.effects.environmentMap = map1.effects.environmentMap;
  map2.effects.eyeDomeLighting = map1.effects.eyeDomeLighting;
  map2.effects.ambientOcclusion = map1.effects.ambientOcclusion;

  const visitor: LayerTreeVisitor = {
    visitLayer: layer => {
      if (layer.visible && layer instanceof TileSet3DLayer) {
        copyMeshLayer(map2, layer);
      }
      return LayerTreeVisitor.ReturnValue.CONTINUE;
    },
    visitLayerGroup: layerGroup => {
      if (layerGroup.visible) {
        layerGroup.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
      }
      return LayerTreeVisitor.ReturnValue.CONTINUE;
    },
  };
  map1.layerTree.accept(visitor);
}

function copyMeshLayer(magnifierMap: WebGLMap, layer: TileSet3DLayer) {
  const tileSet3DLayer = new TileSet3DLayer(layer.model, {
    id: `${layer.id}`,
    label: layer.label,
    selectable: false,
    qualityFactor: 1.5 * layer.qualityFactor,
    fadingTime: 0,
    loadingStrategy: layer.loadingStrategy,
    transformation: layer.transformation ?? undefined,
    meshStyle: layer.meshStyle,
    pointCloudStyle: layer.pointCloudStyle,
    performanceHints: {maxPointCount: 15_000_000},
    transparency: layer.transparency,
  });
  tileSet3DLayer.pointCloudStyle.pointSize = {mode: ScalingMode.ADAPTIVE_WORLD_SIZE, minimumPixelSize: 4};
  tileSet3DLayer.pointCloudStyle.gapFill = 3;
  magnifierMap.layerTree.addChild(tileSet3DLayer);
}
