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
import {
  createArc,
  createExtrudedShape,
  createPoint,
  createPolygon,
  createPolyline,
  createShapeList
} from "@luciad/ria/shape/ShapeFactory.js";
import {createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {Axis} from "@luciad/ria/reference/Axis.js";
import {createScaleTransformation} from "@luciad/ria/transformation/Affine3DTransformation.js";
import {OrientedBox} from "@luciad/ria/shape/OrientedBox.js";
import {Geodesy} from "@luciad/ria/geodesy/Geodesy.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {ShapeList} from "@luciad/ria/shape/ShapeList.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {LineType} from "@luciad/ria/geodesy/LineType.js";
import {DEG2RAD, interpolate, RAD2DEG} from "./Math.js";

const EPSILON = 1e-4;
const LLH_REFERENCE = getReference("CRS:84");
const LLH_GEODESY = createEllipsoidalGeodesy(LLH_REFERENCE);

/**
 * Creates a shape that forms a horizontal arc with arrowheads on both sides
 */
export const createHorizontalArcArrow = (centerPoint: Point,
                                         radiusInMeters: number,
                                         startAzimuthDegrees: number,
                                         arcSizeDegrees: number,
                                         arrowHeadSizeMeters: number,
                                         geodesy: Geodesy = LLH_GEODESY): ShapeList => {
  if (centerPoint.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    centerPoint = createTransformation(centerPoint.reference!, LLH_REFERENCE).transform(centerPoint);
  }

  const centerPointWithoutHeight = centerPoint.copy();
  centerPointWithoutHeight.translate3D(0, 0, -centerPoint.z);
  const arrowShape = createExtrudedShape(centerPoint.reference, createArc(centerPoint.reference,
      centerPoint,
      radiusInMeters,
      radiusInMeters,
      0,
      startAzimuthDegrees,
      arcSizeDegrees), centerPoint.z, centerPoint.z);
  const arrowHeadPoints1 = [
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters - arrowHeadSizeMeters, startAzimuthDegrees),
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters + arrowHeadSizeMeters, startAzimuthDegrees),
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters, startAzimuthDegrees - 5)
  ];
  const arrowHead1 = createExtrudedShape(centerPoint.reference,
      createPolygon(centerPoint.reference!, arrowHeadPoints1),
      centerPoint.z, centerPoint.z);
  const arrowHeadPoints2 = [
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters - arrowHeadSizeMeters,
        startAzimuthDegrees + arcSizeDegrees),
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters + arrowHeadSizeMeters,
        startAzimuthDegrees + arcSizeDegrees),
    geodesy.interpolate(centerPointWithoutHeight, radiusInMeters, startAzimuthDegrees + arcSizeDegrees + 5)
  ];
  const arrowHead2 = createExtrudedShape(centerPoint.reference,
      createPolygon(centerPoint.reference!, arrowHeadPoints2),
      centerPoint.z, centerPoint.z);
  return createShapeList(centerPoint.reference, [arrowShape, arrowHead1, arrowHead2]);
};

/**
 * Creates a shape that forms a horizontal arc with barbed arrowheads on both sides
 */
export const createHorizontalBarbedArcArrow = (centerPoint: Point,
                                               radiusInMeters: number,
                                               startAzimuthDegrees: number,
                                               arcSizeDegrees: number,
                                               arrowHeadLengthInMeters: number,
                                               arrowLineWidthInMeters: number,
                                               segments = 20): ShapeList => {
  if (centerPoint.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    centerPoint = createTransformation(centerPoint.reference!, LLH_REFERENCE).transform(centerPoint);
  }

  const arrowHeadSize = calculateArrowHeadSize(arrowLineWidthInMeters);
  const arrowHeadArcSize = Math.atan(arrowHeadSize / radiusInMeters) * RAD2DEG;
  const outerLineCorners = [];
  const innerLineCorners = [];

  const azimuthStart = startAzimuthDegrees + arrowHeadArcSize;
  const azimuthEnd = startAzimuthDegrees + arcSizeDegrees - arrowHeadArcSize;
  for (let i = 0; i < segments + 1; i++) {
    const azimuth = interpolate(azimuthStart, azimuthEnd, i / segments);
    outerLineCorners.push(LLH_GEODESY.interpolate(centerPoint, radiusInMeters, azimuth));
    innerLineCorners.push(LLH_GEODESY.interpolate(centerPoint, radiusInMeters - arrowLineWidthInMeters, azimuth));
  }

  const endArrow = createHorizontalBarbedArrowHead(
      innerLineCorners[innerLineCorners.length - 1],
      outerLineCorners[innerLineCorners.length - 1],
      arrowHeadLengthInMeters,
      arrowLineWidthInMeters,
      LLH_GEODESY);

  const startArrow = createHorizontalBarbedArrowHead(
      outerLineCorners[0],
      innerLineCorners[0],
      arrowHeadLengthInMeters,
      arrowLineWidthInMeters,
      LLH_GEODESY);

  return createShapeList(centerPoint.reference,
      [createPolygon(centerPoint.reference!, [...outerLineCorners, ...innerLineCorners.reverse()]), endArrow,
       startArrow]);
};

/**
 * Creates a shape that forms a vertical line that with arrowheads on both sides
 */
export const createVerticalLineArrow = (bottomPoint: Point,
                                        height: number,
                                        arrowHeadSizeMeters: number,
                                        geodesy: Geodesy = createEllipsoidalGeodesy(
                                            bottomPoint.reference!)): ShapeList => {
  const bottomPointWithoutHeight = bottomPoint.copy();
  bottomPointWithoutHeight.translate3D(0, 0, -bottomPoint.z);
  const verticalLine = createPolyline(bottomPoint.reference, [
    createPoint(bottomPoint.reference, [bottomPoint.x, bottomPoint.y, bottomPoint.z]),
    createPoint(bottomPoint.reference, [bottomPoint.x, bottomPoint.y, bottomPoint.z + height])
  ]);
  const altitudeArrowHeadBasePoint1 = geodesy.interpolate(bottomPointWithoutHeight,
      arrowHeadSizeMeters, 270);
  const altitudeArrowHeadBasePoint2 = geodesy.interpolate(bottomPointWithoutHeight,
      arrowHeadSizeMeters, 90);
  const altitudeArrowHead1 = createPolygon(bottomPoint.reference!, [
    createPoint(bottomPoint.reference, [altitudeArrowHeadBasePoint1.x, altitudeArrowHeadBasePoint1.y, bottomPoint.z]),
    createPoint(bottomPoint.reference, [altitudeArrowHeadBasePoint2.x, altitudeArrowHeadBasePoint2.y, bottomPoint.z]),
    createPoint(bottomPoint.reference,
        [bottomPointWithoutHeight.x, bottomPointWithoutHeight.y, bottomPoint.z - arrowHeadSizeMeters * 2])
  ]);
  const altitudeArrowHead2 = createPolygon(bottomPoint.reference!, [
    createPoint(bottomPoint.reference,
        [altitudeArrowHeadBasePoint1.x, altitudeArrowHeadBasePoint1.y, bottomPoint.z + height]),
    createPoint(bottomPoint.reference,
        [altitudeArrowHeadBasePoint2.x, altitudeArrowHeadBasePoint2.y, bottomPoint.z + height]),
    createPoint(bottomPoint.reference,
        [bottomPointWithoutHeight.x, bottomPointWithoutHeight.y, bottomPoint.z + height + arrowHeadSizeMeters * 2])
  ]);
  return createShapeList(bottomPoint.reference, [verticalLine, altitudeArrowHead1, altitudeArrowHead2]);
};

/**
 * Creates a shape that forms a vertical line with barbed arrowheads on both sides
 */
export const createVerticalBarbedLineArrow = (bottomPoint: Point, height: number, azimuth: number,
                                              arrowHeadLengthInMeters: number, arrowLineWidthInMeters: number) => {
  if (bottomPoint.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    bottomPoint = createTransformation(bottomPoint.reference!, LLH_REFERENCE).transform(bottomPoint);
  }
  const arrowHeadSize = calculateArrowHeadSize(arrowLineWidthInMeters);
  const bottomLinePoint = bottomPoint.copy();
  bottomLinePoint.z += arrowHeadSize;
  const leftBottomPoint = LLH_GEODESY.interpolate(bottomLinePoint, arrowLineWidthInMeters / 2, azimuth + 90);
  const rightBottomPoint = LLH_GEODESY.interpolate(bottomLinePoint, arrowLineWidthInMeters / 2, azimuth - 90);
  const leftTopPoint = leftBottomPoint.copy();
  leftTopPoint.z += height - arrowHeadSize * 2;
  const rightTopPoint = rightBottomPoint.copy();
  rightTopPoint.z += height - arrowHeadSize * 2;

  const arrowLine = createPolygon(bottomPoint.reference!,
      [leftBottomPoint, leftTopPoint, rightTopPoint, rightBottomPoint]);
  const bottomArrowHead = createVerticalBarbedArrowHead(leftBottomPoint, rightBottomPoint, arrowHeadLengthInMeters,
      arrowLineWidthInMeters, false);
  const topArrowHead = createVerticalBarbedArrowHead(leftTopPoint, rightTopPoint, arrowHeadLengthInMeters,
      arrowLineWidthInMeters, true);

  return createShapeList(bottomPoint.reference,
      [arrowLine, bottomArrowHead, topArrowHead]);
}

/**
 * Creates a shape that forms a horizontal line with arrowheads on both sides
 */
export const createHorizontalLineArrow = (centerPoint: Point,
                                          distanceMeters: number,
                                          azimuthDirection: number,
                                          arrowHeadSizeMeters: number,
                                          geodesy: Geodesy = LLH_GEODESY): ShapeList => {
  if (centerPoint.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    centerPoint = createTransformation(centerPoint.reference!, LLH_REFERENCE).transform(centerPoint);
  }
  const horizontalLine = createPolyline(centerPoint.reference, [
    geodesy.interpolate(centerPoint, distanceMeters * 0.5, azimuthDirection),
    geodesy.interpolate(centerPoint, distanceMeters * 0.5, azimuthDirection + 180),
  ]);
  const arrowHead1 = createPolygon(centerPoint.reference!, [
    geodesy.interpolate(horizontalLine.getPoint(0), arrowHeadSizeMeters, azimuthDirection - 90),
    geodesy.interpolate(horizontalLine.getPoint(0), arrowHeadSizeMeters, azimuthDirection + 90),
    geodesy.interpolate(horizontalLine.getPoint(0), arrowHeadSizeMeters * 2, azimuthDirection)
  ]);
  const arrowHead2 = createPolygon(centerPoint.reference!, [
    geodesy.interpolate(horizontalLine.getPoint(1), arrowHeadSizeMeters, azimuthDirection + 90),
    geodesy.interpolate(horizontalLine.getPoint(1), arrowHeadSizeMeters, azimuthDirection - 90),
    geodesy.interpolate(horizontalLine.getPoint(1), arrowHeadSizeMeters * 2, azimuthDirection + 180)
  ]);
  return createShapeList(centerPoint.reference, [horizontalLine, arrowHead1, arrowHead2]);
};

/**
 * Creates a shape that forms a horizontal cross with barbed arrows on all four sides.
 */
export const createHorizontalBarbedCrossArrow = (centerPoint: Point,
                                                 radiusInMeters: number,
                                                 azimuth: number,
                                                 arrowHeadLengthInMeters: number,
                                                 arrowLineWidthInMeters: number): ShapeList => {
  if (centerPoint.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    centerPoint = createTransformation(centerPoint.reference!, LLH_REFERENCE).transform(centerPoint);
  }
  const arrowLineCorners = [];
  const arrowHeads = [] as Polygon[];
  const arrowLineLength = radiusInMeters - arrowLineWidthInMeters / 2 - calculateArrowHeadSize(arrowLineWidthInMeters)

  for (let i = 0; i < 4; i++) {
    const corner1 = LLH_GEODESY.interpolate(centerPoint,
        Math.sqrt(2 * arrowLineWidthInMeters * arrowLineWidthInMeters) / 2, azimuth + 45 - (90 * i));
    const corner2 = LLH_GEODESY.interpolate(corner1, arrowLineLength, azimuth - 90 * i);
    const corner3 = LLH_GEODESY.interpolate(corner2, arrowLineWidthInMeters, azimuth - 90 * (i + 1));
    arrowLineCorners.push(corner1, corner2, corner3);

    arrowHeads.push(
        createHorizontalBarbedArrowHead(corner2, corner3, arrowHeadLengthInMeters,
            arrowLineWidthInMeters));
  }
  return createShapeList(centerPoint.reference,
      [createPolygon(centerPoint.reference!, arrowLineCorners), ...arrowHeads]);
};

/**
 * Creates a horizontal barbed arrow head
 */
const createHorizontalBarbedArrowHead = (
    shaftPointRight: Point,
    shaftPointLeft: Point,
    barbLengthInMeters: number,
    barbWidthInMeters: number,
    geodesy: Geodesy = LLH_GEODESY) => {
  if (shaftPointRight.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    shaftPointRight = createTransformation(shaftPointRight.reference!, LLH_REFERENCE).transform(shaftPointRight);
  }
  if (shaftPointLeft.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    shaftPointLeft = createTransformation(shaftPointLeft.reference!, LLH_REFERENCE).transform(shaftPointLeft);
  }

  const azimuth = geodesy.forwardAzimuth(shaftPointRight, shaftPointLeft, LineType.CONSTANT_BEARING) + 90;
  const shaftLength = geodesy.distance(shaftPointLeft, shaftPointRight, LineType.CONSTANT_BEARING);
  const shaftCenter = geodesy.interpolate(shaftPointRight, shaftLength / 2, azimuth - 90);
  const barbLength = barbLengthInMeters - barbWidthInMeters - (shaftLength / 2) / Math.cos(45 * DEG2RAD);

  const arrowPoint = geodesy.interpolate(shaftCenter, calculateArrowHeadSize(barbWidthInMeters), azimuth);
  const arrowInnerCornerRight = geodesy.interpolate(shaftPointRight, barbLength, azimuth + 135);
  const arrowOuterCornerRight = geodesy.interpolate(arrowInnerCornerRight, barbWidthInMeters, azimuth + 45);
  const arrowInnerCornerLeft = geodesy.interpolate(shaftPointLeft, barbLength, azimuth - 135);
  const arrowOuterCornerLeft = geodesy.interpolate(arrowInnerCornerLeft, barbWidthInMeters, azimuth - 45);

  return createPolygon(arrowPoint.reference!, [
    arrowPoint,
    arrowOuterCornerRight,
    arrowInnerCornerRight,
    shaftPointRight,
    shaftPointLeft,
    arrowInnerCornerLeft,
    arrowOuterCornerLeft
  ]);

}

/**
 * Creates a vertical barbed arrow head
 */
const createVerticalBarbedArrowHead = (
    shaftPointRight: Point,
    shaftPointLeft: Point,
    barbLengthInMeters: number,
    barbWidthInMeters: number,
    isPointingUp: boolean,
    geodesy: Geodesy = LLH_GEODESY) => {
  if (shaftPointRight.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    shaftPointRight = createTransformation(shaftPointRight.reference!, LLH_REFERENCE).transform(shaftPointRight);
  }
  if (shaftPointLeft.reference?.referenceType === ReferenceType.GEOCENTRIC) {
    shaftPointLeft = createTransformation(shaftPointLeft.reference!, LLH_REFERENCE).transform(shaftPointLeft);
  }

  const azimuth = geodesy.forwardAzimuth(shaftPointRight, shaftPointLeft, LineType.CONSTANT_BEARING) + 90;
  const shaftLength = geodesy.distance(shaftPointLeft, shaftPointRight, LineType.CONSTANT_BEARING);
  const shaftCenter = geodesy.interpolate(shaftPointRight, shaftLength / 2, azimuth - 90);
  const barbLength = barbLengthInMeters - barbWidthInMeters - (shaftLength / 2) / Math.cos(45 * DEG2RAD);

  const arrowPoint = shaftCenter.copy();
  arrowPoint.z += (isPointingUp ? 1 : -1) * calculateArrowHeadSize(barbWidthInMeters);
  const arrowInnerCornerRight = geodesy.interpolate(shaftPointRight, Math.cos(45 * DEG2RAD) * barbLength, azimuth + 90);
  arrowInnerCornerRight.z += (isPointingUp ? -1 : 1) * Math.sin(45 * DEG2RAD) * barbLength;
  const arrowOuterCornerRight = geodesy.interpolate(arrowInnerCornerRight, Math.sin(45 * DEG2RAD) * barbWidthInMeters,
      azimuth + 90);
  arrowOuterCornerRight.z += (isPointingUp ? 1 : -1) * Math.cos(45 * DEG2RAD) * barbWidthInMeters;
  const arrowInnerCornerLeft = geodesy.interpolate(shaftPointLeft, Math.cos(45 * DEG2RAD) * barbLength, azimuth - 90);
  arrowInnerCornerLeft.z += (isPointingUp ? -1 : 1) * Math.sin(45 * DEG2RAD) * barbLength;
  const arrowOuterCornerLeft = geodesy.interpolate(arrowInnerCornerLeft, Math.sin(45 * DEG2RAD) * barbWidthInMeters,
      azimuth - 90);
  arrowOuterCornerLeft.z += (isPointingUp ? 1 : -1) * Math.cos(45 * DEG2RAD) * barbWidthInMeters;

  return createPolygon(arrowPoint.reference!, [
    arrowPoint,
    arrowOuterCornerRight,
    arrowInnerCornerRight,
    shaftPointRight,
    shaftPointLeft,
    arrowInnerCornerLeft,
    arrowOuterCornerLeft
  ]);

}

/**
 * Returns the distance from the top of the arrow with given barb width to its shaft,
 * assuming its shaft has the same width as the barbs.
 */
const calculateArrowHeadSize = (barbWidthInMeters: number) => {
  return Math.tan(45 * DEG2RAD) * (barbWidthInMeters / 2) + Math.sqrt(2 * Math.pow(barbWidthInMeters, 2));
}

/**
 * Creates a shape that contains only the ground-plane of an oriented box
 */
export const createGroundPlaneFromOrientedBox = (orientedBox: OrientedBox, transformation: Transformation,
                                                 targetReference: CoordinateReference): Polygon => {
  if (!orientedBox || orientedBox.type !== ShapeType.ORIENTED_BOX) {
    throw new Error("AdvancedShapeFactory: Argument must be an oriented box");
  }
  if (orientedBox.reference!.getAxis(Axis.Name.Z).direction !== Axis.Direction.UP) {
    throw new Error(
        "AdvancedShapeFactory: orientedBox reference must have up direction in order to identify the ground plane");
  }
  const bounds = orientedBox.bounds;
  const minX = bounds.x;
  const maxX = bounds.x + bounds.width;
  const minY = bounds.y;
  const maxY = bounds.y + bounds.height;
  const height = bounds.z;
  return createPolygon(targetReference, [
    transformation.transform(createPoint(orientedBox.reference, [minX, minY, height])),
    transformation.transform(createPoint(orientedBox.reference, [maxX, minY, height])),
    transformation.transform(createPoint(orientedBox.reference, [maxX, maxY, height])),
    transformation.transform(createPoint(orientedBox.reference, [minX, maxY, height]))
  ]);
};

/**
 * Creates a point for the ground plane of an oriented box. The order of the point is guaranteed to be
 * the same over time.
 * @param cornerIndex The index of the corner to use.
 * @param orientedBox the oriented box to calculate a point for.
 * @param transformation The transformation to apply to the result.
 * @returns a corner point, transformed to a specific reference
 */
export const createPointForOrientedBox = (cornerIndex: number, orientedBox: OrientedBox,
                                          transformation: Transformation): Point => {
  if (!orientedBox || orientedBox.type !== ShapeType.ORIENTED_BOX) {
    throw new Error("AdvancedShapeFactory: Argument must be an oriented box");
  }
  if (orientedBox.reference!.getAxis(Axis.Name.Z).direction !== Axis.Direction.UP) {
    throw new Error(
        "AdvancedShapeFactory: orientedBox reference must have up direction in order to identify the ground plane");
  }
  const bounds = orientedBox.bounds;
  const minX = bounds.x;
  const maxX = bounds.x + bounds.width;
  const minY = bounds.y;
  const maxY = bounds.y + bounds.height;
  const minZ = bounds.z;
  const maxZ = bounds.z + bounds.depth;
  switch (cornerIndex) {
  case 0:
    return transformation.transform(createPoint(orientedBox.reference, [minX, minY, minZ]));
  case 1:
    return transformation.transform(createPoint(orientedBox.reference, [maxX, minY, minZ]));
  case 2:
    return transformation.transform(createPoint(orientedBox.reference, [maxX, maxY, minZ]));
  case 3:
    return transformation.transform(createPoint(orientedBox.reference, [minX, maxY, minZ]));
  case 4:
    return transformation.transform(createPoint(orientedBox.reference, [minX, minY, maxZ]));
  case 5:
    return transformation.transform(createPoint(orientedBox.reference, [maxX, minY, maxZ]));
  case 6:
    return transformation.transform(createPoint(orientedBox.reference, [maxX, maxY, maxZ]));
  case 7:
    return transformation.transform(createPoint(orientedBox.reference, [minX, maxY, maxZ]));
  default:
    throw new Error(`corner index does not exist: ${cornerIndex}`);
  }
};

/**
 * Stretches an oriented box. The bottom of the box stays at the same height, but the top will be stretched by a stretching factor.
 * @param orientedBox the oriented box to start from
 * @param scaleX The amount to scale the x dimension by. Scaling happens from the center
 * @param scaleY The amount to scale the y dimension by. Scaling happens from the center.
 * @param stretchZ The amount to stretch. 2.0 will make an orientedBox that is twice as tall as the input
 *                 orientedbox
 */
export const createStretchedOrientedBox = (orientedBox: OrientedBox, scaleX: number, scaleY: number,
                                           stretchZ: number): OrientedBox => {
  if (!orientedBox || orientedBox.type !== ShapeType.ORIENTED_BOX) {
    throw new Error("AdvancedShapeFactory: Argument must be an oriented box");
  }
  if (orientedBox.reference!.getAxis(Axis.Name.Z).direction !== Axis.Direction.UP) {
    throw new Error(
        "AdvancedShapeFactory: orientedBox reference must have up direction in order to identify the ground plane");
  }
  const scaledBox = orientedBox.copy();
  const bounds = scaledBox.bounds;
  const stretchTransformation = createScaleTransformation({
    scaleX,
    scaleY,
    scaleZ: stretchZ,
    centerX: scaledBox.focusPoint.x,
    centerY: scaledBox.focusPoint.y,
    centerZ: scaledBox.focusPoint.z - (bounds.depth * (1 - EPSILON) * 0.5),
  });
  scaledBox.transform(stretchTransformation);
  return scaledBox;
};

/**
 * Creates a horizontal square defined by its center point, half diagonal length, azimuth of the first corner and geodesy
 */
export const createHorizontalSquare = (
    centerPoint: Point,
    semiDiagonal: number,
    azimuthDirection: number,
    geodesy: Geodesy
): Polygon => {
  return createPolygon(centerPoint.reference!, [
    geodesy.interpolate(centerPoint, semiDiagonal, azimuthDirection),
    geodesy.interpolate(centerPoint, semiDiagonal, azimuthDirection + 90),
    geodesy.interpolate(centerPoint, semiDiagonal, azimuthDirection + 180),
    geodesy.interpolate(centerPoint, semiDiagonal, azimuthDirection + 270),
    geodesy.interpolate(centerPoint, semiDiagonal, azimuthDirection),
  ]);
};

/**
 * Returns a list of 6 rectangles that represent the given orientedBox's faces.
 * If we define the oriented box's local axes as following using the box's corner indices:
 * <ul>
 *   <li>X: 7 -> 3</li>
 *   <li>Y: 7 -> 5</li>
 *   <li>Z: 7 -> 6</li>
 * </ul>
 *
 * Then the returned faces are defined as the planes at
 * <ol>
 *   <li>min X</li>
 *   <li>max X</li>
 *   <li>min Y</li>
 *   <li>max Y</li>
 *   <li>min Z</li>
 *   <li>max Z</li>
 * </ol>
 */
export function createFacePolygons(box: OrientedBox) {
  const cp = box.getCornerPoints();
  return [
    createPolygon(box.reference as CoordinateReference, [
      cp[4],
      cp[6],
      cp[7],
      cp[5],
    ]),
    createPolygon(box.reference as CoordinateReference, [
      cp[0],
      cp[1],
      cp[3],
      cp[2],
    ]),
    createPolygon(box.reference as CoordinateReference, [
      cp[2],
      cp[3],
      cp[7],
      cp[6],
    ]),
    createPolygon(box.reference as CoordinateReference, [
      cp[0],
      cp[1],
      cp[5],
      cp[4],
    ]),
    createPolygon(box.reference as CoordinateReference, [
      cp[1],
      cp[3],
      cp[7],
      cp[5],
    ]),
    createPolygon(box.reference as CoordinateReference, [
      cp[2],
      cp[6],
      cp[4],
      cp[0],
    ]),
  ];
}
