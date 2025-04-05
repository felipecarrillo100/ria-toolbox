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
import {createCartesianReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createBounds, createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";
import {Evented, Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {PinchEvent} from "@luciad/ria/view/input/PinchEvent.js";
import {ScrollEvent} from "@luciad/ria/view/input/ScrollEvent.js";
import {Map} from "@luciad/ria/view/Map.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {DefaultController} from "@luciad/ria/view/controller/DefaultController.js";

const REFERENCE = createCartesianReference({
  xUnitOfMeasure: getUnitOfMeasure("Second"),
  yUnitOfMeasure: getUnitOfMeasure("Number")
});

function pad(str: number | string, max: number): string {
  const result = str.toString();
  return result.length < max ? pad(`0${result}`, max) : result;
}

/**
 * This component shows a timeline with labels, backed by a RIA map
 * <p>
 *   It has a LuciadRIA non-georeferenced Map ({@link #map}) where X is time and Y is an unspecified number.
 * </p>
 * <p>
 *   It adds navigation constraints so that you can only pan horizontally,
 *   and not navigate beyond the currently set time range.
 * </p>
 * <p>
 *   The replay speed is dependent on the zoom level of the timeline.
 * </p>
 * <p>
 * Notes:
 * <ul>
 *   <li>
 *     It has a LuciadRIA Map, so you can add layers to it.
 *     The geometry (either in the model, or submitted through a ShapeProvider, or submitted directly on the GeoCanvas GeoCanvas)
 *     should be in the {@link TIME_LINE_REFERENCE time reference}.
 *   </li>
 *   <li>Change currentTime to programmatically move the timeline.</li>
 *   <li>Read {@link #currentTime} and {@link Evented#on "CurrentTimeChange" events} to listen to time changes.</li>
 *   <li>Use {@link #setValidRange} to set the valid time and Y range.  Navigation will be constrained to that range.</li>
 *   <li>Use {@link #map.getMapBounds} to get the time and Y extent currently visible on the view. As a timeline does not have
 *   <code>map.wrapAroundWorld</code> enabled, the resulting array of bounds will always contain a single element.
 *   </li>
 * </ul>
 * </p>
 */
export class Timeline implements Evented {
  private _map: WebGLMap | Map;
  private _mapChangeHandle: Handle | null;
  private _eventedSupport: EventedSupport;
  private _startTime: number;
  private _endTime: number;

  private _playing: boolean;
  private _frame: number | null;

  constructor(domNode: HTMLElement, startTime: number, endTime: number, webgl: boolean, autoAdjustDisplayScale: boolean) {
    this._playing = false;
    this._frame = null;
    const height = domNode.clientHeight;
    this._eventedSupport = new EventedSupport(["CurrentTimeChange", "PlayingChange"]);
    const MapClass = webgl ? WebGLMap : Map;
    this._map = new MapClass(domNode, {
      reference: REFERENCE,
      border: {
        bottom: 20
      },
      autoAdjustDisplayScale: autoAdjustDisplayScale,
      axes: {
        xAxis: {
          axisLineStyle: {
            color: "rgba(176, 179, 50, 1.0)",
            width: 0
          },
          gridLine: true,
          labelFormatter: (timestampInSeconds: number): string => {
            const date = new Date(timestampInSeconds * 1000);
            const mapBoundsArr = this._map.getMapBounds();
            if (mapBoundsArr.length !== 1) {
              return "";
            }
            const visibleTimeRange = mapBoundsArr[0].width;
            if (visibleTimeRange > 5 * 365 * 24 * 60 * 60) {
              return date.getFullYear().toString();
            }
            if (visibleTimeRange > 0.5 * 365 * 24 * 60 * 60) {
              return `${pad(date.getMonth() + 1, 2)}/${date.getFullYear()}`;
            }
            if (visibleTimeRange > 5 * 31 * 24 * 60 * 60) {
              return `${pad(date.getDate(), 2)}/${pad(date.getMonth() + 1, 2)}/${date.getFullYear()}`;
            }
            if (visibleTimeRange > 7 * 24 * 60 * 60) {
              return `${pad(date.getDate(), 2)}/${pad(date.getMonth() + 1, 2)}`;
            }
            return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`;
          },
          labelRotation: 0,
          labelStyle: {
            alignmentBaseline: "middle",
            textAnchor: "center",
            offsetY: 10,
            angle: 0,
            fill: "rgba(255, 255, 255, 1.0)",
            font: "15px Tahoma, Arial, sans-serif",
            haloWidth: 0,
            strokeWidth: 0
          },
          spacing: {
            minimumTickSpacing: 60,
            mapSpacing: [1,
                         60,
                         5 * 60,
                         10 * 60,
                         30 * 60,
                         60 * 60,
                         4 * 60 * 60,
                         8 * 60 * 60,
                         24 * 60 * 60,
                         3 * 24 * 60 * 60,
                         7 * 24 * 60 * 60,
                         14 * 24 * 60 * 60,
                         31 * 24 * 60 * 60,
                         3 * 31 * 24 * 60 * 60,
                         6 * 31 * 24 * 60 * 60,
                         365 * 24 * 60 * 60,
                         5 * 365 * 24 * 60 * 60,
                         10 * 365 * 24 * 60 * 60
            ] //space on seconds, 5min, 10min, 30min..
          },
          subTickLength: height / 2,
          subTicks: 0,
          tickLineStyle: {
            color: "rgba(0, 0, 0, 0)",
            width: 0
          }
        }
      }
    });

    //custom controller that does not manipulate y-scale when zooming and also does not pan in the y-direction
    this._map.defaultController = new DefaultController({
      navigateController: new TimeSeriesController()
    });

    this._startTime = startTime;
    this._endTime = endTime;
    this.currentTime = (endTime - startTime) / 2;
    this.setValidRange(startTime, endTime, 0, 0);
    this.fitToTimeRange(startTime, endTime);

    this._mapChangeHandle = this._map.on("MapChange", () => {
      this._eventedSupport.emit("CurrentTimeChange", this.currentTime, this.visibleMinTime, this.visibleMaxTime);
    });
  }

  get map(): Map | WebGLMap {
    return this._map;
  }

  destroy(): void {
    if (this._mapChangeHandle) {
      this._mapChangeHandle.remove();
    }
    if (this._map) {
      this._map.destroy();
    }
  }

  /**
   * Navigate the view so that the given absolute time (in seconds) is in the center of the timeline.
   */
  set currentTime(timeInSeconds: number) {
    const worldPoint = createPoint(this._map.reference, [timeInSeconds, 0]);
    this._map.mapNavigator.pan({
      targetLocation: worldPoint
    });
  };

  /**
   * Get the time that is currently in the center of the timeline.
   * <p/>
   * Use {@link #on "CurrentTimeChange" events} to get notified of changes.
   */
  get currentTime(): number {
    const centerViewPoint = createPoint(null, [this._map.viewSize[0] / 2, this._map.viewSize[1] / 2]);
    return this._map.viewToMapTransformation.transform(centerViewPoint).x;
  };

  /**
   * Get the time that is currently at the start of the timeline.
   * <p/>
   * Use {@link #on "CurrentTimeChange" events} to get notified of changes.
   */
  get visibleMinTime(): number {
    const leftViewPoint = createPoint(null, [0, this._map.viewSize[1] / 2]);
    return this._map.viewToMapTransformation.transform(leftViewPoint).x;
  };

  /**
   * Get the time that is currently at the end of the timeline.
   * <p/>
   * Use {@link #on "CurrentTimeChange" events} to get notified of changes.
   */
  get visibleMaxTime(): number {
    const rightViewPoint = createPoint(null, [this._map.viewSize[0], this._map.viewSize[1] / 2]);
    return this._map.viewToMapTransformation.transform(rightViewPoint).x;
  };

  /**
   * Set the valid time and Y range.
   * <p/>
   * Navigation will be constrained to these ranges.
   * The timeline will fit on the time range.
   */
  setValidRange(startTime: number, endTime: number, yMin: number, yMax: number): void {
    const timeRange = endTime - startTime;
    this._map.mapNavigator.constraints.limitBounds!.bounds = createBounds(REFERENCE,
        [startTime - timeRange, 3 * timeRange, yMin, yMax - yMin]);
    const fitBounds = createBounds(REFERENCE, [startTime, timeRange, yMin, yMax - yMin]);
    this._map.mapNavigator.fit({
      bounds: fitBounds,
      animate: false,
      fitMargin: "0px",
      allowWarpXYAxis: true
    });
  };

  /**
   * Animated fit on a time range.
   */
  fitToTimeRange(startTime: number, endTime: number): Promise<void> {
    const mapBoundsArr = this._map.getMapBounds();
    if (mapBoundsArr.length !== 1) {
      return Promise.reject();
    }
    const mapBounds = mapBoundsArr[0];
    const bounds = createBounds(REFERENCE,
        [startTime, endTime - startTime, mapBounds.y, mapBounds.height]);
    return this._map.mapNavigator.fit({
      bounds,
      animate: true,
      fitMargin: "0px",
      allowWarpXYAxis: true
    });
  };

  play() {
    if (!this._playing) {
      this._playing = true;
      this._frame = window.requestAnimationFrame(() => this.playStep());
      this._eventedSupport.emit("PlayingChange", true);
    }
  }

  pause() {
    if (this._playing) {
      this._playing = false;
      if (this._frame !== null) {
        window.cancelAnimationFrame(this._frame);
      }
      this._frame = null;
      this._eventedSupport.emit("PlayingChange", false);
    }
  }

  get playing(): boolean {
    return this._playing;
  }

  private playStep() {
    const mapBoundsArr = this._map.getMapBounds();
    if (mapBoundsArr.length === 1) {
      const mapBounds = mapBoundsArr[0];
      const newTime = this.currentTime + (mapBounds.width / 3000);
      this.currentTime = newTime >= this._endTime ? this._startTime : newTime;
    }
    this._frame = window.requestAnimationFrame(() => this.playStep());
  }

  on(event: "PlayingChange", callback: (playing: boolean) => void): Handle;
  on(event: "CurrentTimeChange",
     callback: (currentTime: number, visibleMinTime: number, visibleMaxTime: number) => void): Handle;
  on(event: "PlayingChange" | "CurrentTimeChange", callback: (...args: any[]) => void): Handle {
    return this._eventedSupport.on(event, callback);
  }
}

/**
 * The world reference of the timeline map: X-axis is time in seconds, Y-axis is a non-specified number.
 */
export const TIME_LINE_REFERENCE = REFERENCE;

/**
 * Custom controller that:
 *  - only zooms in the x-direction
 *  - only pans in the x-direction
 *  - does not rotate
 * Useful for 1-dimensional Maps (such as Timelines)
 */
class TimeSeriesController extends Controller {

  private _previousViewPoint: Point | null;

  constructor() {
    super();
    this._previousViewPoint = null;
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    const type = event.type;
    const viewPoint = createPoint(null, [event.viewPosition[0], 0 /* ignore Y */]);

    if (type === GestureEventType.SCROLL) {
      // zoom on mousewheel: scrolling upwards => amount > 0 => zoom in
      const factor = ((event as ScrollEvent).amount > 0) ? 2.0 : 0.5;
      this.map!.mapNavigator.zoom({
        factor: {
          x: factor,
          y: 1
        },
        location: viewPoint,
        animate: {
          duration: 250
        }
      });
      return EVENT_HANDLED;

    } else if (type === GestureEventType.DOUBLE_CLICK) {
      // zoom on double-click
      this.map!.mapNavigator.zoom({
        factor: {
          x: 2,
          y: 1
        },
        location: viewPoint,
        animate: {
          duration: 250
        }
      });
      return EVENT_HANDLED;

    } else if (type === GestureEventType.PINCH) {
      // zoom on pinch: pinch events come with a scaleFactor
      const scaleFactor = (event as PinchEvent).scaleFactor;
      if (scaleFactor > 0 && !isNaN(scaleFactor) &&
          !(scaleFactor === Number.POSITIVE_INFINITY || scaleFactor === Number.NEGATIVE_INFINITY)) {
        this.map!.mapNavigator.zoom({
          targetScale: {
            x: scaleFactor * this.map!.mapScale[0],
            y: this.map!.mapScale[1]
          },
          location: viewPoint
        });
      }
      return EVENT_HANDLED;

    } else if (type === GestureEventType.DRAG) {
      if (this._previousViewPoint) {
        this.map!.mapNavigator.pan({
          targetLocation: this._previousViewPoint,
          toViewLocation: viewPoint
        });
      }
      this._previousViewPoint = viewPoint;
      return EVENT_HANDLED;

    } else if (type === GestureEventType.DRAG_END) {
      this._previousViewPoint = null;
    }
    return EVENT_IGNORED;
  };
}
