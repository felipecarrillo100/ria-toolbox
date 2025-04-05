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

interface UseGoogleMapsAPIKey {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  validationState: ValidationState;
  validationFeedback: string | null;
}

export const GOOGLE_API_LOCALSTORAGE_KEY = "luciadRiaGoogleAPIKey";

interface Props {
  addToLocalStorage: boolean;
}

/**
 * The same Google API Key can be used for both Google 2D Map Tiles and Google 3D Map Tiles.
 * When checking for validity of a given key, we try to create a Google 2D Tiles session,
 * as that is not a billable transaction.
 * @param addToLocalStorage
 */
export const useGoogleAPIKey = ({addToLocalStorage}: Props): UseGoogleMapsAPIKey => {
  const {value: apiKey, setValue} = useLocalStorage(GOOGLE_API_LOCALSTORAGE_KEY);

  async function validateKey(key: string | null, signal: AbortSignal): Promise<ValidationResult<string | null>> {
    if (key === null || key === "<YOUR_API_KEY>") {
      return {value: key, valid: false, feedback: "Please provide an API key"};
    }
    const validationResult = await validateGoogleAPIKey(key);
    if (!validationResult.valid) {
      console.error(new Error(validationResult.message));
    } else {
      if (addToLocalStorage) {
        localStorage.setItem(GOOGLE_API_LOCALSTORAGE_KEY, key);
      }
    }
    return {value: key, valid: validationResult.valid, feedback: validationResult.message};
  }

  const setApiKey = (key: string | null) => {
    if (!key || !addToLocalStorage) {
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

/**
 * A Google API key can be used for both Google 2D Tiles as Google 3D Tiles
 * We use the Session request from Google 2D Tiles for validation, with default parameters.
 * This request is not billable.
 * @param googleApiKey
 */
async function validateGoogleAPIKey(googleApiKey: string): Promise<{
  valid: boolean,
  message: string
}> {
  const request = new Request(`https://www.googleapis.com/tile/v1/createSession?key=${googleApiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      "mapType": "roadmap",
      "language": "en-US",
      "region": "US"
    })
  });
  const response = await fetch(request);
  if (response.status !== 200) {
    const errorMsg = (await response.json())["error"]["message"];
    return {valid: false, message: errorMsg};
  }
  return {valid: true, message: "Valid API key"};
}