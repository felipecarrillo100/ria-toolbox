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
import {Vector3} from "@luciad/ria/util/Vector3.js";

/**
 * The `PathPointVectors` interface describes position and orientation of the camera in a specific key frame of a tour.
 * All inputs are expressed in the EPSG:4978 coordinate system.
 */
export interface PathPointVectors {
  /**
   * The 3D coordinates representing the camera's position
   */
  eye: Vector3;
  /**
   * The 3D vector pointing in the direction which the camera is facing.
   */
  forward: Vector3;
  /**
   * The 3D vector representing the "up" direction of the camera, which represents the camera's roll angle.
   */
  up: Vector3;
}

/**
 * The `PathKeyframe` interface describes a path keyframe in the `PathData.keyframes` array.
 */
export interface PathKeyframe extends PathPointVectors {
  /**
   * The unique identifier for the keyframe.
   */
  id: string;
  /**
   * Defines how sharply the path bends at the keyframe location. A low value (close to 0) results
   * in a sharper curve while a high value results in a smoother curve.
   */
  tension: number;
}


/**
 * The `PathData` interface represents a path object.
 */
export interface PathData {
  /**
   * The unique identifier for the path.
   */
  id: string;
  /**
   * The name of the path.
   */
  name: string;
  /**
   * The total duration of the path in milliseconds.
   */
  duration: number;
  /**
   * Specifies whether the path should be closed.
   */
  closed: boolean;
  /**
   * The array of `PathKeyframe` defining the camera location and orientation along the path.
   */
  keyframes: PathKeyframe[];
}
