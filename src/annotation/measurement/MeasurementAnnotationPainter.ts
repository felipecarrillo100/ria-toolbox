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
import {FeaturePainter, PaintState} from '@luciad/ria/view/feature/FeaturePainter.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {LabelCanvas} from '@luciad/ria/view/style/LabelCanvas.js';
import {Shape} from '@luciad/ria/shape/Shape.js';
import {Measurement, MeasurementPaintStyles} from "@luciad/ria-toolbox-ruler3d/measurement/Measurement.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {Map} from "@luciad/ria/view/Map.js";

/**
 * The properties used to style measurement annotations
 */
export interface MeasurementFeatureProperties {
  /**
   * Whether the annotation should be visible on the map or not
   */
  visible: boolean;
  /**
   * The measurement that the feature represents
   */
  measurement: Measurement;
}

/**
 * Styles used by the {@link MeasurementAnnotationPainter} to paint measurement annotations in different states.
 */
export interface MeasurementAnnotationStyles {
  /**
   * The styles used when an annotation is visible and not selected or hovered
   */
  defaultStyles: MeasurementPaintStyles;
  /**
   * The styles used when an annotation is selected
   */
  selectedStyles: MeasurementPaintStyles;
  /**
   * The styles used when an annotation is hovered and is visible
   */
  hoveredVisibleStyles: MeasurementPaintStyles;
  /**
   * The styles used when an annotation is hovered, but not visible
   */
  hoveredHiddenStyles: MeasurementPaintStyles;
}

/**
 * A feature representing a measurement annotation on the map
 */
export type MeasurementFeature = Feature<Point, MeasurementFeatureProperties> & { id: string };

/**
 * Painter responsible to paint measurement annotations on a Map.
 * By default, the `visible` property of a feature is used to determine whether it should be visible or not,
 * but hovered features are always visible.
 * Labels are painted when the feature is either hovered, selected or `alwaysShowLabel` is set to true.
 */

export class MeasurementAnnotationPainter extends FeaturePainter {
  private readonly _styles: MeasurementAnnotationStyles;
  private _alwaysShowLabel: boolean = false;
  private _hideFeatures: boolean = false;

  /**
   * Constructs a new MeasurementAnnotationPainter
   * @param styles the styles used to paint annotations.
   */
  constructor(styles: MeasurementAnnotationStyles) {
    super();
    this._styles = styles;
  }

  /**
   * Denotes whether labels of visible features should always be drawn or not, independent of whether they're hovered or not.
   */
  get alwaysShowLabel(): boolean {
    return this._alwaysShowLabel;
  }

  set alwaysShowLabel(value: boolean) {
    if (value !== this._alwaysShowLabel) {
      this._alwaysShowLabel = value;
      this.invalidateAll();
    }
  }

  /**
   * Denotes whether all features should be hidden or not, independent of their visible property.
   */
  get hideFeatures(): boolean {
    return this._hideFeatures;
  }

  set hideFeatures(value: boolean) {
    if (value !== this._hideFeatures) {
      this._hideFeatures = value;
      this.invalidateAll();
    }
  }

  paintBody(
      geoCanvas: GeoCanvas,
      feature: MeasurementFeature,
      _shape: Shape,
      _layer: Layer,
      _map: Map,
      paintState: PaintState
  ): void {
    if (this._hideFeatures) {
      return;
    }
    const {measurement, visible} = feature.properties;
    if (visible || paintState.hovered) {
      measurement.paintBody(geoCanvas, this.getRelevantStyles(visible, paintState.selected, paintState.hovered));
    }
  }

  paintLabel(
      labelCanvas: LabelCanvas,
      feature: MeasurementFeature,
      _shape: Shape,
      _layer: unknown,
      _map: unknown,
      state: PaintState
  ): void {
    if (this._hideFeatures) {
      return;
    }
    const {measurement, visible} = feature.properties;
    if (!state.hovered && !state.selected && !this._alwaysShowLabel) {
      return;
    }

    if (visible || state.hovered) {
      measurement.paintLabel(labelCanvas, this.getRelevantStyles(visible, state.selected, state.hovered));
    }
  }

  private getRelevantStyles(visible: boolean, selected: boolean, hovered: boolean): MeasurementPaintStyles {
    if (selected) {
      return this._styles.selectedStyles;
    } else if (hovered) {
      if (visible) {
        return this._styles.hoveredVisibleStyles;
      } else {
        return this._styles.hoveredHiddenStyles;
      }
    } else {
      return this._styles.defaultStyles;
    }
  }
}
