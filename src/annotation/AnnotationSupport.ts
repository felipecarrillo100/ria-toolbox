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
import {Bounds} from '@luciad/ria/shape/Bounds.js';
import {Map} from '@luciad/ria/view/Map.js';
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {Handle} from '@luciad/ria/util/Evented.js';
import {FeatureLayer} from '@luciad/ria/view/feature/FeatureLayer.js';
import {MemoryStore} from '@luciad/ria/model/store/MemoryStore.js';
import {LookAt} from '@luciad/ria/view/camera/LookAt.js';
import {hoverSafely, selectSafely} from "./SelectionUtil.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {PickInfo} from "@luciad/ria/view/PickInfo.js";

/**
 * A generic interface representing an annotation on a LuciadRIA map.
 */
export interface Annotation {
  /**
   * The unique identifier of the annotation
   */
  id: string;

  /**
   * Whether the annotation should be visible on the map or not
   */
  visible: boolean
}

/**
 * Options used to create an AnnotationSupport
 */
export interface AnnotationSupportCreateOptions {
  /**
   * The map on which annotations will be displayed
   */
  map: Map;

  /**
   * Callback called when the Annotation Support wants to change the controller relevant for annotation management.
   * The default implementation sets the given controller to the map's controller field.
   */
  onControllerChange?: ((controller: Controller | null) => void);

  /**
   * Callback called when the Annotation Support created a layer on which it will display the annotations.
   * The default implementation adds the given layer to the layer tree of the map.
   */
  onLayerCreated?: ((layer: Layer) => void);

  /**
   * The bounds in which annotations are allowed to be created.
   * If these are omitted, creation is unrestricted.
   */
  creationBounds?: Bounds;
}

const ANNOTATION_CREATED_EVENT = 'AnnotationCreatedEvent';
const ANNOTATION_CONTROLLER_ACTIVE_STATE_CHANGED_EVENT = 'AnnotationActiveStateChanged';
const ANNOTATION_HOVERED_CHANGED_EVENT = 'AnnotationHoveredChanged';
const ANNOTATIONS_SELECTION_CHANGED_EVENT = 'AnnotationsSelectionChanged';

/**
 * Abstract support class to help with annotation management.
 * Use the {@link updateAnnotations} method when you want to add, remove or modify the managed annotations.
 * Use the {@link updateCreationState} method to change whether the user should be creating an annotation or just
 * seeing/interacting with them.
 *
 * @template A The type of annotations that you pass to this class in {@link updateAnnotations}
 * @template F The type of feature that will be stored in the model of the annotation layer
 * @template C The type of controller that is used when the support is creating annotations
 * @template T The type of options that are passed to create the annotation controller
 * @template U The type of object that is returned when an annotation is created.
 */
export abstract class AnnotationSupport<A extends Annotation, F extends Feature, C extends Controller, T, U> {
  protected readonly _map: Map;
  protected readonly _store: MemoryStore<F>;
  protected readonly _layer: FeatureLayer;
  protected readonly _onControllerChange: ((controller: Controller | null) => void);
  protected readonly _eventedSupport = new EventedSupport(
      [ANNOTATION_CREATED_EVENT, ANNOTATION_HOVERED_CHANGED_EVENT, ANNOTATIONS_SELECTION_CHANGED_EVENT,
       ANNOTATION_CONTROLLER_ACTIVE_STATE_CHANGED_EVENT], true);
  private readonly _handles: Handle[] = [];
  protected _creationBounds: Bounds | null;
  protected _switchingControllers: boolean = false;
  protected _annotationController: C | null = null;

  /**
   * Creates a new AnnotationSupport
   * @param options {@see AnnotationSupportCreateOptions}
   */
  constructor(options: AnnotationSupportCreateOptions) {
    this._map = options.map;
    this._onControllerChange = options.onControllerChange ??
                               ((controller) => this._map.controller = controller);

    this._store = new MemoryStore<F>();
    this._layer = this.createLayer(this._store, options);

    if (options.onLayerCreated) {
      options.onLayerCreated(this._layer);
    } else {
      this._map.layerTree.addChild(this._layer);
    }

    this._creationBounds = options.creationBounds ?? null;
    this.setupListeners();
  }

  /**
   * Creates the layer that will be used to display the annotation features on the map.
   */
  protected abstract createLayer(store: MemoryStore<F>, options: AnnotationSupportCreateOptions): FeatureLayer;

  /**
   * Sets the bounds in which annotations are allowed to be created.
   * If these are omitted, creation is unrestricted.
   * Changing this while the user is already creating an annotation has no effect.
   */
  setCreationBounds(bounds: Bounds | null) {
    this._creationBounds = bounds
  }

  private setupListeners() {
    this._handles.push(this._map.on("HoverChanged", (event) => {
      if (event.hoverChanges.find(({layer}) => layer === this._layer)) {
        const hoveredIds = this._map.hoveredObjects.find(({layer}) => layer === this._layer)?.hovered?.map(
            ({id}) => id);
        this._eventedSupport.emit(ANNOTATION_HOVERED_CHANGED_EVENT, (hoveredIds ?? []) as string[])
      }
    }));
    this._handles.push(this._map.on("SelectionChanged", (event) => {
      if (event.selectionChanges.find(({layer}) => layer === this._layer)) {
        const selectedIds = this._map.selectedObjects.find(({layer}) => layer === this._layer)?.selected?.map(
            ({id}) => id);
        this._eventedSupport.emit(ANNOTATIONS_SELECTION_CHANGED_EVENT, (selectedIds ?? []) as string[])
      }
    }));
  }

  /**
   * Removes the hover and selection change handles that this annotation support has on the map.
   * Also removes the annotation layer from its parent if there is any.
   * Call this when you are no longer using this support.
   */
  destroy() {
    this._handles.forEach(handle => handle.remove());
    this._layer.parent?.removeChild(this._layer);
    this.cancelCreation();
  }

  /**
   * Updates whether the user should be creating an annotation or just seeing/interacting with them.
   * When the creating argument is true, {@link AnnotationSupportCreateOptions.onControllerChange onControllerChange} is
   * called to set a controller on the map that allows a user to create annotations.
   * If it is false, {@link AnnotationSupportCreateOptions.onControllerChange onControllerChange} is called with null to
   * removed that controller from the map.
   */
  updateCreationState(creating: boolean, options: T) {
    if (creating) {
      if (this._annotationController === null) {
        this.startCreation(options);
      } else if (!this.isCurrentlyCreating(options)) {
        this._switchingControllers = true;
        this.cancelCreation();
        this.startCreation(options);
        this._switchingControllers = false;
      }
    } else if (this._annotationController !== null) {
      this.cancelCreation();
    }
  }

  /**
   * Returns whether the controller that is currently active was created with the given options or not
   */
  protected abstract isCurrentlyCreating(options: T): boolean;

  private startCreation(options: T) {
    if (this._annotationController) {
      throw new Error('Can not start measurement creation while it is not completed or stopped yet');
    }
    this._annotationController = this.createAndInitializeController(options);
    this._onControllerChange(this._annotationController);
  }

  /**
   * Creates a controller that will be used for creating a new annotation and initializes it in such a way
   * that {@link emitControllerActiveStateChanged} and {@link emitAnnotationCreated} are called correctly.
   */
  protected abstract createAndInitializeController(options: T): C;

  private cancelCreation() {
    if (this._annotationController) {
      if (!this._switchingControllers) {
        this._onControllerChange(null);
      }
      this._annotationController = null;
    }
  }

  /**
   * Updates the annotations handled by this support class.
   * This class calculates the difference between the given arguments and the current state on the map and does the
   * necessary to ensure that the map's state will correspond to the given arguments.
   *
   * @param annotations the annotations that this support is managing. Note that for optimal performance, it is best to
   * define the position of the annotations in the same modelReference as used by the support.
   * @param hoveredAnnotationIds the identifiers of the annotations that should be hovered. This allows to highlight
   * annotations from the UI.
   * @param selectedAnnotationIds the identifiers of the annotations that should be selected. This allows to select
   * annotations from the UI.
   */
  updateAnnotations(annotations: A[], hoveredAnnotationIds: string[],
                    selectedAnnotationIds: string[]) {
    this.synchronizeAnnotations(annotations);
    this.synchronizeHoveringState(hoveredAnnotationIds);
    this.synchronizeSelectionState(selectedAnnotationIds);
  }

  private synchronizeAnnotations(annotations: A[]) {
    const annotationsToRemove = this.getAllAnnotations();
    for (const annotation of annotations) {
      const feature = this._store.get(annotation.id);

      if (feature) {
        annotationsToRemove.splice(annotationsToRemove.indexOf(feature), 1);
        const changed = this.updateFeature(feature, annotation);
        if (changed) {
          this._layer.painter.invalidate(feature);
        }
      } else {
        this._store.add(this.createFeature(annotation));
      }
    }

    for (const annotation of annotationsToRemove) {
      this._store.remove(annotation.id)
    }
  }

  /**
   * Updates the given feature to match the given annotation.
   * @returns whether the feature was modified or not
   */
  protected abstract updateFeature(feature: F, annotation: A): boolean;

  /**
   * Returns a new feature that represents the given annotation.
   */
  protected abstract createFeature(annotation: A): F;

  private synchronizeHoveringState(annotationIds: string[]) {
    const features = annotationIds.map(id => this._store.get(id)).filter(
        feature => !!feature) as F[];
    if (features.length > 0) {
      hoverSafely(this._map, this._layer, features)
    } else {
      const hoveredObjectsWithoutAnnotations: PickInfo[] = this._map.hoveredObjects.filter(
          ({layer}) => layer !== this._layer).map(
          ({hovered, layer}) => ({objects: hovered as Feature[], layer: layer as FeatureLayer | TileSet3DLayer}))
      this._map.hoverObjects(hoveredObjectsWithoutAnnotations);
    }
  }

  private synchronizeSelectionState(annotationIds: string[]) {
    const features = annotationIds.map(id => this._store.get(id)).filter(
        feature => !!feature) as F[];
    if (features.length > 0) {
      selectSafely(this._map, this._layer, features)
    } else {
      const selectedObjectsWithoutAnnotations: PickInfo[] = this._map.selectedObjects.filter(
          ({layer}) => layer !== this._layer).map(
          ({selected, layer}) => ({objects: selected as Feature[], layer: layer as FeatureLayer | TileSet3DLayer}))
      this._map.selectObjects(selectedObjectsWithoutAnnotations);
    }
  }

  private getAllAnnotations(): F[] {
    const cursor = this._store.query();
    const result: F[] = [];
    while (cursor.hasNext()) {
      result.push(cursor.next());
    }
    return result;
  }

  /**
   * Triggers the listeners of {@link onControllerActiveStateChanged}
   */
  protected emitControllerActiveStateChanged(state: boolean) {
    this._eventedSupport.emit(ANNOTATION_CONTROLLER_ACTIVE_STATE_CHANGED_EVENT, state);
  }

  /**
   * Event that is triggered when the controller used to create annotations is enabled or disabled
   * @param callback the callback to be invoked when the controller is changed. The state argument specifies whether
   * the controller is still active or not.
   */
  onControllerActiveStateChanged(callback: (state: boolean) => void): Handle {
    return this._eventedSupport.on(ANNOTATION_CONTROLLER_ACTIVE_STATE_CHANGED_EVENT, callback);
  }

  /**
   * Triggers the listeners of {@link onAnnotationCreated}
   */
  protected emitAnnotationCreated(id: string, createdAnnotationInfo: U, lookAt: LookAt) {
    this._eventedSupport.emit(ANNOTATION_CREATED_EVENT, id, createdAnnotationInfo, lookAt);
  }

  /**
   * Event that is triggered when an annotation has been created by a user. Typically, the arguments from the callback
   * function are used to create a new AnnotationFeature, which is then passed to the {@link updateAnnotations} method
   * of this class, together with the previously created annotations.
   * @param callback the callback to be invoked when the annotation was created. The arguments contain an identifier,
   * annotation information and camera LookAt that corresponds to the camera state when creating the annotation.
   */
  onAnnotationCreated(callback: (id: string, createdAnnotationInfo: U,
                                 lookAt: LookAt) => void): Handle {
    return this._eventedSupport.on(ANNOTATION_CREATED_EVENT, callback);
  }

  /**
   * Event that is triggered when a change has been detected in the list of annotations that are currently hovered by
   * the user.
   * @param callback the callback to be invoked when the hovering change is detected. The ids argument contain a list
   * of identifiers specifying which annotations are currently hovered.
   */
  onAnnotationHovered(callback: (ids: string[]) => void): Handle {
    return this._eventedSupport.on(ANNOTATION_HOVERED_CHANGED_EVENT, callback);
  }

  /**
   * Event that is triggered when a change has been detected in the list of annotations that are currently selected by
   * the user.
   * @param callback the callback to be invoked when the selection change is detected. The ids argument contain a list
   * of identifiers specifying which annotations are currently selected.
   */
  onAnnotationSelected(callback: (ids: string[]) => void): Handle {
    return this._eventedSupport.on(ANNOTATIONS_SELECTION_CHANGED_EVENT, callback);
  }
}
