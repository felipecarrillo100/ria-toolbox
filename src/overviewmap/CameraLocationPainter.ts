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
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {IconStyle, ImageIconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {CameraFeature} from "./types.js";

const DEFAULT_CAMERA_ICON_SIZE = 24;

/**
 * The constructor options for `CameraLocationPainter`.
 */
export interface CameraLocationPainterConstructorOptions {
  /**
   * The size of the camera icon.
   * @default 24 pixels
   */
  cameraIconSize?: number;
}

/**
 * The `CameraLocationPainter` class provides custom painting functionalities
 * to handle the rendering of camera position on the overview map.
 *
 * Users can configure the default size of camera and can optionally override default drawing methods
 * for a custom visual representation.
 */
export class CameraLocationPainter extends FeaturePainter {
  private _cameraIconSize = 24;
  private _cameraIconStyle: IconStyle;

  constructor({cameraIconSize}: CameraLocationPainterConstructorOptions = {}) {
    super();
    this._cameraIconSize = cameraIconSize ?? DEFAULT_CAMERA_ICON_SIZE;
    this._cameraIconStyle = createCameraIconStyle(this._cameraIconSize);
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
   * Draws the visual representation of the camera at a given point.
   * Users may override this method to provide a custom implementation for rendering the camera representation.
   * @param geoCanvas - The GeoCanvas instance used to draw the frustum icon.
   * @param feature - The camera feature.
   */
  override paintBody(geoCanvas: GeoCanvas, feature: CameraFeature) {
    const {heading} = feature.properties;
    if (this._cameraIconStyle.heading !== heading) {
      this._cameraIconStyle.heading = heading;
    }
    geoCanvas.drawIcon(feature.shape, this._cameraIconStyle);
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
