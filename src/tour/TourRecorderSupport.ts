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
import {RecorderSupport} from "@luciad/ria-toolbox-recorder/RecorderSupport.js";
import {TourPathSupport} from './TourPathSupport.js';
import {setCameraOnPath} from './TourCameraUtil.js';
import {VideoRecorder} from "@luciad/ria-toolbox-recorder/VideoRecorder.js";

/**
 * `TourRecorderSupport` is a specialized subclass of `RecorderSupport` tailored for managing recording in the context of tours.
 * It provides additional functionality for navigating between keyframes,
 * with capabilities to move backwards or forwards to the nearest path point before a recording starts.
 */
export class TourRecorderSupport extends RecorderSupport {
  private readonly _pathSupport: TourPathSupport;

  /**
   * Constructor
   * @param pathSupport A support for managing tour paths.
   * @param videoRecorder A custom implementation of the MP4 recorder.
   *                      If not provided, the tool uses the default MP4 recorder from the Tour.
   */
  constructor(pathSupport: TourPathSupport, videoRecorder?: VideoRecorder) {
    super({
      updatable: {
        update(fraction: number) {
          const pathFeature = pathSupport.pathFeature;
          if (pathFeature) {
            setCameraOnPath(pathSupport.map, pathFeature, fraction);
          }
        },
      },
      map: pathSupport.map,
      videoRecorder
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
   * Begins recording the tour from the current fraction.
   * The duration of the recorded video is set to the duration of the current path.
   */
  override async record(): Promise<void> {
    const pathFeature = this._pathSupport.pathFeature;
    if (!pathFeature) {
      return;
    }
    this.totalDuration = pathFeature.duration;
    this.fileName = getFileCoreName(pathFeature.name);

    return super.record();
  }
}

function getFileCoreName(pathName: string): string {
  const date = new Date();
  const core = pathName.replace(/ /g, '_') || 'tour';
  const d1 = date.toLocaleDateString('en-GB', {dateStyle: 'short'});
  const d2 = date.toLocaleTimeString('en-GB', {timeStyle: 'medium'});
  return `${core.toLocaleLowerCase()}_${d1}_${d2}`;
}
