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

interface DragPosition {
  x: number;
  y: number;
  time: number;
}

/**
 * This class can be used to track the speed of gesture events.
 * The "track" method should be called with subsequent gesture events, for example drag events.
 * At the moment you want to determine the current speed, you call "getSpeed", which gives you the speed in pixels per second
 * (both combined and for the x and y axes separately).
 */
export class GestureSpeedTracker {
  private _trackHistory: DragPosition[];
  private readonly _historySize: number;
  private _isTouch: boolean;

  constructor(historySize: number) {
    this._trackHistory = [];
    if (historySize < 7) {
      throw new Error(
          "GestureSpeedTracker history size must be at least 7. It needs at least 3 points to track + it disregards some points for mouse input");
    }
    this._historySize = historySize;
    this._isTouch = false;
  }

  track(event: GestureEvent): void {
    this._trackHistory.push({
      x: event.viewPoint.x,
      y: event.viewPoint.y,
      time: performance.now() / 1000
    });

    if (this._trackHistory.length > this._historySize) {
      this._trackHistory.splice(0, 1);
    }

    this._isTouch = event.inputType === "touch";
  }

  getSpeed(): { speed: number, speedX: number, speedY: number } {
    let speedX = 0;
    let speedY = 0;

    if (this._trackHistory.length > 3) {
      let totalDistanceX = 0.0;
      let totalDistanceY = 0.0;
      let totalTime = 0.0;

      //We don't count the last point 2x (in touch we do) because mouse slows down more than a finger (touch)
      let numberOfPointsToIgnore = this._isTouch ? 1 : 3;
      if (this._trackHistory.length - numberOfPointsToIgnore <= 3) {
        numberOfPointsToIgnore = 0; // only ignore points if there's enough points remaining to determine a speed
      }

      for (let i = 1; i < this._trackHistory.length - numberOfPointsToIgnore; i++) {
        const location = this._trackHistory[i];
        const previousLocation = this._trackHistory[i - 1];
        totalDistanceX += location.x - previousLocation.x;
        totalDistanceY += location.y - previousLocation.y;
        totalTime += location.time - previousLocation.time;
      }

      //velocity in pixels per second
      speedX = totalDistanceX / totalTime;
      speedY = totalDistanceY / totalTime;
    }
    return {
      speed: Math.sqrt(speedX * speedX + speedY * speedY),
      speedX,
      speedY
    }
  }

  reset(): void {
    this._trackHistory = [];
  }
}