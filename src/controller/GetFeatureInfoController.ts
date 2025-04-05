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
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {WMSImageModel} from "@luciad/ria/model/image/WMSImageModel.js";
import {WMSTileSetModel} from "@luciad/ria/model/tileset/WMSTileSetModel.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {WMSImageLayer} from "@luciad/ria/view/image/WMSImageLayer.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {Map} from "@luciad/ria/view/Map.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {WMSGetFeatureInfoResponse, WMSTileSetLayer} from "@luciad/ria/view/tileset/WMSTileSetLayer.js";
import {throttle} from "@luciad/ria-toolbox-core/util/Throttle.js";

const IS_FUSION_RGBA_STRING = /\[\d+\.?\d*, RED],\n\[\d+.?\d*, GREEN],\n\[\d+\.?\d*, BLUE],\n\[\d+\.\d*, ALPHA]/gm;

const isFusionRGBAFeature = (feature: Feature) => typeof feature.properties.values === "string" &&
                                                  feature.properties.values.match(IS_FUSION_RGBA_STRING);

class QueryableWMSLayerVisitor implements LayerTreeVisitor {

  private _foundLayer: (WMSImageLayer | WMSTileSetLayer) | null;

  constructor() {
    this._foundLayer = null;
  }

  get foundLayer(): (WMSImageLayer | WMSTileSetLayer) | null {
    return this._foundLayer;
  }

  visitLayer(layer: Layer): LayerTreeVisitor.ReturnValue {
    if (!layer.visible) {
      return LayerTreeVisitor.ReturnValue.CONTINUE;
    }
    if (typeof (layer as any).queryable !== "undefined" && (layer as any).queryable) {
      this._foundLayer = layer as (WMSImageLayer | WMSTileSetLayer);
      return LayerTreeVisitor.ReturnValue.ABORT;
    }
    return LayerTreeVisitor.ReturnValue.CONTINUE;
  }

  visitLayerGroup(layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue {
    layerGroup.visitChildren(this, LayerTreeNode.VisitOrder.TOP_DOWN);
    if (this._foundLayer !== null) {
      return LayerTreeVisitor.ReturnValue.ABORT;
    } else {
      return LayerTreeVisitor.ReturnValue.CONTINUE;
    }
  }
}

export interface GetFeatureInfoControllerConstructorOptions {
  /**
   * If set to true, the controller will only do GetFeatureInfo requests
   * when the mouse is clicked. If the value is unset or false, the controller
   * will do a GetFeatureInfo request on every mouse move. Enable this if
   * GetFeatureInfo requests are too expensive to do on every mouse move.
   */
  requestOnlyOnClick?: boolean;

  /**
   * A function that is invoked when an Error occurs that should be shown in the UI.
   */
  handleError?: (message: string, error: Error) => void;
}

/**
 * Controller that does a WMS GetFeatureInfo request for the pixel under the mouse.
 */
export class GetFeatureInfoController extends Controller {
  private readonly _onClickOnly: boolean;
  private readonly _balloonContentProvider: (feature: Feature) => HTMLDivElement;
  private _feature: Feature | null;
  private _featureLayer: Layer | null;
  private _callbacksToRemove: Handle[];
  private _balloonShowing: boolean;
  private _infoPromise: Promise<WMSGetFeatureInfoResponse> | null;
  private _handleError: ((message: string, error: Error) => void) | null;
  private readonly _mouseMovedCallback: (x: number, y: number) => void;

  /**
   * Creates a GetFeatureInfoController.
   * @param options An options literal.
   */
  constructor(options?: GetFeatureInfoControllerConstructorOptions) {
    super();
    options = options || {};
    this._handleError = options.handleError ?? null;
    this._onClickOnly = !!(options.requestOnlyOnClick);
    this._feature = null;
    this._featureLayer = null;
    this._callbacksToRemove = [];
    this._balloonShowing = false;
    this._infoPromise = null;
    this._balloonContentProvider = feature => {
      const featureProps = feature.properties;
      const list = document.createElement("ul");
      for (const key in featureProps) {
        if (featureProps.hasOwnProperty(key) &&
            key !== "uid" &&
            featureProps[key] != null &&
            ((Array.isArray(featureProps[key]) && featureProps[key].length > 0) || !Array.isArray(featureProps[key]))) {
          const item = document.createElement("li");
          item.innerHTML = `${key}: ${featureProps[key]}`;
          list.appendChild(item);
        }
      }
      const title = document.createElement("h4");
      if (list.childElementCount > 0) {
        title.innerHTML = "Properties";
      } else {
        title.innerHTML = "No properties found";
      }
      const node = document.createElement("div");
      node.appendChild(title);
      node.appendChild(list);
      return node;
    };
    this._mouseMovedCallback = throttle((x: number, y: number) => {
      if (this._balloonShowing) {
        //don't request other feature info if the user clicked on a feature to show its properties
        //otherwise the balloon he is looking at will disappear.
        return;
      }
      this._requestFeatureInfo(x, y, false, true);
    }, 30);
  }

  onActivate(map: Map): void {
    this._callbacksToRemove.push(map.on("ShowBalloon", () => {
      this._balloonShowing = true;
    }));
    this._callbacksToRemove.push(map.on("HideBalloon", () => {
      this._balloonShowing = false;
    }));
    this._callbacksToRemove.push(map.layerTree.on("NodeRemoved", (event) => {
      const removedLayer = event.node;
      if (this._featureLayer === removedLayer) {
        this._feature = null;
        this._featureLayer = null;
        map.hideBalloon();
        this.invalidate();
      }
    }));
    super.onActivate(map);
  }

  onDeactivate(map: Map): void {
    for (let i = 0; i < this._callbacksToRemove.length; i++) {
      this._callbacksToRemove[i].remove();
    }
    this._callbacksToRemove.length = 0;
    super.onDeactivate(map);
  }

  //#snippet geocanvas
  onDraw(geoCanvas: GeoCanvas): void {
    if (this._feature && this._feature.shape) {
      geoCanvas.drawShape(this._feature.shape, {
        stroke: {
          color: "rgb(255,0,0)",
          width: 2
        }
      });
    }
  }

  //#endsnippet geocanvas

  onGestureEvent(gestureEvent: GestureEvent): HandleEventResult {
    if (gestureEvent.type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      this._mouseClicked(gestureEvent);
    } else if (gestureEvent.type === GestureEventType.MOVE && !this._onClickOnly) {
      this._mouseMovedCallback(gestureEvent.viewPosition[0], gestureEvent.viewPosition[1]);
    }
    return EVENT_IGNORED;
  }

  private _mouseClicked(event: GestureEvent): boolean {
    this.map!.hideBalloon();
    this._feature = null;
    this._requestFeatureInfo(event.viewPosition[0], event.viewPosition[1], true, false);
    return true;
  }

  private _requestFeatureInfo(x: number, y: number, showBalloon: boolean, ignoreResponseIfBalloonShowing: boolean) {
    const queryLayer = this.findFirstVisibleAndQueryableWMSLayer();
    if (queryLayer === null) {
      return;
    }

    const geoJsonCodec = new GeoJsonCodec({
      generateIDs: true
    });
    if (this._infoPromise) {
      return; // skip: a previous request is still busy
    }
    this._infoPromise = queryLayer.getFeatureInfo(x, y);
    if (this._infoPromise === null) {
      // make sure to deselect the feature
      this.invalidate();
      return;
    }
    if (showBalloon) {
      this.cursor ="wait";
    }
    this._infoPromise.then(response => {
      this._infoPromise = null;
      const contentType = response.getHeader("Content-Type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        //we can only handle GeoJson responses.
        return;
      }
      if (ignoreResponseIfBalloonShowing && this._balloonShowing) {
        //if a user is already looking at the properties of a feature, keep his balloon on-screen
        return;
      }
      const decodedFeatures = geoJsonCodec.decode({
        content: response.text
      });
      this._feature = null;
      if (decodedFeatures.hasNext()) {
        const decodedFeature = decodedFeatures.next();
        if (!isFusionRGBAFeature(decodedFeature)) {
          this._feature = decodedFeature;
          this._featureLayer = queryLayer;
          if (showBalloon) {
            this.map!.showBalloon({
              //show balloon at the location of the GetFeatureInfo request
              anchor: createPoint(null, [x, y]),
              contentProvider: () => this._balloonContentProvider(decodedFeature),
              panTo: false
            });
          }
        }
      }
      this.cursor = null;
      this.invalidate();
    }, () => {
      this.cursor = null;
      const wmsModel = queryLayer.model as (WMSImageModel | WMSTileSetModel);
      const queryLayers = `${wmsModel.queryLayers}`;
      this._handleError && this._handleError(`GetFeatureInfo${queryLayers}`,
          new Error(
              `Error while requesting feature information for layer '${wmsModel.queryLayers}'<br/>Make sure:<ul>  <li>These WMS layers are queryable. You can look in the WMS capabilities to determine this.</li>  <li>The WMS server supports the "application/json" format for feature information.</li>  <li>the WMS server support Cross-Origin Resource Sharing (CORS)</li></ul>`));
    });
  }

  private findFirstVisibleAndQueryableWMSLayer(): (WMSImageLayer | WMSTileSetLayer) | null {
    const findQueryableLayerVisitor = new QueryableWMSLayerVisitor();
    this.map!.layerTree.visitChildren(findQueryableLayerVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
    return findQueryableLayerVisitor.foundLayer;
  }

}
