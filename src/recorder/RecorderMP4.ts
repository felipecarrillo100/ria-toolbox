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
import html2canvas from 'html2canvas';
import {WebGLMap} from '@luciad/ria/view/WebGLMap.js';
import * as Mp4Muxer from "mp4-muxer";
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {VideoRecorder} from "./VideoRecorder.js";

const MIME_MP4 = 'video/mp4';

/**
 * The default implementation of MP4 recorder, based on mp4-muxer (https://github.com/Vanilagy/mp4-muxer) and
 * browsers embedded MP4 encoder API.
 */
export class RecorderMP4 implements VideoRecorder {
  private readonly _mapNode: HTMLElement;
  private readonly _canvas: HTMLCanvasElement;
  private _muxer: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget> | null = null;
  private _videoEncoder: VideoEncoder | null = null;
  private _fps: number = 60;
  private _frameNumber = 0;
  private _withLabels = false;
  private _isCanvasResizedForRecording: boolean = false;

  /**
   * Creates a new instance of recorder.
   * @param map - An instance of WebGLMap, used to extract the WebGL context for rendering video frames.
   */
  constructor(map: WebGLMap) {
    this._mapNode = map.domNode;
    const context = map.webGLContext;
    const canvas = context?.canvas;
    if (!canvas) {
      throw new Error('Missing GL context');
    }
    this._canvas = canvas as HTMLCanvasElement;
  }

  /**
   * Initializes the MP4 video recorder by setting up the video encoder and muxer.
   *
   * @param fps The number of frames per second for the recording.
   * @param qualityFactor A value between 0.0 and 1.0 representing the desired quality of the video.
   *                      Higher values lead to better quality but larger file sizes.
   * @param withLabels If true, overlays additional labels and metadata onto the video frames.
   */
  async init(fps: number, qualityFactor: number, withLabels: boolean): Promise<void> {
    this._fps = fps;
    this._frameNumber = 0;
    this._withLabels = withLabels;

    // video codecs use a concept called macro-blocks which are units of pixels where the dimension should be multiplication of 2
    const roundDownEven = (value: number) => 2 * Math.floor(value / 2);
    const width = roundDownEven(this._canvas.width);
    const height = roundDownEven(this._canvas.height);
    this._isCanvasResizedForRecording = this._canvas.width !== width || this._canvas.height !== height;
    if (this._isCanvasResizedForRecording) {
      // VideoFrame's options.visibleRect is not respected thus the manual canvas resize
      this._canvas.width = width;
      this._canvas.height = height;
    }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      fastStart: "in-memory"
    });

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this._muxer?.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error(e);
        throw e;
      },
    });

    // for higher resolutions use Level 5.2 (4K): otherwise Level 4.2 (2K)
    const codecProfile = (width > 2048 || height > 1080) ? "avc1.420034" : "avc1.42002a";

    // calculate bitrate based on bits per pixel
    const totalPixels = width * height;
    const bitsPerPixel = clamp(qualityFactor * qualityFactor * qualityFactor, 0.05, 0.95);
    const bitrate = totalPixels * bitsPerPixel * fps;

    videoEncoder.configure({
      codec: codecProfile,
      bitrate,
      width,
      height,
      displayWidth: width,
      displayHeight: height,
    });
    this._muxer = muxer;
    this._videoEncoder = videoEncoder;
  }

  /**
   * Captures a single frame from the WebGL canvas or the HTML content (via html2canvas),
   * and adds it to the video sequence.
   */
  async captureFrame(): Promise<boolean> {
    const canvas = this._withLabels
                   ? await (html2canvas as any)(this._mapNode, {logging: false}) as HTMLCanvasElement
                   : this._canvas;
    if (!this._videoEncoder || this._videoEncoder.state !== "configured") {
      return false;
    }

    const frame = new VideoFrame(canvas, {
      timestamp: (this._frameNumber * 1e6) / this._fps, // Equally spaced frames
    });

    this._videoEncoder.encode(frame);
    frame.close();
    if (this._frameNumber > 0 && (this._frameNumber % 60 === 0)) {
      await this._videoEncoder.flush();
    }

    this._frameNumber++;
    return true;
  }

  private cleanUp() {
    // Properly close the encoder if not already closed
    if (this._videoEncoder && this._videoEncoder.state !== 'closed') {
      this._videoEncoder.close();
    }
    this._videoEncoder = null;
    this._muxer = null;
    this._frameNumber = 0;
    if (this._isCanvasResizedForRecording) {
      if (this._mapNode.clientWidth !== this._canvas.width) {
        this._canvas.width = this._mapNode.clientWidth;
      }
      if (this._mapNode.clientHeight !== this._canvas.height) {
        this._canvas.height = this._mapNode.clientHeight;
      }
    }
    this._isCanvasResizedForRecording = false;
  }

  /**
   * Stops the video recording process. If abort is false, finalizes and saves the MP4 file.
   * @param abort If true, the recording is discarded, and no file is saved. Defaults to false.
   */
  async stop(abort = false): Promise<Blob | null> {
    if (!this._videoEncoder || !this._muxer) {
      this.cleanUp();
      return null;
    }

    let blob: Blob | null = null;

    try {
      if (!abort) {
        if (this._videoEncoder.state === "configured") {
          // Flush the encoder to ensure all frames are processed
          await this._videoEncoder.flush();
        }

        this._muxer.finalize();

        const buffer = this._muxer.target.buffer;
        if (buffer) {
          blob = new Blob([buffer], {type: MIME_MP4});
        }
      }
    } catch (error) {
      console.error('Error while stopping the video recording:', error);
    } finally {
      // Properly close the encoder if not already closed
      this.cleanUp();
    }

    return blob;
  }
}