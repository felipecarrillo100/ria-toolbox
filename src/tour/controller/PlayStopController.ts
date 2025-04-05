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
import {EVENT_IGNORED, HandleEventResult} from '@luciad/ria/view/controller/HandleEventResult.js';
import {GestureEventType} from '@luciad/ria/view/input/GestureEventType.js';
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {TourPathSupport} from '../TourPathSupport.js';

const ACTIONS_TO_BREAK_PLAY = [GestureEventType.SINGLE_CLICK_CONFIRMED, GestureEventType.SCROLL, GestureEventType.DRAG];

/**
 * `PlayStopController` stops a path animation when user interacts with the map.
 */
export class PlayStopController extends Controller {
  private readonly _pathSupport: TourPathSupport;

  constructor(pathSupport: TourPathSupport) {
    super();
    this._pathSupport = pathSupport;
  }

  override onGestureEvent(event: GestureEvent): HandleEventResult {
    if (this._pathSupport.cameraLock && ACTIONS_TO_BREAK_PLAY.includes(event.type)) {
      this._pathSupport.tourPlayerSupport.stop();
    }
    return EVENT_IGNORED;
  }
}
