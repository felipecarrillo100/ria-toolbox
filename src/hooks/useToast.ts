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
import {createContext, useContext, useRef, useState} from "react";

type Level = "error" | "warning" | "info"

export interface Toast {
  level: Level;
  text: string;
  tag: string | null;

  close(): void;
}

export interface IToastContext {
  toasts: Toast[];

  showErrorToast(message: string, error: unknown, tag?: string): void;

  showWarningToast(message: string, tag?: string): void;

  showInfoToast(message: string, tag?: string): void;
}

export const ToastContext = createContext<IToastContext>(undefined!);

export const useToastContext = () => {
  return useContext(ToastContext);
}

export const useToastState = (toastDuration: number = 12000) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const tags = useRef<string[]>([]);

  const showToast = (level: Level, text: string, aTag?: string): boolean => {
    const tag = aTag ?? null;
    if (tag && tags.current.indexOf(tag) >= 0) {
      return false;
    }

    if (tag) {
      tags.current.push(tag);
    }

    const closeToast = () => {
      setToasts(toasts => toasts.filter(t => t !== toast));
    }

    const toast: Toast = {
      level,
      text,
      tag,
      close: closeToast
    };

    setToasts(toasts => [toast, ...toasts]);

    setTimeout(closeToast, toastDuration);

    return true;
  }

  const showErrorToast = (message: string, error?: unknown, tag?: string): void => {
    const shown = showToast("error", message, tag);
    if (shown && error) {
      console.error(error);
    }
  }

  const showWarningToast = (message: string, tag?: string): void => {
    showToast("warning", message, tag);
  }

  const showInfoToast = (message: string, tag?: string) => {
    showToast("info", message, tag);
  }

  return {
    toasts,
    showErrorToast,
    showWarningToast,
    showInfoToast
  };

}

