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
import {createOrientedBox, createPoint, createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {OrthographicCamera} from "@luciad/ria/view/camera/OrthographicCamera.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {Map} from "@luciad/ria/view/Map.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {
  CARTESIAN_REFERENCE,
  createCartesianMap,
  createSliceMap,
  DEFAULT_SLICE_COLOR,
  SLICE_MAP_FOV_Y, synchronizeMeshLayers
} from "./util/CrossSectionMapUtil.js";
import {
  CROSS_SECTION_GEODESY,
  CROSS_SECTION_MODEL_REFERENCE,
  CrossSectionPlane,
  GRID_SEGMENT_SIZE
} from "./CrossSectionPlane.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {
  CARTESIAN_MEASUREMENT_CHANGED_EVENT,
  CartesianMeasurement,
  CartesianRulerController,
  MeasureState
} from "./CartesianRulerController.js";
import {CrossSectionController} from "./CrossSectionController.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {MemoryStore} from "@luciad/ria/model/store/MemoryStore.js";
import {CrossSectionMeasurementPainter} from "./CrossSectionMeasurementPainter.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {sub} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {ReferenceType} from "@luciad/ria/reference/ReferenceType.js";
import {Geodesy} from "@luciad/ria/geodesy/Geodesy.js";
import {createCartesianGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {createMeasurement} from "@luciad/ria-toolbox-ruler3d/measurement/MeasurementUtil.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {STYLE_GRID} from "./util/CrossSectionDrawUtil.js";
import {createTransformationFromGeoLocation} from "@luciad/ria/transformation/Affine3DTransformation.js";
import {
  Color,
  color,
  defaultColor,
  Expression,
  ifThenElse,
  isInside,
  orientedBox
} from "@luciad/ria/util/expression/ExpressionFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {CompositeController} from "@luciad/ria/view/controller/CompositeController.js";
import {ORTHOGONAL_MEASUREMENT_TYPE} from "@luciad/ria-toolbox-ruler3d/measurement/OrthogonalMeasurement.js";

export const CROSS_SECTION_DEACTIVATED_EVENT = "CrossSectionDeactivated";
export const BUSY_CHANGE_EVENT = 'BusyChange';
export const CARTESIAN_MAP_CREATED_EVENT = "CartesianMapCreated";
export const SLICE_MAP_CREATED_EVENT = "SliceMapCreated";
export const MEASUREMENT_AVAILABLE_EVENT = "MeasurementAvailable";
const MEASUREMENT_FEATURE_ID = "measurement-feature-id";
const MEASUREMENT_HOVER_FEATURE_ID = "measurement-hover-feature-id";
const GRID_FEATURE_ID = "grid-feature-id";
const DUMMY_BOX = createOrientedBox(getReference("EPSG:4978"), {x: 0, y: 0, z: 0}, {x: 0.001, y: 0.001, z: 0.001});

function findCrossSectionController(map: Map): CrossSectionController | null {
  if (!map.controller) {
    return null;
  }
  const controllersToCheck = [map.controller];
  while (controllersToCheck.length > 0) {
    const controller = controllersToCheck.splice(0, 1)[0];
    if (controller instanceof CrossSectionController) {
      return controller;
    } else if (controller instanceof CompositeController) {
      controllersToCheck.push(...controller.delegates);
    }
  }
  return null;
}

/**
 * Class that contains the (superposed) slice map which used to show the cross-section, and the
 * cartesian map which is used to do measurements.
 */
export class CrossSectionView {
  private readonly _eventedSupport: EventedSupport;
  private readonly _mainMap: WebGLMap;
  private readonly _geodesy: Geodesy;
  private readonly _modelToMapTransformation: Transformation;
  private readonly _measurementModel: FeatureModel;
  private readonly _measurementLayer: FeatureLayer;
  private readonly _cartesianGridModel: FeatureModel;
  private _handles: Handle[] = [];
  private _sliceMap?: WebGLMap;
  private _cartesianMap?: Map;
  private _plane: CrossSectionPlane = new CrossSectionPlane();
  private _boxExpression = orientedBox(DUMMY_BOX);
  private _busy: boolean = false;
  private readonly _highlight: boolean;

  constructor(mainMap: WebGLMap, sliceMapNode: HTMLElement, cartesianMapNode: HTMLElement,
              layerGroup: LayerGroup = mainMap.layerTree, highlight = true) {
    if (mainMap.reference.referenceType !== ReferenceType.GEOCENTRIC) {
      throw new Error(
          "The cross-section tool only works on geocentric maps, not with reference: " + mainMap.reference.identifier);
    }
    this._eventedSupport = new EventedSupport([
          CROSS_SECTION_DEACTIVATED_EVENT,
          MEASUREMENT_AVAILABLE_EVENT,
          BUSY_CHANGE_EVENT,
          CARTESIAN_MAP_CREATED_EVENT,
          SLICE_MAP_CREATED_EVENT],
        true);
    this._mainMap = mainMap;
    this._geodesy = createCartesianGeodesy(this._mainMap.reference);
    this._modelToMapTransformation = createTransformation(CROSS_SECTION_MODEL_REFERENCE, mainMap.reference);
    this._measurementModel = new FeatureModel(new MemoryStore(), {reference: CROSS_SECTION_MODEL_REFERENCE});
    this._measurementLayer = new FeatureLayer(this._measurementModel,
        {painter: new CrossSectionMeasurementPainter(), label: "Cross section measurements"});
    layerGroup.addChild(this._measurementLayer, "top");
    this._highlight = highlight;

    createSliceMap(mainMap, sliceMapNode).then(map => {
      this._sliceMap = map
      this._sliceMap.on('idle', () => {
        if (!this._busy) {
          this._busy = true;
          this._eventedSupport.emit(BUSY_CHANGE_EVENT, true);
          map.layerTree.whenReady().then(() => {
            this._busy = false;
            this._eventedSupport.emit(BUSY_CHANGE_EVENT, false);
          });
        }
      });
      this.updateSlice();
      const synchLayersHandle = this.synchronizeSliceMapLayers(this._mainMap, this._sliceMap);
      this._handles.push(synchLayersHandle);
      this._eventedSupport.emit(SLICE_MAP_CREATED_EVENT, this._sliceMap);
    });

    this._cartesianGridModel = new FeatureModel(new MemoryStore(), {reference: CARTESIAN_REFERENCE});
    const cartesianGridPainter = new FeaturePainter();
    cartesianGridPainter.paintBody = (geoCanvas, _feature, shape) => {
      geoCanvas.drawShape(shape, STYLE_GRID);
    }
    const cartesianGridLayer = new FeatureLayer(this._cartesianGridModel,
        {painter: cartesianGridPainter, label: "Cartesian Grid"});
    createCartesianMap(cartesianMapNode).then(map => {
      this._cartesianMap = map
      this.initializeCartesianRulerController(map);
      this.initializeCartesianMapChangeListener(map);
      map.layerTree.addChild(cartesianGridLayer, "top");
      this._eventedSupport.emit(CARTESIAN_MAP_CREATED_EVENT, map);
      this.updateCartesianGrid();
    });

    if (this._highlight) {
      this.initializeHighlightExpression();
    }
  }

  /**
   * Synchronizes the mesh layers of the main map with the slice map.
   * @param mainMap The main map.
   * @param sliceMap The slice map on which the cross-section will be painted.
   * @return a Handle object that's used to clean up the synchronization between the maps.
   *         When CrossSectionView.destroy() is called, this Handle.remove() is called.
   */
  protected synchronizeSliceMapLayers(mainMap: WebGLMap, sliceMap: WebGLMap) {
    return synchronizeMeshLayers(mainMap, sliceMap, this._highlight);
  }

  /**
   * The oriented box expression that represents the slice of the cross-section.
   * Use this in {@link createHighlightColorExpression} to create a color expression that highlights the cross-section.
   */
  get boxExpression() {
    return this._boxExpression;
  }

  /**
   * Create a color expression that highlights the cross-section on main map TileSet3DLayers.
   */
  protected createHighlightColorExpression(): Expression<Color> | null {
    return ifThenElse(isInside(this.boxExpression), color(DEFAULT_SLICE_COLOR), defaultColor());
  }

  /**
   * Applies the color expression that highlights the cross-section on all TileSet3DLayer layers of the main map.
   */
  private initializeHighlightExpression() {
    const highlightExpression = this.createHighlightColorExpression();

    const applyExpressionOnLayer = (layer: Layer) => {
      if (layer instanceof TileSet3DLayer) {
        layer.meshStyle.colorExpression = highlightExpression;
      }
    }

    const layerTreeVisitor: LayerTreeVisitor = {
      visitLayer: (layer: Layer): LayerTreeVisitor.ReturnValue => {
        applyExpressionOnLayer(layer);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      },
      visitLayerGroup(layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue {
        layerGroup.visitChildren(layerTreeVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      }
    };

    this._mainMap.layerTree.visitChildren(layerTreeVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
    this._handles.push(this._mainMap.layerTree.on("NodeAdded", applyExpressionOnLayer));
  }

  private initializeCartesianRulerController(cartesianMap: Map) {
    const controller = new CartesianRulerController({horizontalMargin: -10});
    cartesianMap.controller = controller;
    this._handles.push(controller.on(CARTESIAN_MEASUREMENT_CHANGED_EVENT, ({state, p1, p2}: CartesianMeasurement) => {
      const modelP1 = this.cartesianToModel(p1);
      if (state === MeasureState.NO_POINT_PLACED) {
        const cursorPoint = CROSS_SECTION_GEODESY.interpolate(modelP1, this._plane.width * 0.01,
            this._plane.azimuth + 180)
        this._measurementModel.put(new Feature(cursorPoint, {}, MEASUREMENT_HOVER_FEATURE_ID));
        return;
      } else {
        this._measurementModel.remove(MEASUREMENT_HOVER_FEATURE_ID);
      }

      const modelP2 = this.cartesianToModel(p2);

      const measurement = createMeasurement(ORTHOGONAL_MEASUREMENT_TYPE, [modelP1, modelP2]);
      const feature = new Feature(modelP1, {measurement}, MEASUREMENT_FEATURE_ID);
      this._measurementModel.put(feature);
      this._eventedSupport.emit(MEASUREMENT_AVAILABLE_EVENT, true);
    }));

  }

  private initializeCartesianMapChangeListener(cartesianMap: Map) {
    const [initialWidth, initialHeight] = cartesianMap.viewSize
    let lastCoords = cartesianMap.viewToMapTransformation.transform(
        createPoint(null, [initialWidth / 2, initialHeight / 2]));

    this._handles.push(cartesianMap.on('MapChange', () => {
      const [width, height] = cartesianMap.viewSize
      const center = cartesianMap.viewToMapTransformation.transform(createPoint(null, [width / 2, height / 2]));
      const newAnchor = CROSS_SECTION_GEODESY.interpolate(this._plane.anchorPoint, center.x - lastCoords.x,
          this._plane.azimuth + 90);
      newAnchor.z += center.y - lastCoords.y;
      lastCoords = center;
      this._plane.updateAnchorPoint(newAnchor, false);
      const cartesianCamera = cartesianMap.camera as OrthographicCamera;
      this._plane.updateDimensions(cartesianCamera.worldWidth, cartesianCamera.worldHeight);
      this.updateSliceMaps();
      const controller = findCrossSectionController(this._mainMap);
      if (controller) {
        controller.invalidateHandles();
      }
    }));
  }

  get cartesianMap(): Map {
    if (!this._cartesianMap) {
      throw new Error("Can not get cartesian map if the view is not fully initialized.");
    }
    return this._cartesianMap;
  }

  get plane(): CrossSectionPlane {
    return this._plane;
  }

  /**
   * Destroys the Vertical view by cleaning all internal states
   */
  destroy(): void {
    for (const handle of this._handles) {
      handle.remove();
    }
    this._cartesianMap?.destroy();
    this._sliceMap?.destroy();
    this._measurementLayer.parent?.removeChild(this._measurementLayer);
    if (this._highlight) {
      this.removeHighlightExpression();
    }
    this._eventedSupport.emit(CROSS_SECTION_DEACTIVATED_EVENT);
  }

  /**
   * Removes the color expression that highlights the cross-section from all TileSet3DLayer layers of the main map.
   */
  private removeHighlightExpression() {

    const layerTreeVisitor: LayerTreeVisitor = {
      visitLayer: (layer: Layer): LayerTreeVisitor.ReturnValue => {
        if (layer instanceof TileSet3DLayer) {
          layer.meshStyle.colorExpression = null;
        }
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      },
      visitLayerGroup(layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue {
        layerGroup.visitChildren(layerTreeVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      }
    };

    this._mainMap.layerTree.visitChildren(layerTreeVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
  }

  on(event: typeof CROSS_SECTION_DEACTIVATED_EVENT |
         typeof BUSY_CHANGE_EVENT |
         typeof CARTESIAN_MAP_CREATED_EVENT |
         typeof MEASUREMENT_AVAILABLE_EVENT |
         typeof SLICE_MAP_CREATED_EVENT,
     callback: (() => void) |
         ((busy: boolean) => void) |
         ((cartesianMap: Map) => void) |
         ((measurementAvailable: boolean) => void) |
         ((sliceMap: WebGLMap) => void)) {
    return this._eventedSupport.on(event, callback);
  }

  get measurement(): Feature | null {
    return (this._measurementModel.get(MEASUREMENT_FEATURE_ID) as Feature | undefined) ?? null;
  }

  clearMeasurements() {
    (this.cartesianMap.controller as CartesianRulerController).reset();
    this._measurementModel.remove(MEASUREMENT_FEATURE_ID);
    this._measurementModel.remove(MEASUREMENT_HOVER_FEATURE_ID);
    this._eventedSupport.emit(MEASUREMENT_AVAILABLE_EVENT, false);
  }

  /**
   * Updates the slice and cartesian map using the slicing plane of this object.
   */
  updateSliceMaps(): void {
    this.updateCartesianMapExtents();
    this.updateSlice();
    this.updateCartesianGrid();
  }

  /**
   * Updates the camera of the slice map and its mesh layers' visibility expressions using the slicing plane of this object.
   */
  private updateSlice() {
    if (this._cartesianMap && this._sliceMap && this._plane) {
      const {anchorPoint, azimuth} = this._plane;
      const worldPoint = this._modelToMapTransformation.transform(anchorPoint);

      const height = (this._cartesianMap.camera as OrthographicCamera).worldHeight;
      const width = (this._cartesianMap.camera as OrthographicCamera).worldWidth;
      const distance = height / 2 / Math.atan(((SLICE_MAP_FOV_Y / 2.0) * Math.PI) / 180.0);
      const thickness = Math.min(Math.max((0.5 * distance) / 1000.0, 0.4), 4.0) * 3;

      this._boxExpression.value = createOrientedBox(createTransformationFromGeoLocation(anchorPoint, {azimuth}),
          {x: -width / 2, y: -thickness / 2, z: -height / 2}, {x: width, y: thickness, z: height});

      this._sliceMap.camera = (this._sliceMap.camera as PerspectiveCamera)
          .lookAt({ref: worldPoint, pitch: 0, yaw: azimuth, roll: 0, distance})
          .copyAndSet({near: distance - thickness / 2, far: distance + thickness / 2});
    }
  }

  /**
   * Updates the cartesian map such that it's width and height correspond with those from the slicing plane
   */
  private updateCartesianMapExtents() {
    if (this._cartesianMap) {
      const camera = this._cartesianMap.camera as OrthographicCamera;
      if (camera.worldHeight !== this._plane.height || camera.worldWidth !== this.plane.width) {
        this._cartesianMap.camera = camera.copyAndSet({
          worldHeight: this._plane.height,
          worldWidth: this._plane.width
        })
      }
    }
  }

  /**
   * Updates the grid of the cartesian map, using the grid offset from the slicing plane.
   */
  private updateCartesianGrid() {
    if (this._cartesianMap) {
      const gridLines: Polyline[] = [];
      const [offsetX, offsetY] = this._plane.gridOffset;
      const width = this._plane.width;
      const height = this._plane.height;

      const startPoint = this._cartesianMap.viewToMapTransformation.transform(
          createPoint(null, [0, this._cartesianMap.viewSize[1]]));

      for (let x = startPoint.x + offsetX % GRID_SEGMENT_SIZE; x < startPoint.x + width; x += GRID_SEGMENT_SIZE) {
        gridLines.push(createPolyline(CARTESIAN_REFERENCE, [[x, startPoint.y], [x, startPoint.y + height]]));
      }
      for (let y = startPoint.y + offsetY % GRID_SEGMENT_SIZE; y < startPoint.y + height; y += GRID_SEGMENT_SIZE) {
        gridLines.push(createPolyline(CARTESIAN_REFERENCE, [[startPoint.x, y], [startPoint.x + width, y]]));
      }

      this._cartesianGridModel.put(new Feature(createShapeList(CARTESIAN_REFERENCE, gridLines), {}, GRID_FEATURE_ID));
    }
  }

  /**
   * Transforms a point on the cartesian map of this view to a point which can be visualized on the main map.
   */
  private cartesianToModel(cartesianPoint: Point): Point {
    const [width, height] = this.cartesianMap.viewSize;
    const cartesianCenter = this.cartesianMap.viewToMapTransformation.transform(
        createPoint(null, [width / 2, height / 2]));
    const modelCenter = this._plane.anchorPoint.copy();

    const translation = sub(cartesianPoint, cartesianCenter);
    const result = CROSS_SECTION_GEODESY.interpolate(modelCenter, translation.x, this._plane.azimuth + 90);
    result.z += translation.y;
    return result;
  }

}