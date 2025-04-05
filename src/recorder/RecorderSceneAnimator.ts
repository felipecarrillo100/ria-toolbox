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
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {RecorderSupport} from "./RecorderSupport.js";
import {VideoRecorder} from "./VideoRecorder.js";

/**
 * It manages the animation and recording states,
 * allowing the steps of scene animation and video recording to be executed in lockstep.
 */
export class RecorderSceneAnimator {
  private readonly _recorderSupport: RecorderSupport;
  private readonly _recorder: VideoRecorder;

  private _recording = false;
  private _recordDuration = 0;
  private _recordStartFraction = 0;
  private _fractionDelta = 0;
  private _recordFraction = 0;

  constructor(recorderSupport: RecorderSupport, recorder: VideoRecorder) {
    this._recorderSupport = recorderSupport;
    this._recorder = recorder;
  }

  async start(): Promise<void> {
    const {fraction, fps, totalDuration, qualityFactor, withLabels} = this._recorderSupport;
    await this._recorder.init(fps, qualityFactor, withLabels);

    const timeAtStart = fraction * totalDuration;
    this._recordDuration = totalDuration - timeAtStart;
    this._fractionDelta = 1 / ((this._recordDuration / 1000) * fps);
    this._recordStartFraction = fraction;

    this._recordFraction = 0.0;
    this.recording = true;

    return this.step();
  }

  async stop(abort: boolean) {
    this.recording = false;
    const blob = await this._recorder?.stop(abort);
    if (blob) {
      videoDownload(blob, this._recorderSupport.fileName);
    }
  }

  private async step(): Promise<void> {
    if (!this._recording) {
      return;
    }

    // update the scene for a new fraction
    this._recorderSupport.fraction = this.absoluteFraction;

    // wait for update readiness
    await this._recorderSupport.readinessSignal();

    const frameCaptured = this._recording && this._recorder ? await this._recorder.captureFrame() : false;

    if (this._recording && this._recordFraction < 1.0 && frameCaptured) {
      this.recordingFraction = this._recordFraction + this._fractionDelta;
      await this.step();
    } else {
      this.recordingFraction = 0.0;
      await this.stop(false);
    }
  }

  get recording(): boolean {
    return this._recording;
  }

  set recording(recording: boolean) {
    if (this._recording !== recording) {
      this._recording = recording;
      this._recorderSupport.emitRecordingStartStopEvent();
    }
  }

  get recordingFraction(): number {
    return this._recordFraction;
  }

  private set recordingFraction(fraction: number) {
    this._recordFraction = clamp(fraction, 0, 1);
  }

  /**
   * Gets the current recording fraction adjusted with the initial fraction from which the recording started.
   */
  private get absoluteFraction(): number {
    return this._recordStartFraction + this._recordFraction * (1 - this._recordStartFraction);
  }
}

function videoDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  // Delay revoking the Blob URL to ensure the download operation starts successfully.
  // Without the delay, the URL could be revoked before the download starts, causing it to fail.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}