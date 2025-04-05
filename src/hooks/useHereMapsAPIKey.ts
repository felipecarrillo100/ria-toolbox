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
import {ValidationState} from "@luciad/ria-toolbox-core/util/ValidationState.js";
import {useAsyncValidation, ValidationResult} from "./useAsyncValidation.js";
import {useLocalStorage} from "./useLocalStorage.js";
import {useState} from "react";

interface UseHereMapsAPIKey {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  validationState: ValidationState;
  validationFeedback: string | null;
}

export const HERE_MAPS_LOCALSTORAGE_KEY = "luciadRiaHereMapsKey";

export const useHereMapsAPIKey = (): UseHereMapsAPIKey => {
  const [apiKey, setValue] = useState<string | null>(null);
  return useHereMapsAPIKeyInternal({apiKey, setValue});
}

export const useHereMapsAPIKeyFromLocalStorage = (): UseHereMapsAPIKey => {
  const {value: apiKey, setValue} = useLocalStorage(HERE_MAPS_LOCALSTORAGE_KEY);
  return useHereMapsAPIKeyInternal({apiKey, setValue});
}

interface InternalProps {
  apiKey: string | null;
  setValue: (value: string | null) => void;
}

const useHereMapsAPIKeyInternal = ({apiKey, setValue}: InternalProps): UseHereMapsAPIKey => {
  async function validateKey(key: string | null, signal: AbortSignal): Promise<ValidationResult<string | null>> {
    if (key === null) {
      return {value: key, valid: false, feedback: "Please provide an API key"};
    }
    const response = await fetch(`https://geocode.search.hereapi.com/v1/geocode?apiKey=${key}&q=%22%22`, {signal});
    if (response.status !== 200) {
      if (response.status === 401) {
        return {value: key, valid: false, feedback: "Invalid API key"};
      } else {
        console.error(new Error((await response.json()).error_description));
        return {value: key, valid: false, feedback: "Unexpected error while testing HERE maps key"};
      }
    }
    return {value: key, valid: true, feedback: "Valid API key"};
  }

  const setApiKey = (key: string | null) => {
    if (!key) {
      setValue(null);
    } else {
      setValue(key);
    }
  };

  const {validationState, validationFeedback} = useAsyncValidation<string | null>(
      apiKey,
      null,
      "Enter an API key",
      validateKey
  );

  return {apiKey, setApiKey, validationState, validationFeedback};
}