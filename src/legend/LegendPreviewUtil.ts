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
import {Shape} from "@luciad/ria/shape/Shape.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {MemoryStore} from "@luciad/ria/model/store/MemoryStore.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {FeaturePainter, PaintState} from "@luciad/ria/view/feature/FeaturePainter.js";
import html2canvas from "html2canvas";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {isDefined} from "@luciad/ria-toolbox-core/util/Lang.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";
import {Icon3DStyle} from "@luciad/ria/view/style/Icon3DStyle.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {PanoramaStyle} from "@luciad/ria/view/style/PanoramaStyle.js";
import {PanoramaContext} from "@luciad/ria/model/tileset/PanoramaContext.js";
import {ShapeStyle} from "@luciad/ria/view/style/ShapeStyle.js";
import {TextStyle} from "@luciad/ria/view/style/TextStyle.js";
import {PointLabelStyle} from "@luciad/ria/view/style/PointLabelStyle.js";
import {InPathLabelStyle} from "@luciad/ria/view/style/InPathLabelStyle.js";
import {OnPathLabelStyle} from "@luciad/ria/view/style/OnPathLabelStyle.js";

/**
 * A utility class, tied to a map, to handle the legend information for that map.

 * It can be used to get a legend entry preview at any moment in time depending on the current detail level of the map.
 * It will keep track of legend entry previews for legend features in a cache, that can be cleared whenever the painter
 * for the feature changed using `resetLegendCache`.
 */
export class LegendPreviewUtil {
  private readonly _mapForLegend;
  private readonly _previewCache: {
    [featureId: string | number]: {
      [detailLevel: number]: string | null;
    }
  };

  constructor(mapForLegend: Map) {
    this._mapForLegend = mapForLegend;
    this._previewCache = {};
  }

  /**
   * Method to clear the cache of legend images (one per lod) for a certain feature.
   * This is needed whenever the painter for that feature changes.
   * @param feature
   */
  resetLegendCache(feature: Feature): void {
    this._previewCache[feature.id] = {};
  }

  /**
   * Method to generate a base64 legend image of a given width and height for a certain feature.
   * This method reuses cached images if available.
   * If you provide a layer, this method takes into account the level of detail of the main map,
   * as well as if this feature would actually be drawn on the main map (if it generates draw-calls).
   *
   * @param legendFeature the feature for the legend-entry
   * @param legendPainter the painter you want to use to generate the legend preview
   * @param width the width of the resulting image
   * @param height the height of the resulting image
   * @param layer the layer if you want to check visibility of the feature on the map and return null if not visible.
   */
  async getLegendPreview(legendFeature: Feature,
                         legendPainter: FeaturePainter,
                         width: number, height: number,
                         layer: FeatureLayer | null = null): Promise<string | null> {
    if (layer && !layer.visible) {
      return null;
    }
    if (!this._previewCache[legendFeature.id]) {
      this._previewCache[legendFeature.id] = {};
    }
    const detailLevel = layer ? this.getDetailLevel(layer, layer.painter) : 0;
    let preview = this._previewCache[legendFeature.id][detailLevel];
    if (!isDefined(preview, true)) {
      if (!layer || this.isPainted(legendFeature, layer, detailLevel)) {
        legendFeature.properties.lcdLevelOfDetail = detailLevel;
        preview = await generatePreviewImage(legendFeature, addLODMutation(legendPainter), width, height);
        legendFeature.properties.lcdLevelOfDetail = undefined;
      } else {
        preview = null;
      }
      this._previewCache[legendFeature.id][detailLevel] = preview;
    }
    return preview;
  }

  /**
   * This method is used to check if the feature would actually get painted on the map with the given
   * level of detail. It makes use of canvasses that do not actually draw anything, but that merely track
   * the number of draw calls made.
   */
  private isPainted(feature: Feature, layer: FeatureLayer, detailLevel: number) {
    const geoCanvasCallsTracker = new GeoCanvasCallsTracker();
    const labelCanvasCallsTracker = new LabelCanvasCallsTracker();
    const painter = layer.painter;
    painter.paintBody(geoCanvasCallsTracker, feature, feature.shape!, layer, this._mapForLegend,
        {selected: false, hovered: false, level: detailLevel});
    if (painter.paintLabel) {
      painter.paintLabel(labelCanvasCallsTracker, feature, feature.shape!, layer, this._mapForLegend,
          {selected: false, hovered: false, level: detailLevel});
    }
    return (geoCanvasCallsTracker.callsToCanvas + labelCanvasCallsTracker.callsToCanvas) > 0;
  }

  /**
   * This method is used to translate the current scale on the main map into a detail level, used by
   * the painter.
   */
  private getDetailLevel(layer: FeatureLayer, painter: FeaturePainter | null): number {
    const detailLevelScales = painter && painter.getDetailLevelScales ?
                              painter.getDetailLevelScales(layer, this._mapForLegend) : null;

    if (!detailLevelScales || detailLevelScales.length === 0) {
      return 0;
    }

    let level = 0;
    const scale = this._mapForLegend.mapScale[0];
    for (let i = 0; i < detailLevelScales.length; i++) {
      if (scale >= detailLevelScales[i]) {
        level++;
      }
    }
    return level;
  }
}

/**
 * Utility method to set up a map for the legend feature, to create the preview base64 image and to clean up after.
 * @param feature the legend feature
 * @param painter the painter to use
 * @param width the width for your image
 * @param height the height for your image
 */
async function generatePreviewImage(feature: Feature, painter: FeaturePainter,
                                    width: number, height: number): Promise<string> {
  const reference = feature.shape?.reference!;
  const shape = feature.shape!;
  const ratio = height / width;
  const shapeWidth = (shape.bounds && shape.bounds.width > 0) ? shape.bounds.width : 0.015;
  const shapeHeight = (shape.bounds && shape.bounds.height > 0) ? shape.bounds.height : shapeWidth * ratio;
  const currentOverflow = document.body.style.overflow;

  //hide the scrollbar (if any) to make sure no flickering is introduced when creating this temporary div
  document.body.style.overflow = 'hidden';

  const domPreviewContainer = document.createElement("div");
  domPreviewContainer.id = "legendContainer";
  domPreviewContainer.style.width = `${width}px`;
  domPreviewContainer.style.height = `${height}px`;
  domPreviewContainer.style.position = "relative";
  domPreviewContainer.style.overflow = "left";
  document.body.appendChild(domPreviewContainer);

  const map = new Map(domPreviewContainer, {reference: reference});
  const memoryStore = new MemoryStore({data: [feature]});
  const model = new FeatureModel(memoryStore, {
    reference: reference,
  });
  const layer = new FeatureLayer(model, {
    label: `legend`,
    painter: painter,
    selectable: false,
  });
  map.layerTree.addChild(layer, "top");
  await map.mapNavigator.fit({
    bounds: createBounds(feature.shape!.reference!, [-shapeWidth / 2, shapeWidth, -shapeHeight / 2, shapeHeight]),
  })
  await layer.whenReady();

  const legendImage = await getScreenShotUrl(domPreviewContainer, width, height, true);

  map.destroy();
  document.body.removeChild(domPreviewContainer);
  // reset the overflow to how it was
  document.body.style.overflow = currentOverflow;

  return legendImage;
}

async function getScreenShotUrl(domPreviewContainer: HTMLDivElement, width: number,
                                height: number, withLabel: boolean = false): Promise<string> {
  let canvas: HTMLCanvasElement = await getHtmlCanvasElement(domPreviewContainer, width, height, withLabel);
  return canvas.toDataURL("image/png");
}

async function getHtmlCanvasElement(domPreviewContainer: HTMLDivElement, width: number,
                                    height: number, withLabel: boolean = false): Promise<HTMLCanvasElement> {
  if(withLabel) {
    const html2CanvasOptions = {
      // By default, window.devicePixelRatio is used for scale.
      // This can result in larger images than the actual pixel size of the DOM node.
      // For example, when the page is "zoomed" or the system has high DPI scaling enabled.
      scale: 1,
      width: width,
      height: height,
      logging: false,
      // the background color for legend entries can be set
      // using css styling
      // .legend-panel-table-image {
      //   background: #f8e6b7;
      // }
      backgroundColor: null,
    };
    // @ts-ignore
    return html2canvas(domPreviewContainer, html2CanvasOptions)
        .then((c: HTMLCanvasElement) => {
          return c;
        },(error: any) => {
          console.error(error);
          console.warn(`Something went wrong in 'html2canvas', returning the legend preview without label.`);
          return domPreviewContainer.getElementsByTagName("canvas")[0];
        });
  } else {
    return domPreviewContainer.getElementsByTagName("canvas")[0];
  }
}

function addLODMutation<T extends FeaturePainter>(painter: T): T {
  let oldPaintBody: (geoCanvas: GeoCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map,
                     paintState: PaintState) => void;
  let oldPaintLabel: (labelCanvas: LabelCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map,
                      paintState: PaintState) => void;

  if (!painter) {
    return painter;
  }

  if (isDefined(painter.paintBody)) {
    oldPaintBody = painter.paintBody;
    painter.paintBody = function(geoCanvas: GeoCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map,
                                 paintState: PaintState): void {
      paintState.level = feature.properties.lcdLevelOfDetail ?? paintState.level;
      oldPaintBody.call(painter, geoCanvas, feature, shape, layer, map, paintState);
    };
  }

  if (isDefined(painter.paintLabel)) {
    oldPaintLabel = painter.paintLabel!;
    painter.paintLabel = function(labelCanvas: LabelCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map,
                                  paintState: PaintState): void {
      paintState.level = feature.properties.lcdLevelOfDetail ?? paintState.level;
      oldPaintLabel.call(painter, labelCanvas, feature, shape, layer, map, paintState);
    };
  }

  return painter;
}

/**
 * This is a mocking geoCanvas, merely created to track if anything gets actually painted.
 * It is used in `LegendPreviewUtil#isPainted` to see if the legend feature would actually be visible
 * on the main map. If not, it will not generate a legend entry.
 */
class GeoCanvasCallsTracker implements GeoCanvas {

  private _callsToCanvas: number = 0;

  constructor() {
    this._callsToCanvas = 0;
  }

  get callsToCanvas(): number {
    return this._callsToCanvas;
  }

  drawIcon(shape: Shape, iconStyle: IconStyle): void {
    this._callsToCanvas++;
  }

  drawIcon3D(shape: Shape, iconStyle: Icon3DStyle): void {
    this._callsToCanvas++;
  }

  drawPanorama(location: Point, style?: PanoramaStyle, context?: PanoramaContext): void {
    this._callsToCanvas++;
  }

  drawShape(shape: Shape, style: ShapeStyle): void {
    this._callsToCanvas++;
  }

  drawText(shape: Shape, text: string, style: TextStyle): void {
    this._callsToCanvas++;
  }
}

/**
 * This is a mocking labelCanvas, merely created to track if anything gets actually painted.
 * It is used in `LegendPreviewUtil#isPainted` to see if the legend feature would actually be visible
 * on the main map. If not, it will not generate a legend entry.
 */
class LabelCanvasCallsTracker implements LabelCanvas {
  private _callsToCanvas: number = 0;

  constructor() {
    this._callsToCanvas = 0;
  }

  get callsToCanvas(): number {
    return this._callsToCanvas;
  }

  drawLabel(html: string | HTMLElement, shape: Shape, labelStyle: PointLabelStyle): void {
    this._callsToCanvas++;
  }

  drawLabelInPath(html: string | HTMLElement, shape: Shape, labelStyle: InPathLabelStyle): void {
    this._callsToCanvas++;
  }

  drawLabelOnPath(html: string | HTMLElement, shape: Shape, labelStyle: OnPathLabelStyle): void {
    this._callsToCanvas++;
  }
}