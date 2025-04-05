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
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Map} from "@luciad/ria/view/Map.js";

export const useWebGLContextLost = (map: Map) => {
  const [isWebGLContextLost, setIsWebGLContextLost] = useState<boolean>((map instanceof WebGLMap && map.webGLContext) ? map.webGLContext.isContextLost() : false);

  useEffect(() => {
    if (map instanceof WebGLMap) {
      let currentWebGLContext = map.webGLContext;
      const handleContextLoss = () => {
        setIsWebGLContextLost(true);
      }
      currentWebGLContext?.canvas.addEventListener("webglcontextlost", handleContextLoss);

      const handle = map.on("WebGLContextChanged", () => {
        currentWebGLContext?.canvas.removeEventListener("webglcontextlost", handleContextLoss);
        currentWebGLContext = map.webGLContext;
        currentWebGLContext?.canvas.addEventListener("webglcontextlost", handleContextLoss);
        setIsWebGLContextLost(currentWebGLContext ? currentWebGLContext.isContextLost() : false);
      });

      setIsWebGLContextLost(map.webGLContext ? map.webGLContext.isContextLost() : false);
      return () => {
        currentWebGLContext?.canvas.removeEventListener("webglcontextlost", handleContextLoss);
        handle?.remove();
      }
    } else {
      setIsWebGLContextLost(false);
    }
  }, [map]);

  return {isWebGLContextLost};
}