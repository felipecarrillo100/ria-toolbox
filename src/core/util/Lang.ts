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
/**
 * Returns whether the given value is a promise
 */
export function isPromise<T>(value: any): value is Promise<T> {
  return !!value && typeof value.then === "function";
}

/**
 * Returns whether the given value is undefined
 */
export function isUndefined(value: any): value is undefined {
  return typeof value === "undefined";
}

/**
 * Returns whether the given value is defined, or null if specified
 */
export function isDefined(value: any, canBeNull: boolean = false) {
  return !isUndefined(value) && (canBeNull || value !== null);
}

/**
 * Returns whether the given value is a string
 */
export function isString(value: any): value is string {
  return typeof value === "string";
}

/**
 * Returns whether the given value is a number
 */
export function isNumber(value: any, canBeNaN: boolean = true): value is number {
  return typeof value === "number" && (canBeNaN || !isNaN(value));
}