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
import {UndoManager} from "@luciad/ria/view/undo/UndoManager.js";
import {EditController} from "@luciad/ria/view/controller/EditController.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {ExtrudedShape} from "@luciad/ria/shape/ExtrudedShape.js";
import {Map} from "@luciad/ria/view/Map.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {Undoable} from "@luciad/ria/view/undo/Undoable.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {WithIdentifier} from "@luciad/ria/model/WithIdentifier.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {EditShapeStatus} from "@luciad/ria/view/controller/EditShapeEvent.js";

// samples use 1 instance of the undo manager
export const SAMPLE_UNDO_MANAGER = new UndoManager();

//#snippet UNDO_REDO_KEYS
// wire CTRL+Z to undo and CTRL+Y to redo. For Mac users, wire CMD+Z to undo and CMD+SHIFT+Z to redo.
window.addEventListener("keydown", (e) => {
  if (document.activeElement instanceof HTMLInputElement) {
    // input/text field has focus, undo/redo should affect the text and not the map
    return;
  }
  // ctrl+z or cmd+z (mac) to undo
  const isMac = window.navigator.platform.indexOf("Mac") >= 0 || window.navigator.userAgent.indexOf("Mac") >= 0;
  const isUndoKey = isMac ? (e.key === "z" && (e.metaKey && !e.shiftKey)) : (e.key === "z" && e.ctrlKey);
  if (isUndoKey) {
    SAMPLE_UNDO_MANAGER.undo();
    e.preventDefault();
  }
  // ctrl+y or cmd+shift+z (mac) to redo
  const isRedoKey = isMac ? (e.key === "z" && e.metaKey && e.shiftKey) : (e.key === "y" && e.ctrlKey);
  if (isRedoKey) {
    SAMPLE_UNDO_MANAGER.redo();
    e.preventDefault();
  }
});
//#endsnippet UNDO_REDO_KEYS

/**
 * An undoable for editing shapes
 */
class ChangeShapeUndoable extends Undoable {

  private readonly _map: Map;
  private readonly _layer: FeatureLayer;
  private readonly _feature: Feature;
  private readonly _undoShape: Shape | null;
  private readonly _redoShape: Shape | null;

  constructor(id: string, label: string, map: Map, layer: FeatureLayer, feature: Feature, undoShape: Shape | null, redoShape: Shape | null) {
    super(id, label);
    this._map = map;
    this._layer = layer;
    this._feature = feature;
    this._undoShape = undoShape;
    this._redoShape = redoShape;
  }

  redo(): void {
    this.applyShape(this._redoShape);
  }

  undo(): void {
    this.applyShape(this._undoShape);
  }

  // EditController.restart is called by the undoable, but undoables are also created from this event.
  // (for restarts with Escape key presses, cf. SampleEditController)
  // Avoid creating new undoables by applying undo/redo
  public static isRestartFromUndoable = false;

  private applyShape(shape: Shape | null): void {
    this._feature.shape = shape;
    // if the controller is still active, restart editing
    if (this._map.controller instanceof EditController) {
      ChangeShapeUndoable.isRestartFromUndoable = true;
      this._map.controller.restart(this._feature, this._layer);
      ChangeShapeUndoable.isRestartFromUndoable = false;
    } else if (this._layer.editable) {
      this._layer.model.put(this._feature);
    }
  }

}

const SHAPE_TYPE_TO_STRING: { [shapeType: number]: string } = {
  [ShapeType.POINT]: "point",
  [ShapeType.POLYGON]: "polygon",
  [ShapeType.POLYLINE]: "polyline",
  [ShapeType.GEO_BUFFER]: "geobuffer",
  [ShapeType.CIRCLE]: "circle",
  [ShapeType.ARC]: "arc",
  [ShapeType.ARC_BAND]: "arcband",
  [ShapeType.BOUNDS]: "bounds",
  [ShapeType.ELLIPSE]: "ellipse",
  [ShapeType.SECTOR]: "sector",
}

function shapeToString(shape: Shape | null): string {
  if (shape === null) {
    return "null";
  }
  if (ShapeType.contains(shape.type, ShapeType.EXTRUDED_SHAPE)) {
    const extrudedShape = shape as ExtrudedShape;
    return `extruded ${shapeToString(extrudedShape.baseShape)}`;
  }
  for (const type of Object.keys(SHAPE_TYPE_TO_STRING) as any as ShapeType[]) {
    if (ShapeType.contains(shape.type, type)) {
      return SHAPE_TYPE_TO_STRING[type];
    }
  }
  return "shape";
}

let idCounter = 0;

//#snippet EDIT_SHAPE_UNDO
/**
 * Adds sample undo/redo support to an EditController.
 * @param editController The EditController to add sample undo/redo support to
 * @param undoManager The UndoManager to add the undoable to
 */
export const addEditUndoSupport = (editController: EditController, undoManager: UndoManager = SAMPLE_UNDO_MANAGER): Handle => {
  let lastShape = editController.feature.shape ? editController.feature.shape.copy() : null;
  const editHandle = editController.on("EditShape", ({shape, status}) => {
    if (status === EditShapeStatus.FINISHED) {
      const label = `edit ${shapeToString(shape)}`;
      const newShape = shape ? shape.copy() : null;
      addChangeShapeUndoable(editController.map!, editController.layer, editController.feature, lastShape, newShape, label, undoManager);
      lastShape = newShape ? newShape.copy() : null;
    }
  });
  const restartHandle = editController.on("Restarted", () => {
    if (!ChangeShapeUndoable.isRestartFromUndoable) {
      // restart from outside undo/redo, track the change
      const shape = editController.feature.shape;
      const label = `restart ${shapeToString(shape)}`;
      const newShape = shape ? shape.copy() : null;
      addChangeShapeUndoable(editController.map!, editController.layer, editController.feature, lastShape, newShape, label, undoManager);
      lastShape = newShape ? newShape.copy() : null;
    }
    lastShape = editController.feature.shape ? editController.feature.shape.copy() : null;
  });
  const deactivateHandle = editController.on("Deactivated", () => {
    restartHandle.remove();
    editHandle.remove();
    deactivateHandle.remove();
  });
  return {
    remove: () => {
      restartHandle.remove();
      editHandle.remove();
      deactivateHandle.remove();
    }
  }
}
//#endsnippet EDIT_SHAPE_UNDO

/**
 * Adds an undoable to the sample undo manager that undoes/redoes changing a feature's shape.
 */
export const addChangeShapeUndoable = (map: Map, layer: FeatureLayer, feature: Feature, oldShape: Shape | null, newShape: Shape | null, label: string, undoManager: UndoManager = SAMPLE_UNDO_MANAGER) => {
  const id = `${label}-${idCounter++}`;
  const undoable = new ChangeShapeUndoable(id, label, map, layer, feature, oldShape, newShape);
  undoManager.push(undoable);
}

type SelectedObject = {
  layer: Layer,
  selected: WithIdentifier[]
}

interface Lock {
  locked: boolean;
}

/**
 * An undoable for selection
 */
class SelectionUndoable extends Undoable {

  private readonly _map: Map;
  private readonly _selectionBefore: SelectedObject[];
  private readonly _selectionAfter: SelectedObject[];
  private _lock: Lock;

  constructor(id: string, label: string, map: Map, selectionBefore: SelectedObject[], selectionAfter: SelectedObject[], lock: Lock) {
    super(id, label);
    this._map = map;
    this._selectionBefore = [...selectionBefore];
    this._selectionAfter = [...selectionAfter];
    this._lock = lock;
  }

  redo(): void {
    this.applySelection(this._selectionAfter);
  }

  undo(): void {
    this.applySelection(this._selectionBefore);
  }

  private applySelection(selectedObjects: SelectedObject[]): void {
    // stop editing when applying a new selection
    if (this._map.controller instanceof EditController) {
      this._map.controller = null;
    }

    this._lock.locked = true;
    const objectsToSelect = selectedObjects.map(sel => {
      return {
        layer: sel.layer as FeatureLayer | TileSet3DLayer,
        objects: sel.selected as Feature[]
      };
    });
    this._map.selectObjects(objectsToSelect);
    this._lock.locked = false;
  }
}

/**
 * Adds selection undo/redo support to a map
 * @param map The map to add undo/redo support to
 * @param undoManager The UndoManager to add the undoable to
 */
export const addSelectionUndoSupport = (map: Map, undoManager: UndoManager = SAMPLE_UNDO_MANAGER): Handle => {
  const lock = {locked: false};
  let currentSelection = [...map.selectedObjects];
  return map.on("SelectionChanged", (_event) => {
    if (!lock.locked) {
      const id = "" + idCounter++;
      const label = "selection change";
      undoManager.push(
        new SelectionUndoable(id, label, map, currentSelection, map.selectedObjects, lock)
      );
      currentSelection = [...map.selectedObjects];
    }
  });
}

/**
 * An undoable for adding and deleting features to a model
 */
class CreationDeletionUndoable extends Undoable {

  private readonly _map: Map;
  private readonly _model: FeatureModel;
  private readonly _feature: Feature;
  private readonly _lock: Lock;
  private readonly _swap: boolean;

  constructor(id: string, label: string, map: Map, model: FeatureModel, feature: Feature, swap: boolean, lock: Lock) {
    super(id, label);
    this._map = map;
    this._model = model;
    this._feature = feature;
    this._lock = lock;
    this._swap = swap;
  }

  redo(): void {
    this._swap ? this.removeFeature() : this.addFeature();
  }

  undo(): void {
    this._swap ? this.addFeature() : this.removeFeature();
  }

  private addFeature(): void {
    if (this._lock) {
      this._lock.locked = true;
    }
    Promise.resolve(this._model.get(this._feature.id)).then(feature => {
      if (!feature) {
        throw new Error("Feature not in store");
      }
      if (this._lock) {
        this._lock.locked = false;
      }
    }).catch(() => {
      // feature is not in the store => add it to the model
      Promise.resolve(this._model.put(this._feature)).then((_ignored) => {
        this._lock.locked = false;
      }).catch(() => {
        this._lock.locked = false;
      });
    });
  }

  private removeFeature(): void {
    if (this._map.controller instanceof EditController && this._map.controller.feature === this._feature) {
      this._map.controller = null;
    }
    this._lock.locked = true;
    this._model.remove(this._feature.id);
    this._lock.locked = false;
  }

}

const createDeleteLock = {locked: false};

/**
 * Adds an undoable to the sample undo manager that undoes/redoes deletion of a feature
 * @param map The map
 * @param model The model where the deleted feature is/was in
 * @param feature The deleted feature
 * @param undoManager The UndoManager to add the undoable to
 */
export const addDeleteFeatureUndoable = (map: Map, model: FeatureModel, feature: Feature, undoManager: UndoManager = SAMPLE_UNDO_MANAGER) => {
  const id = "delete-" + idCounter++;
  const label = `delete ${shapeToString(feature.shape!)}`;
  const undoable = new CreationDeletionUndoable(id, label, map, model, feature, true, createDeleteLock);
  undoManager.push(undoable);
}

/**
 * Adds an undoable that undoes/redoes creation of a feature
 * @param map The map
 * @param model the model of the feature
 * @param feature The created feature
 * @param undoManager The UndoManager to add the undoable to
 */
export const addCreateFeatureUndoable = (map: Map, model: FeatureModel, feature: Feature, undoManager = SAMPLE_UNDO_MANAGER): void => {
  const label = `create ${shapeToString(feature.shape!)}`;
  const id = "create-" + idCounter++;
  const undoable = new CreationDeletionUndoable(id, label, map, model, feature, false, createDeleteLock);
  undoManager.push(undoable);
}