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
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {UrlStore} from "@luciad/ria/model/store/UrlStore.js";
import {BingMapsTileSetModel} from "@luciad/ria/model/tileset/BingMapsTileSetModel.js";
import {FusionTileSetModel} from "@luciad/ria/model/tileset/FusionTileSetModel.js";
import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType.js";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode.js";
import {UrlTileSetModel} from "@luciad/ria/model/tileset/UrlTileSetModel.js";
import {WMSTileSetModel} from "@luciad/ria/model/tileset/WMSTileSetModel.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {LonLatPointFormat} from "@luciad/ria/shape/format/LonLatPointFormat.js";
import {Shape} from "@luciad/ria/shape/Shape.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {FeaturePainter, PaintState} from "@luciad/ria/view/feature/FeaturePainter.js";
import {GridLayer} from "@luciad/ria/view/grid/GridLayer.js";
import {LonLatGrid} from "@luciad/ria/view/grid/LonLatGrid.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {Map} from "@luciad/ria/view/Map.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {PinEndPosition} from "@luciad/ria/view/style/PinEndPosition.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {WMSTileSetLayer} from "@luciad/ria/view/tileset/WMSTileSetLayer.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {AirspaceGeoJsonCodec} from "../codec/AirspaceGeoJsonCodec.js";
import {createCircle} from "./IconFactory.js";
import {QuadTreeRasterTileSetStructure} from "@luciad/ria/model/tileset/RasterTileSetModel.js";

const SAMPLE_SERVICE_URL = "https://sampleservices.luciad.com";
const CRS84 = getReference("CRS:84");

let publicLuciadFusionServerPromise: Promise<Response> | null = null;

async function isPublicLuciadFusionServerReachable(): Promise<Response> {
  return publicLuciadFusionServerPromise ?? (
      publicLuciadFusionServerPromise = fetch(
          SAMPLE_SERVICE_URL +
          "/lts?SERVICE=LTS&VERSION=1.0.0&REQUEST=getTile&COVERAGE_ID=4ceea49c-3e7c-4e2d-973d-c608fb2fb07e&LEVEL=0&ROW=0&COLUMN=0"
      )
  );
}

/**
 * Returns a layer based on an LTS imagery service that can be used as background imagery
 */
export async function createFusionBackgroundLayer(): Promise<RasterTileSetLayer> {
  await isPublicLuciadFusionServerReachable();

  //#snippet references
  const tileSetReference = getReference("EPSG:4326");
  //#endsnippet references
  const bounds = createBounds(getReference("EPSG:4326"), [-180, 360, -90, 180]);
  const toTileSetReference = createTransformation(bounds.reference!, tileSetReference);
  const tileSetBounds = toTileSetReference.transformBounds(bounds);

  const imageryParameters = {
    structure: {
      reference: tileSetReference,
      bounds: tileSetBounds,
      level0Columns: 4,
      level0Rows: 2,
      levelCount: 24,
      tileWidth: 256,
      tileHeight: 256
    },
    url: "https://sampleservices.luciad.com/lts",
    coverageId: "4ceea49c-3e7c-4e2d-973d-c608fb2fb07e",
  };

  const fusionTileSetModel = new FusionTileSetModel(imageryParameters);
  return new RasterTileSetLayer(fusionTileSetModel, {
    label: "Aerial imagery",
    layerType: LayerType.BASE
  });
}

/**
 * Returns a layer based on an LTS elevation service that can be used to add elevation info to your map
 */
export async function createFusionElevationLayer(): Promise<RasterTileSetLayer> {
  await isPublicLuciadFusionServerReachable();
  const quadTreeStructure: QuadTreeRasterTileSetStructure = {
    reference: getReference("EPSG:4326"),
    level0Columns: 4,
    level0Rows: 2,
    levelCount: 24,
    bounds: createBounds(getReference("EPSG:4326"), [-180, 360, -90, 180]),
    tileWidth: 32,
    tileHeight: 32,
  };
  const elevationParameters = {
    structure: quadTreeStructure,
    url: SAMPLE_SERVICE_URL + "/lts",
    coverageId: "e8f28a35-0e8c-4210-b2e8-e5d4333824ec",
    dataType: RasterDataType.ELEVATION,
    samplingMode: RasterSamplingMode.POINT
  };

  const fusionTileSetModel = new FusionTileSetModel(elevationParameters);
  return new RasterTileSetLayer(fusionTileSetModel, {
    label: "Elevation"
  });
}

/**
 * Returns a layer based on an WMTS imagery service that can be used as background imagery
 */
export async function createWMSBackgroundLayer(map: Map): Promise<WMSTileSetLayer> {
  const isSWMap = !(map instanceof WebGLMap);

  const model = await WMSTileSetModel.createFromURL(
      SAMPLE_SERVICE_URL + "/wms", [{
        layer: "4ceea49c-3e7c-4e2d-973d-c608fb2fb07e"
      }], {
        reference: isSWMap ? map.reference : getReference("EPSG:3857")
      });

  return new WMSTileSetLayer(model, {
    layerType: LayerType.BASE,
    id: "Background",
    label: "Global Imagery (WMS)"
  });
}

/**
 * Returns a layer that can be used as background imagery for the Boston area
 */
export async function createBostonBackgroundLayer(): Promise<RasterTileSetLayer> {
  const metadata = await fetch("/sampledata/boston/meta.json").then(r => r.json());
  metadata.reference = getReference(metadata.reference);
  metadata.bounds = createBounds(metadata.reference, metadata.bounds);
  metadata.baseURL = "/sampledata/boston/{z}_{x}_{y}.png";
  const model = new UrlTileSetModel(metadata);
  return new RasterTileSetLayer(model, {
    label: "Earth Image",
    layerType: LayerType.BASE
  });
}

//#snippet createLonLatGridLayer
/**
 * Returns a grid layer
 */
export function createGridLayer(): GridLayer {
  //Define scale ranges and create a grid
  const settings = [{
    scale: 40000.0E-9,
    deltaLon: 1 / 60,
    deltaLat: 1 / 60
  }, {
    scale: 20000.0E-9,
    deltaLon: 1 / 30,
    deltaLat: 1 / 30
  }, {
    scale: 10000.0E-9,
    deltaLon: 1 / 10,
    deltaLat: 1 / 10
  }, {
    scale: 5000.0E-9,
    deltaLon: 1 / 2,
    deltaLat: 1 / 2
  }, {
    scale: 1000.0E-9,
    deltaLon: 1,
    deltaLat: 1
  }, {
    scale: 200.0E-9,
    deltaLon: 5,
    deltaLat: 5
  }, {
    scale: 20.0E-9,
    deltaLon: 10,
    deltaLat: 10
  }, {
    scale: 9.0E-9,
    deltaLon: 20,
    deltaLat: 20
  }, {
    scale: 5.0E-9,
    deltaLon: 30,
    deltaLat: 30
  }, {
    scale: 0,
    deltaLon: 45,
    deltaLat: 45
  }];
  const grid = new LonLatGrid(settings);

  //Set the default styling for grid lines and labels
  grid.fallbackStyle = {
    labelFormat: new LonLatPointFormat({
      pattern: "lat(+DM),lon(+DM)"
    }),
    originLabelFormat: new LonLatPointFormat({
      pattern: "lat(+D),lon(+D)"
    }),
    originLineStyle: {
      color: "rgba(230, 20, 20, 0.6)",
      width: 2
    },
    lineStyle: {
      color: "rgba(210,210,210,0.6)",
      width: 1
    },
    originLabelStyle: {
      fill: "rgba(210,210,210,0.8)",
      halo: "rgba(230, 20, 20, 0.8)",
      haloWidth: 3,
      font: "12px sans-serif"
    },
    labelStyle: {
      fill: "rgb(220,220,220)",
      halo: "rgb(102,102,102)",
      haloWidth: 3,
      font: "12px sans-serif"
    }
  };

  //Use simplified labels when zoomed out a lot.
  const degreesOnlyFormat = new LonLatPointFormat({
    pattern: "lat(+D),lon(+D)"
  });
  grid.setStyle(grid.scales.indexOf(0), {
    labelFormat: degreesOnlyFormat
  });
  grid.setStyle(grid.scales.indexOf(5.0E-9), {
    labelFormat: degreesOnlyFormat
  });
  grid.setStyle(grid.scales.indexOf(9.0E-9), {
    labelFormat: degreesOnlyFormat
  });
  grid.setStyle(grid.scales.indexOf(20.0E-9), {
    labelFormat: degreesOnlyFormat
  });
  grid.setStyle(grid.scales.indexOf(200.0E-9), {
    labelFormat: degreesOnlyFormat
  });
  return new GridLayer(grid, {
    label: "Grid"
  });
}

//#endsnippet createLonLatGridLayer

const HTML_TEMPLATE_NORMAL = '<div style="background-color: rgb(40,40,40); padding: 5px; border-radius: 10px; color: rgb(238,233,233)">$city, $state</div>';
const HTML_TEMPLATE_SELECT = '<div style="background-color: rgb(80,10,10); padding: 5px; border-radius: 10px; color: rgb(238,233,233)">$city, $state</div>';
const EMPTY_STYLE = {
  offset: 20,
  pin: {
    endPosition: PinEndPosition.MIDDLE,
    width: 1
  }
};

class CitiesPainter extends FeaturePainter {

  private readonly _cache: Record<string, HTMLCanvasElement> = {};
  private readonly _labelsAlwaysVisible: boolean;

  constructor(labelsAlwaysVisible: boolean) {
    super();
    this._labelsAlwaysVisible = labelsAlwaysVisible;
  }

  //#snippet memoization
  paintBody(geoCanvas: GeoCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map, state: PaintState): void {
    let cssPixelSize = this.getIconSize(feature);
    if (state.hovered) {
      cssPixelSize *= 1.33;
    }
    const devicePixelSize = cssPixelSize * map.displayScale;
    const hash = devicePixelSize.toString() + state.selected + state.hovered;
    let icon = this._cache[hash];
    if (!icon) {
      let stroke = "rgba(255,255,255,1.0)";
      let fill = "rgba(255,0,0,0.5)";
      let strokeWidth = 2 * map.displayScale;
      if (state.selected) {
        stroke = "rgba(0,0,255,1.0)";
        fill = "rgba(255,0,255,0.7)";
        strokeWidth = 3 * map.displayScale;
      }
      icon = createCircle({
        stroke,
        fill,
        strokeWidth,
        width: devicePixelSize,
        height: devicePixelSize,
      });
      this._cache[hash] = icon;
    }
    geoCanvas.drawIcon(shape.focusPoint!, {
      width: `${cssPixelSize}px`,
      height: `${cssPixelSize}px`,
      image: icon
    });
  }

  //#endsnippet memoization

  paintLabel(labelCanvas: LabelCanvas, feature: Feature, shape: Shape, layer: Layer, map: Map,
             paintState: PaintState): void {
    let html;
    if (paintState.selected || this._labelsAlwaysVisible) {
      html = paintState.selected ? HTML_TEMPLATE_SELECT : HTML_TEMPLATE_NORMAL;
      html = html.replace('$city', feature.properties.CITY);
      html = html.replace('$state', feature.properties.STATE);
      labelCanvas.drawLabel(html, shape, EMPTY_STYLE);
    }
  }

  getIconSize(feature: Feature): number {
    return Math.round(
        Math.sqrt(Math.round(feature.properties.TOT_POP / 10000) * 10000 / Math.PI) / 28);
  }
}

export const CITY_LAYER_ID = "usa_cities";

export function createCitiesLayer(painter?: FeaturePainter | null,
                                  options?: { labelsAlwaysVisible: boolean }): FeatureLayer {

  const citiesStore = new UrlStore({
    target: "/sampledata/cities.json"
  });

  const citiesModel = new FeatureModel(citiesStore, {
    reference: CRS84
  });

  let citiesPainter;
  if (painter) {
    citiesPainter = painter;
  } else {
    citiesPainter = new CitiesPainter(options?.labelsAlwaysVisible ?? false);
  }

  return new FeatureLayer(citiesModel, {
    id: CITY_LAYER_ID,
    label: "USA Cities",
    layerType: LayerType.STATIC,
    painter: citiesPainter,
    selectable: true
  });
}

export function createWorldLayer(): FeatureLayer {
  const store = new UrlStore({
    target: "/sampledata/world.json"
  })
  const model = new FeatureModel(store, {
    reference: getReference("EPSG:4326")
  });
  return new FeatureLayer(model, {
    label: "World Countries",
    layerType: LayerType.STATIC,
    selectable: true
  });
}

type BingMapsType = "aerial" | "road" | "AerialWithLabels" | "CanvasLight" | "CanvasDark" | "CanvasGray";

export const createBingMapsLayer = async (type: BingMapsType) => {
  const data = await fetch(`/sampleservices/bingproxy/${type}`).then(response => response.json())
      .catch(_err => {
        throw new Error(
            "Something went wrong while contacting the Bing proxy. Did you configure it with a Bing Maps key?"
        )
      });

  let resource;
  if (data.resourceSets[0] && data.resourceSets[0].resources[0]) {
    resource = data.resourceSets[0].resources[0];
    resource.brandLogoUri = data.brandLogoUri;
  } else {
    resource = data;
  }
  const model = new BingMapsTileSetModel(resource);
  return new RasterTileSetLayer(model, {
    label: `${type} (Bing)`,
    layerType: LayerType.BASE,
    id: "Bing"
  });
}

type AirspaceDataset = "airspaces_us" | "airspaces_vv";
export const createAirspaceLayer = (dataset: AirspaceDataset, painter?: FeaturePainter) => {
  const fileHasIds = dataset === "airspaces_vv";
  const store = new UrlStore({
    target: `/sampledata/${dataset}.json`,
    codec: new AirspaceGeoJsonCodec({
      generateIDs: !fileHasIds,
      lowerLimitProperty: "Lower_Limit",
      upperLimitProperty: "Upper_Limit"
    })
  });
  const model = new FeatureModel(store, {
    reference: getReference("EPSG:4326")
  });
  return new FeatureLayer(model, {
    id: "airspaces",
    painter: painter,
    label: 'Airspaces',
    selectable: true
  });
}