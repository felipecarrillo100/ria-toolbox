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
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {createCameraLayers} from "./CameraLayersFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {DefaultController} from "@luciad/ria/view/controller/DefaultController.js";
import {NavigateController} from "@luciad/ria/view/controller/NavigateController.js";
import {ZoomController} from "@luciad/ria/view/controller/ZoomController.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {PanController} from "@luciad/ria/view/controller/PanController.js";
import {OverviewCameraLayer, OverviewFrustumLayer} from "./types.js";

const EVENT_SYNC_MAP_CENTER = 'SyncMapCenter';

/**
 * The constructor options for `OverviewMapSupport`.
 */
export interface OverviewMapSupportConstructorOptions {
  /**
   * The main map instance. The camera object of this map will be reflected on the 2D map.
   */
  mainMap: WebGLMap;

  /**
   * The DOM node element based on which the 2D overview map will be internally created.
   */
  overviewMapDomNode: HTMLElement;
}

const ref2d = getReference("EPSG:3857");

/**
 * The zoom controller used on the overview map.
 * This controller performs zooming centered on the map's center point when the `OverviewMapSupport.syncMapCenters` is enabled.
 * Otherwise, zooming occurs relative to the touched position.
 */
export class OverviewMapZoomController extends ZoomController {
  private _center: Point | null = null;

  constructor(private overviewMapSupport: OverviewMapSupport) {
    super();
  }

  getZoomTarget(gestureEvent: GestureEvent) {
    if (this.overviewMapSupport.syncMapCenters) {
      const [width, height] = this.overviewMapSupport.overviewMap.viewSize;

      if (!this._center) {
        this._center = createPoint(null, [width / 2, height / 2]);
      } else {
        this._center.x = width / 2;
        this._center.y = height / 2;
      }
      return this._center;
    }
    return super.getZoomTarget(gestureEvent);
  }
}

/**
 * The pan controller used on the overview map.
 * This controller prevents panning actions if `OverviewMapSupport.syncMapCenters` is enabled.
 */
export class OverviewMapPanController extends PanController {
  constructor(private overviewMapSupport: OverviewMapSupport) {
    super();
  }

  isPanEvent(gestureEvent: GestureEvent) {
    return !this.overviewMapSupport.syncMapCenters && super.isPanEvent(gestureEvent);
  }
}

/**
 * The OverviewMapSupport class is responsible for creating a secondary 2D map synchronized with another 3D map.
 * It provides functionality to display the current camera position, orientation, and field of view of the camera on the 3D map.
 */
export class OverviewMapSupport {
  private readonly _eventedSupport = new EventedSupport([EVENT_SYNC_MAP_CENTER], true);
  private readonly _overviewMap: WebGLMap;
  private readonly _cameraLayer: OverviewCameraLayer;
  private readonly _cameraFrustumLayer: OverviewFrustumLayer;
  private readonly _defaultNavigationController: NavigateController;
  private readonly _mainMap: WebGLMap;
  private readonly _handles: Handle[] = [];
  private _syncMapCenters = true;
  private _resizeObserver: ResizeObserver;

  /**
   * Creates a new instance of the OverviewMapSupport.
   *
   * @param {Object} options The options object.
   */
  constructor({mainMap, overviewMapDomNode}: OverviewMapSupportConstructorOptions) {
    if (!(mainMap.camera instanceof PerspectiveCamera)) {
      throw new Error(`Main map's camera must be a PerspectiveCamera`);
    }
    this._overviewMap = new WebGLMap(overviewMapDomNode, {reference: ref2d, autoAdjustDisplayScale: mainMap.autoAdjustDisplayScale});
    this._mainMap = mainMap;

    const {cameraLayer, cameraFrustumLayer, cameraHandle} = createCameraLayers(mainMap);
    this._cameraLayer = cameraLayer;
    this._cameraFrustumLayer = cameraFrustumLayer;
    this._overviewMap.layerTree.addChild(this._cameraFrustumLayer, "top");
    this._overviewMap.layerTree.addChild(this._cameraLayer, "top");

    this._overviewMap.mapNavigator.zoom({targetScale: mainMap.mapScale[0], animate: false});

    const navigateController = new NavigateController({
      zoomController: new OverviewMapZoomController(this),
      panController: new OverviewMapPanController(this)
    });
    this._defaultNavigationController = navigateController;
    this._overviewMap.defaultController = new DefaultController({navigateController});

    this.syncCameraCenterPosition();

    this._resizeObserver = new ResizeObserver(() => this.syncCameraCenterPosition());
    this._resizeObserver.observe(this._overviewMap.domNode);

    this._handles = [
      mainMap.on('MapChange', () => this.syncCameraCenterPosition()),
      cameraHandle
    ];
  }

  private syncCameraCenterPosition() {
    if (this._syncMapCenters) {
      this.recenterCameraPosition();
    }
  }

  /**
   * Adjusts the camera's position to be in the center of the viewport, irrespective of the state of the `syncMapCenters` property.
   */
  recenterCameraPosition() {
    this._overviewMap.mapNavigator.pan({targetLocation: this._mainMap.camera.eyePoint});
  }

  /**
   * Releases local resources associated with the class.
   * After calling this method, the camera synchronization will no longer be performed.
   */
  destroy() {
    this._handles.forEach(h => h.remove());
    this._handles.length = 0;
    this._resizeObserver.disconnect();
    this._overviewMap.destroy();
  }

  /**
   * Provides the internally created instance of the 2D overview map (reference EPSG:3857).
   * Users should add layers to this map or register event handlers if needed.
   */
  get overviewMap(): WebGLMap {
    return this._overviewMap;
  }

  /**
   * Gets {@link OverviewCameraLayer} responsible for displaying the camera position on the overview map.
   */
  get cameraLayer(): OverviewCameraLayer {
    return this._cameraLayer;
  }

  /**
   * Gets {@link OverviewFrustumLayer} responsible for displaying the camera frustum on the overview map.
   */
  get cameraFrustumLayer(): OverviewFrustumLayer {
    return this._cameraFrustumLayer;
  }

  /**
   * Retrieves the default navigation controller for the overview map.
   * This navigation controller is based on `OverviewMapZoomController` and `OverviewMapPanController`
   * and is applied by default on the overview map.
   */
  get defaultNavigationController(): NavigateController {
    return this._defaultNavigationController;
  }

  /**
   * Indicates whether both maps should synchronize their central positions.
   * If set to true, panning on the main map will also pan the overview map.
   * @default is true.
   */
  get syncMapCenters(): boolean {
    return this._syncMapCenters;
  }

  set syncMapCenters(value: boolean) {
    if (this._syncMapCenters !== value) {
      this._syncMapCenters = value;
      this.syncCameraCenterPosition();
      this._eventedSupport.emit(EVENT_SYNC_MAP_CENTER, value);
    }
  }

  /**
   * Registers an event handler for changes to the 'syncMapCenters' property.
   * When 'syncMapCenters' property changes, the provided callback function is invoked with the current 'syncMapCenters' value.
   * @param callback This function is invoked when the 'syncMapCenters' value changes.
   *                 The new value is passed as a boolean parameter to the callback.
   */
  onSyncMapCenters(callback: (syncMapCenters: boolean) => void): Handle {
    return this._eventedSupport.on(EVENT_SYNC_MAP_CENTER, callback);
  }
}
