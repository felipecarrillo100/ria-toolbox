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
import {KMLGroundOverlayFeature} from "@luciad/ria/model/kml/KMLGroundOverlayFeature.js";
import {KMLModel} from "@luciad/ria/model/kml/KMLModel.js";
import {KMLNetworkLinkFeature} from "@luciad/ria/model/kml/KMLNetworkLinkFeature.js";
import {createGroundOverlayLayer} from "@luciad/ria/util/kml/KMLUtil.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {LoadEverything} from "@luciad/ria/view/feature/loadingstrategy/LoadEverything.js";
import {KMLLayer} from "@luciad/ria/view/kml/KMLLayer.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {Map} from "@luciad/ria/view/Map.js";

/**
 * Automates the responses to KML events with behaviors:
 * <ul>
 *   <li>When a Network Link is discovered, it is automatically processed and added to the map as a new KMLLayer.
 *   <li>When a Ground Overlay is discovered, it is automatically processed and added to the map as a new RasterTileSetLayer.
 * </ul>
 * <p>All placemarks that have "visibility=0" in KML file will be still displayed on the map.</p>
 *
 * This KML layer manager only supports basic handling of Network Links and Ground overlays.
 * Please refer to the KML sample for extended behavior including support:
 * <lu>
 *   <li>for hierarchical KML data (documents & folders)</li>
 *   <li>refreshing network links</li>
 *   <li>creating UI component to control visibility of KML features</li>
 * </lu>
 *
 * @param kmlLayer the kml layer to automate creation of related layers for network links and overlays
 */
export function manageKMLLayer(kmlLayer: KMLLayer): void {
  addListeners(kmlLayer);
}

function addListeners(layer: KMLLayer): void {
  const kmlModel = layer.model as KMLModel;
  kmlModel.on("KMLNetworkLink",
      (networkLink: KMLNetworkLinkFeature) => onKMLNetworkLinkEvent(networkLink, layer));
  kmlModel.on("KMLGroundOverlay",
      (groundOverlay: KMLGroundOverlayFeature) => onKMLGroundOverlayEvent(groundOverlay, layer));

  layer.workingSet.on("QueryFinished", () => onForceVisible(layer));
}

function onKMLNetworkLinkEvent(networkLink: KMLNetworkLinkFeature, kmlLayer: FeatureLayer): void {
  const {map} = kmlLayer;
  if (!map) {
    return
  }

  const networkLinkLayer = createLayerForNetworkLink(map, kmlLayer, networkLink);
  if (networkLinkLayer) {
    addListeners(networkLinkLayer);
    kmlLayer.parent!.addChild(networkLinkLayer, "above", kmlLayer);
  }
}

function onKMLGroundOverlayEvent(groundOverlay: KMLGroundOverlayFeature, kmlLayer: KMLLayer): void {
  const {map} = kmlLayer;
  if (!map) {
    return
  }

  createLayerForGroundOverlay(map, kmlLayer, groundOverlay)?.then(layer => {
    if (layer) {
      kmlLayer.parent!.addChild(layer, "below", kmlLayer);
    }
  });
}

function createLayerForGroundOverlay(map: Map, masterLayer: KMLLayer,
                                     groundOverlayFeature: KMLGroundOverlayFeature): Promise<Layer | null> | null {
  if (checkIfLayerExists(map, `${masterLayer.id}-${groundOverlayFeature.id}`)) {
    throw new Error("Cannot create a layer for KML Ground Overlay feature: layer already exists");
  }
  if (!masterLayer || !masterLayer.model ||
      !groundOverlayFeature || !groundOverlayFeature.shape || !groundOverlayFeature.shape.bounds ||
      !groundOverlayFeature.properties.icon || !groundOverlayFeature.properties.icon.href
  ) {
    throw new Error("Cannot create a layer for KML Ground Overlay feature: incomplete data");
  }

  const {id, properties} = groundOverlayFeature;
  const {name} = properties;

  return createGroundOverlayLayer(map, groundOverlayFeature, {
    layerOptions: {
      id: id as string,
      label: name as string
    },
    drapeTarget: masterLayer.drapeTarget
  }).catch(e => {
    console.error(e);
    throw new Error(`Cannot create layer for GroundOverlay feature '${name}'. Check the console for details`);
  });
}

function createLayerForNetworkLink(map: Map, masterLayer: FeatureLayer,
                                   networkLink: KMLNetworkLinkFeature): KMLLayer | null {
  const {link, name} = networkLink.properties;
  const {href} = link;
  if (checkIfLayerExists(map, `${masterLayer.id}-${networkLink.id}`)) {
    throw new Error("Cannot create a layer for KML Network Link feature: layer already exists");
  }

  return new KMLLayer(new KMLModel(href as string), {
    id: `${networkLink.id}`,
    label: name as string,
    loadingStrategy: new LoadEverything(),
    selectable: true,
  });
}

function checkIfLayerExists(map: Map, layerId: string): boolean {
  return typeof map.layerTree.findLayerById(`${layerId}`) !== "undefined";
}

function onForceVisible(layer: FeatureLayer): void {
  let needInvalidate = false;
  layer.workingSet.get().forEach(kmlFeature => {
    if (!kmlFeature.properties.visibility) {
      // make the feature visible again
      kmlFeature.properties.visibility = true;
      needInvalidate = true;
    }
  });
  if (needInvalidate) {
    // there were some KML features invisible.
    layer.painter.invalidateAll();
  }
}