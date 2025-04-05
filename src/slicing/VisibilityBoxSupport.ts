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
import {OrientedBox} from "@luciad/ria/shape/OrientedBox.js";
import {Map} from "@luciad/ria/view/Map.js";
import {
  and,
  boolean,
  Expression,
  isInside,
  not,
  or,
  ParameterExpression
} from "@luciad/ria/util/expression/ExpressionFactory.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {TileSet3DLayer} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {MemoryStore} from "@luciad/ria/model/store/MemoryStore.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {FeaturePainter} from "@luciad/ria/view/feature/FeaturePainter.js";
import {drawBox} from "./OrientedBoxDrawUtil.js";
import ReturnValue = LayerTreeVisitor.ReturnValue;

export enum Effect {
  NONE,
  VISIBLE_INSIDE,
  VISIBLE_OUTSIDE
}

export interface VisibilityBoxConfig {
  id: string;
  name: string;
  expression: ParameterExpression<OrientedBox>;
  enabled: boolean;
  isInsideLayers: string[];
  isOutsideLayers: string[];
  newLayersEffect: Effect;
}

/**
 * Event that is emitted when the configs have been changed.
 * This can either be because configs have been added, removed or modified.
 */
export const CONFIGS_CHANGED_EVENT = "ConfigsChangedEvent";

export const FOCUS_CHANGED_EVENT = "FocusChangedEvent";

export const VISIBILITY_BOX_LAYER_ID = "VISIBILITY_BOX_LAYER";

/**
 * Support class that sets and updates visibility expressions on a map's Tileset3DLayers, defined by given configs.
 */
export class VisibilityBoxSupport {

  private readonly _eventedSupport: EventedSupport = new EventedSupport([CONFIGS_CHANGED_EVENT, FOCUS_CHANGED_EVENT], true);
  private readonly _map: Map;
  private readonly _model: FeatureModel;
  private readonly _layer: FeatureLayer;
  private readonly _configs: VisibilityBoxConfig[];
  private readonly _handles: Handle[] = [];

  private _focusedConfigId: string | null = null;

  constructor(map: Map, layerGroup: LayerGroup, configs: VisibilityBoxConfig[] = []) {
    this._map = map;
    this._model = new FeatureModel(new MemoryStore(), {reference: getReference("EPSG:4978")});
    this._layer = this.createLayer();
    layerGroup.addChild(this._layer);
    this._configs = configs;
    for (const config of configs) {
      this.updateBox(config.id, config.expression.value);
    }
    this.updateExpressions();
    this.initializeNodeAddedListener();
    this.initializeNodeRemovedListener();
  }

  private createLayer() {
    const painter = new FeaturePainter();
    painter.paintBody = (geoCanvas, feature, shape, _layer, _map, paintState) => {
      if (!this._focusedConfigId || feature.id === this._focusedConfigId) {
        drawBox(geoCanvas, shape as OrientedBox,
            {hightlighted: !this._focusedConfigId && paintState.hovered, withOccludedPart: true});
      }
    }
    return new FeatureLayer(this._model,
        {
          id: VISIBILITY_BOX_LAYER_ID,
          label: "Visibility Boxes",
          painter,
          hoverable: true
        });
  }

  /**
   * Cleans this support by removing the created handles.
   */
  destroy() {
    for (const handle of this._handles) {
      handle.remove();
    }
    if (this._layer.parent) {
      this._layer.parent.removeChild(this._layer);
    }
  }

  /**
   * Only visualize the box of the config with given id.
   */
  focusOnBox(configId: string) {
    this._focusedConfigId = configId;
    this._layer.painter.invalidateAll();
    this._eventedSupport.emit(FOCUS_CHANGED_EVENT, configId);
  }

  /**
   * Visualize all of the configs' boxes.
   */
  unfocus() {
    this._focusedConfigId = null;
    this._layer.painter.invalidateAll();
    this._eventedSupport.emit(FOCUS_CHANGED_EVENT, null);
  }

  /**
   * The configs used by this support to create visibility expressions.
   */
  get configs() {
    return [...this._configs]
  }

  /**
   * Adds the given config to the support and reset the visibility expressions to take the new config into account.
   */
  addConfig(config: VisibilityBoxConfig) {
    this._configs.push(config);
    this.updateBox(config.id, config.expression.value);
    this._eventedSupport.emit(CONFIGS_CHANGED_EVENT);
    this.updateExpressions();
  }

  /**
   * Updates the visualized box that corresponds to the config with given id.
   */
  updateBox(configId: string, box: OrientedBox) {
    this._model.put(new Feature(box, {}, configId))
  }

  /**
   * Updates the given config that was already present in this support and reset the visibility expressions to take the
   * new update into account.
   */
  updateConfig(config: VisibilityBoxConfig) {
    const index = this._configs.findIndex(({id}) => id === config.id);
    if (index >= 0) {
      this._configs[index] = config;
      this.updateBox(config.id, config.expression.value);
      this._eventedSupport.emit(CONFIGS_CHANGED_EVENT);
      this.updateExpressions();
    }
  }

  /**
   * Remove the config with given id from to the support and reset the visibility expressions to take the removal
   * into account.
   */
  removeConfig(id: string) {
    const index = this._configs.findIndex((config) => id === config.id);
    if (index >= 0) {
      this._configs.splice(index, 1);
      this._model.remove(id);
      this._eventedSupport.emit(CONFIGS_CHANGED_EVENT);
      this.updateExpressions();
    }
  }

  /**
   * Updates the visibility expressions of all TileSet3DLayers on the map to follow this support's configs.
   * If multiple layers have all box expressions applied with the same effects, the resulting expressions will be shared.
   */
  private updateExpressions() {
    const createdExpressions = {} as { [key: string]: Expression<boolean> };

    const visitor: LayerTreeVisitor = {
      visitLayer: (layer): LayerTreeVisitor.ReturnValue => {
        if (!(layer instanceof TileSet3DLayer)) {
          return ReturnValue.CONTINUE;
        }
        const insideExpressions: ParameterExpression<OrientedBox>[] = [];
        const outsideExpressions: ParameterExpression<OrientedBox>[] = [];
        const inIds = [] as string[];
        const outIds = [] as string[];
        for (const config of this._configs) {
          if (!config.enabled) {
            continue;
          }
          if (config.isInsideLayers.indexOf(layer.id) >= 0) {
            insideExpressions.push(config.expression);
            inIds.push(config.id);
          }
          if (config.isOutsideLayers.indexOf(layer.id) >= 0) {
            outsideExpressions.push(config.expression);
            outIds.push(config.id);
          }
        }

        const expressionKey = `ìn: [${inIds.join(",")}], out: [${outIds.join(",")}]`

        let expression;
        if (createdExpressions[expressionKey]) {
          expression = createdExpressions[expressionKey];
        } else {
          expression = this.createVisibilityExpression(insideExpressions, outsideExpressions);
          createdExpressions[expressionKey] = expression;
        }

        layer.meshStyle.visibilityExpression = expression;
        layer.pointCloudStyle.visibilityExpression = expression;
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      },
      visitLayerGroup: (layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue => {
        layerGroup.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      }
    };
    this._map.layerTree.accept(visitor);
  }

  private createVisibilityExpression(insideExpressions: ParameterExpression<OrientedBox>[],
                                     outsideExpressions: ParameterExpression<OrientedBox>[]) {
    const insideExpression = insideExpressions.length === 0 ?
                             boolean(true) :
                             or(...insideExpressions.map(box => isInside(box)))
    const outsideExpression = outsideExpressions.length === 0 ?
                              boolean(true) :
                              and(...outsideExpressions.map(box => not(isInside(box))));

    return and(insideExpression, outsideExpression);
  }

  private initializeNodeAddedListener() {
    let configsChanged = false;
    const visitor: LayerTreeVisitor = {
      visitLayer: (layer): LayerTreeVisitor.ReturnValue => {
        if (!(layer instanceof TileSet3DLayer)) {
          return ReturnValue.CONTINUE;
        }
        for (const config of this._configs) {
          configsChanged = configsChanged || config.newLayersEffect !== Effect.NONE;
          if (config.newLayersEffect === Effect.VISIBLE_INSIDE) {
            config.isInsideLayers.push(layer.id);
          } else if (config.newLayersEffect === Effect.VISIBLE_OUTSIDE) {
            config.isInsideLayers.push(layer.id);
          }
        }
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      },
      visitLayerGroup: (layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue => {
        layerGroup.visitChildren(visitor, LayerTreeNode.VisitOrder.TOP_DOWN);
        return LayerTreeVisitor.ReturnValue.CONTINUE;
      }
    };
    this._handles.push(this._map.layerTree.on("NodeAdded", (change) => {
      configsChanged = false;
      change.node.accept(visitor);
      if (configsChanged) {
        this._eventedSupport.emit(CONFIGS_CHANGED_EVENT);
        this.updateExpressions();
      }
    }));
  }

  private initializeNodeRemovedListener() {
    this._handles.push(this._map.layerTree.on("NodeRemoved", (change) => {
      for (const config of this._configs) {
        config.isInsideLayers = config.isInsideLayers.filter((id) => !change.node.findLayerById(id));
        config.isOutsideLayers = config.isOutsideLayers.filter((id) => !change.node.findLayerById(id));
      }
    }));
  }

  on(event: typeof CONFIGS_CHANGED_EVENT, callback: () => void, context?: any): Handle;
  on(event: typeof FOCUS_CHANGED_EVENT, callback: (id: string | null) => void, context?: any): Handle;

  on(event: string, callback: (...args: any[]) => void, context?: any): Handle {
    return this._eventedSupport.on(event, callback, context);
  }
}