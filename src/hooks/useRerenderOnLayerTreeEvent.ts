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
import {LayerTree} from "@luciad/ria/view/LayerTree.js";
import {useEffect, useReducer} from "react";
import {Handle} from "@luciad/ria/util/Evented.js";

/**
 * Triggers a React rerender whenever one of the given events is emitted by the given layer tree.
 * This is useful when you don't want to duplicate the whole layerTree's state in React.
 */
export function useRerenderOnLayerTreeEvent(layerTree: LayerTree, events: string[]) {
  // https://reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    const handles: Handle[] = [];
    for (const event of events) {
      handles.push(layerTree.on(event, forceUpdate));
    }
    //an update is triggered here to avoid bad state caused by the cleanup of another component that happened
    // between the rendering of the component that calls this hook and the initialization of the listeners.
    forceUpdate();

    return () => {
      for (const handle of handles) {
        handle.remove();
      }
    }
  }, [layerTree, events.sort().join(",")]);

}