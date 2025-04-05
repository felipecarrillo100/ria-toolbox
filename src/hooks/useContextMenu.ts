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
import {ContextMenu} from "@luciad/ria/view/ContextMenu.js";
import {createContext, useContext, useState} from "react";

export interface IContextMenuContext {
  open: boolean;

  x: number;

  y: number;

  contextMenu: ContextMenu | null;

  showContextMenu(pagePosition: number[], contextMenu: ContextMenu): void;

  hideContextMenu(): void;
}

export const ContextMenuContext = createContext<IContextMenuContext>(undefined!);

export const useContextMenuContext = () => {
  return useContext(ContextMenuContext);
}

interface State {
  open: boolean;
  x: number;
  y: number;
  contextMenu: ContextMenu | null;
}

export const useContextMenuState = () => {
  const [{open, x, y, contextMenu}, setState] = useState<State>({open: false, x: 0, y: 0, contextMenu: null});

  const showContextMenu = (position: number[], contextMenu: ContextMenu): void => {
    setState({
      open: true,
      x: position[0],
      y: position[1],
      contextMenu
    });
  }

  const hideContextMenu = (): void => {
    setState({
      open: false,
      x: 0,
      y: 0,
      contextMenu: null
    });
  };

  return {
    open,
    x,
    y,
    contextMenu,
    showContextMenu,
    hideContextMenu
  };

}