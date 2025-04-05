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
import {Map} from "@luciad/ria/view/Map.js";
import {useEffect, useState} from "react";
import {getScaleAtMapCenter} from "@luciad/ria-toolbox-core/util/ScaleUtil.js";

export enum ScaleType {
  /**
   * A map scale ratio at the origin of the projection.
   * The accuracy of this map scale depends on the distance (in meters) between the origin of the projection,
   * and what is currently visible on screen. Typically, the larger the distance, the greater the
   * distortion will be that is caused by the projection, and the less accurate
   * the scale is.
   * <p/>
   * If, for example, the projection is centered on Paris, the scale is calculated
   * for Paris. Therefore, if the view is showing the US, the scale calculated
   * by this method is potentially way off compared to what is visible on
   * screen.
   */
  PROJECTION_CENTER = "ProjectionCenter",

  /**
   * A map scale ratio at the center of the current map extents.
   * If the projection is centered on a spot far away of the current map extents, the scale
   * calculated by this method is still accurate (it is measured horizontally).
   * This does imply however that the map scale changes by simply
   * panning the map around.
   */
  MAP_CENTER = "MapCenter"
}

/**
 * Returns the up-to-date x-scale of the given map as a ratio between the distance,
 * as it is measured on the screen of the device, to the distance in the real world.
 */
export const useMapScale = (map: Map, scaleType: ScaleType) => {

  const [scale, setScale] = useState(map.mapScale[0]);

  useEffect(() => {
    const mapChangeListener = map.on("MapChange", () => {
      const mapScale = scaleType === ScaleType.PROJECTION_CENTER ? map.mapScale[0] : getScaleAtMapCenter(map);
      if (mapScale !== scale) {
        setScale(mapScale);
      }
    });

    return () => {
      mapChangeListener.remove();
    }
  }, [map]);

  return scale;
};