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
import {Map} from '@luciad/ria/view/Map.js';
import {Bounds} from '@luciad/ria/shape/Bounds.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {createTransformation} from '@luciad/ria/transformation/TransformationFactory.js';
import {CoordinateReference} from '@luciad/ria/reference/CoordinateReference.js';
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {Measurement} from '@luciad/ria-toolbox-ruler3d/measurement/Measurement.js';
import {Ruler3DController, Ruler3DControllerCreateOptions} from "@luciad/ria-toolbox-ruler3d/Ruler3DController.js";

/**
 * Options used to create an LabelAnnotationController
 */
export interface MeasurementControllerCreateOptions extends Ruler3DControllerCreateOptions {
  /**
   * The bounds in which annotations are allowed to be placed. If this is null, creation is unrestricted.
   */
  bounds: Bounds | null;
}

/**
 * Controller that is used to add a Measurement annotation on a map.
 * To use it, set it on the map and listen to the {@link MEASUREMENT_FINISHED_EVENT}.
 */
export class MeasurementAnnotationController extends Ruler3DController {
  private readonly _bounds: Bounds | null;

  public constructor(
      measurement: Measurement,
      options: MeasurementControllerCreateOptions) {

    super(measurement, options);
    this._bounds = options.bounds;
  }

  onDeactivate(map: Map) {
    map.domNode.style.cursor = 'default';
    return super.onDeactivate(map);
  }

  protected toModelPoint(event: GestureEvent): Point | null {
    const point = super.toModelPoint(event);
    if (this._bounds && point) {
      let pointToCheck = point;
      if (!point.reference?.equals(this._bounds.reference)) {
        pointToCheck = createTransformation(
            point.reference as CoordinateReference,
            this._bounds.reference as CoordinateReference
        ).transform(point);
      }
      if (!this._bounds.contains3DPoint(pointToCheck)) {
        return null;
      }
    }
    return point;
  }

}
