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
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {FeatureLayer} from '@luciad/ria/view/feature/FeatureLayer.js';
import {Map} from '@luciad/ria/view/Map.js';

/**
 * Safely selects the given features on the given map.
 * Workaround for RIA-3647 where if you select a feature that is in a store but
 * not yet in the layer's workingSet (which is initialized asynchronously), an
 * error is thrown.
 */
export function selectSafely(
    map: Map,
    layer: FeatureLayer,
    features: Feature[]
) {
  callWhenWorkingSetContains(layer, features, () => {
    map.selectObjects([
      {
        layer,
        objects: features,
      },
    ]);
  })
}

/**
 * Safely hovers the given features on the given map.
 * Workaround for RIA-3647 where if you hover a feature that is in a store but
 * not yet in the layer's workingSet (which is initialized asynchronously), an
 * error is thrown.
 */
export function hoverSafely(
    map: Map,
    layer: FeatureLayer,
    features: Feature[]
) {
  callWhenWorkingSetContains(layer, features, () => {
    map.hoverObjects([
      {
        layer,
        objects: features,
      },
    ]);
  })
}

/**
 * Calls the given callback when the given layer's workingSet contains all the given features
 */
function callWhenWorkingSetContains(
    layer: FeatureLayer,
    features: Feature[],
    callback: () => void,
) {
  function isCallable(): boolean {
    const featuresInWorkingSet = layer.workingSet.get().map(({id}) => id);
    return features.findIndex(({id}) => featuresInWorkingSet.indexOf(id) < 0) < 0
  }

  if (isCallable()) {
    callback();
  } else {
    const handle = layer.workingSet.on('WorkingSetChanged', () => {
      if (isCallable()) {
        handle.remove();
        callback();
      }
    });
  }
}
