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
import {useEffect, useRef, useState} from "react";
import {ValidationState} from "@luciad/ria-toolbox-core/util/ValidationState.js";

export interface ValidationResult<T> {
  value: T;
  valid: boolean;
  feedback?: string;
}

export function useAsyncValidation<T>(value: T, initialValue: T, emptyFeedback: string,
                                      validate: (value: T, abortSignal: AbortSignal) => Promise<ValidationResult<T>>) {
  const [validationState, setValidationState] = useState<ValidationState>('initial');
  const [validationFeedback, setValidationFeedback] = useState<string | null>(emptyFeedback);
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (value === initialValue) {
      setValidationState('initial');
      setValidationFeedback(emptyFeedback);
    } else {
      setValidationFeedback(null);
      setValidationState('pending');
      abortRef.current = new AbortController();
      validate(value, abortRef.current.signal).then(({value: val, valid, feedback}) => {
        if (value === val) { // check if the result is for the current value
          setValidationState(valid ? 'valid' : 'invalid');
          setValidationFeedback(feedback ?? null);
        }
      }).catch(error => {
        if (error.name !== 'AbortError') {
          setValidationState('invalid');
          setValidationFeedback(null);
        }
      });
    }
  }, [value, emptyFeedback]);

  return {validationState, validationFeedback};
}