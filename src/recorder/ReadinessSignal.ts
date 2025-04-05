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
import { LayerTreeNode } from '@luciad/ria/view/LayerTreeNode.js';

/**
 * A function type that returns a promise that resolves when the recorder can progress to the next fraction.
 */
export type ReadinessSignal = () => Promise<unknown>;

/**
 * Creates a ReadinessSignal function that waits a specified amount of time before resolving.
 * @param timeout - The time to wait in milliseconds.
 * @returns A ReadinessSignal function
 */
export function createTimeReadinessSignal(timeout: number): ReadinessSignal {
  return () => new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Creates a ReadinessSignal function that waits until the next frame is ready to be drawn.
 * @returns A ReadinessSignal function
 */
export function createAnimationFrameReadinessSignal(): ReadinessSignal {
  return () => new Promise(resolve => window.requestAnimationFrame(resolve));
}

/**
 * Creates a ReadinessSignal function that waits until a specific layer tree node is ready.
 * @param layerNode - The layer tree node to wait for.
 * @returns A ReadinessSignal function
 */
export function createLayerTreeNodeReadinessSignal(layerNode: LayerTreeNode): ReadinessSignal {
  return () => layerNode.whenReady();
}

/**
 * Creates a ReadinessSignal function that waits until the first of multiple ReadinessSignal functions is resolved.
 * @param readinessSignals - An array of ReadinessSignal functions.
 * @returns A ReadinessSignal function
 */
export function createRaceReadinessSignal(readinessSignals: ReadinessSignal[]): ReadinessSignal {
  return () => Promise.race(readinessSignals.map(waiter => waiter()));
}
