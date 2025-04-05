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
import { Point } from '@luciad/ria/shape/Point.js';
import { Feature } from '@luciad/ria/model/feature/Feature.js';
import {PathPointVectors} from "../PathData.js";
import {PathFeature} from "./PathFeature.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";

/**
 * The `PathPointProps` interface, extending PathPointVectors, contains properties of a point on a path.
 */
interface PathPointProps {
  /** The path this point belongs to. */
  parent: PathFeature;
  /** sequential index of the point on the path */
  index: number;
}

/**
 * The `PathPointFeature` class represents a keyframe point on a path.
 * Note: This class is used internally and is not intended for API use.
 */
export class PathPointFeature extends Feature<Point, PathPointProps> {
  /**
   * Retrieves a unique identifier for this path point.
   * @returns The unique id of this path point as a string.
   */
  get keyframeId(): string {
    return this.id as string;
  }

  /**
   * Retrieves the sequential number representing this point's order in the path.
   * @returns The point's index within the path.
   */
  get index(): number {
    return this.properties.index;
  }

  /**
   * Returns the fraction representing this point's position on the path.
   * The fraction, a value between 0 and 1, specifies where along the path this point is located.
   * A fraction of 0 represents the start of the path, 1 represents the end.
   * @returns The fraction representing this point's position on the path.
   */
  get fraction(): number {
    const path = this.properties.parent;
    const size = path.getSize();
    if (size <= 1) {
      return 0;
    }
    const segments = size - (path.closed ? 0 : 1);
    return this.index / segments;
  }

  /**
   * Returns the point's vectors (eye, forward, up).
   */
  getPathPointVectors(): PathPointVectors {
    return this.properties.parent.getPathPointVectors(this.index);
  }

  /**
   * Updates the position of the point along the path.
   * @param p - New point to which the path point should be moved.
   */
  updatePosition(p: Vector3): void {
    this.shape.move3DToCoordinates(p.x, p.y, p.z);
    updateVector(this.getPathPointVectors().eye, p);
    this.properties.parent.invalidateTrajectory();
  }

  /**
   * Updates the orientation vectors (forward and up) of the point.
   * @param camera - The camera instance used to update the orientation.
   */
  updateOrientation(camera: PathPointVectors): void {
    const {forward, up} = this.getPathPointVectors();
    updateVector(forward, camera.forward);
    updateVector(up, camera.up);
  }
}

function updateVector(vector: Vector3, {x, y, z}: Vector3) {
  vector.x = x;
  vector.y = y;
  vector.z = z;
}