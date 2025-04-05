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
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {
  Measurement,
  MEASUREMENT_CHANGED_EVENT,
  MeasurementPaintStyles,
  MEASUREMENTS_MODEL_REFERENCE,
  MeasurementSegment
} from "./measurement/Measurement.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {Map} from "@luciad/ria/view/Map.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {MeasurementProjector} from "./ThreePointProjector.js";

export const MEASUREMENT_FINISHED_EVENT = "MeasurementFinished";
export const MEASUREMENT_STARTED_EVENT = "MeasurementStarted";
export const ENABLED_CHANGE_EVENT = "ENABLED_CHANGED";

export interface Ruler3DControllerCreateOptions {
  styles: MeasurementPaintStyles;
  minSegments?: number;
  maxSegments?: number;
  enabled?: boolean;
  projector?: MeasurementProjector;
  startOnMove?: boolean;
}

export class Ruler3DController<S extends MeasurementSegment = MeasurementSegment> extends Controller {
  private readonly _eventedSupport: EventedSupport;
  private readonly _minSegments: number;
  private readonly _maxSegments: number;
  private readonly _measurementStyles: MeasurementPaintStyles;
  private readonly _projector?: MeasurementProjector;
  private readonly _startOnMove: boolean;
  private _measurement: Measurement<S>;
  private _worldToModel?: Transformation;
  private _enabled: boolean;
  private _finished: boolean = false;
  private _measurementHandle: Handle | null = null;

  constructor(measurement: Measurement<S>,
              {
                styles,
                enabled = true,
                minSegments = 0,
                maxSegments = Number.MAX_SAFE_INTEGER,
                projector,
                startOnMove = false
              }: Ruler3DControllerCreateOptions) {
    super();
    this._eventedSupport = new EventedSupport([MEASUREMENT_FINISHED_EVENT, ENABLED_CHANGE_EVENT, MEASUREMENT_STARTED_EVENT], true)
    this._measurementStyles = styles;
    this._projector = projector;
    this._startOnMove = startOnMove;
    this._measurement = measurement;
    this.listenToMeasurementChanges();
    this._enabled = enabled;
    this._minSegments = minSegments;
    this._maxSegments = maxSegments;
  }

  onActivate(map: Map) {
    super.onActivate(map);
    this._worldToModel = this.createWorldToModelTransformation(map);
    this.startMeasurement();
  }

  /**
   * Creates a transformation from the map reference to the reference where measurements happens.
   * @param map The map on which measurements happens.
   * @protected
   */
  protected createWorldToModelTransformation(map : Map) {
    return createTransformation(map.reference, MEASUREMENTS_MODEL_REFERENCE);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    if (this._enabled !== enabled) {
      this._enabled = enabled;
      this._eventedSupport.emit(ENABLED_CHANGE_EVENT, enabled);
    }
  }

  get measurement(): Measurement<S> {
    return this._measurement;
  }

  set measurement(value: Measurement<S>) {
    this._measurement = value;
    this.invalidate();
    this.listenToMeasurementChanges();
  }

  get projector(): MeasurementProjector | undefined {
    return this._projector;
  }

  protected get measurementStyles(): MeasurementPaintStyles {
    return this._measurementStyles
  }

  get finished(): boolean {
    return this._finished;
  }

  //#snippet gesture
  /**
   * Handle the user input gestures. The event-object contains information about the type of user-interaction
   */
  onGestureEvent(gestureEvent: GestureEvent): HandleEventResult {
    if (!this._enabled) {
      return EVENT_IGNORED;
    }
    if (this._projector && !this._projector?.ready) {
      const result = this._projector.handleEventForInitialization(gestureEvent);
      if (result === HandleEventResult.EVENT_HANDLED) {
        this.invalidate();
      }
      return result;
    } else if (gestureEvent.type === GestureEventType.SINGLE_CLICK_UP) {
      return this.handleClick(gestureEvent);
    } else if (gestureEvent.type === GestureEventType.MOVE) {
      return this.handleMove(gestureEvent);
    } else if (gestureEvent.type === GestureEventType.DOUBLE_CLICK) {
      return this.handleDoubleClick();
    } else {
      return HandleEventResult.EVENT_IGNORED;
    }
  }

  //#endsnippet gesture

  private handleClick(gestureEvent: GestureEvent) {
    if (this._finished) {
      this._measurement.reset();
      this.startMeasurement();
    }
    const maxPointCount = this._startOnMove ? this._maxSegments + 1 : this._maxSegments;
    if (this._measurement.pointCount >= maxPointCount) {
      this.finishMeasurement();
    } else {
      const modelPoint = this.toModelPoint(gestureEvent);
      if (modelPoint) {
        this._measurement.addPoint(modelPoint);
      }
    }
    return HandleEventResult.EVENT_HANDLED
  }

  private handleMove(gestureEvent: GestureEvent) {
    if (this._finished && this._startOnMove && this._measurement.pointCount === 0) {
      this.startMeasurement();
    }
    const modelPoint = this.toModelPoint(gestureEvent);
    const minPointsAtMove = this._startOnMove ? 0 : 1;
    if (this._measurement.pointCount >= minPointsAtMove && !this._finished && modelPoint) {
      if (this._measurement.pointCount === minPointsAtMove) {
        this._measurement.addPoint(modelPoint);
      }

      this._measurement.move3DPoint(this._measurement.pointCount - 1, modelPoint);
      return HandleEventResult.EVENT_HANDLED
    } else {
      return HandleEventResult.EVENT_IGNORED;
    }
  }

  private handleDoubleClick() {
    if (this._finished) {
      return HandleEventResult.EVENT_IGNORED;
    }
    //remove the point that was created because of the first click of this double_click event
    this._measurement.removePoint(this._measurement.pointCount - 1);
    this.finishMeasurement();
    return HandleEventResult.EVENT_HANDLED
  }

  protected finishMeasurement() {
    if (!this._finished && this._measurement.pointCount > this._minSegments) {
      this._finished = true;
      this._eventedSupport.emit(MEASUREMENT_FINISHED_EVENT, this._measurement);
    }
  }

  protected startMeasurement() {
    if (this._finished) {
      this._finished = false;
      this._eventedSupport.emit(MEASUREMENT_STARTED_EVENT, this._measurement);
    }
  }

  protected toModelPoint(gestureEvent: GestureEvent): Point | null {
    try {
      let modelPoint;
      if (this._projector) {
        modelPoint = this._projector.project(gestureEvent.viewPoint);
      } else {
        modelPoint = this.viewToModel(gestureEvent.viewPoint);
      }
      return modelPoint;
    } catch (e) {
      if (e instanceof OutOfBoundsError) {
        return null;
      } else {
        throw e;
      }
    }
  }

  /**
   * Transform a point from the view to the reference where measurements happens.
   * If no point is found, throws OutOfBoundError.
   * @param viewPoint Point on the view, in pixel coordinates.
   * @protected
   */
  protected viewToModel(viewPoint: Point) : Point {
    return this._worldToModel!.transform(
        this.map!.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE).transform(viewPoint));
  }

  private listenToMeasurementChanges() {
    if (this._measurementHandle) {
      this._measurementHandle.remove();
    }
    this._measurementHandle = this.measurement.on(MEASUREMENT_CHANGED_EVENT, () => this.invalidate());
  }

  onDraw(geoCanvas: GeoCanvas) {
    this._measurement.paintBody(geoCanvas, this._measurementStyles);
    if (this._projector) {
      this._projector.paintProjection(geoCanvas);
    }
  }

  onDrawLabel(labelCanvas: LabelCanvas) {
    this._measurement.paintLabel(labelCanvas, this._measurementStyles);
  }

  on(event: string, callback: any): Handle {
    if (event === MEASUREMENT_FINISHED_EVENT || event === ENABLED_CHANGE_EVENT || event === MEASUREMENT_STARTED_EVENT) {
      return this._eventedSupport.on(event, callback);
    }
    //@ts-ignore
    return super.on(event, callback);
  }
}