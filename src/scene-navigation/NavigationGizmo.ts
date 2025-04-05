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
import {Icon3DStyle} from "@luciad/ria/view/style/Icon3DStyle.js";
import {Map} from "@luciad/ria/view/Map.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {DEG2RAD} from "@luciad/ria-toolbox-core/util/Math.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {distanceAlongDirection} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {PBRSettings} from "@luciad/ria/view/style/PBRSettings.js";

/**
 * The gizmo 3D object should be defined with the origin that is in the center of the icon.
 * The real size represents the perimeter (twice the radius) of the sphere that encircles the gizmo object.
 */
export interface GizmoOptions {
  /**
   *  Expected size of the gizmo visualization in pixels. Default value is 90 pixels.
   *  Note that this value is approximated for a more simplified implementation.
   */
  sizeInPixels?: number;

  /**
   * The real size of the gizmo mesh in meters. Default value is 2 meters
   */
  realSize?: number;

  /**
   * The PBR settings used to style the gizmo
   */
  pbrSettings?: PBRSettings | null;
}

const DEFAULT_PBR_SETTINGS = {
  lightIntensity: 0.5,
  material: {
    metallicFactor: 1,
    roughnessFactor: 0.5,
  },
};

/**
 * A navigation gizmo is typically used to represent the anchor point of an interaction, to give more feedback to the
 * user on what they are doing.
 * Navigation gizmos use 3D icons, which are defined in meters, but thanks to this class, you can also resize them to
 * fit a certain size in pixels.
 */
export class NavigationGizmo {
  private readonly _style: Icon3DStyle;
  private readonly _gizmoSizeInPixels: number;
  private readonly _realGizmoSize: number; // meters

  constructor(meshUrl: string, {sizeInPixels, realSize, pbrSettings}: GizmoOptions = {}) {
    this._style = getGizmoStyle(meshUrl, pbrSettings === undefined ? DEFAULT_PBR_SETTINGS : pbrSettings);
    this._gizmoSizeInPixels = sizeInPixels ?? 90;
    this._realGizmoSize = realSize ?? 2;
  }

  get style(): Icon3DStyle {
    return this._style;
  }

  /**
   * Scales this object's style such that it approximately has the expected size in pixels, when viewing it from the
   * given map's camera
   */
  rescaleForFixedViewSize(map: Map, gizmoCenter: Point) {
    const {camera, viewSize} = map;

    const orthogonalDistance = distanceAlongDirection(gizmoCenter, camera.eye, camera.forward);

    const sizeInMeters = computeSizeInMeters(
        this._gizmoSizeInPixels,
        (camera as PerspectiveCamera).fovY,
        viewSize[1],
        orthogonalDistance,
    );
    this.applyScaleFactor(sizeInMeters / this._realGizmoSize);
  }

  private applyScaleFactor(scaleFactor: number) {
    this._style.scale = {
      x: scaleFactor,
      y: scaleFactor,
      z: scaleFactor,
    };
  }
}

/**
 * Returns the size in meters that a circular object has at the center of the
 * screen with given size in pixels at the given distance.
 */
function computeSizeInMeters(sizeInPixels: number, fovY: number, viewHeight: number, distance: number): number {
  const halfAngle = (sizeInPixels / 2 / viewHeight) * fovY;
  const halfSize = Math.tan(halfAngle * DEG2RAD) * distance;
  return halfSize * 2;
}

function getGizmoStyle(meshUrl: string, pbrSettings: PBRSettings | null): Icon3DStyle {
  return {
    meshUrl,
    rotation: {
      x: 0,
      y: 0,
      z: -90,
    },
    orientation: {
      roll: 0,
    },
    translation: {
      x: 0,
      y: 0,
      z: 0,
    },
    scale: {
      x: 1,
      y: 1,
      z: 1,
    },
    transparency: true,
    pbrSettings,
  };
}
