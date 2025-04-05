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
 * Throttle the given function to be called only once every 'wait' ms.
 *
 * This function ensure that the last call is always executed, but possibly with a delay. This is different from
 * most other throttle functions, that simply drop calls if they are too soon after the previous call.
 *
 * @param callback The function to throttle
 * @param wait The minimum amount of milliseconds between two successive calls to the throttled function.
 */
export function throttle<A extends any[]>(callback: (...args: A) => void, wait: number): (...args: A) => void {

  if (wait <= 0) {
    return callback;
  }

  let throttled = false;
  let scheduled: A|null = null;
  return (...props: A) => {

    if (!throttled) {
      callback(...props);
      throttled = true;
    } else if (!scheduled) {
      setTimeout(function() {
        callback(...scheduled as A);
        throttled = false;
        scheduled = null;
      }, wait);
      scheduled = props;
    } else {
      scheduled = props;
    }
  };
}