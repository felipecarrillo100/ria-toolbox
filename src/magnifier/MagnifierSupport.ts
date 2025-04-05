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
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {Map} from '@luciad/ria/view/Map.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {Handle} from '@luciad/ria/util/Evented.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {PerspectiveCamera} from '@luciad/ria/view/camera/PerspectiveCamera.js';
import {add, distance, length, normalize, scale, sub} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {throttle} from "@luciad/ria-toolbox-core/util/Throttle.js";
import {LocationMode} from '@luciad/ria/transformation/LocationMode.js';
import {OutOfBoundsError} from '@luciad/ria/error/OutOfBoundsError.js';
import {createPoint} from '@luciad/ria/shape/ShapeFactory.js';

const EVENT_MAGNIFIED_POINT = 'MagnifiedWorldPointChange';
const EVENT_RESIZE = 'Resize';

// Defines the minimal width and height in pixels of the magnifier
const MIN_SIZE = 10;

// The default distance to target in meters
const DEFAULT_DISTANCE_TO_TARGET = 3;
// The minimum distance to target in meters
const MINIMUM_DISTANCE_TO_TARGET = 1;
// The default magnifier's width in pixels
const DEFAULT_WIDTH = 400;
// The default magnifier's height in pixels
const DEFAULT_HEIGHT = 300;
// The default roundness
const DEFAULT_ROUNDNESS = 0.1;
// The default magnifier's position offset in pixels
const DEFAULT_POSITION_OFFSET = 32;

/**
 * MagnifierSupport constructor options.
 */
export interface MagnifierSupportConstructorOptions {
  /**
   * The maximum distance, in meters, from the target at which the camera's eye will be positioned.
   * When the camera on the main map is closer than that distance then
   * the camera on the magnifier map is placed progressively closer to the target.
   * @default 3
   */
  distanceToTarget?: number;

  /**
   * Defines the desired width, in pixels, of the magnifier.
   * @default 400
   */
  width?: number;

  /**
   * Defines the desired height, in pixels, of the magnifier.
   * @default 300
   */
  height?: number;

  /**
   * Determines the roundness of the magnifier. The value is a number in the range between 0 and 1.
   * A value of 0 renders the magnifier as a rectangle, while a value of 1 renders it as an ellipse.
   * Any value between 0 and 1 produces a rounded rectangle with a degree of roundness proportional to the value.
   * @default 0.1
   */
  roundness?: number;

  /**
   * The pixel offset between the magnified view position and the magnifier's border.
   * @default 32
   */
  positionOffset?: number;
}

/**
 * The MagnifierSupport class that creates the magnifier on the primary map.
 * This tool provides an enlarged view around a point on the main map, offering detailed insights that may not be
 * easily visible otherwise.
 *
 * This support emits an event that notifies the listener when the magnified world point changes.
 * It can also provide the world point that is in the center of the magnifier.
 */
export class MagnifierSupport {
  private readonly _eventedSupport = new EventedSupport([EVENT_RESIZE, EVENT_MAGNIFIED_POINT], true);
  private readonly _magnifierMapNode: HTMLDivElement;
  private readonly _centerNode: HTMLDivElement;

  private _mainMap!: Map;
  private _distanceToTarget: number;
  private _positionOffset: number;
  private _roundness: number;
  private _desiredSize: [number, number];
  private _actualSize: [number, number];
  private _magnifierMap: WebGLMap | null = null;
  private _magnifierMapChangeListener: Handle | null = null;
  private _magnifiedViewPoint: Point | null = null;
  private _magnifiedWorldPoint: Point | null = null;
  private _visible = true;

  constructor(map: Map, options: MagnifierSupportConstructorOptions = {}) {
    if (!MagnifierSupport.isMapCompatible(map)) {
      throw new Error('This map is not compatible with the Magnifier tool.');
    }
    const {distanceToTarget, width, height, roundness, positionOffset} = validateFields(options);
    this._distanceToTarget = distanceToTarget;
    this._desiredSize = [width, height];
    this._actualSize = [width, height];
    this._roundness = roundness;
    this._positionOffset = positionOffset;

    const {magnifierMapNode, centerNode} = this.createInternalNodes();
    this._magnifierMapNode = magnifierMapNode;
    this._centerNode = centerNode;
    this.activate(map);
  }

  /**
   * Checks whether the provided map is compatible with the Magnifier tool or not.
   * If the map is not compatible, the MagnifierController cannot be added to this map.
   * @param map the map to test
   */
  static isMapCompatible(map: Map): boolean {
    return map.camera instanceof PerspectiveCamera;
  }

  private createInternalNodes(): { magnifierMapNode: HTMLDivElement, centerNode: HTMLDivElement } {
    const magnifierMapNode = document.createElement('div');
    magnifierMapNode.style.position = 'absolute';
    magnifierMapNode.style.top = '0';
    magnifierMapNode.style.left = '0';
    magnifierMapNode.style.width = `${this._desiredSize[0]}px`;
    magnifierMapNode.style.height = `${this._desiredSize[1]}px`;
    magnifierMapNode.style.margin = '0';
    magnifierMapNode.style.padding = '0';
    magnifierMapNode.style.pointerEvents = 'none';
    magnifierMapNode.style.backgroundColor = 'black';
    magnifierMapNode.style.visibility = 'hidden';
    magnifierMapNode.style.clipPath = `inset(0 0 round ${this._roundness * 50}%)`;

    const overlayNode = document.createElement('div');
    overlayNode.style.position = 'absolute';
    overlayNode.style.top = '0';
    overlayNode.style.left = '0';
    overlayNode.style.width = '100%';
    overlayNode.style.height = '100%';
    overlayNode.style.display = 'flex';
    overlayNode.style.justifyContent = 'center';
    overlayNode.style.alignItems = 'center';
    magnifierMapNode.appendChild(overlayNode);

    const centerNode = document.createElement('div');
    centerNode.style.width = '4px';
    centerNode.style.height = '4px';
    centerNode.style.backgroundColor = 'rgb(255,255,0)';
    centerNode.style.border = '1px solid white';
    centerNode.style.boxSizing = 'content-box';
    overlayNode.appendChild(centerNode);

    return {magnifierMapNode, centerNode};
  }

  /**
   * This method creates the magnifier map and adds listeners to the given map to keep the magnifier map's camera
   * in sync with the given map.
   * This method is called by the constructor, normally you should only call this if you called {@link destroy} before.
   * Please note the given map should use the <code>PerspectiveCamera</code> otherwise an error will be thrown.
   * @param map the main map.
   */
  activate(map: Map): void {
    this._mainMap = map;
    const maxIndex = Array.from(map.domNode.querySelectorAll('*'))
        .reduce((z, a) => {
          const zIndex = parseFloat(getComputedStyle(a).zIndex);
          return !isNaN(zIndex) ? Math.max(zIndex, z) : z;
        }, 10);

    this._centerNode.style.zIndex = `${maxIndex + 1}`;

    map.domNode.appendChild(this._magnifierMapNode);

    this._magnifierMap = new WebGLMap(this._magnifierMapNode, {reference: map.reference});
    this._magnifierMap.mapNavigator.constraints.above = null;
    this._magnifierMap.globeColor = null;

    this._magnifierMapChangeListener = map.on('MapChange', throttle(() => {
          this.updateSize();
          this.updateMagnifierCamera();
        }, 50),
    );
    this.updateSize();
  }

  /**
   * Cleans up the listeners on the main map and destroys the magnifier map.
   * To reactivate it later on, you can call {@link activate}.
   */
  destroy(): void {
    this._magnifierMapChangeListener?.remove();
    if (this._magnifierMap) {
      this._mainMap.domNode.removeChild(this._magnifierMap.domNode);
      this._magnifierMap?.destroy();
      this._magnifierMap = null;
    }
    this._magnifiedViewPoint = null;
    this._magnifiedWorldPoint = null;
  }

  /**
   * Retrieves the magnifier map, or <code>null</code> if the magnifier map has not been initialized yet.
   */
  get magnifierMap(): WebGLMap | null {
    return this._magnifierMap;
  }

  /**
   * Returns the HTML node element that represents the center of the magnifier.
   */
  get centerNode(): HTMLDivElement {
    return this._centerNode;
  }

  private updateSize() {
    if (!this._magnifierMap) {
      return;
    }

    let width = this._desiredSize[0];
    let height = this._desiredSize[1];

    const aspectRatio = width / height;
    const [w, h] = this._mainMap.viewSize;
    // the magnifier's width should not exceed 1/3 of the map's width
    if (width > w / 3) {
      width = Math.round(w / 3);
      height = Math.round(width / aspectRatio);
    }
    // the magnifier's height should not exceed 1/3 of the map's height
    if (height > h / 3) {
      height = Math.round(h / 3);
      width = Math.round(aspectRatio * height);
    }

    const [currentWidth, currentHeight] = this._actualSize;
    if (width !== currentWidth || height !== currentHeight) {
      this._magnifierMap.domNode.style.width = `${width}px`;
      this._magnifierMap.domNode.style.height = `${height}px`;
      this._actualSize = [width, height];
      this._eventedSupport.emit(EVENT_RESIZE, width, height);
      this.updateMagnifier();
    }
  }

  /**
   * The desired width and height of the magnifier node element.
   * The actual dimensions are automatically adjusted when needed,
   * as they cannot exceed a third of the map's width and height.
   */
  get desiredSize(): [number, number] {
    const [w, h] = this._desiredSize;
    return [w, h];
  }

  set desiredSize([width, height]: [number, number]) {
    const w = Math.max(Math.round(width), MIN_SIZE);
    const h = Math.max(Math.round(height), MIN_SIZE);
    if (this._desiredSize[0] !== w || this._desiredSize[1] !== h) {
      this._desiredSize = [w, h];
      this.updateSize();
    }
  }

  /**
   * Returns the actual width and height of the magnifier map.
   * The actual size may differ from the desired size because
   * it cannot exceed one-third of the main map's width and height,
   * ensuring the main map remains visible.
   */
  get actualSize(): [number, number] {
    const [w, h] = this._actualSize;
    return [w, h];
  }

  /**
   * The pixel offset between the magnified view position and the magnifier's border.
   */
  get positionOffset(): number {
    return this._positionOffset;
  }

  set positionOffset(value: number) {
    const normalizedValue = clamp(Math.round(value), 0, this.desiredSize[1]);
    if (this._positionOffset !== normalizedValue) {
      this._positionOffset = normalizedValue;
      this.updateMagnifier();
    }
  }

  /**
   * The maximum distance, in meters, from the target at which the camera's eye will be positioned, which
   * determines the magnification ratio. When the camera on the main map is closer than that distance then
   * the camera on the magnifier map is placed progressively closer to the target.
   */
  get distanceToTarget(): number {
    return this._distanceToTarget;
  }

  set distanceToTarget(value: number) {
    const normalizedValue = Math.max(value, MINIMUM_DISTANCE_TO_TARGET);
    if (this._distanceToTarget !== normalizedValue) {
      this._distanceToTarget = normalizedValue;
      this.updateMagnifier();
    }
  }

  /**
   * Determines the roundness of the magnifier. The value is a number in the range between 0 and 1.
   * A value of 0 renders the magnifier as a rectangle, while a value of 1 renders it as an ellipse.
   * Any value between 0 and 1 produces a rounded rectangle with a degree of roundness proportional to the value.
   */
  get roundness(): number {
    return this._roundness;
  }

  set roundness(value: number) {
    const normalized = clamp(value, 0, 1);
    if (this._roundness !== normalized) {
      this._roundness = normalized;
      if (this._magnifierMap) {
        this._magnifierMap.domNode.style.clipPath = `inset(0 0 round ${this._roundness * 50}%)`;
      }
      this.updateMagnifier();
    }
  }

  /**
   * Sets whether the magnifier should be visible.
   * If set to false, the magnifier will be hidden.
   * Note that the actual visibility of the magnifier also depends on whether {@link magnifiedWorldPoint} is null or not.
   */
  get visible(): boolean {
    return this._visible;
  }

  set visible(active: boolean) {
    if (this._visible !== active) {
      this._visible = active;
      this.updateMagnifier();
      if (!active) {
        this.magnifiedWorldPoint = null;
      }
    }
  }

  /**
   * Internally used to fetch the world point, which can either be on the main map or in the center of the magnifier map.
   * By default, this method returns the world point located on the closest surface of the visualized mesh.
   * Users have the option to override this method with a custom implementation if needed.
   * The method returns <code>null</code> if it cannot determine the world point.
   * @param map either the main map or the magnifier map
   * @param viewPoint the position in pixel coordinates
   */
  getWorldPoint(map: Map, viewPoint: Point): Point | null {
    try {
      return map.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE).transform(viewPoint);
    } catch (e) {
      if (!(e instanceof OutOfBoundsError)) {
        throw e;
      }
      return null;
    }
  }

  /**
   * The current view point that is the center of magnification on the main map.
   */
  get magnifiedViewPoint(): Point | null {
    return this._magnifiedViewPoint;
  }

  set magnifiedViewPoint(viewPoint: Point | null) {
    this._magnifiedViewPoint = viewPoint;
    if (viewPoint) {
      this.magnifiedWorldPoint = this.getWorldPoint(this._mainMap, viewPoint);
    } else {
      this.magnifiedWorldPoint = null;
    }
  }

  /**
   * The current world point that is the center of magnification on the main map.
   */
  get magnifiedWorldPoint(): Point | null {
    return this._magnifiedWorldPoint;
  }

  private set magnifiedWorldPoint(val: Point | null) {
    if (val === this._magnifiedWorldPoint || (val && this._magnifiedWorldPoint?.equals(val))) {
      return;
    }

    this._magnifiedWorldPoint = val;
    this.updateMagnifier();
    this._eventedSupport.emit(EVENT_MAGNIFIED_POINT, this._magnifiedWorldPoint);
  }

  private updateMagnifier() {
    const shouldBeVisible = this.visible && this.magnifiedWorldPoint;
    if (shouldBeVisible) {
      this.updateMagnifierCamera();
      this.updateMagnifierPosition();
    }

    if (this.magnifierMap) {
      const visibility = shouldBeVisible ? 'visible' : 'hidden';
      if (this.magnifierMap.domNode.style.visibility !== visibility) {
        this.magnifierMap.domNode.style.visibility = visibility;
      }
    }
  }

  private updateMagnifierCamera() {
    if (
        !this._magnifierMap ||
        !this._magnifiedViewPoint ||
        !this._magnifiedWorldPoint ||
        !(this._mainMap.camera instanceof PerspectiveCamera)
    ) {
      return;
    }

    const camera = this._mainMap.camera;
    const forward = normalize(sub(camera.toWorld(this._magnifiedViewPoint), camera.eye));

    const distanceToEye = distance(this._magnifiedWorldPoint, camera.eye);

    const eyeTranslationFactor =
        distanceToEye > 2 * this._distanceToTarget
        ? // will move the camera to the fixed distance from the target
        (distanceToEye - this._distanceToTarget) / distanceToEye
        : // will halve the camera distance to the target
        0.5;

    const eyeTranslation = scale(sub(this._magnifiedWorldPoint, camera.eye), eyeTranslationFactor);
    const eye = add(camera.eye, eyeTranslation);
    const toTarget = distanceToEye - length(eyeTranslation);

    const fovScale = this._magnifierMap.viewSize[1] / this._mainMap.viewSize[1];

    this._magnifierMap.camera = this._magnifierMap.camera.copyAndSet({
      eye,
      forward,
      up: camera.up,
      fovY: fovScale * camera.fovY,
    });

    this._magnifierMap.effects.depthOfField = {
      focalDepth: toTarget,
      focusRange: 0.2 * toTarget,
      scale: 100,
    };
  }

  private updateMagnifierPosition() {
    if (this._magnifiedViewPoint && this._mainMap && this._magnifierMap && this.magnifiedWorldPoint) {
      const {x: viewX, y: viewY} = this._magnifiedViewPoint;
      const [currentWidth, currentHeight] = this._magnifierMap.viewSize;
      const [mainMapWidth] = this._mainMap.viewSize;

      const y = viewY - this._positionOffset;
      const signedTop = y - currentHeight;
      const top = Math.max(0, signedTop);

      let left = viewX - currentWidth / 2;
      if (signedTop < 0) {
        // the magnifier crosses the top border
        const shiftX = currentWidth / 2 + this._positionOffset;
        left += viewX + currentWidth + this._positionOffset < mainMapWidth ? shiftX : -shiftX;
      }
      if (left < 0) {
        left = 0;
      }
      if (left + currentWidth > mainMapWidth) {
        left = mainMapWidth - currentWidth;
      }

      this._magnifierMap.domNode.style.left = `${left}px`;
      this._magnifierMap.domNode.style.top = `${top}px`;
    }
  }

  /**
   * Returns the precise world position of the point located in the center of the magnifier.
   * This function retrieves the point from the magnifier map.
   * The returned point is more accurate than the magnified world point on the main map because the magnifier displays
   * a more detailed mesh representation.
   * If the point cannot be retrieved, the function returns <code>null</code>.
   */
  getMagnifierCenterPoint(): Point | null {
    if (!this._mainMap || !this._magnifierMap || !this.visible || !this._magnifiedWorldPoint) {
      return null;
    }
    const [w, h] = this._magnifierMap.viewSize;
    const viewCenter = createPoint(null, [w / 2, h / 2]);
    return this.getWorldPoint(this._magnifierMap, viewCenter);
  }

  /**
   * Registers a callback function to be invoked whenever the {@link magnifiedWorldPoint} on the main map changes.
   * The new magnified point is passed to the callback function as an argument.
   * @param callback the registered callback
   */
  onMagnifiedWorldPointChanged(callback: (magnifiedWorldPoint: Point | null) => void): Handle {
    return this._eventedSupport.on(EVENT_MAGNIFIED_POINT, callback);
  }

  /**
   * Registers a callback function that is triggered whenever the actual size of the magnifier node element changes.
   * The callback function receives the actual width and height of the magnifier.
   * @param callback the registered callback
   */
  onResize(callback: (width: number, height: number) => void): Handle {
    return this._eventedSupport.on(EVENT_RESIZE, callback);
  }
}

function validateFields(options: MagnifierSupportConstructorOptions): Required<MagnifierSupportConstructorOptions> {
  const {
    distanceToTarget = DEFAULT_DISTANCE_TO_TARGET,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    positionOffset = DEFAULT_POSITION_OFFSET,
    roundness = DEFAULT_ROUNDNESS
  } = options;
  return {
    distanceToTarget: Math.max(distanceToTarget, MINIMUM_DISTANCE_TO_TARGET),
    width: width > MIN_SIZE ? Math.round(width) : DEFAULT_WIDTH,
    height: height > MIN_SIZE ? Math.round(height) : DEFAULT_HEIGHT,
    positionOffset: clamp(Math.round(positionOffset), 0, height),
    roundness: clamp(roundness, 0, 1)
  }
}