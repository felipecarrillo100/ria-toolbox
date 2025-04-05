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
import {Controller} from '@luciad/ria/view/controller/Controller.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {TourPathSupport} from '../TourPathSupport.js';
import {TourStyle} from '../view/TourStyles.js';
import {getFrustumShape, getFrustumSizeInfo} from '../view/TourDrawUtils.js';
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";


/**
 * `PathFrustumController` visualizes the camera's frustum for the current fraction value, if the camera is not locked.
 */
export class PathFrustumController extends Controller {
  private readonly _pathSupport: TourPathSupport;
  private _frustumStyle: ShapeStyle;

  constructor(pathSupport: TourPathSupport) {
    super();
    this._pathSupport = pathSupport;
    this._frustumStyle = TourStyle.pathController.frustumStyle
  }

  /**
   * Sets the style for drawing the frustum of the current fraction on the path.
   */
  setStyle(frustumStyle: ShapeStyle) {
    this._frustumStyle = frustumStyle;
  };

  /**
   * Draws the camera's frustum on path for the current fraction
   */
  override onDraw(geoCanvas: GeoCanvas): void {
    if (!this._pathSupport.cameraLock) {
      this.drawFrustumOnPath(geoCanvas);
    }
  }

  private drawFrustumOnPath(geoCanvas: GeoCanvas) {
    const path = this._pathSupport.pathFeature;
    if (path && this.map) {
      const frustumSizeInfo = getFrustumSizeInfo(path, this.map);
      frustumSizeInfo.frustumSize *= 2;
      const vectors = path.getVectorsAtFraction(this._pathSupport.tourPlayerSupport.fraction);
      geoCanvas.drawShape(getFrustumShape(vectors, frustumSizeInfo), this._frustumStyle);
    }
  }
}
