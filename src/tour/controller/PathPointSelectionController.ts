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
import {Controller} from '@luciad/ria/view/controller/Controller.js';
import {HandleEventResult} from '@luciad/ria/view/controller/HandleEventResult.js';
import {GestureEventType} from '@luciad/ria/view/input/GestureEventType.js';
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {EditMode, PathController} from "./PathController.js";
import {getTouchedPathPointFeature} from "./PathControllerUtil.js";
import {TourPathSupport} from "../TourPathSupport.js";

/**
 * `PathPointSelectionController` selects a path point for edit.
 */
export class PathPointSelectionController extends Controller {
  private readonly _pathSupport: TourPathSupport;
  private readonly _pathController: PathController;

  constructor(pathSupport: TourPathSupport, pathController: PathController) {
    super();
    this._pathSupport = pathSupport;
    this._pathController = pathController;
  }

  override onGestureEvent(event: GestureEvent): HandleEventResult {
    const {map} = this;

    if (!map || this._pathController.editMode === EditMode.INACTIVE) {
      return HandleEventResult.EVENT_IGNORED;
    }

    if (event.type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      const touched = getTouchedPathPointFeature(event.viewPoint, this._pathSupport, map);
      if (touched) {
        this._pathController.startEditingPathPoint(touched.index, false);
      } else {
        this._pathController.stopEditingPathPoint();
      }
      return HandleEventResult.EVENT_HANDLED;
    }
    if (event.type === GestureEventType.DOUBLE_CLICK_EVENT) {
      this._pathController.stopEditingPathPoint();
      return HandleEventResult.EVENT_HANDLED;
    }

    return HandleEventResult.EVENT_IGNORED;
  }

}

