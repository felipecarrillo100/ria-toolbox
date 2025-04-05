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
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Map} from "@luciad/ria/view/Map.js";
import {useEffect, useState} from "react";
import {isUndefined} from "@luciad/ria-toolbox-core/util/Lang.js";
import {useMouseCoordinate} from "./useMouseCoordinate.js";
import {useToastContext} from "./useToast.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";

const REFERENCE = getReference("crs:84");

export const useMouseHeight = (map: Map, getHeight?: (wgs84MouseLocation: Point) => Promise<number>): number => {

  const [height, setHeight] = useState<number>(0);
  const [requesting, setRequesting] = useState(false);
  const [serviceError, setServiceError] = useState(false)
  const [mouseModelCoordinate] = useMouseCoordinate(map, map.reference.referenceType == ReferenceType.CARTESIAN ? map.reference : REFERENCE);

  const {showErrorToast} = useToastContext();

  useEffect(() => {
    if (mouseModelCoordinate) {
      if (!isUndefined(getHeight) && !serviceError) {
        if (requesting) {
          return;
        }
        setRequesting(true);
        getHeight(mouseModelCoordinate).then(h => {
          setHeight(h);
          setRequesting(false)
        }).catch(e => {
          showErrorToast("Error occurred when retrieving height, using height data of the model", e)
          setHeight(mouseModelCoordinate.z);
          setRequesting(false);
          setServiceError(true);
        });
      } else {
        setHeight(mouseModelCoordinate.z);
      }
    }
  }, [map, mouseModelCoordinate]);

  return height;
}















