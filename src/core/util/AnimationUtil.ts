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
import {AnimationManager} from "@luciad/ria/view/animation/AnimationManager.js";
import {Animation} from "@luciad/ria/view/animation/Animation.js";

/**
 * Run a function with the AnimationManager.
 * <p/>
 * Per default, it runs 1 second, not looped, with a unique key.
 * @since 2025.0
 */
export function animate(callback: (fraction: number) => void, options: { duration?: number, loop?: boolean, key?: string, ease?: (fraction: number) => number, abortSignal?: AbortSignal } = {}): Promise<void> {
  const animation = new class extends Animation {
    constructor() {
      super(options.duration || 1000);
    }

    update(f: number) {
      callback(options.ease ? options.ease(f) : f);
    }
  };
  return AnimationManager.putAnimation(options.key || "#" + Math.random(), animation, options.loop || false, options.abortSignal).catch(e => {
  });
}