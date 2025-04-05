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
/**
 * Interface representing a generic video recorder.
 */
export interface VideoRecorder {

  /**
   * Initializes the video recorder with the specified frame rate and quality settings.
   * @param fps - Frames per second. Determines how many frames are captured per second.
   * @param qualityFactor - A value between 0.0 and 1.0 representing the quality factor.
   *                        Higher values yield better quality but larger file sizes.
   * @param withLabels - A flag that indicates whether LuciadRIA labels should be embedded in the video.
   * @returns A promise that resolves when initialization is complete.
   */
  init(fps: number, qualityFactor: number, withLabels: boolean): Promise<void>;

  /**
   * Captures a single frame and adds it to the video sequence.
   * @returns A promise that resolves to `true` if the frame was successfully captured, or `false` if the capture failed.
   */
  captureFrame(): Promise<boolean>;

  /**
   * Stops the video recording process and releases system resources.
   * This method should always be called if the recorder was initialized.
   * @param abort - If true, recording will be aborted without finalizing the file.
   *                If false or omitted, the video file will be finalized and saved.
   * @returns A promise for video blob that resolves when the recording process is stopped.
   */
  stop(abort?: boolean): Promise<Blob | null>;
}
