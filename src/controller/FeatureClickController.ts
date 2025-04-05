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
import {Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {PickController} from "@luciad/ria/view/controller/PickController.js";
import {PaintRepresentation} from "@luciad/ria/view/PaintRepresentation.js";
import {PickInfo} from "@luciad/ria/view/PickInfo.js";
import {Point} from "@luciad/ria/shape/Point.js";

export const FEATURE_CLICKED = "FeatureClicked";

/**
 * A controller that emits events when a feature is clicked.
 * Note that this controller will *not* select features. You can use
 * <code>@luciad/ria/view/controllers/SelectController</code> for that.
 *
 * As an example, this controller is used with panoramas to enter/move in a panorama when its icon is clicked.
 *
 * This controller fires event when a feature from one of its layers was clicked.
 * You can listen to click events as follows:
 *
 * <code>
 *   const logClick = (feature, layer, gestureEvent) => {
 *     console.log(`Clicked on feature with ID: ${feature.id} from layer ${layer.label} at mouse [${gestureEvent.x}, ${gestureEvent.y}]`);
 *   }
 *   const clickController = new FeatureClickController([myFeatureLayer]);
 *   clickController.on(FEATURE_CLICKED, logClick);
 *   map.controller = clickController;
 * </code>
 */
export class FeatureClickController extends PickController {
  private readonly _eventedSupport: EventedSupport;
  private readonly _layers: FeatureLayer[];

  constructor(layers: FeatureLayer[]) {
    super();
    this._eventedSupport = new EventedSupport([FEATURE_CLICKED]);
    this._layers = layers;
  }

  getPaintRepresentations(event: GestureEvent): PaintRepresentation[] {
    return [PaintRepresentation.BODY];
  }

  getCandidates(viewPoint: Point | null, sensitivity: number, paintRepresentations: PaintRepresentation[], multiple: boolean): PickInfo[] {
    return super.getCandidates(viewPoint, sensitivity, paintRepresentations, multiple).filter(c => this._layers.indexOf(c.layer as FeatureLayer) >= 0);
  }

  handleCandidates(gestureEvent: GestureEvent, candidates: PickInfo[]): HandleEventResult {
    if (candidates.length === 0) {
      return HandleEventResult.EVENT_IGNORED;
    }
    const closestPick = candidates[0];
    this._eventedSupport.emit(FEATURE_CLICKED, closestPick.objects[0], closestPick.layer, gestureEvent);
    return HandleEventResult.EVENT_HANDLED;
  }

  isPickEvent(gestureEvent: GestureEvent): boolean {
    if (gestureEvent.inputType === "mouse") {
      return gestureEvent.type === GestureEventType.SINGLE_CLICK_UP && (gestureEvent.domEvent as MouseEvent).button === 0;
    }
    return gestureEvent.inputType === "touch" && gestureEvent.type === GestureEventType.SINGLE_CLICK_CONFIRMED;
  }

  on(event: typeof FEATURE_CLICKED | "Invalidated" | "Activated" | "Deactivated", callback: (...args: any[]) => void,
     context?: any): Handle {
    if (event === FEATURE_CLICKED) {
      return this._eventedSupport.on(event, callback, context);
    } else if (event === "Invalidated") {
      return super.on(event, callback, context);

    } else if (event === "Activated") {
      return super.on(event, callback, context);
    }
    return super.on(event, callback, context);
  }
}
