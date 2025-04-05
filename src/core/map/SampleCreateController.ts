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
import {BasicCreateController} from "@luciad/ria/view/controller/BasicCreateController.js";
import {UndoManager} from "@luciad/ria/view/undo/UndoManager.js";
import {Map as RIAMap} from "@luciad/ria/view/Map.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Feature, FeatureProperties} from "@luciad/ria/model/feature/Feature.js";
import {addCreateFeatureUndoable} from "../util/SampleUndoSupport.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {KeyEventType} from "@luciad/ria/view/input/KeyEventType.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {CreateControllerConstructorOptions} from "@luciad/ria/view/controller/CreateController.js";

/**
 * A CreateController that is re-used throughout RIA samples.
 *
 * It adds two-step cancellation on Escape keypresses.
 * It can also add undoables to an UndoManager, so shape creation can be undone.
 */
export class SampleCreateController extends BasicCreateController {

  private readonly _undoManager: UndoManager | null;
  private _firstClickReceived: boolean = false;

  constructor(shapeType?: ShapeType, undoManager?: UndoManager, defaultProperties?: FeatureProperties, options?: CreateControllerConstructorOptions) {
    super(
        shapeType ?? ShapeType.POINT,
        defaultProperties ?? {},
        options ?? {finishOnSingleClick: true}
    );
    this._undoManager = undoManager ?? null;
  }

  onObjectCreated(map: RIAMap, layer: FeatureLayer, feature: Feature): void | Promise<void> {
    if (this._undoManager) {
      addCreateFeatureUndoable(map, layer.model, feature);
    }
    return super.onObjectCreated(map, layer, feature);
  }

  onGestureEvent(aEvent: GestureEvent): HandleEventResult {
    if (aEvent.type === GestureEventType.DOWN) {
      this._firstClickReceived = true;
    }
    return super.onGestureEvent(aEvent);
  }

  onActivate(map: RIAMap) {
    this._firstClickReceived = false;
    super.onActivate(map);
  }

  restart() {
    this._firstClickReceived = false;
    super.restart();
  }

  onKeyEvent(keyEvent: KeyEvent): HandleEventResult {
    if (keyEvent.domEvent?.key === "Escape" && keyEvent.type === KeyEventType.UP) {
      if (!this._firstClickReceived) {
        // creation hasn't started yet, deactivate the CreateController
        return HandleEventResult.EVENT_HANDLED | HandleEventResult.REQUEST_DEACTIVATION;
      }
      this.restart();
      return HandleEventResult.EVENT_HANDLED;
    }
    return HandleEventResult.EVENT_IGNORED;
  }
}