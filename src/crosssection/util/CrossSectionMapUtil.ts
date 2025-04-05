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
import {OGC3DTilesModel} from "@luciad/ria/model/tileset/OGC3DTilesModel.js";
import {createCartesianReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";
import {color} from "@luciad/ria/util/expression/ExpressionFactory.js";
import {AxisConfiguration} from "@luciad/ria/view/axis/AxisConfiguration.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {Map} from "@luciad/ria/view/Map.js";
import {TileLoadingStrategy, TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {LayerTreeNodeType} from "@luciad/ria/view/LayerTreeNodeType.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {createCompositeHandle} from "@luciad/ria-toolbox-core/util/EventedUtil.js";

export const DEFAULT_SLICE_COLOR = '#0c9e98';
export const CARTESIAN_REFERENCE = createCartesianReference({
  xUnitOfMeasure: getUnitOfMeasure('Meter'),
  yUnitOfMeasure: getUnitOfMeasure('Meter'),
});

export const MIN_CARTESIAN_MAP_SCALE = 0.0008;
export const MAX_CARTESIAN_MAP_SCALE = 0.0512; //it's best if the max is equal to the min multiplied by power of 2

export const SLICE_MAP_FOV_Y = 2;

const AXES: AxisConfiguration = {
  axisLineStyle: {color: 'rgba(0,0,0,0)'},
};

/**
 * Create a new slice map, used to show a slice of the given mainMap's mesh layers.
 * Assuming that the depth of this slice is relatively thin, this slice can be seen as a cross-section.
 * @returns the new slice map, and the handles that keep the slice map's layers in sync with the main map's layers.
 */
export async function createSliceMap(mainMap: Map, sliceMapNode: HTMLElement): Promise<WebGLMap> {
  const sliceMap = new WebGLMap(sliceMapNode, {reference: mainMap.reference});

  sliceMap.effects.antiAliasing = false;
  sliceMap.effects.atmosphere = false;
  sliceMap.effects.starfield = false;
  sliceMap.effects.light = null;
  sliceMap.globeColor = 'rgba(0, 0, 0, 0.0)';
  sliceMap.adjustDepthRange = false;
  sliceMap.camera = sliceMap.camera.copyAndSet({fovY: SLICE_MAP_FOV_Y});

  await sliceMap.layerTree.whenReady();
  return sliceMap;
}

/**
 * Copies all TileSet3DLayer layers from the mainMap to the sliceMap and keep the slice map in sync with the mainMap.
 * @param mainMap The main map.
 * @param sliceMap The overlay map on which the cross-section will be painted.
 * @param applyColorExpression Apply a uniform color to the cross-section map.
 * @returns the handle that keeps the maps' layers synchronized
 */
export function synchronizeMeshLayers(mainMap: Map, sliceMap: WebGLMap, applyColorExpression = true): Handle {
  const synchronizationHandles: Handle[] = [];
  synchronizationHandles.push(deepCopyLayer(mainMap.layerTree, sliceMap.layerTree, applyColorExpression));
  synchronizationHandles.push(synchronizeEvents(mainMap, sliceMap, applyColorExpression));
  return createCompositeHandle(synchronizationHandles);
}

function deepCopyLayer(layerGroupSource: LayerGroup, layerGroupDestination: LayerGroup,
                       applyColorExpression: boolean): Handle {
  const synchronizationHandles: Handle[] = [];
  for(const child of layerGroupSource.children) {
    if ( child instanceof TileSet3DLayer) {
      const copy = createMeshLayerCopy(child, applyColorExpression);
      layerGroupDestination.addChild(copy, 'bottom');
      synchronizationHandles.push(synchronizeLayerVisibility(child, copy));
    } else if (child instanceof LayerGroup) {
      const groupCopy = createLayerGroupCopy(child as LayerGroup);
      layerGroupDestination.addChild(groupCopy.group);
      synchronizationHandles.push(groupCopy.synchronizationHandle);
      synchronizationHandles.push(deepCopyLayer(child as LayerGroup, groupCopy.group, applyColorExpression));
    }
  }
  return createCompositeHandle(synchronizationHandles);
}

function synchronizeLayerVisibility(mainMapLayer: TileSet3DLayer, sliceMapLayer: TileSet3DLayer): Handle {
  sliceMapLayer.visible = mainMapLayer.visible;
  return mainMapLayer.on("VisibilityChanged", (visibility) => {
    sliceMapLayer.visible = visibility;
  });
}

function createMeshLayerCopy(layer: TileSet3DLayer, applyColorExpression = true): TileSet3DLayer {
  return new TileSet3DLayer(layer.model as OGC3DTilesModel, {
    id: layer.id,
    visible: layer.visible,
    selectable: false,
    qualityFactor: layer.qualityFactor,
    fadingTime: 0,
    loadingStrategy: TileLoadingStrategy.DETAIL_FIRST,
    transformation: layer.transformation ?? undefined,
    meshStyle: applyColorExpression ? {colorExpression: color(DEFAULT_SLICE_COLOR)} : undefined,
    pointCloudStyle: layer.pointCloudStyle
  });
}

function createLayerGroupCopy(layerGroup: LayerGroup): { group: LayerGroup, synchronizationHandle: Handle } {
  const newGroup = new LayerGroup({
    id: layerGroup.id,
    label: layerGroup.label,
    visible: layerGroup.visible,
  });
  const synchronizationHandle = layerGroup.on("VisibilityChanged", (visibility) => {
    newGroup.visible = visibility
  });

  return {group: newGroup, synchronizationHandle};
}

/**
 * Make a map subscribe to layerTree node events of another map
 * @param mainMap Map emitting events
 * @param secondaryMap Map receiving events
 * @param applyColorExpression True if the color expression has to be overridden
 * @returns the handle that keeps the maps synchronized
 */
function synchronizeEvents(mainMap: Map, secondaryMap: WebGLMap, applyColorExpression: boolean): Handle {
  const synchronizationHandles: Handle[] = [];
  synchronizationHandles.push(mainMap.layerTree.on("NodeAdded", (event) => {
    const nodeToAdd = event.node;
    const mainMapParent = nodeToAdd.parent;
    if (mainMapParent) {
      // Root nodes for the mainMap and sliceMap don't have the same id. So we need to handle this corner case.
      const isAddedOnRoot = !mainMapParent.parent;
      const sliceMapParent = (isAddedOnRoot ? secondaryMap.layerTree : secondaryMap.layerTree.findLayerGroupById(mainMapParent.id));

      if (nodeToAdd.treeNodeType === LayerTreeNodeType.LAYER) {
        if (nodeToAdd instanceof TileSet3DLayer) {
          const copy = createMeshLayerCopy(nodeToAdd, applyColorExpression);
          sliceMapParent.addChild(copy);
          synchronizationHandles.push(synchronizeLayerVisibility(nodeToAdd, copy));
        }
      } else if (nodeToAdd.treeNodeType === LayerTreeNodeType.LAYER_GROUP) {
        const oldGroup = nodeToAdd as LayerGroup;
        const groupCopy = createLayerGroupCopy(oldGroup);
        sliceMapParent.addChild(groupCopy.group);
        synchronizationHandles.push(groupCopy.synchronizationHandle);
        synchronizationHandles.push(deepCopyLayer(oldGroup, groupCopy.group, applyColorExpression));
      }
    } else {
      throw Error("Cannot copy a root node to map");
    }
  }))
  synchronizationHandles.push(mainMap.layerTree.on("NodeRemoved", (event) => {
    const nodeToRemove = secondaryMap.layerTree.findLayerTreeNodeById(event.node.id);
    // If not a TileSet3DLayer, there is no node to remove.
    nodeToRemove?.parent?.removeChild(nodeToRemove);
  }))
  synchronizationHandles.push(mainMap.layerTree.on("NodeMoved", (event) => {
    const nodeToMove = secondaryMap.layerTree.findLayerTreeNodeById(event.node.id);
    if (nodeToMove) {
      // The parent node is either the last node in the path or the root node
      const parentToMoveTo = event.path[event.path.length - 1] ?? secondaryMap.layerTree;
      const parentToMoveToInSecondaryMap = secondaryMap.layerTree.findLayerGroupById(parentToMoveTo.id)
      parentToMoveToInSecondaryMap.moveChild(nodeToMove);
    }
  }))
  return createCompositeHandle(synchronizationHandles);
}

/**
 * Creates a 2D cartesian map with axes defined in meter, which can be used to make measurements on.
 */
export async function createCartesianMap(containerNode: HTMLElement): Promise<Map> {
  const cartesianMap = new WebGLMap(containerNode, {
    reference: CARTESIAN_REFERENCE,
    axes: { // defining axis prevents rotations on the map
      xAxis: AXES,
      yAxis: AXES,
    },
  });
  // restrict map navigations
  cartesianMap.mapNavigator.constraints = {
    scale: {
      minScale: MIN_CARTESIAN_MAP_SCALE,
      maxScale: MAX_CARTESIAN_MAP_SCALE,
    },
  };
  cartesianMap.effects.antiAliasing = false;

  await cartesianMap.mapNavigator.fit({
    bounds: createBounds(CARTESIAN_REFERENCE, [-40, 80, -20, 40]),
    animate: false,
  }).catch();

  return cartesianMap;
}
