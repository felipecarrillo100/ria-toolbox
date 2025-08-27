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

export const MILLISECOND = 0.001;
export const SECOND = 1;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const YEAR = 365.2425 * DAY;
export const MONTH = YEAR / 12;

const LOCALE = "en-US";

const MAX_PIXEL_PER_SUB_TICK = 30;

const AXIS_COLOR = "rgba(176, 179, 50, 1.0)";

const LABEL_COLOR = "rgba(255, 255, 255, 1.0)";
const SUB_TICK_LABEL_COLOR = "rgba(213,213,213,0.8)";

const TICK_LINE_COLOR = "rgb(255,255,255)";
const SUB_TICK_LINE_COLOR = AXIS_COLOR;

const timeZone = "UTC";

type DateFormater = {
  longFormater: (date: Date) => string,
  shortFormatter: (date: Date) => string,
}

/**
 * Defines the string representation of time values.
 */
const ticksSpacingConfiguration :  Record<"millisecond" | "second" | "minute" | "hour" | "day" | "month" | "year", DateFormater> = {
  millisecond: {
    longFormater: (_date: Date) => "",
    shortFormatter: (date: Date) => `.${(date.getMilliseconds())}`,
  },
  second: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, {hour: "numeric" , hour12: false, minute: "numeric", second:"numeric", timeZone})}`,
    shortFormatter: (date: Date) => `${date.toLocaleString(LOCALE, {second:"numeric", timeZone})}"`,
  },
  minute: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, {hour: "numeric" , hour12: false, minute: "numeric", timeZone})}`,
    shortFormatter: (date: Date) => `${date.toLocaleString(LOCALE, {minute: "numeric", timeZone})}'`,
  },
  hour: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, {hour: "numeric" , hour12: false, timeZone})}`,
    shortFormatter: (date: Date) => `${Number.parseInt(date.toLocaleString(LOCALE, {hour: "numeric" , hour12: false, timeZone}))}h`,
  },
  day: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, {month: 'short', day: 'numeric', timeZone})}`,
    shortFormatter: (date: Date) => `${date.toLocaleString(LOCALE, {day: 'numeric', timeZone})}th`,
  },
  month: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, { month: 'long' })}`,
    shortFormatter: (date: Date) => `${date.toLocaleString(LOCALE, { month: 'short'})}`,
  },
  year: {
    longFormater: (date: Date) => `${date.toLocaleString(LOCALE, { year: 'numeric'})}`,
    shortFormatter: (date: Date) => `${date.toLocaleString(LOCALE, { year: 'numeric'})}`,
  }
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
    const tickLength = 50;
    const subTickLength = 10;

    this._eventedSupport = new EventedSupport(["CurrentTimeChange", "PlayingChange"]);
    const MapClass = webgl ? WebGLMap : Map;
    this._map = new MapClass(domNode, {
      reference: REFERENCE,
      border: {
        bottom: 50
      },
      autoAdjustDisplayScale: autoAdjustDisplayScale,
      axes: {
        xAxis: {
          axisLineStyle: {
            color: AXIS_COLOR,
            width: 0
          },
          gridLine: false,
          labelFormatter: (timestampInSeconds: number): string => {
            const date = new Date(timestampInSeconds * 1000);
            const mapBoundsArr = this._map.getMapBounds();
            if (mapBoundsArr.length !== 1) {
              return "";
            }
            const visibleTimeRange = mapBoundsArr[0].width;
            if (visibleTimeRange >= YEAR) {
              const roundDate = new Date(date.getTime() + DAY * 1000);
              return ticksSpacingConfiguration.year.longFormater(roundDate);
            }
            if (visibleTimeRange >= MONTH) {
              // If we are near the end of the month, we want to display the next month.
              if (date.getDate() > 25) {
                date.setMonth(date.getMonth()+1, 1);
              }
              return ticksSpacingConfiguration.month.longFormater(date);
            }
            if (visibleTimeRange >= DAY) {
              return ticksSpacingConfiguration.day.longFormater(date);
            }
            if (visibleTimeRange >= MINUTE) {
              return ticksSpacingConfiguration.minute.longFormater(date);
            }
            return ticksSpacingConfiguration.second.longFormater(date);
          },
          subTickLabelFormatter: (timestampInSeconds: number, spacing: number): string => {
            const date = new Date(timestampInSeconds * 1000);
            const mapBoundsArr = this._map.getMapBounds();
            if (mapBoundsArr.length !== 1) {
              return "";
            }

            // For the labels bigger than a month, if we are near the end of the month, we want to round the date up to the next month.
            if (spacing > MONTH && date.getDate() >= 10) {
              date.setMonth(date.getMonth() + 1, 1);
            }

            switch (spacing) {
            case SECOND:
              return ticksSpacingConfiguration.millisecond.shortFormatter(date);
            case MINUTE:
              return ticksSpacingConfiguration.second.shortFormatter(date);
            case HOUR:
              return ticksSpacingConfiguration.minute.shortFormatter(date);
            case DAY:
              return ticksSpacingConfiguration.hour.shortFormatter(date);
            case MONTH:
              return ticksSpacingConfiguration.day.shortFormatter(date);
            case YEAR:
              return ticksSpacingConfiguration.month.shortFormatter(date);
            case 5 * YEAR:
              return ticksSpacingConfiguration.year.shortFormatter(date);
            default:
              return "";
            }

          },
          labelRotation: 0,
          labelStyle: {
            alignmentBaseline: "bottom",
            textAnchor: "left",
            offsetX: 12,
            offsetY: tickLength,
            angle: 0,
            fill: LABEL_COLOR,
            font: "18px Tahoma, Arial, sans-serif",
            haloWidth: 0,
            strokeWidth: 0
          },
          subTickLabelStyle: {
            alignmentBaseline: "top",
            textAnchor: "center",
            offsetY: subTickLength,
            angle: 0,
            fill: SUB_TICK_LABEL_COLOR,
            font: "15px Tahoma, Arial, sans-serif",
            haloWidth: 0,
            strokeWidth: 0
          },
          spacing: {
            minimumTickSpacing: 120,
            mapSpacing: [10 * MILLISECOND,
                         SECOND,
                         MINUTE,
                         HOUR,
                         DAY,
                         MONTH,
                         YEAR,
                         5 * YEAR,
                         10 * YEAR
            ]
          },
          tickLength: tickLength,
          subTickLength: subTickLength,
          subTicks: (mapSpacing: number, pixelSpacing: number) => {
            let numberOfSubTicks = 1;
            if (mapSpacing <= 1) {
              numberOfSubTicks = 100;
            } else if (mapSpacing <= HOUR) {
                numberOfSubTicks = 60;
            } else if (mapSpacing <= DAY) {
              numberOfSubTicks =  24;
            } else if (mapSpacing <= MONTH) {
              numberOfSubTicks =  30;
            } else if (mapSpacing <= YEAR) {
              numberOfSubTicks =  12;
            } else if (mapSpacing <= 5 * YEAR) {
              numberOfSubTicks =  5;
            } else if (mapSpacing <= 10 * YEAR) {
              numberOfSubTicks =  10;
            }

            // In case the sub-ticks are too close to each other, we reduce the number of sub-ticks
            const maxNumberOfSubTicks = pixelSpacing / MAX_PIXEL_PER_SUB_TICK;
            while (numberOfSubTicks > maxNumberOfSubTicks) {
              numberOfSubTicks /= 2;
            }

            return Math.ceil(numberOfSubTicks - 1);
          },
          tickLineStyle: {
            color: TICK_LINE_COLOR,
            width: 4
          },
          subTickLineStyle: {
            color: SUB_TICK_LINE_COLOR,
            width: 2
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
