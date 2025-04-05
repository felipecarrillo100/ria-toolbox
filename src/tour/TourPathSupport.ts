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
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {Map} from '@luciad/ria/view/Map.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {Handle} from '@luciad/ria/util/Evented.js';
import {MemoryStore} from '@luciad/ria/model/store/MemoryStore.js';
import {PathFeature} from './model/PathFeature.js';
import {flyToPath, flyToPathPointLocation, setCameraOnPath} from './TourCameraUtil.js';
import {TourPlayerSupport} from './TourPlayerSupport.js';
import {TourRecorderSupport} from './TourRecorderSupport.js';
import {createTourPathLayer, TourPathLayer} from './view/PathLayerCreator.js';
import {EditMode, PathController} from './controller/PathController.js';
import {PathData, PathKeyframe} from "./PathData.js";
import {PathPainter} from "./view/PathPainter.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {VideoRecorder} from "@luciad/ria-toolbox-recorder/VideoRecorder.js";

const PATH_DATA_CHANGE_EVENT = 'PATH_DATA_CHANGE_EVENT';
const PATH_SELECTION_CHANGE_EVENT = 'PATH_SELECTION_CHANGE_EVENT';
const PATH_CAMERA_LOCK_CHANGE_EVENT = 'PATH_CAMERA_LOCK_CHANGE_EVENT';

/**
 * The Tour tool's reference system, represented  as an `EPSG:4978` coordinate system, used for controlling the camera position in tour paths.
 */
export const TOUR_MODEL_REFERENCE = getReference('EPSG:4978');

/**
 * TourPathSupport options
 */
export interface TourPathSupportOptions {
  /**
   * Callback invoked when the TourPathLayer is created.
   * This layer represents the tour path on the map and is automatically added
   * to the map's layer tree if this callback is not provided.
   * Additionally, the map's controller defaults to this path's controller.
   * @param layer - The created `TourPathLayer`
   * @param controller - The associated `PathController`
   */
  onTourInit?: (layer: TourPathLayer, controller: PathController) => void;

  /**
   * A custom implementation of the MP4 recorder. If not provided, the tool uses the default MP4 recorder from the Tour.
   */
  videoRecorder?: VideoRecorder;
}

/**
 * The `TourPathSupport` class provides a support for managing a tour path.
 * This includes creating and editing a tour path, animating the tour, and recording the tour for playback.
 */
export class TourPathSupport {
  private readonly _map: WebGLMap;
  private readonly _eventSupport: EventedSupport;
  private readonly _tourPlayerSupport: TourPlayerSupport;
  private readonly _pathController: PathController;
  private readonly _pathStore: MemoryStore<PathFeature>;
  private readonly _tourPathLayer: TourPathLayer;
  private readonly _tourRecorderSupport: TourRecorderSupport;

  private _pathFeature: PathFeature | null = null;
  // Tells if the camera should be locked on the path while playing animation in edit mode
  private _cameraLock = true;

  /**
   * Constructs a new instance of TourPathSupport.
   *
   * @param map - The WebGLMap instance where tours are expected to be featured.
   * @param options - support options.
   */
  constructor(map: WebGLMap, {onTourInit, videoRecorder}: TourPathSupportOptions = {}) {
    this._map = map;
    this._eventSupport = new EventedSupport(
        [PATH_DATA_CHANGE_EVENT, PATH_SELECTION_CHANGE_EVENT, PATH_CAMERA_LOCK_CHANGE_EVENT], true);
    this._pathStore = new MemoryStore<PathFeature>();
    this._tourPathLayer = createTourPathLayer(this._pathStore);

    this._pathController = new PathController(this);
    this._tourPlayerSupport = new TourPlayerSupport(this);
    this._tourRecorderSupport = new TourRecorderSupport(this, videoRecorder)

    if (onTourInit) {
      onTourInit(this._tourPathLayer, this._pathController);
    } else {
      map.layerTree.addChild(this._tourPathLayer, 'top');
      map.controller = this._pathController;
    }

  }

  /**
   * Destroys the support class. After destroying the class cannot be used anymore.
   */
  async destroy() {
    if (this.map.controller === this._pathController) {
      this.map.controller = null;
    }
    if (this.map.layerTree.findLayerById(this._tourPathLayer.id)) {
      this.map.layerTree.removeChild(this._tourPathLayer);
    }
    await this._tourRecorderSupport.cleanUp();
    this._pathStore.clear();
  }

  /**
   * Checks whether the provided map is compatible with the tool or not.
   * If the map is not compatible, the tool cannot be used to this map.
   * @param map the map to test
   */
  static isMapCompatible(map: Map): boolean {
    return map.reference.equals(TOUR_MODEL_REFERENCE);
  }

  /**
   * Returns the TourPathLayer instance.
   * Note: The layer is instantiated eagerly as part of this class's initialization.
   * However, it's up to the user to fetch this layer instance and add it at the desired position in the map's layer tree.
   * @returns The active TourPathLayer instance.
   */
  get tourPathLayer(): TourPathLayer {
    return this._tourPathLayer;
  }

  /**
   * Returns the path painter instance.
   * @returns path painter instance.
   */
  get pathPainter(): PathPainter {
    return this._tourPathLayer.painter;
  }

  /**
   * Returns the main map.
   * @returns The WebGLMap instance of the main map.
   */
  get map(): WebGLMap {
    return this._map;
  }

  /**
   * Returns the `TourPlayerSupport` instance.
   * @returns The `TourPlayerSupport` instance.
   */
  get tourPlayerSupport(): TourPlayerSupport {
    return this._tourPlayerSupport;
  }

  /**
   * Returns the TourRecorderSupport instance.
   * @returns The `TourRecorderSupport` instance.
   */
  get tourRecorderSupport(): TourRecorderSupport {
    return this._tourRecorderSupport;
  }

  /**
   * Returns the path controller.
   * Note: The controller isn't automatically attached to a map.
   * It's up to the user to attach this controller to the map manually if they want to use it for editing.
   * @returns The `PathController` instance.
   */
  get pathController(): PathController {
    return this._pathController;
  }

  /**
   * Returns the path feature encapsulated by the support.
   */
  get pathFeature(): PathFeature | null {
    return this._pathFeature;
  }

  /**
   * Returns the current path data corresponding to path feature.
   * @returns The path data object, or null if no path is currently set.
   */
  getPathData(): PathData | null {
    return this._pathFeature?.getPathData() || null;
  }

  /**
   * Sets the given path data in the support.
   * The `PathData` object represents a serializable object representing a tour path.
   * Based on this, the support will instantiate the `PathFeature`.
   * The support handles one path representation at a time, hence setting a new `pathData` will replace the existing path object to encapsulate.
   *
   * @param pathData - The path data to encapsulate by the support.
   */
  setTourPath(pathData: PathData) {
    if (this._pathFeature?.id !== pathData.id) {
      this._pathFeature = new PathFeature(pathData);
      this._pathStore.reload([this._pathFeature]);
      this.cameraLock = true;
      this.pathController.editMode = EditMode.INACTIVE;
      this._eventSupport.emit(PATH_SELECTION_CHANGE_EVENT, this._pathFeature.getPathData());
      // automatically update player's duration
      this.tourPlayerSupport.duration = this._pathFeature.duration;
    } else {
      this.updateTourPath(pathData);
    }
  }

  /**
   * Removes the current tour path.
   */
  removeTourPath(): void {
    this._pathFeature = null;
    this._pathStore.clear();
    this._pathController.editMode = EditMode.INACTIVE;
    this._eventSupport.emit(PATH_SELECTION_CHANGE_EVENT, null);
    this.pathPainter.invalidateAll();
  }

  /**
   * Updates the tour path.
   * @param tour - The path data for updating the tour path.
   */
  updateTourPath(tour: PathData) {
    if (!this._pathFeature || this._pathFeature.id !== tour.id) {
      console.warn(`PathSupport Tool: a path with id ${tour.id} is not found.`);
    }

    const pathFeature = this._pathFeature;
    if (pathFeature) {
      const {name, closed, duration, keyframes} = tour;
      const isNameUpdated = pathFeature.setPathName(name);
      const isClosedUpdated = pathFeature.setPathClosed(closed);
      const isDurationUpdated = pathFeature.setPathDuration(duration);
      const isKeyframeUpdated = pathFeature.setPathKeyframes(keyframes);

      // the path is repainted only if their parameters are really modified
      if (isNameUpdated || isClosedUpdated || isDurationUpdated || isKeyframeUpdated) {
        this.onPathUpdate();
      }
    }
  }

  /**
   * Retrieves the fraction (a number between 0 and 1) corresponding to the closest point on the path before the current fraction.
   * @param fraction - A number between 0 and 1 representing a position along the path.
   * @returns The fraction associated with the point on the path that is immediately before the given fraction.
   */
  getFractionForPreviousPoint(fraction: number): number {
    return this._pathFeature?.getPathPointBefore(fraction)?.fraction ?? 0;
  }

  /**
   * Retrieves the fraction (a number between 0 and 1) corresponding to the closest point on the path after the current fraction.
   * @param fraction - A number between 0 and 1 representing a position along the path.
   * @returns The fraction associated with the point on the path that is immediately after the given fraction.
   */
  getFractionForNextPoint(fraction: number): number {
    return this._pathFeature?.getPathPointAfter(fraction)?.fraction ?? 0;
  }

  /**
   * Moves the camera to the current path.
   */
  async flyToPath() {
    const bounds = this._pathFeature?.shape.bounds;
    if (bounds) {
      return flyToPath(this.map, bounds, 500);
    }
  }

  /**
   * Moves the camera to the current path's point identified by the given index.
   * @param index the index of the point on the path.
   * @param distance the distance in meters teh camera is placed in front of the path point
   */
  async flyToPathPoint(index: number, distance = 2) {
    const pointFeature = this._pathFeature?.getPathPointFeatures()[index];
    if (pointFeature) {
      return flyToPathPointLocation(this.map, pointFeature.getPathPointVectors(), distance)
    }
  }

  /**
   * Updates the name of the path.
   * @param name The name for the complete path.
   */
  setPathName(name: string): void {
    if (this._pathFeature?.setPathName(name)) {
      this.onPathUpdate();
    }
  }

  /**
   * Updates the duration of the path playback.
   * @param duration The duration for the complete tour in milliseconds.
   */
  setPathDuration(duration: number): void {
    if (this._pathFeature?.setPathDuration(duration)) {
      this.tourPlayerSupport.duration = duration;
      this.onPathUpdate();
    }
  }

  /**
   * Determines if the tour path should be circular.
   * @param closed Set to `true` if the tour path should be circular; `false` otherwise.
   */
  setPathClosed(closed: boolean): void {
    if (this._pathFeature?.setPathClosed(closed)) {
      this.onPathUpdate();
    }
  }

  /**
   * Sets a new list of keyframes for the existing tour path.
   * @param keyframes - An array of PathKeyframe objects to set for the path.
   */
  setPathKeyframes(keyframes: PathKeyframe[]): void {
    if (this._pathFeature?.setPathKeyframes(keyframes)) {
      this.onPathUpdate();
    }
  }

  /**
   * Adds a new keyframe to the path at the specified index or appends it to the end of the path.
   *
   * @param keyframe The `PathKeyframe` to be added to the path.
   * @param index The position at which to insert the keyframe. If provided, the keyframe
   *              is inserted at this index; otherwise, it is appended to the end of the path.
   */
  addPathKeyframe(keyframe: PathKeyframe, index?: number): void {
    if (this._pathFeature) {
      const keyframes = this._pathFeature.keyframes;
      if (index !== undefined) {
        keyframes.splice(index, 0, keyframe);
      } else {
        keyframes.push(keyframe);
      }
      this._pathFeature.setPathKeyframes(keyframes);
      this.pathController.stopEditingPathPoint();
      this.onPathUpdate();
    }
  }

  /**
   * Deletes a keyframe from the path.
   */
  deletePathKeyframe(index: number): void {
    if (!this._pathFeature) {
      return;
    }
    if (index < 0 || index > this._pathFeature.getSize() - 1) {
      console.warn(`TourSupport: cannot delete a path point with index ${index}`);
      return;
    }

    const keyframes = this._pathFeature.keyframes;
    this._pathFeature.setPathKeyframes([...keyframes.slice(0, index), ...keyframes.slice(index + 1)]);
    this.pathController.stopEditingPathPoint();
    this.onPathUpdate();
  }

  /**
   * The callback function that updates the scene when playing the tour, called from the player support.
   * @param fraction animation fraction
   */
  updatePlayFraction(fraction: number) {
    if (!this._pathFeature || this._pathFeature.isEmpty()) {
      // nothing to update
      return;
    }

    if (!this._cameraLock && this._pathController.editMode !== EditMode.INACTIVE) {
      // draw the current camera frustum when animating the tour (camera unlocking is only for inspection while editing the path)
      this._pathController.invalidate();
    } else {
      setCameraOnPath(this._map, this._pathFeature, fraction);
    }
  }

  /**
   * Gets the current state of the camera lock.
   * @returns `true` if the camera is locked to the path; `false` otherwise.
   */
  get cameraLock(): boolean {
    return this._cameraLock;
  }

  /**
   * Updates the parameter that determines whether the camera should be locked or unlocked when the `PathController` is in edit mode.
   * This feature helps in inspecting the tour animation.
   *
   * When the camera is unlocked:
   * - The camera's position and orientation remain unchanged during the tour animation.
   * - The tour animation displays the movement of the camera as a dynamic frustum.
   *
   * Note: The camera can be unlocked only when the path is being edited.
   *
   * @param cameraLock `true` if the camera is locked to the path.
   */
  set cameraLock(cameraLock: boolean) {
    if (!cameraLock && this._pathController.editMode === EditMode.INACTIVE) {
      // request to unlock the camera is rejected
      this._eventSupport.emit(PATH_CAMERA_LOCK_CHANGE_EVENT, this._cameraLock);
    } else if (this._cameraLock !== cameraLock) {
      this._cameraLock = cameraLock;
      if (cameraLock && this._pathFeature) {
        // force camera onto the path
        setCameraOnPath(this._map, this._pathFeature, this._tourPlayerSupport.fraction);
      }
      // paints or hides the frustum on the path
      this._pathController.invalidate();
      this._eventSupport.emit(PATH_CAMERA_LOCK_CHANGE_EVENT, this._cameraLock);
    }
  }

  /**
   * Registers a callback to be executed whenever the data for the current path is modified.
   * @param callback - A function to be invoked on a path update.
   * It accepts the updated path as an argument.
   * @returns A handle which can be used to deregister the callback.
   */
  onPathDataChange(callback: (path: PathData) => void): Handle {
    return this._eventSupport.on(PATH_DATA_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback to be executed whenever the selection of the path changes.
   * @param callback - Function to be invoked when path selection changes.
   *        The function should accept a single argument: an instance of `PathData` representing the newly selected path,
   *        or `null` if no path is currently selected.
   *
   * @returns {Handle} A handle object which can be used to deregister the callback.
   */
  onPathSelectionChange(callback: (path: PathData | null) => void): Handle {
    return this._eventSupport.on(PATH_SELECTION_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback function to be run when the camera locking state changes.
   * @param callback - The function to be called when the camera locking state changes.
   * @returns A handle which can be used to deregister the callback.
   */
  onCameraLockChange(callback: (lock: boolean) => void): Handle {
    return this._eventSupport.on(PATH_CAMERA_LOCK_CHANGE_EVENT, callback);
  }

  private onPathUpdate(): void {
    if (this._pathFeature) {
      this.tourPlayerSupport.duration = this._pathFeature.duration;

      this.emitPathDataChange();
      if (!this._cameraLock) {
        this._pathController.invalidate();
      }
    }
    this.pathPainter.invalidateAll();
  }

  /**
   * Emits a path data change event whenever the path data encapsulated by the support class changes.
   * Note that when the path is visually edited, the data change event is emitted only when the editing action ends,
   * such as when dragging a path point ends.
   */
  emitPathDataChange() {
    if (this._pathFeature) {
      this._eventSupport.emit(PATH_DATA_CHANGE_EVENT, this._pathFeature.getPathData());
    }
  }
}