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
import {PlayerSupport} from "@luciad/ria-toolbox-player/PlayerSupport.js";
import {TourPathSupport} from './TourPathSupport.js';

/**
 * `TourPlayerSupport` is a specialized extension of `PlayerSupport` tailored for implementing the tour functionality.
 * It provides functionality for forwarding and reversing to the nearest path point.
 */
export class TourPlayerSupport extends PlayerSupport {
  private readonly _pathSupport: TourPathSupport;

  /**
   * Constructs a new instance of `TourPlayerSupport`.
   *
   * @param pathSupport - The `TourPathSupport` instance managing the tour path to be animated and conducting scene updates
   *                      according to the current fraction.
   */
  constructor(pathSupport: TourPathSupport) {
    super({
      updatable: {
        update(fraction: number) {
          pathSupport.updatePlayFraction(fraction);
        },
      },
      animationKey: `TOUR-PLAYER-${performance.now()}`
    });

    this._pathSupport = pathSupport;
  }

  /**
   * Transitions the current fraction backwards to the fraction corresponding to the closest point
   * on the path before the current fraction.
   */
  moveBack(): void {
    this.fraction = this._pathSupport.getFractionForPreviousPoint(this.fraction);
  }

  /**
   * Transitions the current fraction forwards to the fraction corresponding to the closest point
   * on the path after the current fraction.
   */
  moveForward(): void {
    this.fraction = this._pathSupport.getFractionForNextPoint(this.fraction);
  }

  /**
   * Starts the player animation from the current fraction.
   * It also adjusts the recording duration based on the current path.
   */
  override play(): void {
    const path = this._pathSupport.pathFeature;
    if (path) {
      // Make sure the path controller does not edit any point
      this._pathSupport.pathController.stopEditingPathPoint();
      this.duration = path.duration;
      super.play();
    }
  }
}
