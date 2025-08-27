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

export const AZURE_MAPS_LOCALSTORAGE_KEY = "luciadRiaAzureMapsKey";

interface UseAzureMapsSubscriptionKey {
  subscriptionKey: string | null;
  setSubscriptionKey: (key: string | null) => void;
  validationState: ValidationState;
  validationFeedback: string | null;
}

export const useAzureMapsSubscriptionKey = (): UseAzureMapsSubscriptionKey => {
  const [subscriptionKey, setValue] = useState<string | null>(null);
  return useAzureMapsSubscriptionKeyInternal({subscriptionKey, setValue});
}

export const useAzureMapsSubscriptionKeyFromLocalStorage = (): UseAzureMapsSubscriptionKey => {
  const {value: subscriptionKey, setValue} = useLocalStorage(AZURE_MAPS_LOCALSTORAGE_KEY);
  return useAzureMapsSubscriptionKeyInternal({subscriptionKey, setValue});
}

interface InternalProps {
  subscriptionKey: string | null;
  setValue: (value: string | null) => void;
}

const useAzureMapsSubscriptionKeyInternal = ({subscriptionKey, setValue}: InternalProps): UseAzureMapsSubscriptionKey => {
  async function validateKey(key: string | null, signal: AbortSignal): Promise<ValidationResult<string | null>> {
    if (key === null) {
      return {value: key, valid: false, feedback: "Please provide a subscription key"};
    }
    const response = await fetch(`https://atlas.microsoft.com/map/tileset?api-version=2024-04-01&tilesetId=microsoft.base&subscription-key=${key}`, {signal});
    if (response.status !== 200) {
      if (response.status === 401) {
        return {value: key, valid: false, feedback: "Invalid subscription key"};
      } else {
        console.error(new Error((await response.json()).error_description));
        return {value: key, valid: false, feedback: "Unexpected error while testing Azure maps key"};
      }
    }
    return {value: key, valid: true, feedback: "Valid subscription key"};
  }

  const setSubscriptionKey = (key: string | null) => {
    if (!key) {
      setValue(null);
    } else {
      setValue(key);
    }
  };

  const {validationState, validationFeedback} = useAsyncValidation<string | null>(
      subscriptionKey,
      null,
      "Enter a subscription key",
      validateKey
  );

  return {subscriptionKey, setSubscriptionKey, validationState, validationFeedback};
}