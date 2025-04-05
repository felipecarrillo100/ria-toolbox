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
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {HoverController} from "@luciad/ria/view/controller/HoverController.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {PickInfo} from "@luciad/ria/view/PickInfo.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {PaintRepresentation} from "@luciad/ria/view/PaintRepresentation.js";

const MOUSEOVER_CURSOR = "pointer"; // the cursor to show when hovering over a feature

/**
 * A custom hover controller that will only hover certain layers, and shows a custom cursor while hovering.
 */
export class CustomHoverController extends HoverController {

  private readonly _layers: FeatureLayer[];

  constructor(layers?: FeatureLayer[]) {
    super();
    this._layers = layers || [];
  }

  getCandidates(viewPoint: Point | null, sensitivity: number, paintReps: PaintRepresentation[], multiple: boolean): PickInfo[] {
    return super.getCandidates(viewPoint, sensitivity, paintReps, multiple).filter(
        c => this._layers.indexOf(c.layer as FeatureLayer) >= 0
    );
  }

  handleCandidates(gestureEvent: GestureEvent, candidates: PickInfo[]): HandleEventResult {
    this.cursor = candidates.length >= 1 ? MOUSEOVER_CURSOR : null;
    return super.handleCandidates(gestureEvent, candidates);
  }
}