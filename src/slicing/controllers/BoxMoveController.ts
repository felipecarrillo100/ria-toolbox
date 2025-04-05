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
import {OrientedBoxEditingSupport} from "../OrientedBoxEditingSupport.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {Map} from "@luciad/ria/view/Map.js";
import {rayRectangleIntersection, toPoint} from "@luciad/ria-toolbox-core/util/Vector3Util.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {createFacePolygons} from "@luciad/ria-toolbox-core/util/AdvancedShapeFactory.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {calculatePointingDirection} from "@luciad/ria-toolbox-core/util/PerspectiveCameraUtil.js";
import {
  ALTITUDE_CHANGED_EVENT,
  CRS_84,
  GeolocateHandleSupport,
  MOVED_EVENT,
  POSITION_UPDATED_EVENT,
  ROTATED_EVENT,
  STYLE_UPDATED_EVENT,
} from "@luciad/ria-toolbox-geolocation/GeolocateHandleSupport.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";

export interface BoxMoveControllerCreateOptions {
  /**
   * Defines what needs to happen when a user clicks on the map.
   * @param intersectsBox whether the user clicked inside the box that is being edited or not.
   */
  onClick?: (intersectsBox: boolean) => void;
}

/**
 * Controller used to translate and rotate an oriented box using geolocation handles.
 * This controller's oriented box is implicitly defined by the given {@link OrientedBoxEditingSupport}.
 */
export class BoxMoveController extends Controller {

  private readonly _editSupport: OrientedBoxEditingSupport;
  private readonly _handleSupport: GeolocateHandleSupport = new GeolocateHandleSupport();
  private readonly _onClick?: (intersectsBox: boolean) => void;

  private _lastRotation: number = 0;

  constructor(support: OrientedBoxEditingSupport, options?: BoxMoveControllerCreateOptions) {
    super();
    this._editSupport = support;
    this._onClick = options?.onClick;

    this._handleSupport.on(STYLE_UPDATED_EVENT, () => this.invalidate());
    this._handleSupport.on(POSITION_UPDATED_EVENT, () => this.updateHandles());
    this._handleSupport.on(MOVED_EVENT, (translation) => this._editSupport.translate(translation));
    this._handleSupport.on(ROTATED_EVENT, (absoluteRotation) => {
      this._editSupport.rotateAroundZ(this._editSupport.getXYCenter(), this._lastRotation - absoluteRotation);
      this._lastRotation = absoluteRotation;
    })
    this._handleSupport.on(ALTITUDE_CHANGED_EVENT, (translation) => this._editSupport.translate(translation))
  }

  onActivate(map: Map) {
    super.onActivate(map);
    this.updateHandles();
  }

  onDeactivate(map: Map): any {
    this._handleSupport.resetHandles();
    return super.onDeactivate(map);
  }

  /**
   * Update the geolocation handles' shape and interaction functions to fit this controller's oriented box.
   */
  private updateHandles() {
    const bottomCenter = toPoint(this.map!.reference, this._editSupport.getXYCenter());
    const box2llh = createTransformation(bottomCenter.reference!, CRS_84);
    const bottomCenterLLH = box2llh.transform(bottomCenter);
    const [x0, x1] = this._editSupport.getXInterval();
    const width = x1 - x0;
    const [y0, y1] = this._editSupport.getYInterval();
    const depth = y1 - y0;

    this._handleSupport.updateHandles(this.map!, bottomCenterLLH, width, depth);
    this.invalidate();
  }

  onGestureEvent(event: GestureEvent): HandleEventResult {
    if (event.type === GestureEventType.SINGLE_CLICK_UP && this._onClick) {
      this._onClick(this.isViewPointInBox(event.viewPoint))
      return HandleEventResult.EVENT_HANDLED;
    } else if (event.type === GestureEventType.DRAG_END) {
      this._lastRotation = 0;
    } else if (event.type === GestureEventType.SINGLE_CLICK_CONFIRMED) {
      return HandleEventResult.EVENT_HANDLED;
    }
    const bottomCenter = toPoint(this.map!.reference, this._editSupport.getXYCenter());
    return this._handleSupport.handleGestureEvent(this.map!, event, bottomCenter);
  }

  onDraw(geoCanvas: GeoCanvas) {
    this._handleSupport.drawHandles(geoCanvas);
  }

  onDrawLabel(labelCanvas: LabelCanvas) {
    this._handleSupport.drawHandleLabels(labelCanvas);
  }

  private isViewPointInBox(viewPoint: Vector3) {
    const eye = (this.map!.camera as PerspectiveCamera).eye;
    const pointingDirection = calculatePointingDirection(this.map!, viewPoint);

    for (const rectangle of createFacePolygons(this._editSupport.getBox())) {
      if (rayRectangleIntersection(eye, pointingDirection, rectangle)) {
        return true;
      }
    }
    return false;
  }

}