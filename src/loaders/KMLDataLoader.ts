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
import {KMLModel} from "@luciad/ria/model/kml/KMLModel.js";
import {KMLLayer} from "@luciad/ria/view/kml/KMLLayer.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {manageKMLLayer} from "./KMLLayerManager.js";

export const KMLDataLoader = {
  /**
   * Creates a layer for the given URL, assuming it is KML content.
   *
   * Summary:
   * - Create a @luciad/ria/model/kml/KMLModel to load the data
   * - Create a @luciad/ria/view/kml/KMLLayer
   */
  createLayer: function(layerName: string, url: string): LayerGroup {
    const layerGroup = new LayerGroup({
      label: layerName + " (KML)"
    });
    const layer = new KMLLayer(new KMLModel(url), {
      label: layerName + " (KML)",
      selectable: true,
    });
    layerGroup.addChild(layer);
    manageKMLLayer(layer);
    return layerGroup;
  }
};