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
import {DEG2RAD} from "@luciad/ria-toolbox-core/util/Math.js";
import {CameraFeature} from "./types.js";

const DEFAULT_FRUSTUM_ICON_SIZE = 80;

/**
 * The constructor options for `CameraFrustumPainter`.
 */
export interface CameraFrustumPainterConstructorOptions {
  /**
   * The size of the camera frustum icon.
   * @default 80 pixels
   */
  frustumIconSize?: number;
}

/**
 * The `CameraFrustumPainter` class provides custom painting functionalities
 * to handle the rendering of the 2D frustum on the overview map.
 *
 * Users can configure the default size of camera and frustum and can optionally override default drawing methods
 * for a custom visual representation.
 */
export class CameraFrustumPainter extends FeaturePainter {
  private _frustumIconSize = 80;
  private _frustumIconStyle: IconStyle;

  constructor({frustumIconSize}: CameraFrustumPainterConstructorOptions = {}) {
    super();
    this._frustumIconSize = frustumIconSize ?? DEFAULT_FRUSTUM_ICON_SIZE;
    this._frustumIconStyle = createFrustumIconStyle(this._frustumIconSize);
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

  /**
   * Draws the visualization of the camera frustum.
   * Users may override this method to provide a custom implementation for rendering the camera frustum representation.
   * @param geoCanvas - The GeoCanvas instance used to draw the frustum icon.
   * @param feature - The camera feature.
   */
  override paintBody(geoCanvas: GeoCanvas, feature: CameraFeature) {
    const {heading, fov} = feature.properties;

    if (this._frustumIconStyle.heading !== heading) {
      this._frustumIconStyle.heading = heading;
    }
    const newBase = 2 * this._frustumIconSize * Math.tan(fov / 2 * DEG2RAD);
    const percentageChange = newBase / this._frustumIconSize * 100;

    this._frustumIconStyle.height = `${percentageChange}%`;
    geoCanvas.drawIcon(feature.shape, this._frustumIconStyle);
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
