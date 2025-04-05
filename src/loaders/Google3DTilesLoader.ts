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
import "@luciad/ria-toolbox-config/asset-typings.d.ts"; // this allows imports of images (e.g. import ImageUrl from "./image.png")
import {TileSet3DLayer, TileSet3DLayerConstructorOptions} from "@luciad/ria/view/tileset/TileSet3DLayer.js";
import {OGC3DTilesModel} from "@luciad/ria/model/tileset/OGC3DTilesModel.js";
import {Map} from "@luciad/ria/view/Map.js";
import {LayerTreeNode} from "@luciad/ria/view/LayerTreeNode.js";
import {LayerTreeVisitor} from "@luciad/ria/view/LayerTreeVisitor.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {LayerGroup} from "@luciad/ria/view/LayerGroup.js";
import {FacetCullingType} from "@luciad/ria/view/style/FacetCullingType.js";
import GoogleLogoUrl from "./google_logo.png";

/**
 * How the Google information is stored in local storage (if allowed)
 */
const GOOGLE_INFO = "GOOGLE_INFO";

/**
 * The time that a new session can remain active before expiring
 * From <a href="https://developers.google.com/maps/documentation/tile/3d-tiles"> the Google 3D tiles documentation</a>,
 * we learn that the same session can be used for 3 hours.
 */
const TIME_SESSION_IS_VALID_MS: number = 3 * 60 * 60 * 1000;

/**
 * The time (in minutes) that the session needs to be valid until expiration to decide not to renew the session.
 */
const REUSE_SESSION_IF_MORE_THAN_X_MIN_REMAINING_VALID = 5;

interface GoogleInfo {
  rootUrl: string,
  apiKey: string,
  sessionId: string,
  validUntil: number,
}

//#snippet GOOGLE_3D_TILES_LOADER

/**
 * Almost all TileSet3DLayerConstructorOptions can be used to create a Google tileset 3D layer,
 * except
 * <ul>
 *   <li>qualityFactor: fixed at 0.125</li>
 *   <li>pointCloudStyle: no pointCloud layer.</li>
 * </ul>
 */
type GoogleTileSet3DLayerConstructorOptions = Omit<TileSet3DLayerConstructorOptions, "pointCloudStyle" | "qualityFactor">;

export interface Google3DTilesLoaderOptions {
  /**
   * Provide the map if you want to automatically
   * <ul>
   *   <li> make the globe transparent (without doing this, terrain intersects with the tiles). </li>
   *   <li> add the above mesh constraint. </li>
   *   <li> make all terrain-draped layers invisible. </li>
   * </ul>
   * These special map conditions will only remain in place as long as the Google tiles layer is visible.
   */
  map?: Map,

  /**
   * Set to true if you want to renew your session when the session expires.
   * <br>
   * From <a href="https://developers.google.com/maps/documentation/tile/3d-tiles"> the Google 3D tiles documentation</a>,
   * we learn that the same session can be used for 3 hours.
   * <br>
   * <i>"The render can make at least three hours of tile requests from a single root tileset request.
   * After reaching this limit, you must make another root tileset request."</i>
   *
   * @default false
   */
  autoRenew?: boolean,

  /**
   * Set to true if you want to keep your session active (through the use of local storage)
   *
   * @default false
   */
  keepSession?: boolean,

  /**
   * Almost all TileSet3DLayerConstructorOptions can be provided here, except for pointCloudStyle and qualityFactor
   * @default {}
   */
  layerConstructorOptions?: GoogleTileSet3DLayerConstructorOptions,
}

export const Google3DTilesLoader = {

  /**
   * Async function to create a TileSet3DLayer for Google 3D Tiles
   * @param googleApiKey your API key
   * @param options
   */
  createLayer: async (googleApiKey: string, options?: Google3DTilesLoaderOptions): Promise<TileSet3DLayer> => {
    //#endsnippet
    const googleInfo = await getGoogleInfo(googleApiKey, options?.keepSession ?? false);
    //#snippet ADD_GOOGLE_LOGO
    return OGC3DTilesModel.create(googleInfo.rootUrl,
        {requestParameters: {"key": googleInfo.apiKey, "session": googleInfo.sessionId}})
        .then(model => {
          model.getLogo = function(): string {
            return GoogleLogoUrl;
          };
          //#endsnippet
          const timeOut = autoRenewSession(googleInfo, model, options);
          const google3DTilesLayer = new TileSet3DLayer(model, {
            // Make sure to keep "Google" in the label of the layer
            label: "Google 3D Tiles",
            // keep the qualityFactor low, this dataset does not handle larger quality factors well due to it being so big.
            qualityFactor: 0.125,
            // individual buildings cannot be selected, there is no id property for them included in the data.
            selectable: false,
            meshStyle: {
              // don't add lighting, lighting is included in the textures, so this would lead to strange effects.
              lighting: false,
              // use the culling type as specified in the data, which in this case is backface culling.
              facetCulling: FacetCullingType.BASED_ON_DATA,
              // you can define other meshStyle settings here
              ...options?.layerConstructorOptions?.meshStyle,
            },
            // this tileset has terrain elevation information included, the mesh has the correct elevation where no
            // buildings are present.
            isPartOfTerrain: true,
            // no fading when replacing tiles
            fadingTime: 0,
            // use this to define other setting like drapeTarget for example
            ...options?.layerConstructorOptions
          });
          prepareMapForGoogle3DTiles(google3DTilesLayer, timeOut, options?.map);
          return google3DTilesLayer;
        });
  },

  /**
   * Async function to check the validity of the Google API key
   * @param googleApiKey your API key
   */
  validateGoogleAPIKey: async (googleApiKey: string): Promise<{
    valid: boolean,
    message: string
  }> => {
    const apiKeyFromStorage = Google3DTilesLoader.getAPIKeyFromLocalStorage();
    if (apiKeyFromStorage === googleApiKey) {
      return {valid: true, message: "Valid API key"};
    }

    const response = await fetch(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${googleApiKey}`);
    if (response.status !== 200) {
      const errorMsg = (await response.json())["error"]["message"];
      return {valid: false, message: errorMsg};
    }
    return {valid: true, message: "Valid API key"};
  },

  /**
   * Function to get a previously used Google API key from localStorage
   * Returns null if no key is present.
   */
  getAPIKeyFromLocalStorage(): string | null {
    const inStorage = localStorage.getItem(GOOGLE_INFO);
    if (inStorage) {
      const googleInfo = JSON.parse(inStorage);
      const validInfo = typeof googleInfo.apiKey !== "undefined";
      if (validInfo) {
        return googleInfo.apiKey;
      }
    }
    return null;
  }
}

/**
 * Google 3D tiles don't work together nicely with "the globe" or any terrain layer for that matter.
 * The globe tends to protrude the tiles. To alleviate that problem, we don't draw the globe when the
 * Google 3D Tiles layer is visible.
 * In this case we also constrain the navigation to "above Mesh", but that is a preference that can be overridden.
 *
 * @param google3DTilesLayer - the layer containing the Google 3D tiles
 * @param autoRenewTimeOut - the timeout to auto-renew a session, will be cleared if the layer is removed
 * @param map - the map containing the layer with Google 3D tiles
 */
function prepareMapForGoogle3DTiles(google3DTilesLayer: TileSet3DLayer, autoRenewTimeOut: number | null,
                                    map?: Map) {
  if (map) {
    const currentGlobeColor = map.globeColor;
    //#snippet GOOGLE_3D_TILES_MAP_GLOBE_COLOR
    // We need a transparent globe when showing Google 3D Tiles.
    map.globeColor = "rgba(0,0,0,0)";
    //#endsnippet

    map.layerTree.accept(hideLayersVisitor);

    const visibleHandler = google3DTilesLayer.on("VisibilityChanged", (visible) => {
      if (visible) {
        map.globeColor = "rgba(0,0,0,0)";
      } else {
        map.globeColor = currentGlobeColor;
      }
    });

    const removeHandler = map.layerTree.on("NodeRemoved", function(event) {
      if (event.node === google3DTilesLayer) {
        map.globeColor = currentGlobeColor;
        if (autoRenewTimeOut) {
          clearTimeout(autoRenewTimeOut);
        }
        visibleHandler.remove;
        removeHandler.remove;
      }
    });
  }
}

const hideLayersVisitor = {
  visitLayer: (layer: Layer): LayerTreeVisitor.ReturnValue => {
    if (!(layer instanceof TileSet3DLayer) && layer.visibleInTree) {
      layer.visible = false;
    }
    return LayerTreeVisitor.ReturnValue.CONTINUE;
  },
  visitLayerGroup: (layerGroup: LayerGroup): LayerTreeVisitor.ReturnValue => {
    layerGroup.visitChildren(hideLayersVisitor, LayerTreeNode.VisitOrder.TOP_DOWN);
    return LayerTreeVisitor.ReturnValue.CONTINUE;
  }
}

/**
 * This function can be used to automatically renew the session when it is about to expire
 */
function autoRenewSession(googleInfo: GoogleInfo, model: OGC3DTilesModel,
                          options?: Google3DTilesLoaderOptions): number | null {
  if (!options?.autoRenew) {
    return null;
  }
  const currentTime: number = new Date().getTime();
  const validUntil: number = googleInfo.validUntil;
  // 10s before it expires, we start the session renewal
  const validTimeInMs: number = (validUntil - currentTime) - 10000;
  // @ts-ignore
  return setTimeout(renewSession.bind(null, googleInfo, model, options), validTimeInMs);
}

async function renewSession(googleInfo: GoogleInfo, model: OGC3DTilesModel,
                            options?: Google3DTilesLoaderOptions): Promise<void> {
  if (!options?.autoRenew) {
    return;
  }
  const renewedGoogleInfo = await getGoogleInfo(googleInfo.apiKey, options?.keepSession ?? false);
  model.requestParameters = {"key": renewedGoogleInfo.apiKey, "session": renewedGoogleInfo.sessionId};
  autoRenewSession(renewedGoogleInfo, model, options);
}

/**
 * Create valid google model parameters, either fetch them from local storage (if allowed to use)
 * or get them through the Google API.
 *
 * @param apiKey the key needed to fetch the parameters (root and session)
 * @param useLocalStorage if using local storage is allowed
 * @return Session information
 * @throw Error if the key is invalid
 */
async function getGoogleInfo(apiKey: string, useLocalStorage: boolean): Promise<GoogleInfo> {
  if (useLocalStorage) {
    const inStorage = localStorage.getItem(GOOGLE_INFO);
    if (inStorage) {
      const googleInfo = JSON.parse(inStorage);
      const validInfo = typeof googleInfo.apiKey !== "undefined" &&
                        typeof googleInfo.rootUrl !== "undefined" &&
                        typeof googleInfo.sessionId !== "undefined" &&
                        typeof googleInfo.validUntil !== "undefined";
      if (validInfo) {
        const currentTime: number = new Date().getTime();
        const validUntil: number = googleInfo.validUntil;
        const validTimeInMinutes: number = Math.floor((validUntil - currentTime) / 1000 / 60);
        const validSession = validUntil > currentTime &&
                             validTimeInMinutes > REUSE_SESSION_IF_MORE_THAN_X_MIN_REMAINING_VALID;
        if (validSession) {
          console.log(
              `Reusing the previous session id (${googleInfo.sessionId}), which is still valid for ${validTimeInMinutes} minutes.`);
          return googleInfo;
        }
      }
    }
  }

  const response = await fetch(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`);
  if (response.status !== 200) {
    const errorMsg = (await response.json())["error"]["message"];
    throw new Error("Cannot load Google 3D Tiles root tile: " + errorMsg);
  }

  const jsonResponse = await response.json();
  const rootWithSession = "https://tile.googleapis.com" +
                          jsonResponse["root"]["children"][0]["children"][0]["content"]["uri"];
  const rootUrl = rootWithSession.split('?')[0];
  const sessionId = rootWithSession.split('=')[1];
  const googleInfo: GoogleInfo = {
    apiKey,
    rootUrl,
    sessionId,
    validUntil: new Date().getTime() + TIME_SESSION_IS_VALID_MS,
  }
  console.log(
      `Fetched a new session id (${sessionId}), which is valid for ${TIME_SESSION_IS_VALID_MS / 1000 / 60} minutes.`);
  if (useLocalStorage) {
    localStorage.setItem(GOOGLE_INFO, JSON.stringify(googleInfo));
  }
  return googleInfo;
}
