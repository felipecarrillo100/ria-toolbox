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
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {createPoint, createPolygon, createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeList} from "@luciad/ria/shape/ShapeList.js";
import {createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";

export const CROSS_SECTION_MODEL_REFERENCE = getReference("CRS:84");
export const CROSS_SECTION_GEODESY = createEllipsoidalGeodesy(CROSS_SECTION_MODEL_REFERENCE);
export const GRID_SEGMENT_SIZE = 10; //in meters

/**
 * Class that represents the cross-section plane, defined by its anchor point and azimuth.
 */
export class CrossSectionPlane {
  private _anchorPoint: Point; //point used to position the plane
  private _gridAnchorPoint: Point; //point used to define the plane's grid
  private _azimuth: number;

  private _plane: Polygon | null;
  private _grid: ShapeList | null;
  private _gridOffset: [number, number];
  private _handleTop: Point | null;

  private _width: number;
  private _height: number;

  constructor() {
    this._anchorPoint = createPoint(CROSS_SECTION_MODEL_REFERENCE, [0, 0, 0]);
    this._gridAnchorPoint = this._anchorPoint;
    this._azimuth = 0;

    this._plane = null;
    this._grid = null;
    this._gridOffset = [0, 0];
    this._handleTop = null;
    this._width = 0;
    this._height = 0;
  }

  get grid(): ShapeList | null {
    return this._grid;
  }

  get plane(): Polygon | null {
    return this._plane;
  }

  get handleTop(): Point | null {
    return this._handleTop;
  }

  get height(): number {
    return this._height;
  }

  get width(): number {
    return this._width;
  }

  /**
   * Distance of respectively the first horizontal and vertical grid lines to the plane's grid anchor point.
   * This can be used to find out how the grid is currently positioned relative to the plane borders.
   */
  get gridOffset(): [number, number] {
    return this._gridOffset;
  }

  /**
   * Sets the anchorPoint of this plane to the given point and translates the grid together with the plane if required.
   * When moving the plane in another direction than its own greater plane, you should always translate the grid.
   */
  updateAnchorPoint(newAnchor: Point, translateGrid: boolean) {
    if (!CROSS_SECTION_MODEL_REFERENCE.equals(newAnchor.reference)) {
      throw new Error(`AnchorPoint should always have a ${CROSS_SECTION_MODEL_REFERENCE.identifier} reference`)
    }

    if (translateGrid) {
      const newAnchorAtSameHeight = newAnchor.copy();
      newAnchorAtSameHeight.z = this._anchorPoint.z;
      const forwardAzimuth = CROSS_SECTION_GEODESY.forwardAzimuth(this._anchorPoint, newAnchorAtSameHeight);
      const horizontalDistance = CROSS_SECTION_GEODESY.distance(this._anchorPoint, newAnchorAtSameHeight);
      const verticalDistance = newAnchor.z - this._anchorPoint.z;
      this._gridAnchorPoint = CROSS_SECTION_GEODESY.interpolate(this._gridAnchorPoint, horizontalDistance,
          forwardAzimuth);
      this._gridAnchorPoint.z += verticalDistance;
    }

    this._anchorPoint = newAnchor;
    this._handleTop = createPoint(CROSS_SECTION_MODEL_REFERENCE,
        [newAnchor.x, newAnchor.y, newAnchor.z + this._height / 2]);
    this.updatePlaneAndGrid();
  }

  get anchorPoint(): Point {
    return this._anchorPoint;
  }

  set azimuth(newAzimuth: number) {
    if (this._handleTop) {
      //rotate the grid's anchorpoint together with the plane so that the displayed grid doesn't change
      const handleAtSameHeight = this._handleTop.copy();
      handleAtSameHeight.z = this._gridAnchorPoint.z;
      const forwardAzimuth = CROSS_SECTION_GEODESY.forwardAzimuth(handleAtSameHeight, this._gridAnchorPoint);
      const newForwardAzimuth = forwardAzimuth + newAzimuth - this._azimuth;
      const horizontalDistance = CROSS_SECTION_GEODESY.distance(handleAtSameHeight, this._gridAnchorPoint);
      this._gridAnchorPoint = CROSS_SECTION_GEODESY.interpolate(handleAtSameHeight, horizontalDistance,
          newForwardAzimuth);
    }

    this._azimuth = newAzimuth;
    this.updatePlaneAndGrid();
  }

  get azimuth(): number {
    return this._azimuth;
  }

  /**
   * Update the width and height of this planet.
   */
  updateDimensions(width: number, height: number): void {
    this._width = width;
    this._height = height;

    const newTopHandle = this.anchorPoint.copy();
    newTopHandle.translate(0, 0, this._height / 2);
    this._handleTop?.move3D(newTopHandle);
    this.updatePlaneAndGrid();
  }

  private updatePlaneAndGrid() {
    if (!this._handleTop) {
      return;
    }

    const center = this._handleTop.copy();
    center.z = center.z - this._height / 2;
    const topRight = CROSS_SECTION_GEODESY.interpolate(this._handleTop, this._width / 2, this._azimuth + 90);
    const topLeft = CROSS_SECTION_GEODESY.interpolate(this._handleTop, -this._width / 2, this._azimuth + 90);
    const bottomRight = topRight.copy();
    bottomRight.z = bottomRight.z - this._height;
    const bottomLeft = topLeft.copy();
    bottomLeft.z = bottomLeft.z - this._height;

    this._plane = createPolygon(CROSS_SECTION_MODEL_REFERENCE, [topLeft, topRight, bottomRight, bottomLeft, topLeft]);
    this._grid = this.createGrid(bottomLeft, topRight);
  }

  private createGrid(bottomLeft: Point, topRight: Point) {
    const output = createShapeList(CROSS_SECTION_MODEL_REFERENCE, []);

    const minZ = this._gridAnchorPoint.z + Math.ceil((bottomLeft.z - this._gridAnchorPoint.z) / GRID_SEGMENT_SIZE) *
                 GRID_SEGMENT_SIZE;
    const maxZ = this._gridAnchorPoint.z + Math.floor((topRight.z - this._gridAnchorPoint.z) / GRID_SEGMENT_SIZE) *
                 GRID_SEGMENT_SIZE;

    for (let z = minZ; z <= maxZ; z += GRID_SEGMENT_SIZE) {
      const start = bottomLeft.copy();
      start.z = z;
      const end = topRight.copy();
      end.z = z;
      output.addShape(createLine(start, end));
    }

    const temp = bottomLeft.copy();
    temp.z = this._gridAnchorPoint.z;
    const horizontalDistance = CROSS_SECTION_GEODESY.distance(this._gridAnchorPoint, temp);
    //find out whether bottomLeft is before or behind the anchor, following the plane's azimuth
    const isBottomLeftForwardFromAnchor = (Math.abs(
                                              this._azimuth - (CROSS_SECTION_GEODESY.forwardAzimuth(this._gridAnchorPoint, bottomLeft) + 90)) + 90)
                                          % 360 > 180;
    const distanceToFirstVertical = isBottomLeftForwardFromAnchor ?
                                    GRID_SEGMENT_SIZE - horizontalDistance % GRID_SEGMENT_SIZE :
                                    horizontalDistance % GRID_SEGMENT_SIZE;
    temp.z = topRight.z;
    const width = CROSS_SECTION_GEODESY.distance(temp, topRight)
    const verticalLines = Math.floor((width - distanceToFirstVertical) / GRID_SEGMENT_SIZE);
    const lastDistance = distanceToFirstVertical + verticalLines * GRID_SEGMENT_SIZE

    for (let dist = distanceToFirstVertical; dist <= lastDistance; dist += GRID_SEGMENT_SIZE) {
      const start = CROSS_SECTION_GEODESY.interpolate(bottomLeft, dist, this._azimuth + 90);
      const end = start.copy();
      end.z = topRight.z;
      output.addShape(createLine(start, end));
    }

    this._gridOffset = [distanceToFirstVertical, minZ - bottomLeft.z];
    return output;
  }

}

function createLine(begin: Point, end: Point) {
  return createPolyline(CROSS_SECTION_MODEL_REFERENCE, [begin, end]);
}

