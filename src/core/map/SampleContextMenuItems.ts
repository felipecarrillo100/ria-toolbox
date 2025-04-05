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
import {createExtrudedShape, createGeoBuffer} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {ContextMenu} from "@luciad/ria/view/ContextMenu.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {isCluster} from "@luciad/ria/view/feature/transformation/ClusteringTransformer.js";
import {Map} from "@luciad/ria/view/Map.js";
import {addChangeShapeUndoable, addDeleteFeatureUndoable, addEditUndoSupport} from "../util/SampleUndoSupport.js";
import {GeoBuffer} from "@luciad/ria/shape/GeoBuffer.js";
import {SampleEditController} from "./SampleEditController.js";

// calculate a size/distance on the map that is reasonable for creating new shapes
// the further the map is zoomed out, the larger the shape will be
function getDefaultShapeSize(map: Map): number {
  return (1.0 / map.mapScale[0]) / 50;
}

const getFirstFeature = (contextMenuInfo: any): Feature | null => {
  for (const feature of contextMenuInfo.objects) {
    if (!isCluster(feature)) {
      return feature;
    }
  }
  return null;
}

/**
 * Adds a context menu item to the given context menu that, when clicked on, will set an edit controller on the map
 * that will edit the first feature in the given contextMenuInfo.
 */
export const addEditFeatureContextMenuItem = (map: Map, contextMenu: ContextMenu, contextMenuInfo: any): void => {
  const firstFeature = getFirstFeature(contextMenuInfo);
  if (firstFeature && firstFeature.shape && contextMenuInfo.layer.editable) {
    contextMenu.addItem({
      id: "EDIT_ID",
      label: "Edit",
      action: function() {
        const editController = new SampleEditController(contextMenuInfo.layer, firstFeature, {
          finishOnSingleClick: true
        });
        addEditUndoSupport(editController);
        map.controller = editController;
      }
    });
  }
}

/**
 * Adds a context menu item to the given context menu that, when clicked on, will remove first feature in the given
 * contextMenuInfo from its model.
 */
export const addDeleteShapeContextMenuItem = (map: Map, contextMenu: ContextMenu, contextMenuInfo: any): void => {
  const firstFeature = getFirstFeature(contextMenuInfo);
  if (firstFeature && contextMenuInfo.layer.editable) {
    const featureLayer = contextMenuInfo.layer as FeatureLayer;
    contextMenu.addItem({
      id: "DELETE_ID",
      label: "Delete",
      action: function() {
        map.selectObjects([]);
        Promise.resolve(contextMenuInfo.layer.workingSet.remove(firstFeature.id)).then(id => {
          addDeleteFeatureUndoable(map, featureLayer.model, firstFeature);
        });
      }
    });
  }
}

/**
 * Adds a context menu item to the given context menu that, when clicked on, will modify the shape of the  first feature
 * in the given contextMenuInfo to a GeoBuffer based on the original shape.
 */
export const addConvertToGeoBufferContextMenuItem = (map: Map, contextMenu: ContextMenu, contextMenuInfo: any) => {
  const feature = getFirstFeature(contextMenuInfo);
  if (feature && feature.shape && contextMenuInfo.layer.editable && GeoBuffer.isSupportedBaseShape(feature.shape)) {
    contextMenu.addItem({
      label: "Convert to GeoBuffer",
      action: function() {
        const baseShape = feature.shape!;
        const width = getDefaultShapeSize(map);
        const oldShape = baseShape.copy();
        const newShape = createGeoBuffer(baseShape.reference, baseShape, width);
        feature.shape = newShape.copy();
        contextMenuInfo.layer.model.put(feature);
        addChangeShapeUndoable(map, contextMenuInfo.layer, feature, oldShape, newShape, "convert to geobuffer");
      }
    });
  }
}

/**
 * Adds a context menu item to the given context menu that, when clicked on, will modify the shape of the first feature
 * in the given contextMenuInfo to the base shape of itself, if it is a GeoBuffer.
 */
export const addConvertToBaseShapeContextMenuItem = (map: Map, contextMenu: ContextMenu, contextMenuInfo: any) => {
  const firstFeature = getFirstFeature(contextMenuInfo);
  if (firstFeature && firstFeature.shape && contextMenuInfo.layer.editable) {
    const shape = firstFeature.shape;
    if (ShapeType.contains(shape.type, ShapeType.EXTRUDED_SHAPE) ||
        ShapeType.contains(shape.type, ShapeType.GEO_BUFFER)
    ) {
      contextMenu.addItem({
        label: "Convert to Base Shape",
        action: function() {
          const feature = contextMenuInfo.objects[0];
          const oldShape = feature.shape.copy();
          const newShape = feature.shape.baseShape.copy();
          feature.shape = newShape.copy();
          contextMenuInfo.layer.model.put(feature);
          addChangeShapeUndoable(map, contextMenuInfo.layer, feature, oldShape, newShape, "convert to base shape");
        }
      });
    }
  }
}

/**
 * Adds a context menu item to the given context menu that, when clicked on, will modify the shape of the  first feature
 * in the given contextMenuInfo to an extruded shape based on the original shape.
 */
export const addExtrudeShapeContextMenuItem = (map: Map, contextMenu: ContextMenu, contextMenuInfo: any) => {
  const firstFeature = getFirstFeature(contextMenuInfo);
  if (firstFeature && firstFeature.shape && contextMenuInfo.layer.editable) {
    contextMenu.addItem({
      label: "Extrude",
      action: function() {
        const feature = contextMenuInfo.objects[0];
        const baseShape = contextMenuInfo.objects[0].shape.copy();
        const height = getDefaultShapeSize(map);
        const oldShape = feature.shape.copy();
        const newShape = createExtrudedShape(baseShape.reference, baseShape, height / 10.0, height);
        feature.shape = newShape.copy();
        contextMenuInfo.layer.model.put(feature);
        addChangeShapeUndoable(map, contextMenuInfo.layer, feature, oldShape, newShape, "convert to extruded shape");
      }
    });
  }
}