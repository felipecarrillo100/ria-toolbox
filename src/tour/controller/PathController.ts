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
import {TourPathSupport} from '../TourPathSupport.js';
import {CompositeController} from "@luciad/ria/view/controller/CompositeController.js";
import {PlayStopController} from "./PlayStopController.js";
import {PathFrustumController} from "./PathFrustumController.js";
import {PathEditController, PathEditControllerStyles} from "./PathEditController.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {PathPointSelectionController} from "./PathPointSelectionController.js";
import {PathPointFeature} from "../model/PathPointFeature.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";

/**
 * The `EditMode` enumeration represents the controller's edit mode states.
 */
export const enum EditMode {
  /**
   * Indicates that the controller is not in the edit mode. In this mode the path controller will not select a point for editing.
   */
  INACTIVE,
  /**
   * Indicates that the controller is in the edit mode for changing point position.
   */
  POSITION,
  /**
   * Indicates that the controller is in the edit mode for changing point's camera orientation.
   */
  ORIENTATION,
}

/**
 * The `PathPointIdentification` interface represents an identifiable point of the path.
 */
export interface PathPointIdentification {
  /**
   * The unique ID of the path point (keyframe).
   */
  keyframeId: string;
  /**
   * The sequential position of the point in the path.
   */
  index: number;
}

// Distance in meters to the edited point
const POSITION_EDIT_DISTANCE_TO_POINT = 2;

const POINT_SELECTION_CHANGE_EVENT = 'POINT_SELECTION_CHANGE_EVENT';
const PATH_EDIT_MODE_CHANGE_EVENT = 'PATH_EDIT_MODE_CHANGE_EVENT';

/**
 * `PathController` is a composite controller that delegates to child controllers to manage following tasks:
 * - stopping the path animation when a user interacts with the map
 * - drawing the current camera frustum in edit mode when the camera is unlocked
 * - selecting a path point to edit
 * - editing a path point
 */
export class PathController extends CompositeController {
  private readonly _pathEditController: PathEditController;
  private readonly _pathFrustumController: PathFrustumController;
  private readonly _pathSupport: TourPathSupport;
  private readonly _eventSupport: EventedSupport;

  private _editMode: EditMode = EditMode.INACTIVE;
  private _editPointIndex: number | null = null;

  constructor(pathSupport: TourPathSupport) {
    super();
    this._pathSupport = pathSupport;
    this._eventSupport = new EventedSupport([POINT_SELECTION_CHANGE_EVENT, PATH_EDIT_MODE_CHANGE_EVENT], true);

    this._pathFrustumController = new PathFrustumController(pathSupport)
    this.appendController(this._pathFrustumController);
    this.appendController(new PlayStopController(pathSupport));
    this.appendController(new PathPointSelectionController(pathSupport, this));
    this._pathEditController = new PathEditController(pathSupport, this);
    this.appendController(this._pathEditController);
  }

  /**
   * Retrieves the current edit mode (position or orientation).
   * @returns {EditMode} The current edit mode defining what aspects of the path are being edited.
   */
  get editMode(): EditMode {
    return this._editMode;
  }

  /**
   * Sets the mode (GEO, ORIENTATION or INACTIVE) for editing path points.
   * - GEO: If a path point is currently selected, changing the mode to GEO allows for visual editing of
   *        the 3D position of the point. If no point is currently selected, the controller selects a path point
   *        for geo editing when a click event occurs.
   * - ORIENTATION: If a path point is currently selected, changing the mode to ORIENTATION enables visual editing of
   *        the camera orientation of the point. If no point is currently selected, the controller selects a path point
   *        for camera orientation editing when a click event occurs.
   * - INACTIVE: If the mode is set to INACTIVE while a point is selected, the controller stops editing the point.
   *        Additionally, in the INACTIVE mode, the controller will not select any point for editing.
   *
   * @param mode - The desired edit mode (GEO, ORIENTATION, or INACTIVE)
   */
  set editMode(mode: EditMode) {
    if (this._editMode !== mode) {
      this._editMode = mode;
      this._pathEditController.updateHandles();

      if (mode === EditMode.INACTIVE) {
        this.stopEditingPathPoint();
        this._pathSupport.cameraLock = true;
      } else {
        this.flyToPathPoint();
      }
      this._eventSupport.emit(PATH_EDIT_MODE_CHANGE_EVENT, this._editMode);
    }
  }

  /**
   * Retrieves the currently edited path point feature. If no point is currently editing, it returns `null`.
   */
  get editPathPointFeature(): PathPointFeature | null {
    const path = this._pathSupport.pathFeature;
    if (path && this._editPointIndex !== null) {
      return path.getPathPointFeatures()[this._editPointIndex] ?? null;
    }
    return null;
  }

  /**
   * Retrieves the index of the currently edited path point.
   * @returns The index of the currently edited path point or `null` if no point is currently being edited.
   */
  get editPointIndex(): number | null {
    return this._editPointIndex;
  }

  /**
   * Initiates editing at a specified path point and optionally triggers a fly-to animation.
   * @param index - The index of the path point to be edited.
   * @param withAnimation - A flag indicating whether to animate the transition to the point being edited.
   *        When true (the default), an animation is triggered. When false, no animation is triggered.
   *        Regardless of this flag, if the edit mode is `EditMode.ORIENTATION`, an animation is always triggered.
   */
  startEditingPathPoint(index: number, withAnimation = true) {
    const path = this._pathSupport.pathFeature;
    if (path && this._editPointIndex !== index) {
      const pathPoints = path.getPathPointFeatures();
      const size = pathPoints.length;
      if (index >= 0 && index < size) {
        this._editPointIndex = index;
        this._pathEditController.updateHandles();
        if (this.editMode === EditMode.INACTIVE) {
          this.editMode = EditMode.POSITION;
        }
        this.emitPointSelectionChangeEvent();

        if (withAnimation || this.editMode === EditMode.ORIENTATION) {
          this.flyToPathPoint();
        }
      }
    }
  }

  /**
   * Stops editing a path point.
   */
  stopEditingPathPoint() {
    if (this._editPointIndex !== null) {
      this._editPointIndex = null;
      this._pathEditController.updateHandles();
      this.emitPointSelectionChangeEvent();
    }
  }

  /**
   * Registers a callback function to be run when a point selection changes while editing a path.
   * @param callback - The function to be called when a point selection changes, receiving the identification details of the path point.
   * @returns A handle which can be used to deregister the callback.
   */
  onPointSelectionChange(callback: (info: PathPointIdentification | null) => void): Handle {
    return this._eventSupport.on(POINT_SELECTION_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback function to be run when the edit mode changes.
   * @param callback - The function to be called when the edit mode changes, receiving the new edit mode.
   * @returns A handle which can be used to deregister the callback.
   */
  onEditModeChange(callback: (editMode: EditMode) => void): Handle {
    return this._eventSupport.on(PATH_EDIT_MODE_CHANGE_EVENT, callback);
  }

  /**
   * Sets a custom style for drawing the frustum of the current fraction on the path.
   */
  setPathFrustumControllerStyle(frustumStyle: ShapeStyle) {
    this._pathFrustumController.setStyle(frustumStyle);
  }

  /**
   * Sets a custom style for controller drawings.
   */
  setPathEditControllerStyle(styleOptions: Partial<PathEditControllerStyles> = {}) {
    this._pathEditController.setStyle(styleOptions);
  }

  private flyToPathPoint() {
    if (this.editPointIndex !== null) {
      const distance = this._editMode === EditMode.POSITION ? POSITION_EDIT_DISTANCE_TO_POINT : 0;
      this._pathSupport.flyToPathPoint(this.editPointIndex, distance).catch(err => console.warn(err))
    }
  }

  private emitPointSelectionChangeEvent(): void {
    const pathPoint = this.editPathPointFeature;
    if (pathPoint) {
      const {index, keyframeId} = pathPoint;
      this._eventSupport.emit(POINT_SELECTION_CHANGE_EVENT, {index, keyframeId});
    } else {
      this._eventSupport.emit(POINT_SELECTION_CHANGE_EVENT, null);
    }
  }
}
