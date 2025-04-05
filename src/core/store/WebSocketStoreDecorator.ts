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
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {Cursor} from "@luciad/ria/model/Cursor.js";
import {Feature, FeatureId} from "@luciad/ria/model/feature/Feature.js";
import {QueryOptions, Store} from "@luciad/ria/model/store/Store.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";

export interface WebSocketStoreDecoratorConstructorOptions {
  delegateStore: Store;
  target: string;
  webSocketMessageUpdatesStore?: boolean;
  getId?: (feature: Feature) => FeatureId;
}

/**
 * Store that wraps a delegate store to connect it to a websocket.
 */
export class WebSocketStoreDecorator implements Store {

  private _delegateStore: Store;
  private readonly _target: string;
  private readonly _eventedSupport: EventedSupport;
  private readonly _webSocketMessageUpdatesStore: boolean;
  private readonly _geoJsonCodec: GeoJsonCodec;
  private readonly _socket: WebSocket;
  private readonly _idRetriever: ((feature: Feature) => FeatureId) | null;

  spatialQuery?(bounds?: Bounds, query?: any, options?: QueryOptions): Promise<Cursor> | Cursor;

  add?(feature: Feature, options?: any): FeatureId | Promise<FeatureId>;

  get?(id: FeatureId, options?: any): Feature | Promise<Feature> | undefined;

  put?(feature: Feature, options?: any): FeatureId | Promise<FeatureId>;

  remove?(id: FeatureId): boolean | Promise<boolean>;

  constructor(options: WebSocketStoreDecoratorConstructorOptions) {
    if (!options.delegateStore) {
      throw new Error("WebSocketStoreDecorator: must pass in a store to decorate");
    }
    this._delegateStore = options.delegateStore;

    if (!options.target) {
      throw new Error("WebSocketStoreDecorator: must pass in a websocket target");
    }
    this._target = options.target;

    //Delegate the decorated store's events
    this._eventedSupport = new EventedSupport();
    if (this._delegateStore.on) {
      this._delegateStore.on("StoreChanged", this.delegateEvent, this);
    }

    // Initialize store:  add the same methods as on the delegate store.
    this.query = (query, options) => {
      return this._delegateStore.query(query, options);
    };

    if (this._delegateStore.spatialQuery) {
      this.spatialQuery = function(bounds, query, options) {
        return this._delegateStore.spatialQuery!(bounds, query, options);
      };
    }

    if (this._delegateStore.add) {
      this.add = (feature, options) => {
        return this._delegateStore.add!(feature, options);
      };
    }

    if (this._delegateStore.remove) {
      this.remove = (id) => {
        return this._delegateStore.remove!(id);
      };
    }

    if (this._delegateStore.put) {
      this.put = (feature, options) => {
        return this._delegateStore.put!(feature, options);
      };
    }

    if (this._delegateStore.get) {
      this.get = (id, options) => {
        return this._delegateStore.get!(id, options);
      };
    }

    // WebSocket message by default update the delegate store. This can be turned off in case the delegate
    // store would send an update to the server, which may create an endless "update - websocket message" loop.
    this._webSocketMessageUpdatesStore = true;
    if (typeof options.webSocketMessageUpdatesStore !== "undefined") {
      this._webSocketMessageUpdatesStore = options.webSocketMessageUpdatesStore;
    }

    this._geoJsonCodec = new GeoJsonCodec();

    this._idRetriever = null;
    if (options.getId) {
      this._idRetriever = options.getId;
    }

    this._socket = new WebSocket(this._target);
    this._socket.onmessage = (event) => this.onMessage(event);
  }

  query(query?: any, options?: QueryOptions): Cursor | Promise<Cursor> {
    return this._delegateStore.query(query, options);
  }

  on(event: string, callback: (eventType: string, feature: Feature, id: FeatureId) => any,
     context?: any): Handle {
    return this._eventedSupport.on(event, callback, context);
  }

  delegateEvent(eventType: string, feature: Feature, id: FeatureId): void {
    this._eventedSupport.emit("StoreChanged", eventType, feature, id);
  }

  onMessage(event: MessageEvent): void {
    if ("NoData" === event.data) {
      return;
    }

    try {
      const featureCursor = this._geoJsonCodec.decode({
        content: event.data
      });
      while (featureCursor.hasNext()) {
        const feature = featureCursor.next();
        if (this._idRetriever) {
          feature.id = this._idRetriever(feature);
        } else if (!feature.id) {
          throw new Error(
              `WebSocketStoreDecorator:: feature: ${feature} does not have an 'id' property. Please provide a getId function that returns a unique id for the features.`);
        }

        if (this._webSocketMessageUpdatesStore) {
          // assume that updating the feature on the store will trigger an update
          if (this._delegateStore.put) {
            this._delegateStore.put(feature);
          }
        } else {
          // just emit the update
          this._eventedSupport.emit("StoreChanged", "update", feature, feature.id);
        }
      }
    } catch (error) {
      //when an element is deleted, the server does not send json which can be converted to a feature, but only an id
      //this cannot be decoded by the codec, so we handle this scenario separately
      try {
        const json = JSON.parse(event.data);
        if (json.id) {
          if (this._webSocketMessageUpdatesStore) {
            if (this._delegateStore.remove) {
              this._delegateStore.remove(json.id);
            }
          } else {
            this._eventedSupport.emit("StoreChanged", "remove", undefined, json.id);
          }
        } else {
          console.log('WARN: unexpectedly could not parse the web _socket message. expecting id.', event.data);
        }
      } catch (e) {
        console.log('WARN: unexpectedly could not parse the web _socket message', event.data);
      }
    }
  }

  destroy(): void {
    this._socket.onmessage = null;
    this._socket.close();
  }
}

