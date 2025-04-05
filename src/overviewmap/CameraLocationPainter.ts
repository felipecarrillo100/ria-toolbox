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
import {createFrustum} from "@luciad/ria-toolbox-core/util/IconFactory.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {IconStyle, ImageIconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {DEG2RAD} from "@luciad/ria-toolbox-core/util/Math.js";
import {CameraFeature} from "./CameraLayer.js";

const DEFAULT_CAMERA_ICON_SIZE = 24;
const DEFAULT_FRUSTUM_ICON_SIZE = 80;

/**
 * The constructor options for `CameraLocationPainter`.
 */
export interface CameraLocationPainterConstructorOptions {
  /**
   * The size of the camera icon.
   * @default 24 pixels
   */
  cameraIconSize?: number;
  /**
   * The size of the camera frustum icon.
   * @default 80 pixels
   */
  frustumIconSize?: number;
}

/**
 * The `CameraLocationPainter` class provides custom painting functionalities
 * to handle the rendering of camera visuals and the 2D frustum on the overview map.
 *
 * Users can configure the default size of camera and frustum and can optionally override default drawing methods
 * for a custom visual representation.
 */
export class CameraLocationPainter extends FeaturePainter {
  private _cameraIconSize = 24;
  private _cameraIconStyle: IconStyle;
  private _frustumIconSize = 80;
  private _frustumIconStyle: IconStyle;

  constructor({cameraIconSize, frustumIconSize}: CameraLocationPainterConstructorOptions = {}) {
    super();
    this._cameraIconSize = cameraIconSize ?? DEFAULT_CAMERA_ICON_SIZE;
    this._cameraIconStyle = createCameraIconStyle(this._cameraIconSize);
    this._frustumIconSize = frustumIconSize ?? DEFAULT_FRUSTUM_ICON_SIZE;
    this._frustumIconStyle = createFrustumIconStyle(this._frustumIconSize);
  }

  /**
   * Gets the size of the camera icon.
   */
  get cameraIconSize() {
    return this._cameraIconSize;
  }

  /**
   * Sets the size of the camera icon.
   * @param size - The desired size of the camera icon.
   */
  set cameraIconSize(size: number) {
    if (this._cameraIconSize !== size) {
      this._cameraIconSize = size;
      this._cameraIconStyle = createCameraIconStyle(this._cameraIconSize);
      this.invalidateAll();
    }
  }

  /**
   * Gets the size of the frustum icon.
   */
  get frustumIconSize() {
    return this._frustumIconSize;
  }

  /**
   * Sets the size of the frustum icon.
   * @param size - The desired size of the frustum icon.
   */
  set frustumIconSize(size: number) {
    if (this._frustumIconSize !== size) {
      this._frustumIconSize = size;
      this._frustumIconStyle = createFrustumIconStyle(this._frustumIconSize);
      this.invalidateAll();
    }
  }

  override paintBody(geoCanvas: GeoCanvas, feature: CameraFeature) {
    const {heading, fov} = feature.properties;

    this.drawCameraFrustum(geoCanvas, feature.shape, heading, fov);
    this.drawCameraPoint(geoCanvas, feature.shape, heading);
  }

  /**
   * Draws the visualization of the camera frustum.
   * Users may override this method to provide a custom implementation for rendering the camera frustum representation.
   * @param geoCanvas - The GeoCanvas instance used to draw the frustum icon.
   * @param point - The point at which the frustum is to be drawn.
   * @param heading - The heading direction of the frustum.
   * @param fov - The field of view in degrees of the frustum.
   */
  drawCameraFrustum(geoCanvas: GeoCanvas, point: Point, heading: number, fov: number) {
    if (this._frustumIconStyle.heading !== heading) {
      this._frustumIconStyle.heading = heading;
    }
    const newBase = 2 * this._frustumIconSize * Math.tan(fov / 2 * DEG2RAD);
    const percentageChange = newBase / this._frustumIconSize * 100;

    this._frustumIconStyle.height = `${percentageChange}%`;
    geoCanvas.drawIcon(point, this._frustumIconStyle);
  }

  /**
   * Draws the visual representation of the camera at a given point.
   *
   * Users may override this method to provide a custom implementation for rendering the camera representation.
   *
   * @param geoCanvas - The GeoCanvas instance used to draw the camera icon.
   * @param point - The point at which the camera should be drawn.
   * @param heading - The heading direction of the camera.
   */
  drawCameraPoint(geoCanvas: GeoCanvas, point: Point, heading: number) {
    if (this._cameraIconStyle.heading !== heading) {
      this._cameraIconStyle.heading = heading;
    }
    geoCanvas.drawIcon(point, this._cameraIconStyle);
  }
}

function createFrustumIconStyle(size: number): ImageIconStyle {
  return {
    image: createFrustum({
      size, colorStroke: 'rgba(80,155,133,1)',
      fillColor0: 'rgba(80,155,133,0.95)',
      fillColor1: 'rgba(80,155,133,0)'
    }),
    anchorX: `0px`,
    anchorY: `${(size / 2)}px`,
    heading: 0,
    rotation: -90,
    zOrder: 1
  }
}

function createCameraIconStyle(size: number): ImageIconStyle {
  // make the image bigger and then downscale it which smoothens the image and leads to an antialiasing effect.
  return {
    image: createCameraIcon(2 * size, 4),
    width: '50%',
    height: '50%',
    zOrder: 2
  };
}

function createCameraIcon(size: number, thickness: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) {
    throw new Error('OverviewMap tool: Cannot get canvas context');
  }
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const outerRadius = (size - thickness) / 2;
  const innerRadius = outerRadius / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.strokeStyle = 'rgba(0,0,0, 1)';
  ctx.lineWidth = thickness;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(80,155,133,1)';
  ctx.fill();

  return canvas;
}
