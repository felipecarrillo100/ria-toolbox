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
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {ArrayCursor} from "@luciad/ria/model/store/ArrayCursor.js";

function bustCache(query?: string): string {
  // NEEDED FOR IE11
  return `${query ? `${query}&` : "?"}bust=${new Date().getTime()}`;
}

/**
 * Constructor options for <code>RestStore</code>.
 */
export interface RestStoreConstructorOptions {
  /**
   * The base URL for the REST store.
   */
  target: string

  /**
   * The contents of the HTML accept header, which defines the
   * content-types that are acceptable for the response. You want to change this if you want to support another format. In that
   * case, you also need to change the <code>Codec</code> used by this <code>Store</code>.
   * Default value: "application/javascript, application/json"
   */
  accepts?: string;

  /**
   * The <code>Codec</code> which will be used to convert the server response into LuciadRIA <code>Features</code>
   * and vice versa. The <code>Codec</code>needs to support both the <code>decode</code> and <code>encode</code> method.
   * You want to change this if you want to support another format. In that case, you also need to change the accept
   * header by specifying the <code>accept</code> property.
   */
  codec?: GeoJsonCodec;
}

export interface RestStoreQueryOptions extends QueryOptions {
  sort?: { descending: boolean, attribute: string }[];
  start?: number;
  count?: number;
  reference?: CoordinateReference;
}

/**
 * A store that can be used to access object collections from a REST web services. This class makes
 * the following assumptions wrt the REST interface of the target web service:
 * <ul>
 *   <li>The collection of objects can be obtained from a given base URL
 *   <li>The URL of individual objects can be derived from the base URL by appending an additional path component
 *       whose value is the ID of the object.
 * </ul>
 */
export class RestStore extends EventedSupport implements Store {

  private readonly _target: string;
  private readonly _accepts: string;
  private readonly _codec: GeoJsonCodec;

  /**
   * Creates a new RestStore instance. This store has capabilities to request its webservice to add,
   * modify or remove features through REST.
   *
   * @param  options options for the new store instance
   */
  constructor({target, accepts, codec}: RestStoreConstructorOptions) {
    super();
    this._target = target;
    while (this._target[this._target.length - 1] === "/") {
      this._target = this._target.substring(0, this._target.length - 1);
    }
    this._accepts = accepts || "application/javascript, application/json";
    this._codec = codec ?? new GeoJsonCodec();
  }

  async get(id: string | number, options: any): Promise<Feature> {
    const headers = options || {};
    headers.Accept = this._accepts;
    const response = await fetch(`${this._target}/${id}${bustCache()}`, {
      method: "GET",
      headers,
      credentials: "same-origin"
    });
    const content = await response.text();
    const cursor = this._codec.decode({
      content,
      contentType: response.headers.get("Content-Type") ?? undefined
    });
    if (cursor.hasNext()) {
      return cursor.next();
    }
    throw new Error(`Feature with id ${id} not found in RestStore`);
  }

  private async putImpl(feature: Feature, overwrite: boolean): Promise<FeatureId> {
    const id = feature.id;
    const hasId = overwrite;
    const encodedFeature = this._codec.encode(new ArrayCursor([feature]));
    //We use the following logic to determine the return ID. You might want to change this logic depending on the behavior of the server
    //- If the id is specified, this will be the id if the serverResponsePromise is resolved
    //- If the body of the server response is not empty, it will be passed to the codec in an attempt to convert it to a
    //  RIA feature. If this succeeds, the ID fo the Feature will be used as ID. If this fails, the contents of the
    //  server response is considered the ID (some REST server returns the whole Feature, some only the ID)
    //- If the Location header is specified, we assume this contains the location for that Feature. The ID will
    //  be parsed from that Location and returned
    //- If all the above fails, the returned Promise will be rejected
    const headers: Record<string, string> = {
      "Content-Type": encodedFeature.contentType,
      Accept: this._accepts
    };

    if (hasId) {
      headers["If-Match"] = "*";
    }

    const ifNoneMatch = !overwrite && hasId ? "*" : null;
    //We only add if-none-match if we try to put a feature that already has an id
    //otherwise, the request will fail if any resource already exists
    if (ifNoneMatch) {
      headers["If-None-Match"] = ifNoneMatch;
    }

    const response = await fetch((hasId ? (`${this._target}/${id}`) : (`${this._target}/`)) + bustCache(), {
      method: hasId ? "PUT" : "POST",
      body: encodedFeature.content,
      headers,
      credentials: "same-origin"
    });

    const data = await response.text();

    let returnedID: FeatureId | null = null;

    if (data && data !== "") {
      try {
        const contentType = response.headers.get("Content-Type");
        const featureCursor = this._codec.decode({
          content: data,
          contentType: contentType ?? undefined
        });
        if (featureCursor.hasNext()) {
          returnedID = featureCursor.next().id;
        }
      } catch (ignore) {
      }
      if (returnedID === null) {
        //the codec failed to parse it, assume the body just contains the ID
        returnedID = data;
      }
    } else {
      //empty body, check the location header
      const locationHeader = response.headers.get("Location");
      if (locationHeader) {
        returnedID = locationHeader.substring(this._target.length - 1);
      }
    }
    feature.id = returnedID!;
    this.emit("StoreChanged", hasId ? "update" : "add", feature, feature.id);
    return feature.id;
  }

  async put(feature: Feature): Promise<FeatureId> {
    return this.putImpl(feature, true);
  }

  async add(feature: Feature): Promise<FeatureId> {
    return this.putImpl(feature, false);
  }

  async remove(id: FeatureId): Promise<boolean> {
    await fetch(`${this._target}/${id}${bustCache()}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    this.emit("StoreChanged", "remove", undefined, id);
    return true;
  }

  async query(query?: Record<string, string> | string, options?: RestStoreQueryOptions): Promise<Cursor> {
    let headers: Record<string, string> = {
      Accept: this._accepts
    };
    options = options || {};
    let queryParams = "";

    if (options.start && options.start >= 0 || options.count && options.count >= 0) {
      headers = {
        ...headers,
        Range: `items=${options.start || '0'}-${("count" in options && options.count !== Infinity)
                                                ? (options.count! + (options.start || 0) - 1) : ''}`
      }
    }

    if (query && typeof query === "object") {
      queryParams = Object.keys(query).reduce((str, key, i) => {
        const delimiter = (i === 0) ? '?' : '&';
        key = encodeURIComponent(key);
        const val = encodeURIComponent((query as Record<string, string>)[key]);
        return [str, delimiter, key, '=', val].join('');
      }, '');
    }

    if (queryParams === null) {
      queryParams = "";
    }

    if (options && options.sort) {
      queryParams += (queryParams ? "&" : "?") + "sort(";
      for (let i = 0; i < options.sort.length; i++) {
        const sort = options.sort[i];
        queryParams += (i > 0 ? "," : "") + (sort.descending ? '-' : '+') + encodeURIComponent(sort.attribute);
      }
      queryParams += ")";
    }

    const response = await fetch(this._target + bustCache(queryParams), {
      method: "GET",
      headers,
      credentials: "same-origin",
      signal: options.abortSignal
    });
    const text = await response.text();
    return this._codec.decode({
      content: text,
      contentType: response.headers.get("Content-Type") ?? undefined,
      reference: options?.reference
    });
  }
}