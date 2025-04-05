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
import {Point} from "@luciad/ria/shape/Point.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {createPolygon} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {createCartesianGeodesy, createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";

export const MEASUREMENT_CHANGED_EVENT = "MeasurementChangedEvent";

export const MEASUREMENTS_MODEL_REFERENCE = getReference("CRS:84");
export const GEODESIC_GEODESY = createEllipsoidalGeodesy(getReference("CRS:84"));
export const CARTESIAN_GEODESY = createCartesianGeodesy(getReference("EPSG:4978"));

export interface MeasurementPaintStyles {
  pointStyles: IconStyle[];
  mainLineStyles: ShapeStyle[];
  helperLineStyles: ShapeStyle[];
  areaStyles: ShapeStyle[];
  mainLabelHtmlStyle: string;
  helperLabelHtmlStyle: string;
}

export interface MeasurementSegment {
  line: Polyline;
  distance: number;
  p1: Point;
  p2: Point;
}

export abstract class Measurement<S extends MeasurementSegment = MeasurementSegment, T = {}> {
  private readonly _eventedSupport: EventedSupport;
  protected _type: string;
  private _points: Point[] = [];
  private _segments: S[] = [];
  private _totalInfo: T;

  protected constructor(type: string) {
    this._eventedSupport = new EventedSupport([MEASUREMENT_CHANGED_EVENT], true);
    this._type = type;
    this._totalInfo = this.calculateTotalInfo();
  }

  protected get segments(): S[] {
    return this._segments;
  }

  protected get points(): Point[] {
    return this._points;
  }

  get type(): string {
    return this._type;
  }

  get totalInfo(): T {
    return this._totalInfo;
  }

  get pointCount(): number {
    return this._points.length;
  }

  get focusPoint(): Point {
    return this.bounds.focusPoint;
  }

  get bounds(): Bounds {
    return createPolygon(MEASUREMENTS_MODEL_REFERENCE, this._points).bounds!;
  }

  addPoint(point: Point): void {
    if (!point.reference) {
      throw new Error("Can not add measurement point if the point has no ")
    }

    const newPoint = MEASUREMENTS_MODEL_REFERENCE.equals(point.reference)
                     ? point
                     : createTransformation(point.reference, MEASUREMENTS_MODEL_REFERENCE).transform(point);

    this._points.push(newPoint);
    if (this._points.length > 1) {
      const p1 = this._points[this._points.length - 2];
      this._segments.push(this.createSegment(p1, newPoint));
    }
    this._totalInfo = this.calculateTotalInfo();
    this._eventedSupport.emit(MEASUREMENT_CHANGED_EVENT);
  }

  removePoint(index: number): void {
    const {segmentToPoint, segmentFromPoint} = this.getSegmentsAroundPoint(index);

    if (segmentToPoint && segmentFromPoint) {
      this._segments.splice(index, 1);
      segmentToPoint.p2 = segmentFromPoint.p2;
      this.recomputeSegment(segmentToPoint)
    } else if (segmentToPoint) {
      this._segments.splice(index - 1, 1);
    } else if (segmentFromPoint) {
      this._segments.splice(index, 1);
    }
    this._points.splice(index, 1);
    this._totalInfo = this.calculateTotalInfo();
    this._eventedSupport.emit(MEASUREMENT_CHANGED_EVENT);
  }

  move3DPoint(index: number, moveToPoint: Point): void {
    this._points[index].move3DToPoint(moveToPoint);
    const {segmentToPoint, segmentFromPoint} = this.getSegmentsAroundPoint(index);
    if (segmentToPoint) {
      this.recomputeSegment(segmentToPoint);
    }
    if (segmentFromPoint) {
      this.recomputeSegment(segmentFromPoint);
    }
    this._totalInfo = this.calculateTotalInfo();
    this._eventedSupport.emit(MEASUREMENT_CHANGED_EVENT);
  }

  private getSegmentsAroundPoint(index: number) {
    return {
      segmentToPoint: index > 0 ? this._segments[index - 1] : null,
      segmentFromPoint: index < this.pointCount ? this._segments[index] : null,
    }
  }

  getPointListCopy(): Point[] {
    return this._points.map((p) => p.copy());
  }

  reset(): void {
    this._points = [];
    this._segments = [];
    this._totalInfo = this.calculateTotalInfo();
    this._eventedSupport.emit(MEASUREMENT_CHANGED_EVENT);
  }

  on(event: typeof MEASUREMENT_CHANGED_EVENT, callback: () => void) {
    return this._eventedSupport.on(event, callback);
  }

  protected recomputeSegmentLine(segment: S): void {
    segment.line.move3DPoint(0, segment.p1.x, segment.p1.y, segment.p1.z);
    segment.line.move3DPoint(1, segment.p2.x, segment.p2.y, segment.p2.z);
  }

  protected abstract createSegment(p1: Point, p2: Point): S;

  protected abstract recomputeSegment(segment: S): void;

  protected abstract calculateTotalInfo(): T;

  abstract paintBody(geoCanvas: GeoCanvas, paintStyles: MeasurementPaintStyles): void;

  abstract paintLabel(labelCanvas: LabelCanvas, paintStyles: MeasurementPaintStyles): void;

  abstract getFormattedTotalInfo(): { label: string, value: string }[];

}
