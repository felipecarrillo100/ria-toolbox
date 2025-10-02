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
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {ScrollEvent} from "@luciad/ria/view/input/ScrollEvent.js";
import {PinchEvent} from "@luciad/ria/view/input/PinchEvent.js";

export enum NavigationType {
  NONE = "NONE",
  ROTATION = "ROTATION",
  PAN = "PAN",
  ZOOM = "ZOOM",
  ZOOM_ON_CLICK = "ZOOM_ON_CLICK",
  FIRST_PERSON_ROTATION = "FIRST_PERSON_ROTATION",
}

function getTouchesOrButtonsPressed(domEvent: MouseEvent | TouchEvent) {
  if (domEvent instanceof MouseEvent) {
    switch (domEvent.buttons) {
      case 1: return "left";
      case 2: return "right";
      case 3: return "both";
      default: return "none";
    }
  } else if (window.TouchEvent && domEvent instanceof TouchEvent) {
    switch (domEvent.touches.length) {
      case 1: return "left";
      case 2: return "right";
      case 3: return "both";
      default: return "none";
    }
  }

  return "none";
}

/**
 * Returns which navigation type should be active next based on the given
 * gesture event, previous navigation type and allowed types.
 *
 * @param event The gesture event to calculate the {@link NavigationType} for.
 * @param previousNavigationType The previous {@link NavigationType}.
 * @param allowedNavigationTypes A list of {@link NavigationType} that are
 *    allowed. If the calculated {@link NavigationType} is not allowed, this
 *    function returns {@link NavigationType.NONE}.
 * @param requiresModifierForFirstPersonRotation Whether the ctrl modifier key
 *    needs to be pressed in order to enable
 *    {@link NavigationType.FIRST_PERSON_ROTATION}. Note that
 *    {@link NavigationType.FIRST_PERSON_ROTATION} will still only get returned
 *    if it has been added to the `allowedNavigationTypes` array.
 * @param swapPanRotateButtons Optional flag to swap the default mouse button actions between pan and rotation.
 *    By default, the left mouse button pans and the right button rotates.
 *    When enabled, this behavior is inverted: left rotates and right pans.
 */
export function getNavigationType(
  {type, domEvent}: GestureEvent,
  previousNavigationType: NavigationType,
  allowedNavigationTypes: NavigationType[],
  requiresModifierForFirstPersonRotation = true,
  swapPanRotateButtons = false
): NavigationType {
  // Check if the zooming action is finished.
  if (
    previousNavigationType === NavigationType.ZOOM &&
    type !== GestureEventType.SCROLL &&
    type !== GestureEventType.PINCH
  ) {
    return NavigationType.NONE;
  }

  // Check if the rotation, orbit or pan action is finished
  if (
    type === GestureEventType.DRAG_END ||
    type === GestureEventType.TWO_FINGER_DRAG_END
  ) {
    return NavigationType.NONE;
  }

  // Handle the rotation and pan actions
  if (
    type === GestureEventType.DRAG ||
    type === GestureEventType.TWO_FINGER_DRAG
  ) {
    const hasCtrlModifier = (domEvent as MouseEvent | TouchEvent).ctrlKey;
    const supportsFirstPersonRotation = allowedNavigationTypes.includes(NavigationType.FIRST_PERSON_ROTATION);
    const prioritiseFirstPersonRotation = supportsFirstPersonRotation
      && (!requiresModifierForFirstPersonRotation || hasCtrlModifier);

    let newNavigationType = NavigationType.NONE;
    const rotationType = prioritiseFirstPersonRotation
                         ? NavigationType.FIRST_PERSON_ROTATION
                         : NavigationType.ROTATION;
    switch (getTouchesOrButtonsPressed(domEvent as MouseEvent | TouchEvent)) {
      case "left":
        newNavigationType = !swapPanRotateButtons ? NavigationType.PAN : rotationType;
        break;
      case "right":
        newNavigationType = !swapPanRotateButtons ? rotationType : NavigationType.PAN;
        break;
      case "both":
        newNavigationType = NavigationType.FIRST_PERSON_ROTATION;
        break;
      case "none":
        newNavigationType = NavigationType.NONE;
        break;
    }

    if (allowedNavigationTypes.includes(newNavigationType)) {
      return newNavigationType;
    } else {
      return NavigationType.NONE;
    }
  }

  // Handle the zoom action
  if (type === GestureEventType.SCROLL || type === GestureEventType.PINCH) {
    if (allowedNavigationTypes.includes(NavigationType.ZOOM)) {
      return NavigationType.ZOOM;
    } else {
      return NavigationType.NONE;
    }
  }

  // Handle the zoom on click action
  if (
    type === GestureEventType.SINGLE_CLICK_UP &&
    allowedNavigationTypes.includes(NavigationType.ZOOM_ON_CLICK)
  ) {
    return NavigationType.ZOOM_ON_CLICK;
  }

  return NavigationType.NONE;
}

/**
 * Returns the speed multiplier factor.
 */
export function getSpeedMultiplier(event: GestureEvent): number {
  const domEvent = event.domEvent;
  if (domEvent instanceof MouseEvent || domEvent instanceof TouchEvent) {
    if (domEvent.shiftKey) {
      return 2;
    } else if (domEvent.altKey) {
      return 0.5;
    }
  }
  return 1;
}

/**
 * Returns the zoom factor.
 * If the value is greater than 0, this means that you need to zoom in, smaller than 0 is zooming out.
 * The given scroll multiplier is only applied on scroll events, not touch pinch events.
 */
export function getZoomFactor(event: GestureEvent, scrollMultiplier = 0.1): number {
  return event.type === GestureEventType.SCROLL
    ? (event as ScrollEvent).amount * scrollMultiplier
    : event.type === GestureEventType.PINCH
      ? (event as PinchEvent).scaleFactor - 1
      : 0;
}
