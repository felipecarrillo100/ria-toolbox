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
import {toPoint} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {FeaturePainter} from '@luciad/ria/view/feature/FeaturePainter.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {LabelCanvas} from '@luciad/ria/view/style/LabelCanvas.js';
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {Layer} from '@luciad/ria/view/Layer.js';
import {Shape} from '@luciad/ria/shape/Shape.js';
import {TourStyle} from './TourStyles.js';
import {createPathLabel, getFrustumShape, getFrustumSizeInfo} from './TourDrawUtils.js';
import {PathFeature} from '../model/PathFeature.js';
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {TOUR_MODEL_REFERENCE} from "../TourPathSupport.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {PointLabelStyle} from "@luciad/ria/view/style/PointLabelStyle.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";

const PAINT_MODE_CHANGE_EVENT = 'PAINT_MODE_CHANGE_EVENT';

/**
 * The enumeration represents the various paint modes available when drawing a path.
 */
export enum PathPaintMode {
  /** The path is not visible. */
  INVISIBLE,
  /** Only the path's trajectory is visible. */
  PATH_ONLY,
  /** The path's trajectory and points are visible. */
  PATH_POINTS,
  /** The path's trajectory, points, and frustums are visible. */
  PATH_POINTS_FRUSTUMS,
}

/**
 * Contains style options for the `PathPainter`.
 */
export interface PathPainterStyleOptions {
  /** The style for the visible part of the tour path. */
  pathStyle: ShapeStyle;
  /** The style for the obscured part of the tour path. */
  pathStyleObscured: ShapeStyle;
  /** The style for path points along the path. */
  pointStyle: IconStyle;
  /** The style for the frustum of the path.  */
  frustumStyle: ShapeStyle;
  /** The style for labels on the path.  */
  labelStyle: PointLabelStyle;
}

/**
 * Path painter that draws a tour path accordingly to the paint mode (`PathPaintMode`).
 */
export class PathPainter extends FeaturePainter {
  private readonly _eventSupport: EventedSupport;
  private _paintMode: PathPaintMode = PathPaintMode.PATH_ONLY;
  private _styles: PathPainterStyleOptions;

  constructor(options: Partial<PathPainterStyleOptions> = {}) {
    super();
    this._eventSupport = new EventedSupport([PAINT_MODE_CHANGE_EVENT], true);

    this._styles = {
      pathStyle: options.pathStyle ?? TourStyle.pathPainter.pathStyle,
      pathStyleObscured: options.pathStyleObscured ?? TourStyle.pathPainter.pathStyleObscured,
      pointStyle: options.pointStyle ?? TourStyle.pathPainter.pointStyle,
      frustumStyle: options.frustumStyle ?? TourStyle.pathPainter.frustumStyle,
      labelStyle: options.labelStyle ?? TourStyle.pathPainter.labelStyle
    }
  }

  setStyles(options: Partial<PathPainterStyleOptions> = {}) {
    this._styles = {
      pathStyle: options.pathStyle ?? TourStyle.pathPainter.pathStyle,
      pathStyleObscured: options.pathStyleObscured ?? TourStyle.pathPainter.pathStyleObscured,
      pointStyle: options.pointStyle ?? TourStyle.pathPainter.pointStyle,
      frustumStyle: options.frustumStyle ?? TourStyle.pathPainter.frustumStyle,
      labelStyle: options.labelStyle ?? TourStyle.pathPainter.labelStyle
    }
  }

  /**
   * Retrieves the current path paint mode.
   * @returns The current `PathPaintMode`.
   */
  get paintMode(): PathPaintMode {
    return this._paintMode;
  }

  /**
   * Sets a new paint mode.
   * @param mode The new `PathPaintMode` to set for the path.
   */
  set paintMode(mode: PathPaintMode) {
    if (this._paintMode !== mode) {
      this._paintMode = mode;
      this.invalidateAll();
      this._eventSupport.emit(PAINT_MODE_CHANGE_EVENT, this._paintMode);
    }
  }

  override paintBody(
      geoCanvas: GeoCanvas,
      pathFeature: PathFeature,
      _shape: Shape,
      _layer: Layer,
      map: WebGLMap
  ): void {
    if (this.skipPainting(pathFeature) || pathFeature.isEmpty()) {
      return;
    }

    const trajectory = pathFeature.shape;
    // draw path
    if (trajectory.pointCount === 1) {
      geoCanvas.drawIcon(toPoint(TOUR_MODEL_REFERENCE, trajectory.getPoint(0)), this._styles.pointStyle);
    } else {
      geoCanvas.drawShape(trajectory, this._styles.pathStyleObscured);
      geoCanvas.drawShape(trajectory, this._styles.pathStyle);
    }

    // draw frustum and point for each control point of the path
    const frustumSizeInfo = getFrustumSizeInfo(pathFeature, map);

    if (this.paintMode === PathPaintMode.PATH_POINTS || this.paintMode === PathPaintMode.PATH_POINTS_FRUSTUMS) {
      pathFeature.getPathPointFeatures().forEach(pathPoint => {
        const pathPointVectors = pathPoint.getPathPointVectors();
        geoCanvas.drawIcon(toPoint(TOUR_MODEL_REFERENCE, pathPointVectors.eye), this._styles.pointStyle);
        if (this.paintMode === PathPaintMode.PATH_POINTS_FRUSTUMS) {
          geoCanvas.drawShape(getFrustumShape(pathPointVectors, frustumSizeInfo), this._styles.frustumStyle);
        }
      });
    }
  }

  override paintLabel(labelCanvas: LabelCanvas, pathFeature: PathFeature): void {
    if (this.skipPainting(pathFeature)) {
      return;
    }

    if (this.paintMode === PathPaintMode.PATH_POINTS || this.paintMode === PathPaintMode.PATH_POINTS_FRUSTUMS) {
      pathFeature.getPathPointFeatures().forEach((pathPoint, index) => {
        const html = createPathLabel(`${index + 1}`);
        const shape = toPoint(TOUR_MODEL_REFERENCE, pathPoint.getPathPointVectors().eye)
        labelCanvas.drawLabel(html, shape, this._styles.labelStyle);
      });
    }
  }

  private skipPainting(pathFeature: PathFeature) {
    return this.paintMode === PathPaintMode.INVISIBLE || pathFeature.isEmpty();
  }

  /**
   * Registers a callback function to be run when path paint mode has changed.
   * @param callback - The function to be called when path view states are changed.
   * @returns A handle which can be used to deregister the callback.
   */
  onPaintModeChange(callback: (paintMode: PathPaintMode) => void): Handle {
    return this._eventSupport.on(PAINT_MODE_CHANGE_EVENT, callback);
  }
}
