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
import {useEffect, useState} from "react"

interface UseLocalStorage {
  value: string | null;
  setValue: (key: string | null) => void;
}

export const useLocalStorage = (key: string): UseLocalStorage => {
  const [localVal, setLocalVal] = useState<string | null>(localStorage.getItem(key));

  useEffect(() => {
    const localStorageChanged = (value: string | null) => {
      setLocalVal(value);
    }

    addListener(key, localStorageChanged);
    return () => {
      removeListener(key, localStorageChanged);
    }
  }, [key]);

  const setValue = (value: string | null) => {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    notifyListeners(key, value);
  }

  return {
    value: localVal,
    setValue
  };

}

// unfortunately, localStorage does not provide events when something changes
// As a workaround, a custom listener mechanism is implemented,
// so the useLocalStorage hook can be used in multiple places with the same key

type Callback = (value: string | null) => void;

const LISTENERS: { [key: string]: Callback[] } = {};

const addListener = (key: string, callback: Callback) => {
  if (!LISTENERS[key]) {
    LISTENERS[key] = [];
  }
  LISTENERS[key].push(callback);
}

const removeListener = (key: string, callback: Callback) => {
  if (!LISTENERS[key]) {
    return;
  }
  const idx = LISTENERS[key].indexOf(callback);
  if (idx >= 0) {
    LISTENERS[key].splice(idx, 1);
  }
  if (LISTENERS[key].length === 0) {
    delete LISTENERS[key];
  }
}

const notifyListeners = (key: string, value: string | null) => {
  if (!LISTENERS[key]) {
    return;
  }
  for (const listener of LISTENERS[key]) {
    listener(value);
  }
}