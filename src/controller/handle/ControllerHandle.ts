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
import {Point} from "@luciad/ria/shape/Point.js";
import {Shape} from "@luciad/ria/shape/Shape.js";

/**
 * A container for visual representations of a handle, as well as a function for checking mouse interaction.
 */
export class ControllerHandle<T = Point> {

  private _focused: boolean;
  private _interactionFunction: ((...any: any) => T) | null;
  private _interactsWithMouseFunction: ((viewPoint: Point) => boolean) | null;
  private _defaultShape: Shape | null;
  private _focusedShape: Shape | null;

  constructor() {
    this._focused = false;
    this._interactionFunction = null;
    this._interactsWithMouseFunction = null;
    this._defaultShape = null;
    this._focusedShape = null;
  }

  /**
   * An interaction function is non-null while an interaction is occurring, and null if an interaction is not occurring.
   * A function to perform while interaction is happening.
   */
  get interactionFunction(): ((...any: any) => T) | null {
    return this._interactionFunction;
  }

  set interactionFunction(value: ((...any: any) => T) | null) {
    this._interactionFunction = value;
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  /**
   * @param defaultShape A shape to visualize when the handle is not focused
   * @param focusedShape A shape to visualize when the handle is focused
   * @param interactsWithMouseFunction A function that expects as input a point in view coordinates, and outputs a boolean
   *                                   response.
   */
  update(defaultShape: Shape | null, focusedShape: Shape | null,
         interactsWithMouseFunction: (viewPoint: Point) => boolean): void {
    this._defaultShape = defaultShape;
    this._focusedShape = focusedShape;
    this._interactsWithMouseFunction = interactsWithMouseFunction;
  }

  get defaultShape(): Shape | null {
    return this._defaultShape;
  }

  get focusedShape(): Shape | null {
    return this._focusedShape;
  }

  get interactsWithMouseFunction(): ((viewPoint: Point) => boolean) | null {
    return this._interactsWithMouseFunction;
  }

  /**
   * Resets the focused state and interactionFunction.
   */
  endInteraction(): void {
    this._focused = false;
    this.interactionFunction = null;
  }
}