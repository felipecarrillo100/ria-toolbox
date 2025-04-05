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
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {GestureEvent} from '@luciad/ria/view/input/GestureEvent.js';
import {Handle} from '@luciad/ria/util/Evented.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {MagnifierSupport, MagnifierSupportConstructorOptions} from "./MagnifierSupport.js";

const EVENT_INIT = 'Init';

/**
 * The MagnifierController uses a {@link MagnifierSupport} to magnify the data around a touched point,
 * offering detailed insights that may not be easily visible otherwise.
 *
 * This controller emits an event that notifies of the world point that has been touched on the main map.
 * It can also  provide the world point that is in the center of the magnifier.
 */
export class MagnifierController extends Controller {
  private readonly _eventedSupport = new EventedSupport([EVENT_INIT], true);
  private readonly _createOptions: MagnifierSupportConstructorOptions;
  private readonly _onMouseLeave = () => this._support && (this._support.magnifiedViewPoint = null);
  private _support: MagnifierSupport | null = null;

  constructor(options: MagnifierSupportConstructorOptions = {}) {
    super();
    this._createOptions = options;
  }

  /**
   * Triggered once when the magnifier controller is activated on the main map.
   * This method creates the magnifier map and emits an event to allow the user to create layers on it.
   * To register a handler for this event, use the <code>onInit()</code> method.
   * Please note the main map should use the <code>PerspectiveCamera</code> otherwise an error will be thrown.
   * @param map the main map.
   */
  override onActivate(map: WebGLMap): void {
    super.onActivate(map);
    if (!this._support) {
      this._support = new MagnifierSupport(map, this._createOptions);
    } else {
      this._support.activate(map);
    }

    map.domNode.addEventListener('mouseleave', this._onMouseLeave);
    map.domNode.addEventListener('mouseout', this._onMouseLeave);

    this._eventedSupport.emit(EVENT_INIT, this._support);
  }

  /**
   * Returns the Magnifier support that this controller created.
   * This is only available when the controller is currently active on the map.
   */
  get support(): MagnifierSupport {
    if (!this._support) {
      throw new Error(
          "Magnifier support was not yet initialized, listen to the initialized event before querying this");
    }
    return this._support;
  }

  /**
   * Triggered once when the magnifier is being deactivated from the main map.
   * @param map the main map
   */
  override onDeactivate(map: WebGLMap): void {
    this._support?.destroy();

    map.domNode.removeEventListener('mouseleave', this._onMouseLeave);
    map.domNode.removeEventListener('mouseout', this._onMouseLeave);
    super.onDeactivate(map);
  }

  /**
   * This function is triggered whenever a mouse gesture event occurs on the main map.
   * During a mouse move, it sets the {@link MagnifierSupport.magnifiedViewPoint} of the support.
   * This will cause the support to recalculate its {@link MagnifierSupport.magnifiedWorldPoint} and emit an event.
   * Users can listen for this event by registering a callback using the
   * {@link MagnifierSupport.onMagnifiedWorldPointChanged} method.
   * @param event The gesture event to be handled.
   */
  override onGestureEvent(event: GestureEvent): HandleEventResult {
    if (!this.map || !this._support) {
      return HandleEventResult.EVENT_IGNORED;
    }

    if (event.type === GestureEventType.MOVE ||
        event.type === GestureEventType.SCROLL ||
        event.type === GestureEventType.DRAG_END) {
      this._support.magnifiedViewPoint = event.viewPoint;
    } else if (event.type === GestureEventType.DRAG || event.type === GestureEventType.ROTATE) {
      this._support.magnifiedViewPoint = null;
    }

    return HandleEventResult.EVENT_IGNORED;
  }

  /**
   * Registers a callback function that is invoked once when the magnifier support is created.
   * The registered callback function receives the newly created instance of the magnifier support.
   * @param callback the registered callback
   */
  onInit(callback: (magnifierSupport: MagnifierSupport) => void): Handle {
    return this._eventedSupport.on(EVENT_INIT, callback);
  }

}