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
import {Evented, Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";

/**
 * Class that tracks the progress of given objects.
 * This can be used, for example, to track the progress of loading layers.
 */
export class ProgressManager<T = any> {

  private readonly _objectsInProgress: Map<T, Progress>;

  private _eventedSupport: EventedSupport;

  constructor() {
    this._eventedSupport = new EventedSupport(["ObjectAdded"], true);
    this._objectsInProgress = new Map();
  }

  /**
   * Get the progress of this object, if not managed, undefined is returned
   * @param object
   */
  getProgress(object: T): Progress | undefined {
    return this._objectsInProgress.get(object);
  }

  /**
   * Set the progress of the given object,
   * if not managed, add the object to the manager
   * @param object
   * @param progressValue
   */
  setProgress(object: T, progressValue: number) {
    let progress = this._objectsInProgress.get(object);
    if (!progress) {
      progress = new Progress();
      this.addObject(object, progress);
    }
    progress.value = progressValue;
    if (progress.value === progress.maxValue) {
      this._objectsInProgress.delete(object);
    }
  }

  /**
   * Adds this object to the manager, with an initial progress of '0'
   * @param object
   * @param progress the progress object you want to use, a default progress object if not specified
   */
  addObject(object: T, progress?: Progress) {
    this._objectsInProgress.set(object, progress ?? new Progress());
    this._eventedSupport.emit("ObjectAdded", object, progress);
  }

  /**
   * Fired when the progress-value changes.
   * @param event the "ObjectAdded" event
   * @param callBack the callback to be invoked when the progress changes.
   * The callback gets a parameters:
   * - 'object' which is the object added to the manager
   * - 'progress' the progress associated with the object
   * @param context value to use as this when executing callback.
   * @event ObjectAdded
   */
  on(event: "ObjectAdded", callBack: (object: T, progress: Progress) => void, context?: any): Handle;

  on(event: string, callback: (...args: any[]) => void, context?: any): Handle {
    return this._eventedSupport.on(event, callback, context);
  }
}

/**
 * Class that represents the progress of an object that is tracked by a {@link ProgressManager}
 */
export class Progress implements Evented {

  private static readonly DEFAULT_MIN_VALUE = 0;
  private static readonly DEFAULT_MAX_VALUE = 100;

  private _value: number;
  private readonly _minValue: number;
  private readonly _maxValue: number;

  private _eventedSupport: EventedSupport;

  /**
   *
   * @param minValue, if not defined a default of "0" is used
   * @param maxValue, if not defined a default of "100" is used
   */
  constructor(minValue?: number, maxValue?: number) {
    this._eventedSupport = new EventedSupport(["ValueChanged"], true);
    this._minValue = minValue ?? Progress.DEFAULT_MIN_VALUE;
    this._maxValue = maxValue ?? Progress.DEFAULT_MAX_VALUE;
    this._value = this._minValue;
  }

  get value(): number {
    return this._value;
  }

  set value(value: number) {
    if (value !== this._value) {
      this._value = Math.max(this._minValue, Math.min(this._maxValue, value));
      this._eventedSupport.emit("ValueChanged", this._value);
    }
  }

  get minValue(): number {
    return this._minValue;
  }

  get maxValue(): number {
    return this._maxValue;
  }

  /**
   * Fired when the progress-value changes.
   * @param event the "ValueChanged" event
   * @param callBack the callback to be invoked when the progress changes.
   * The callback gets a parameters:
   * - 'value' which is a number [minValue, maxValue] indicating the progress
   * @param context value to use as this when executing callback.
   * @event ValueChanged
   */
  on(event: "ValueChanged", callBack: (value: number) => void, context?: any): Handle;

  on(event: string, callback: (...args: any[]) => void, context?: any): Handle {
    return this._eventedSupport.on(event, callback, context);
  }
}