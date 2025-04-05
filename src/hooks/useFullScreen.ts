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
import {useEffect, useState} from "react";

export function isFullScreenElement() {
  return !!document.fullscreenElement ||
         //@ts-ignore
         !!document.webkitFullscreenElement;
}

interface UseFullScreen {
  fullScreen: boolean;

  openFullScreen(): void;

  closeFullScreen(): void;

  toggleFullScreen(): void;
}

export const useFullScreen = (): UseFullScreen => {
  const [fullScreen, setFullScreen] = useState(false);

  const openFullScreen = () => {
    const el = document.documentElement;

    if (el.requestFullscreen) {
      return el.requestFullscreen();
    }
    //@ts-ignore
    if (el.webkitRequestFullscreen) {
      //@ts-ignore
      return el.webkitRequestFullscreen();
    }
  }

  const closeFullScreen = () => {
    if (document.exitFullscreen) {
      return document.exitFullscreen();
    }
    //@ts-ignore
    if (document.webkitExitFullscreen) {
      //@ts-ignore
      return document.webkitExitFullscreen();
    }
  }

  useEffect(() => {
    const handleChange = () => {
      setFullScreen(isFullScreenElement());
    }

    document.addEventListener('webkitfullscreenchange', handleChange, false);
    document.addEventListener('fullscreenchange', handleChange, false);

    return () => {
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  return {
    fullScreen,
    openFullScreen,
    closeFullScreen,
    toggleFullScreen: fullScreen ? closeFullScreen : openFullScreen,
  };
}