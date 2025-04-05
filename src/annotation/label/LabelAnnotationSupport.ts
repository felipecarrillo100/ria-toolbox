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
import {Bounds} from '@luciad/ria/shape/Bounds.js';
import {CoordinateReference} from '@luciad/ria/reference/CoordinateReference.js';
import {Map} from '@luciad/ria/view/Map.js';
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {createTransformation} from '@luciad/ria/transformation/TransformationFactory.js';
import {FeatureLayer} from '@luciad/ria/view/feature/FeatureLayer.js';
import {MemoryStore} from '@luciad/ria/model/store/MemoryStore.js';
import {LabelAnnotationController, POINT_CREATION_EVENT} from "./LabelAnnotationController.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {
  LabelAnnotationFeature,
  LabelAnnotationPainter,
  LabelAnnotationProperties,
  LabelAnnotationStyles
} from "./LabelAnnotationPainter.js";
import {distance} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {AnnotationSupport} from "../AnnotationSupport.js";

/**
 * Interface representing a point annotation on the map.
 */
export interface LabelAnnotation extends LabelAnnotationProperties {
  /**
   * The unique identifier of the annotation
   */
  id: string;

  /**
   * Where the annotation is positioned
   */
  position: Point;
}

/**
 * Options used to create an LabelAnnotationSupport object
 */
interface LabelAnnotationSupportCreateOptions {
  /**
   * The map on which annotations will be displayed
   */
  map: Map;

  /**
   * Callback called when the Annotation Support wants to change the controller relevant for annotation management.
   * The default implementation sets the given controller to the map's controller field.
   */
  onControllerChange?: ((controller: Controller | null) => void);

  /**
   * Callback called when the Annotation Support created a layer on which it will display the annotations.
   * The default implementation adds the given layer to the layer tree of the map.
   */
  onLayerCreated?: ((layer: Layer) => void);

  /**
   * The bounds in which annotations are allowed to be created.
   * If these are omitted, creation is unrestricted.
   */
  creationBounds?: Bounds;

  /**
   * The reference of the model in which the annotation features are stored.
   * To optimize performance, you should define all your annotations in the same reference and pass that reference here,
   * which removes the need for transformations when updating the annotations.
   */
  modelReference?: CoordinateReference;

  /**
   * The style used to draw points under the cursor when creating new annotations.
   * If this is not specified, a default it used.
   */
  cursorStyle?: IconStyle;

  /**
   * The styles used to draw annotation points in various states.
   * If this is not specified, defaults are used.
   */
  annotationStyles?: LabelAnnotationStyles;
}

const ANNOTATION_LAYER_ID = 'annotation-layer';

/**
 * Support class to help with point annotation management.
 * See {@link @AnnotationSupport} on how to use this class.
 * See the documentation of {@link LabelAnnotationPainter} for more information about how annotations are drawn.
 */
export class LabelAnnotationSupport extends AnnotationSupport<LabelAnnotation, LabelAnnotationFeature, LabelAnnotationController, void, Point> {
  private readonly _cursorStyle?: IconStyle;
  private readonly _painterStyles: LabelAnnotationStyles;

  /**
   * Creates a new LabelAnnotationSupport
   * @param options {@see LabelAnnotationSupportCreateOptions}
   */
  constructor(options: LabelAnnotationSupportCreateOptions) {
    super(options);
    this._cursorStyle = options.cursorStyle;
    this._painterStyles = options.annotationStyles ?? {};
  }

  protected createLayer(store: MemoryStore<LabelAnnotationFeature>,
                        options: LabelAnnotationSupportCreateOptions): FeatureLayer {
    return new FeatureLayer(new FeatureModel(store, {reference: options.modelReference ?? getReference("EPSG:4326")}), {
      painter: new LabelAnnotationPainter(this._painterStyles),
      id: ANNOTATION_LAYER_ID,
      label: ANNOTATION_LAYER_ID,
      selectable: true,
      hoverable: true,
    });
  }

  /**
   * Sets whether the annotation titles should always be painted for visible annotations, instead of only when they're
   * being hovered.
   */
  setAnnotationTitleAlwaysVisible(isAlwaysVisible: boolean) {
    (this._layer.painter as LabelAnnotationPainter).alwaysShowLabel = isAlwaysVisible;
  }

  protected isCurrentlyCreating(): boolean {
    return this._annotationController !== null;
  }

  protected createAndInitializeController(): LabelAnnotationController {
    const controller = new LabelAnnotationController(this._creationBounds, {cursorStyle: this._cursorStyle});
    const creationHandle = controller.on(POINT_CREATION_EVENT, point => {
      const worldPoint = createTransformation(point.reference as CoordinateReference, this._map.reference).transform(
          point
      );
      const lookAt = this._map.camera.asLookAt(distance(this._map.camera.eyePoint, worldPoint));
      this.emitAnnotationCreated(String(Date.now()), worldPoint, lookAt);
    });
    const handleActivate = controller.on('Activated', () => {
      (this._layer.painter as LabelAnnotationPainter).hideFeatures = true;
      this.emitControllerActiveStateChanged(true);
      handleActivate.remove();
    });
    const handleDeactivate = controller.on('Deactivated', () => {
      this._annotationController = null;
      creationHandle.remove();
      (this._layer.painter as LabelAnnotationPainter).hideFeatures = false;
      this.emitControllerActiveStateChanged(false);
      handleDeactivate.remove();
    });
    return controller;
  }

  protected updateFeature(feature: LabelAnnotationFeature, annotation: LabelAnnotation): boolean {
    const point = this.getAnnotationPoint(annotation);
    let changed = false;

    if (feature.properties.visible !== annotation.visible) {
      feature.properties.visible = annotation.visible;
      changed = true;
    }
    if (feature.properties.title !== annotation.title) {
      feature.properties.title = annotation.title;
      changed = true;
    }
    if (!point.equals(feature.shape)) {
      feature.shape.move3DToPoint(point);
      changed = true;
    }
    return changed;
  }

  protected createFeature(annotation: LabelAnnotation): LabelAnnotationFeature {
    const point = this.getAnnotationPoint(annotation);
    return new Feature(
        point,
        {visible: annotation.visible, title: annotation.title},
        annotation.id);
  }

  private getAnnotationPoint(annotation: LabelAnnotation): Point {
    if (!annotation.position.reference || annotation.position.reference.referenceType === ReferenceType.CARTESIAN) {
      throw new Error(
          "An annotation was passed with null or local reference. This can not be interpreted as-is on the map");
    }
    let point = annotation.position;
    if (!this._layer.model.reference.equals(point.reference)) {
      point = createTransformation(point.reference!, this._layer.model.reference).transform(point);
    }
    return point;
  }

}
