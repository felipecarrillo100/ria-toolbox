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
import {Handle} from '@luciad/ria/util/Evented.js';
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {MemoryStore} from '@luciad/ria/model/store/MemoryStore.js';
import {MeasurementAnnotationController} from './MeasurementAnnotationController.js';
import {
  MeasurementAnnotationPainter,
  MeasurementAnnotationStyles,
  MeasurementFeature,
  MeasurementFeatureProperties
} from './MeasurementAnnotationPainter.js';
import {distance} from '@luciad/ria-toolbox-core/util/Vector3Util.js';
import {FeatureLayer} from '@luciad/ria/view/feature/FeatureLayer.js';
import {FeatureModel} from '@luciad/ria/model/feature/FeatureModel.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {ReferenceType} from '@luciad/ria/reference/ReferenceType.js';
import {CoordinateReference} from '@luciad/ria/reference/CoordinateReference.js';
import {createTransformation} from '@luciad/ria/transformation/TransformationFactory.js';
import {Measurement, MEASUREMENTS_MODEL_REFERENCE,} from "@luciad/ria-toolbox-ruler3d/measurement/Measurement.js";
import {MEASUREMENT_FINISHED_EVENT, Ruler3DController} from "@luciad/ria-toolbox-ruler3d/Ruler3DController.js";
import {createMeasurement} from "@luciad/ria-toolbox-ruler3d/measurement/MeasurementUtil.js";
import {MeasurementProjector} from "@luciad/ria-toolbox-ruler3d/ThreePointProjector.js";
import {
  RAYCASTED_PROJECTION_TYPE,
  ThreePointRaycastedProjector
} from "@luciad/ria-toolbox-ruler3d/ThreePointRaycastedProjector.js";
import {
  ORTHOGONAL_PROJECTION_TYPE,
  ThreePointOrthogonalProjector
} from "@luciad/ria-toolbox-ruler3d/ThreePointOrthogonalProjector.js";
import {Annotation, AnnotationSupport, AnnotationSupportCreateOptions} from "../AnnotationSupport.js";

/**
 * Interface representing a measurement annotation on the map.
 */
export interface MeasurementAnnotation extends Annotation {
  /**
   * The points representing the measurement
   */
  points: Point[];
  /**
   * The type of the measurement
   */
  type: string;
}

/**
 * The options used to create a {@link MeasurementAnnotationSupport}
 */
export interface MeasurementAnnotationSupportCreateOptions extends AnnotationSupportCreateOptions {
  /**
   * The URL used to style the {@link MeasurementProjector} used by the measurement controller in case of planar
   * measurements.
   */
  projectorPlaneMeshUrl: string;
  /**
   * The styles used to draw measurements in various states.
   */
  styles: MeasurementAnnotationStyles;
}

/**
 * The options used to start creating a measurement annotation
 */
export interface CreateMeasurementOptions {
  /**
   * The type of {@link Measurement} that needs to be created.
   * This is used by {@link MeasurementAnnotationSupport#createMeasurement} to create the desired measurement.
   */
  measurementType: string;
  /**
   * The type of {@link MeasurementProjector} type used to create new measurements.
   * This is used in {@link MeasurementAnnotationSupport#createProjector} to create the desired projector.
   * If undefined, no projector is used.
   */
  projectionType?: string;
}


const MEASUREMENT_LAYER_ID = 'asset-measurement-layer';

/**
 * Support class to help with measurement annotation management.
 * See {@link @AnnotationSupport} on how to use this class.
 * See the documentation of {@link MeasurementAnnotationPainter} for more information about how annotations are drawn.
 */
export class MeasurementAnnotationSupport extends AnnotationSupport<MeasurementAnnotation, MeasurementFeature, Ruler3DController, CreateMeasurementOptions, Measurement> {
  protected readonly _projectorPlaneMeshUrl: string;
  protected readonly _styles: MeasurementAnnotationStyles;

  constructor(options: MeasurementAnnotationSupportCreateOptions) {
    super(options);
    this._projectorPlaneMeshUrl = options.projectorPlaneMeshUrl
    this._styles = options.styles;
  }

  protected createLayer(store: MemoryStore<MeasurementFeature>,
                        options: MeasurementAnnotationSupportCreateOptions): FeatureLayer {
    return new FeatureLayer(new FeatureModel(store, {reference: MEASUREMENTS_MODEL_REFERENCE}), {
      painter: new MeasurementAnnotationPainter(options.styles),
      label: MEASUREMENT_LAYER_ID,
      id: MEASUREMENT_LAYER_ID,
      selectable: true,
      hoverable: true,
    });
  }

  /**
   * Sets whether the annotation labels should always be painted for visible annotations, instead of only when they're
   * being hovered/selected.
   */
  setMeasurementLabelsAlwaysVisible(isAlwaysVisible: boolean) {
    (this._layer.painter as MeasurementAnnotationPainter).alwaysShowLabel = isAlwaysVisible;
  }

  protected isCurrentlyCreating(options: CreateMeasurementOptions): boolean {
    if (!this._annotationController) {
      return false;
    }
    return this._annotationController.measurement.type === options.measurementType &&
           this._annotationController.projector?.type === options.projectionType
  }

  protected createAndInitializeController(options: CreateMeasurementOptions): Ruler3DController {
    const controller = this.createController(options)

    const handles: Handle[] = [
      controller.on(MEASUREMENT_FINISHED_EVENT, (measurement: Measurement) => {
        const feature = toMeasurementFeature(measurement, true);

        const worldPoint = createTransformation(feature.shape.reference as CoordinateReference,
            this._map.reference).transform(
            feature.shape
        );
        const lookAt = this._map.camera.asLookAt(distance(this._map.camera.eyePoint, worldPoint));
        this.emitAnnotationCreated(feature.id as string, measurement, lookAt);
      }),
      controller.on('Activated', () => {
        if (!this._switchingControllers) {
          this.emitControllerActiveStateChanged(true);
        }
        (this._layer.painter as MeasurementAnnotationPainter).hideFeatures = true;
      }),
      controller.on('Deactivated', () => {
        handles.forEach(handle => handle.remove());
        if (!this._switchingControllers) {
          this._annotationController = null;
          this.emitControllerActiveStateChanged(false);
        }
        (this._layer.painter as MeasurementAnnotationPainter).hideFeatures = false;
        this._layer.visible = true;
      }),
    ];

    return controller;
  }

  /**
   * Resets the current measurement, if creation is currently active.
   * This will cause the current measurement to be empty of points, but still allows a user to add points.
   */
  resetCurrentCreatedMeasurement(): void {
    if (this._annotationController) {
      this._annotationController.measurement.reset();
    }
  }

  protected createController(options: CreateMeasurementOptions): Ruler3DController {
    return new MeasurementAnnotationController(
        this.createMeasurement({
          id: "dummy",
          visible: true,
          type: options.measurementType,
          points: [],
        }),
        {
          projector: this.createProjector(options.projectionType),
          bounds: this._creationBounds,
          styles: this._styles.defaultStyles
        }
    );
  }

  protected updateFeature(feature: MeasurementFeature, annotation: MeasurementAnnotation): boolean {
    let changed = false;

    if (feature.properties.visible !== annotation.visible) {
      feature.properties.visible = annotation.visible;
      changed = true;
    }

    const pointsChanged =
        feature.properties.measurement.pointCount !== annotation.points.length ||
        feature.properties.measurement.getPointListCopy().find((point, i) => {
          let annotationPoint = annotation.points[i];
          if (!MEASUREMENTS_MODEL_REFERENCE.equals(annotationPoint.reference)) {
            annotationPoint = createTransformation(
                annotationPoint.reference as CoordinateReference,
                MEASUREMENTS_MODEL_REFERENCE
            ).transform(annotationPoint);
          }
          return !point.equals(annotationPoint);
        });
    if (pointsChanged) {
      feature.properties.measurement = this.createMeasurement(annotation);
      feature.shape = feature.properties.measurement.bounds.focusPoint;
      changed = true;
    }

    return changed;
  }

  protected createFeature(annotation: MeasurementAnnotation): MeasurementFeature {
    return toMeasurementFeature(
        this.createMeasurement(annotation),
        annotation.visible,
        annotation.id
    );
  }

  protected createMeasurement(annotation: MeasurementAnnotation): Measurement {
    if (
        annotation.points[0] &&
        (!annotation.points[0].reference || annotation.points[0].reference.referenceType === ReferenceType.CARTESIAN)
    ) {
      throw new Error(
          'An annotation was passed with null or local reference. This can not be interpreted as-is on the map'
      );
    }

    const points: Point[] = [];
    for (let point of annotation.points) {
      if (!MEASUREMENTS_MODEL_REFERENCE.equals(point.reference)) {
        point = createTransformation(point.reference as CoordinateReference, MEASUREMENTS_MODEL_REFERENCE).transform(
            point
        );
      }
      points.push(point);
    }

    return createMeasurement(annotation.type, points);
  }

  protected createProjector(type?: string): MeasurementProjector | undefined {
    if (type === undefined) {
      return undefined;
    } else if (type === RAYCASTED_PROJECTION_TYPE) {
      return new ThreePointRaycastedProjector(this._map, this._projectorPlaneMeshUrl);
    } else if (type === ORTHOGONAL_PROJECTION_TYPE) {
      return new ThreePointOrthogonalProjector(this._map, this._projectorPlaneMeshUrl);
    } else {
      throw new Error("Unsupported projection type: " + type);
    }
  }
}

function toMeasurementFeature(measurement: Measurement, visible: boolean, id?: string): MeasurementFeature {
  const anchor = measurement.bounds.focusPoint;
  const props: MeasurementFeatureProperties = {
    visible,
    measurement,
  };
  return new Feature(anchor, props, id) as MeasurementFeature;
}
