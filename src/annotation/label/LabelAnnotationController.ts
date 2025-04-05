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
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {HandleEventResult} from '@luciad/ria/view/controller/HandleEventResult.js';
import {GestureEventType} from '@luciad/ria/view/input/GestureEventType.js';
import {LocationMode} from '@luciad/ria/transformation/LocationMode.js';
import {Point} from '@luciad/ria/shape/Point.js';
import {Map} from '@luciad/ria/view/Map.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {IconStyle} from '@luciad/ria/view/style/IconStyle.js';
import {OcclusionMode} from '@luciad/ria/view/style/OcclusionMode.js';
import {OutOfBoundsError} from '@luciad/ria/error/OutOfBoundsError.js';
import {Bounds} from '@luciad/ria/shape/Bounds.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {Handle} from '@luciad/ria/util/Evented.js';
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";

const annotationCursorIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDYiIGhlaWdodD0iNDYiIHZpZXdCb3g9IjAgMCA0NiA0NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyMyIgY3k9IjIzIiByPSIyMyIgZmlsbD0iIzEyMTIxMiIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KICA8Y2lyY2xlIGN4PSIyMy4wMDAxIiBjeT0iMjMiIHI9IjgiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTI3LjAwMDEgMjIuNUgyMy41MDAxVjE5SDIyLjUwMDFWMjIuNUgxOS4wMDAxVjIzLjVIMjIuNTAwMVYyN0gyMy41MDAxVjIzLjVIMjcuMDAwMVYyMi41WiIgZmlsbD0iIzFDOEVBOSIvPgo8L3N2Zz4K';

const CREATION_STYLE: IconStyle = {
  url: annotationCursorIcon,
  width: '46px',
  height: '46px',
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

/**
 * Options used to create an LabelAnnotationController
 */
interface LabelAnnotationControllerConstructorOptions {
  /**
   * The icon style used by the controller to draw the point under the cursor.
   */
  cursorStyle?: IconStyle;
}

/**
 * Event emitted when a user clicks on a surface on which an annotation point can be placed
 */
export const POINT_CREATION_EVENT = 'PointCreationEvent';

/**
 * Controller that is used to add a point annotation on a map.
 * To use it, set it on the map and listen to the {@link POINT_CREATION_EVENT}.
 */
export class LabelAnnotationController extends Controller {
  private readonly _eventedSupport = new EventedSupport([POINT_CREATION_EVENT], true);
  private readonly _bounds: Bounds | null;
  private readonly _cursorStyle: IconStyle;
  private _worldToModelTransformation: Transformation | null = null;
  private _annotationToAdd: Point | null = null;

  /**
   * Creates an LabelAnnotationController
   * @param bounds the bounds in which annotations are allowed to be placed. If this is null, creation is unrestricted.
   * @param options an option object literal used to construct the LabelAnnotationController
   */
  constructor(bounds: Bounds | null, options?: LabelAnnotationControllerConstructorOptions) {
    super();
    this._bounds = bounds;
    this._cursorStyle = options?.cursorStyle ?? CREATION_STYLE;
  }

  onActivate(map: Map) {
    super.onActivate(map);
    this._worldToModelTransformation = this._bounds ? createTransformation(map.reference, this._bounds.reference!)
                                                    : null;
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    if (!this.map) {
      return HandleEventResult.EVENT_IGNORED;
    }
    if (event.type === GestureEventType.MOVE || event.type === GestureEventType.DRAG) {
      let newPoint = null;
      try {
        const touchedPoint = this.map.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE).transform(
            event.viewPoint);
        this._worldToModelTransformation?.transform(touchedPoint, touchedPoint)
        if (!this._bounds || this._bounds.contains3DPoint(touchedPoint)) {
          newPoint = touchedPoint;
        }
      } catch (e) {
        if (!(e instanceof OutOfBoundsError)) {
          throw e;
        }
      }
      this._annotationToAdd = newPoint;
      this.cursor = newPoint ? 'none' : null;
      this.invalidate();
    } else if (event.type === GestureEventType.SINGLE_CLICK_UP && this._annotationToAdd) {
      this.cursor = null;
      this._eventedSupport.emit(POINT_CREATION_EVENT, this._annotationToAdd);
      this._annotationToAdd = null;
      this.invalidate();
      return HandleEventResult.EVENT_HANDLED;
    }
    return HandleEventResult.EVENT_IGNORED;
  }

  onDraw(geoCanvas: GeoCanvas) {
    if (this._annotationToAdd) {
      geoCanvas.drawShape(this._annotationToAdd, this._cursorStyle);
    }
  }

  on(
      event: 'Activated' | 'Deactivated' | 'Invalidated' | typeof POINT_CREATION_EVENT,
      callback: (...args: any[]) => void,
      context?: any
  ): Handle {
    if (event === POINT_CREATION_EVENT) {
      return this._eventedSupport.on(POINT_CREATION_EVENT, callback);
    } else if (event === 'Activated') {
      return super.on(event, callback);
    } else if (event === 'Deactivated') {
      return super.on(event, callback);
    } else {
      return super.on(event, callback, context);
    }
  }
}
