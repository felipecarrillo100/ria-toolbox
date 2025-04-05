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
import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {VISIBILITY_BOX_LAYER_ID, VisibilityBoxSupport} from "../VisibilityBoxSupport.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {distance, rayRectangleIntersection} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {createFacePolygons} from "@luciad/ria-toolbox-core/util/AdvancedShapeFactory.js";
import {BoxResizeController} from "./BoxResizeController.js";
import {BOX_CHANGED_EVENT, OrientedBoxEditingSupport} from "../OrientedBoxEditingSupport.js";
import {OrientedBox} from "@luciad/ria/shape/OrientedBox.js";
import {Map} from "@luciad/ria/view/Map.js";
import {BoxMoveController} from "./BoxMoveController.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";

export function createSwitchableEditingControllers(editSupport: OrientedBoxEditingSupport,
                                                   startWithResizing: boolean, onClickOutsideBox: () => void,
                                                   onChangeController: (controller: Controller) => void) {
  let resizeOnClick = (_: boolean) => {
  };

  const moveOnClick = (intersectsBox: boolean) => {
    if (intersectsBox) {
      onChangeController(new BoxResizeController(editSupport, {onClick: resizeOnClick}))
    } else {
      onClickOutsideBox();
    }
  };

  resizeOnClick = (intersectsBox: boolean) => {
    if (intersectsBox) {
      onChangeController(new BoxMoveController(editSupport, {onClick: moveOnClick}))
    } else {
      onClickOutsideBox();
    }
  };

  if (startWithResizing) {
    return new BoxResizeController(editSupport, {onClick: resizeOnClick})
  } else {
    return new BoxMoveController(editSupport, {onClick: moveOnClick});
  }
}

/**
 * Controller used to visualize and select the oriented boxes from a given {@link VisibilityBoxSupport}.
 * When selecting an oriented box, the map's controller is switched to a {@link BoxResizeController} which allows
 * users to switch to a {@link BoxMoveController} and back by clicking on the oriented box.
 * When clicking outside of the edited box, this controller is put back on the map.
 */
export class BoxSelectController extends Controller {

  private readonly _support: VisibilityBoxSupport;
  private readonly _onChangeController: (controller: Controller) => void;

  /**
   * Creates a new BoxSelectController with given visibility support and callback that is used to set a new controller
   * on the map.
   * If that callback isn't passed, this controller will just set the controller directly on the map.
   */
  constructor(support: VisibilityBoxSupport, onChangeController?: (controller: Controller) => void) {
    super();
    this._support = support;
    this._onChangeController = onChangeController ?? ((controller: Controller) => {
      if (this.map) {
        this.map.controller = controller
      }
    })
  }

  onActivate(map: Map) {
    const boxLayer = map.layerTree.findLayerById(VISIBILITY_BOX_LAYER_ID);
    if (boxLayer) {
      boxLayer.visible = true;
    }
    this._support.unfocus();
    super.onActivate(map);
  }

  onDeactivate(map: Map): any {
    this.map!.clearHovered();
    return super.onDeactivate(map);
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    if (event.type === GestureEventType.MOVE) {
      const hoveredBoxId = this.findClosestIntersectedBox(event.viewPoint);
      const boxLayer = this.map!.layerTree.findLayerById(VISIBILITY_BOX_LAYER_ID);
      if (hoveredBoxId !== null &&
          (boxLayer as FeatureLayer)?.workingSet.get().find((box) => box.id === hoveredBoxId)) {
        const box = (boxLayer.model as FeatureModel).get(hoveredBoxId) as Feature;
        this.map!.hoverObjects([{objects: [box], layer: boxLayer as FeatureLayer}]);
      } else {
        this.map!.clearHovered();
      }
      return EVENT_HANDLED;
    } else if (event.type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      return this.handleClick(event);
    }
    return super.onGestureEvent(event);
  }

  private handleClick(event: GestureEvent) {
    const hoveredBoxId = this.findClosestIntersectedBox(event.viewPoint);
    if (hoveredBoxId) {
      this._support.focusOnBox(hoveredBoxId);
      const config = this._support.configs.find(({id}) => id === hoveredBoxId)!;
      const editSupport = new OrientedBoxEditingSupport(config.expression.value);
      const editHandle = editSupport.on(BOX_CHANGED_EVENT, (box: OrientedBox) => {
        config.expression.value = box;
        this._support.updateBox(hoveredBoxId, box);
      })

      this._onChangeController(createSwitchableEditingControllers(editSupport, true, () => {
            this._onChangeController(this);
            this._support.unfocus();
            editHandle.remove();
          }, (controller: Controller) => this._onChangeController(controller)
      ));
      return EVENT_HANDLED;
    }
    return EVENT_IGNORED;
  }

  private findClosestIntersectedBox(viewPoint: Vector3) {
    if (!this.map) {
      return null;
    }
    const eye = (this.map.camera as PerspectiveCamera).eye;
    const pointingDirection = calculatePointingDirection(this.map, viewPoint);
    let minDistance = Number.MAX_SAFE_INTEGER;
    let closestBoxId: string | null = null;

    for (const config of this._support.configs) {
      const box = config.expression.value;
      for (const rectangle of createFacePolygons(box)) {
        const intersectionPoint = rayRectangleIntersection(
            eye,
            pointingDirection,
            rectangle
        );
        if (intersectionPoint) {
          const intersectionDistance = distance(intersectionPoint, eye);
          if (intersectionDistance < minDistance) {
            minDistance = intersectionDistance;
            closestBoxId = config.id;
          }
        }
      }
    }
    return closestBoxId;
  }
}