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
import {clamp} from '@luciad/ria-toolbox-core/util/Math.js';
import {Updatable} from "@luciad/ria-toolbox-core/util/Updatable.js";
import {Handle} from '@luciad/ria/util/Evented.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {RecorderMP4} from './RecorderMP4.js';
import {createAnimationFrameReadinessSignal, ReadinessSignal} from './ReadinessSignal.js';
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import {RecorderSceneAnimator} from "./RecorderSceneAnimator.js";
import {VideoRecorder} from "./VideoRecorder.js";

const RECORDER_START_STOP_EVENT = 'RECORDER_START_STOP_EVENT';
const RECORDER_FRACTION_EVENT = 'RECORDER_FRACTION_EVENT';
const RECORDER_FPS_CHANGE_EVENT = 'RECORDER_FPS_CHANGE_EVENT';
const RECORDER_DURATION_CHANGE_EVENT = 'RECORDER_DURATION_CHANGE_EVENT';
const RECORDER_QUALITY_FACTOR_CHANGE_EVENT = 'RECORDER_QUALITY_FACTOR_CHANGE_EVENT';
const RECORDER_FILE_NAME_CHANGE_EVENT = 'RECORDER_FILE_NAME_CHANGE_EVENT';

const DEFAULT_DURATION = 1_000;
const DEFAULT_QUALITY_FACTOR = 0.5;
const DEFAULT_FPS = 60;

/**
 * Configuration options provided to the RecorderSupport constructor.
 */
export interface RecorderSupportConstructorOptions {
  /**
   * The WebGLMap instance that is being recorded.
   */
  map: WebGLMap;

  /**
   * This property allows you to specify a custom video recorder implementation.
   * If you don't provide one, the default recorder will use the browser's built-in MP4 encoder API,
   * which works on Chromium based browsers.
   */
  videoRecorder?: VideoRecorder;

  /**
   * The Updater that is responsible for refreshing the map for a specific fraction.
   */
  updatable: Updatable;

  /**
   * The record ReadinessSignal function managing the readiness status of scene updates for snapshot captures.
   */
  readinessSignal?: ReadinessSignal;

  /**
   * The total duration of the recording in milliseconds. The default value is 1000 milliseconds.
   */
  duration?: number;

  /**
   * Specifies whether labels should be included in the recording. By default, labels are not captured.
   * The recorder by default captures the map's canvas images without labels (implemented as HTML nodes).
   * Turning this on means there's an extra step to rasterize the labels and include them in the video.
   * Note that recording with labels takes additional time due to the extra rasterization step.
   */
  withLabels?: boolean;

  /**
   * Defines the frames per second (fps) for the recording. The default value is 60 fps.
   */
  fps?: number;

  /**
   * Sets the quality factor for the recording (0-1).
   * Higher factors result in higher-quality video but with larger file sizes.
   * The default value is 0.5.
   */
  qualityFactor?: number;
}

/**
 * The `RecorderSupport` class provides methods for managing and controlling video recording of a map,
 * including control over recording settings and the ability to subscribe to status events.
 */
export class RecorderSupport {
  private readonly _map: WebGLMap;
  private readonly _eventSupport: EventedSupport;
  private readonly _recorderAnimator: RecorderSceneAnimator;
  private readonly _updater: Updatable;

  private _readinessSignal: ReadinessSignal;
  private _fraction = 0.0;
  private _totalDuration = DEFAULT_DURATION; // milliseconds
  private _qualityFactor = DEFAULT_QUALITY_FACTOR;
  private _fps = DEFAULT_FPS;
  private _fileName = 'video';
  private _withLabels = false;

  /**
   * Creates a new RecorderSupport instance.
   * @param options The options for RecorderSupport.
   */
  constructor({
                updatable,
                videoRecorder,
                map,
                duration,
                withLabels,
                readinessSignal,
                qualityFactor,
                fps,
              }: RecorderSupportConstructorOptions) {
    this._map = map;
    this._updater = updatable;
    this._eventSupport = new EventedSupport(
        [RECORDER_START_STOP_EVENT,
         RECORDER_FRACTION_EVENT,
         RECORDER_FPS_CHANGE_EVENT,
         RECORDER_DURATION_CHANGE_EVENT,
         RECORDER_QUALITY_FACTOR_CHANGE_EVENT,
         RECORDER_FILE_NAME_CHANGE_EVENT],
        true
    );

    this._readinessSignal = readinessSignal ?? createAnimationFrameReadinessSignal();
    this.totalDuration = duration || DEFAULT_DURATION;
    this.qualityFactor = qualityFactor ?? DEFAULT_QUALITY_FACTOR;
    this.fps = fps || DEFAULT_FPS;
    this.withLabels = withLabels ?? false;
    const recorder = videoRecorder ?? new RecorderMP4(map);
    this._recorderAnimator = new RecorderSceneAnimator(this, recorder);
  }

  get map(): WebGLMap {
    return this._map;
  }

  /**
   * Gets the total duration of the recording in milliseconds.
   */
  get totalDuration(): number {
    return this._totalDuration;
  }

  set totalDuration(value: number) {
    if (value <= 0) {
      console.warn('Recorder tool: the duration must be a positive value');
      return;
    }
    if (this._totalDuration !== value) {
      this._totalDuration = value;
      this._eventSupport.emit(RECORDER_DURATION_CHANGE_EVENT, this.totalDuration);
    }
  }

  /**
   * Gets the current file name for the video recording, excluding the file extension.
   */
  get fileName(): string {
    return this._fileName;
  }

  set fileName(value: string) {
    if (this._fileName !== value) {
      this._fileName = value;
      this._eventSupport.emit(RECORDER_FILE_NAME_CHANGE_EVENT, this.fileName);
    }
  }

  /**
   * Gets the current global fraction of the playback, a value between 0 and 1.
   */
  get fraction(): number {
    return this._fraction;
  }

  /**
   * Retrieves the current fraction of the recording.
   * For example, if the recording started halfway through the path (at global fraction 0.5),
   * and is currently at global fraction 0.75 this method will return 0.5, indicating it's halfway through the recording.
   * If a recording has not been started, this method will return 0.
   * @returns A number between 0 and 1 representing the current recording fraction, or 0 if a recording has not been started.
   */
  get recordingFraction(): number {
    return this.recording ? this._recorderAnimator.recordingFraction : 0.0;
  }

  /**
   * Sets the current fraction of the recording but should only be used when recording is not active.
   * It adjusts the part of the map currently being viewed in the recording.
   */
  set fraction(fraction: number) {
    fraction = clamp(fraction, 0, 1);
    if (fraction !== this._fraction) {
      this._fraction = fraction;
      this._updater.update(fraction);

      this.emitRecorderFractionEvent();
    }
  }

  /**
   * Returns `true` if the recording is in progress, `false` otherwise.
   */
  get recording(): boolean {
    return this._recorderAnimator.recording;
  }

  /**
   * Gets the frames per second of the recording.
   */
  get fps(): number {
    return this._fps;
  }

  set fps(value: number) {
    if (value <= 0) {
      console.warn('Recorder tool: the fps rate must be a positive value');
      return;
    }
    const fps = Math.round(value);

    if (this._fps !== fps) {
      this._fps = fps;
      this._eventSupport.emit(RECORDER_FPS_CHANGE_EVENT, this.fps);
    }
  }

  /**
   * Gets the quality factor for the recording.
   */
  get qualityFactor(): number {
    return this._qualityFactor;
  }

  /**
   * Sets the quality factor for the recording.
   * Higher factors result in higher-quality video but with larger file sizes.
   * Accepts values between 1 (indicating the best quality) and 0 (indicating the lower recorded file size, reduced quality).
   * @param qualityFactor - The desired quality factor, falling within the range of 0 to 1.
   */
  set qualityFactor(qualityFactor: number) {
    const factor = clamp(qualityFactor, 0, 1);
    if (this._qualityFactor !== factor) {
      this._qualityFactor = factor;
      this._eventSupport.emit(RECORDER_QUALITY_FACTOR_CHANGE_EVENT, this.qualityFactor);
    }
  }

  /**
   * Gets the ReadinessSignal function for the recording.
   * It ensures the readiness of the scene for snapshot before allowing the recording to proceed.
   * In effect, it waits for any necessary scene updates to complete.
   */
  get readinessSignal(): ReadinessSignal {
    return this._readinessSignal;
  }

  set readinessSignal(value: ReadinessSignal) {
    if (this._readinessSignal !== value) {
      this._readinessSignal = value;
    }
  }

  /**
   * Specifies whether labels should be included in the recording.
   */
  get withLabels(): boolean {
    return this._withLabels;
  }

  set withLabels(value: boolean) {
    if (this._withLabels !== value) {
      this._withLabels = value;
    }
  }

  /**
   * Starts recording the map view from the current fraction till the end (fraction 1.0).
   * If the current fraction is already at 1.0, it will be reset to 0.0 before recording starts.
   * @returns A promise representing the ongoing recording task.
   */
  async record(): Promise<void> {
    if (this.fraction >= 1.0) {
      this.fraction = 0.0;
    }
    // refresh the scene for the current fraction before recording
    this._updater.update(this.fraction);

    return this._recorderAnimator.start();
  }

  /**
   * Stops the ongoing recording. If `abort` is set to true, the recording will be aborted without saving.
   */
  async stop(abort = false): Promise<void> {
    return this._recorderAnimator.stop(abort);
  }

  /**
   * Releases all system resources.
   */
  async cleanUp() {
    return this.stop(true);
  }

  emitRecordingStartStopEvent() {
    this._eventSupport.emit(RECORDER_START_STOP_EVENT, {
      recording: this.recording,
      fraction: this.fraction
    });
  }

  emitRecorderFractionEvent() {
    this._eventSupport.emit(RECORDER_FRACTION_EVENT, {
      fraction: this.fraction,
      recordingFraction: this.recordingFraction
    });
  }

  /**
   * Registers a callback for the recording start/stop event.
   * The callback receives the recording status and a fraction at which the recording started or stopped, and the state of recording
   * @param callback - A function to be invoked when the recording starts or stops.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecordingStartStop(callback: (info: { recording: boolean, fraction: number }) => void): Handle {
    return this._eventSupport.on(RECORDER_START_STOP_EVENT, callback);
  }

  /**
   * Registers a callback to be invoked when the global fraction or the recording fraction changes.
   * The global fraction refers to the overall playback, while the recording fraction pertains only to the range that is being recorded.
   *
   * @param callback - A function to be invoked when the fractions change. The callback receives an object providing the current values of each fraction.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecorderFractionEvent(callback: (info: { recordingFraction: number, fraction: number }) => void): Handle {
    return this._eventSupport.on(RECORDER_FRACTION_EVENT, callback);
  }

  /**
   * Registers a callback for the FPS (frames per second) rate change event.
   * @param callback - A function to be invoked when the recording settings have changed.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecorderFPSChangeEvent(callback: (fps: number) => void): Handle {
    return this._eventSupport.on(RECORDER_FPS_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback for the total duration of the recording (in milliseconds) change event.
   * @param callback - A function to be invoked when the recording settings have changed.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecorderDurationChangeEvent(callback: (duration: number) => void): Handle {
    return this._eventSupport.on(RECORDER_DURATION_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback for the quality factor change event.
   * @param callback - A function to be invoked when the quality factor have changed.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecorderQualityFactorChangeEvent(callback: (qualityFactor: number) => void): Handle {
    return this._eventSupport.on(RECORDER_QUALITY_FACTOR_CHANGE_EVENT, callback);
  }

  /**
   * Registers a callback for the file name change event.
   * @param callback - A function to be invoked when the recording settings have changed.
   * @returns A handle which can be used to deregister the callback.
   */
  onRecorderFileNameChangeEvent(callback: (fileName: string) => void): Handle {
    return this._eventSupport.on(RECORDER_FILE_NAME_CHANGE_EVENT, callback);
  }
}
