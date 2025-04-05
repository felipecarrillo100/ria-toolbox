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
import {EditController, EditControllerConstructorOptions} from "@luciad/ria/view/controller/EditController.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {KeyEventType} from "@luciad/ria/view/input/KeyEventType.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {Map} from "@luciad/ria/view/Map.js";

/**
 * An EditController that restarts when the user presses the Escape key
 */
export class SampleEditController extends EditController {

  private _shapeChanged: boolean = false;
  private _eventHandles: Handle[] = [];

  constructor(layer: FeatureLayer, feature: Feature, options?: EditControllerConstructorOptions) {
    super(layer, feature, options);
  }

  onActivate(map: Map) {
    super.onActivate(map);
    const editShapeHandle = this.on("EditShape", () => {
      this._shapeChanged = true;
    });
    this._eventHandles.push(editShapeHandle);
    const restartHandle = this.on("Restarted", () => {
      this._shapeChanged = false;
    });
    this._eventHandles.push(restartHandle);
  }

  onDeactivate(aMapView: Map): Promise<void> | void {
    for (const handle of this._eventHandles) {
      handle.remove();
    }
    this._eventHandles = [];
    return super.onDeactivate(aMapView);
  }

  onKeyEvent(keyEvent: KeyEvent): HandleEventResult {
    if (keyEvent.domEvent?.key === "Escape" && keyEvent.type === KeyEventType.UP) {
      if (!this._shapeChanged) {
        this.map?.clearSelection();
        return HandleEventResult.EVENT_HANDLED | HandleEventResult.REQUEST_DEACTIVATION;
      }
      this.restart();
      return HandleEventResult.EVENT_HANDLED;
    }
    return HandleEventResult.EVENT_IGNORED;
  }
}