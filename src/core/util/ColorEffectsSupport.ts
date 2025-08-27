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
import {
  and,
  add,
  clamp,
  color,
  Color,
  colorParameter,
  defaultColor,
  divide,
  dotProduct,
  eq,
  Expression,
  ifThenElse,
  mix,
  multiply,
  number,
  numberParameter,
  ParameterExpression,
} from '@luciad/ria/util/expression/ExpressionFactory.js';
import {LayerTreeNode} from '@luciad/ria/view/LayerTreeNode.js';
import {TileSet3DLayer} from '@luciad/ria/view/tileset/TileSet3DLayer.js';
import {LayerTreeVisitor} from '@luciad/ria/view/LayerTreeVisitor.js';
import {Layer} from '@luciad/ria/view/Layer.js';
import {LayerGroup} from '@luciad/ria/view/LayerGroup.js';
import VisitOrder = LayerTreeNode.VisitOrder;
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {isDefined} from "./Lang.js";

export const DEFAULT_COLOR_CONTRAST = 0.1;
export const DEFAULT_COLOR_BRIGHTNESS = 0.02;
export const DEFAULT_COLOR_SATURATION = 0.3;
export const DEFAULT_COLOR_OPACITY = undefined;

//use this color to not overwrite the default color
const DEFAULT_COLOR_EXPRESSION_VALUE = 'rgb(-1,-1,-1,0)';

/**
 * Contains both the color adjustment expression that can be applied on a 3D
 * layer, and its components that can be tweaked to affect the resulting
 * expression.
 */
export type ColorAdjustment = {
  readonly brightnessParam: ParameterExpression<number>;
  readonly contrastParam: ParameterExpression<number>;
  readonly saturationParam: ParameterExpression<number>;
  readonly opacityParam?: ParameterExpression<number>;
  readonly baseColorParam: ParameterExpression<Color>;
  readonly baseColorExpression: Expression<Color>;
  readonly colorExpression: Expression<Color>;
};

type ColorAdjustmentReference = {
  colorAdjustment?: ColorAdjustment | null;
}

/**
 * Makes a simple color expression that adjusts brightness, contrast and saturation.
 * The parameter values are: 0 = no effect, <0 = less, >0 = more.
 * Reasonable range is around -0.3 to +0.3.
 * </p>
 * You can also use <code>createColorAdjustement</code>, which allows more control using expression parameters.
 *
 * @since 2025.0
 */
export function createColorAdjustmentExpression(brightness: number, contrast: number, saturation: number, colorExpression?: Expression<Color>): Expression<Color> {
  let expr = colorExpression ?? defaultColor();
  expr = saturation ? mix(multiply(color('rgba(255, 255, 255, 1.0)'), dotProduct(expr, color("rgba(" + 0.2126 * 255 + ", " + 0.7152 * 255 + ", " + 0.0722 * 255 + ", 0.0)"))), expr, add(number(saturation), number(1.0))) : expr;
  expr = contrast ? add(number(0.5), multiply(add(number(1.0), number(contrast)), add(expr, number(-0.5)))) : expr;
  expr = brightness ? add(expr, number(brightness)) : expr;
  return expr;
}

/**
 * Makes a color expression that adjusts brightness, contrast and saturation.
 * The brightness, contrast and saturation values are: 0 = no effect, <0 = less,
 * >0 = more.
 * Reasonable range is around -0.3 to +0.3.
 * </p>
 * You can also use <code>createColorAdjustementExpression</code> to make simple expression without parameters.
 */
export function createColorAdjustment(
    brightness: number,
    contrast: number,
    saturation: number,
    opacity?: number,
    baseColor?: string,
    baseExpressionColor?: Expression<Color>
): ColorAdjustment {
  const brightnessParam = numberParameter(brightness);
  const contrastParam = numberParameter(contrast);
  const saturationParam = numberParameter(saturation);
  const opacityParam = opacity ? numberParameter(opacity) : undefined;
  const baseColorParam: ParameterExpression<string> = colorParameter(baseColor ?? DEFAULT_COLOR_EXPRESSION_VALUE);
  const baseColorExpression: Expression<string> = baseExpressionColor ?? color(DEFAULT_COLOR_EXPRESSION_VALUE);
  /** We have 4 cases:
   1: we don't have a base color or a base expression => we use the default
   2/3: we have only one of the two => we only use the one we have
   4: We have both => we mix them by taking the average of the two.
   */
  const colorParam = ifThenElse(
      and(eq(baseColorParam, color(DEFAULT_COLOR_EXPRESSION_VALUE)),
          eq(baseColorExpression, color(DEFAULT_COLOR_EXPRESSION_VALUE))),
      defaultColor(),//case 1
      ifThenElse(
          eq(baseColorParam, color(DEFAULT_COLOR_EXPRESSION_VALUE))
          , baseColorExpression, // case 2
          ifThenElse(
              eq(baseColorExpression, color(DEFAULT_COLOR_EXPRESSION_VALUE)),
              baseColorParam,//case 3
              divide(
                  add(baseColorParam, baseColorExpression) // case 4
                  , number(2.0))
          )));

  let colorExpression = mix(
      multiply(
          color('rgba(255, 255, 255, 1.0)'),
          dotProduct(
              colorParam,
              color(
                  'rgba(' +
                  0.2126 * 255 +
                  ', ' +
                  0.7152 * 255 +
                  ', ' +
                  0.0722 * 255 +
                  ', 0.0)'
              )
          )
      ),
      colorParam,
      add(saturationParam, number(1.0))
  );
  colorExpression = add(
      number(0.5),
      multiply(
          add(number(1.0), contrastParam),
          add(colorExpression, number(-0.5))
      )
  );
  colorExpression = add(colorExpression, brightnessParam);
  // cut the saturated part of the color
  colorExpression = clamp(colorExpression, number(0.0), number(1.0));
  if (opacityParam) {
    // restore the original alpha value from the given color.
    colorExpression = add(
        multiply(colorExpression, color('rgba(255, 255, 255, 0.0)')),
        multiply(opacityParam, multiply(colorParam, color('rgba(0, 0, 0, 1.0)')))
    );
  }

  return {
    brightnessParam,
    contrastParam,
    saturationParam,
    opacityParam,
    baseColorParam,
    baseColorExpression,
    colorExpression,
  };
}

function applyLayerColorExpressionToLayer(
    layer: LayerTreeNode,
    colorExpression: Expression<string>
) {
  if (layer instanceof TileSet3DLayer) {
    layer.meshStyle.colorExpression = colorExpression;
    layer.pointCloudStyle.colorExpression = colorExpression;
  }
}

export class ColorEffectsSupport {
  private readonly _globalAdjustment: ColorAdjustment = createColorAdjustment(
      DEFAULT_COLOR_BRIGHTNESS,
      DEFAULT_COLOR_CONTRAST,
      DEFAULT_COLOR_SATURATION,
      DEFAULT_COLOR_OPACITY
  );
  private readonly _maps: Map[];
  private readonly _nodeSpecificAdjustments: Record<string, ColorAdjustment> =
      {};

  /**
   * @param maps all the maps to store style for and apply new styles to.
   * @param applyAdjustmentToNodes if true all the nodes in the layer tree will have a default color adjustment generated
   * for them in the Record and this default style will be applied to them.
   * If false then we will only have the entry in the record generated. The default color will not be applied to them.
   */
  constructor(maps: WebGLMap[], applyAdjustmentToNodes: boolean) {
    this._maps = maps;
    this._maps.forEach(map => {
      this.applyEffect(map.layerTree, applyAdjustmentToNodes);

      map.layerTree.on('NodeAdded', ({node}) => {
            this.applyEffectOnMaps(node.id)
          }
      );
    });
  }

  /**
   * Brightness applied to all nodes of the layer tree where no specific
   * adjustment is defined
   */
  get globalBrightness() {
    return this._globalAdjustment.brightnessParam.value;
  }

  set globalBrightness(brightness: number) {
    this._globalAdjustment.brightnessParam.value = brightness;
  }

  /**
   * Contrast applied to all nodes of the layer tree where no specific
   * adjustment is defined
   */
  get globalContrast() {
    return this._globalAdjustment.contrastParam.value;
  }

  set globalContrast(contrast: number) {
    this._globalAdjustment.contrastParam.value = contrast;
  }

  /**
   * Saturation applied to all nodes of the layer tree where no specific
   * adjustment is defined
   */
  get globalSaturation() {
    return this._globalAdjustment.saturationParam.value;
  }

  set globalSaturation(saturation: number) {
    this._globalAdjustment.saturationParam.value = saturation;
  }

  updateNodeSpecificEffect(
      layerTreeNodeId: string,
      brightness: number,
      contrast: number,
      saturation: number,
      opacity?: number,
      baseColor?: string,
      baseColorExpression?: Expression<Color>
  ) {
    let adjustment = this._nodeSpecificAdjustments[layerTreeNodeId];
    //To change the baseColorExpression we have to regenerate and adjustment.
    //To change the opacity state from undefined to defined too.
    if (adjustment && baseColorExpression === adjustment.baseColorExpression &&
        ((isDefined(opacity)) === (isDefined(adjustment.opacityParam)))) {
      if (brightness !== adjustment.brightnessParam.value) {
        adjustment.brightnessParam.value = brightness;
      }
      if (contrast !== adjustment.contrastParam.value) {
        adjustment.contrastParam.value = contrast;
      }
      if (saturation !== adjustment.saturationParam.value) {
        adjustment.saturationParam.value = saturation;
      }
      if (opacity !== undefined && opacity !== adjustment.opacityParam!.value) {
        adjustment.opacityParam!.value = opacity;
      }
      if (
          !baseColor &&
          adjustment.baseColorParam.value !== DEFAULT_COLOR_EXPRESSION_VALUE
      ) {
        adjustment.baseColorParam.value = DEFAULT_COLOR_EXPRESSION_VALUE;
      } else if (baseColor && adjustment.baseColorParam.value !== baseColor) {
        adjustment.baseColorParam.value = baseColor;
      }
    } else {
      adjustment = createColorAdjustment(
          brightness,
          contrast,
          saturation,
          opacity,
          baseColor,
          baseColorExpression
      );
      this._nodeSpecificAdjustments[layerTreeNodeId] = adjustment;
      this.applyEffectOnMaps(layerTreeNodeId);
    }
  }

  removeNodeSpecificEffect(layerTreeNodeId: string) {
    if (this._nodeSpecificAdjustments[layerTreeNodeId]) {
      delete this._nodeSpecificAdjustments[layerTreeNodeId];
      this.applyEffectOnMaps(layerTreeNodeId);
    }
  }

  private applyEffectOnMaps(layerTreeNodeId: string) {
    this._maps.forEach(map => {
      const node = map.layerTree.findLayerTreeNodeById(layerTreeNodeId);
      if (node) {
        this.applyEffect(node, true);
      }
    });
  }

  private applyEffect(node: LayerTreeNode, applyAdjustmentToNodes: boolean) {
    let colorExpression: Expression<Color> | null =
        this._nodeSpecificAdjustments[node.id]?.colorExpression ?? null;
    let parent: LayerTreeNode = node;
    while (!colorExpression && parent.parent) {
      parent = parent.parent;
      colorExpression =
          this._nodeSpecificAdjustments[parent.id]?.colorExpression ?? null;
    }
    if (!colorExpression) {
      colorExpression = this._globalAdjustment.colorExpression;
    }

    const createVisitor = (
        colorExpression: Expression<Color>
    ): LayerTreeVisitor => {
      const visitor: LayerTreeVisitor = {
        visitLayer: (layer: Layer): LayerTreeVisitor.ReturnValue => {
          if (applyAdjustmentToNodes) {
            applyLayerColorExpressionToLayer(
                layer,
                this._nodeSpecificAdjustments[layer.id]?.colorExpression ??
                colorExpression
            );
          }
          return LayerTreeVisitor.ReturnValue.CONTINUE;
        },
        visitLayerGroup: (group: LayerGroup): LayerTreeVisitor.ReturnValue => {
          group.visitChildren(
              this._nodeSpecificAdjustments[group.id]?.colorExpression
              ? createVisitor(
                  this._nodeSpecificAdjustments[group.id]?.colorExpression
              )
              : visitor,
              VisitOrder.TOP_DOWN
          );
          return LayerTreeVisitor.ReturnValue.CONTINUE;
        },
      };
      return visitor;
    };

    if (node instanceof Layer && applyAdjustmentToNodes) {
      applyLayerColorExpressionToLayer(node, colorExpression);
    } else {
      node.visitChildren(
          createVisitor(colorExpression),
          LayerTreeNode.VisitOrder.TOP_DOWN
      );
    }
  }

  getParentNodeAdjustment(nodeId: string): ColorAdjustment | null {
    for (let i = 0; i < this._maps.length; i++) {
      const map = this._maps[i];
      let parent = map.layerTree.findLayerTreeNodeById(nodeId)?.parent;
      while (parent !== null) {
        const colorAdjustment = this._nodeSpecificAdjustments[parent.id]
        if (colorAdjustment) {
          return colorAdjustment;
        } else {
          parent = parent.parent;
        }
      }
    }
    return null;
  }

  getNodeAdjustment(nodeId: string, getParentIfEmpty: boolean): ColorAdjustment | null {
    return this._nodeSpecificAdjustments[nodeId] ?? (getParentIfEmpty ? this.getParentNodeAdjustment(nodeId) : null);
  }
}