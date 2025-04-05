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
import path from "path";
import fs from "fs";
import webpack from "webpack";
import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";
import {terserConfig} from "./terser.config.js";
import {fileURLToPath} from 'url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname);
const RIA_ROOT_PATH = path.join(CONFIG_PATH, '../../..');
const OUTPUT_PATH = path.join(RIA_ROOT_PATH, "/packed-samples/");
const SAMPLES_PATH = path.join(RIA_ROOT_PATH, "/samples/");
const TOOLBOX_PATH = path.join(RIA_ROOT_PATH, "/toolbox/");
const DEFAULT_WEBPACK_PORT = 3001;
let DEFAULT_SAMPLE_SERVER_URL = "http://localhost:8072";
const DEFAULT_LICENSE_LOADER_PATH = path.join(CONFIG_PATH, "LicenseLoader.ts");
const DEFAULT_SAMPLE_DATA_PATH = path.join(`${RIA_ROOT_PATH}/sampledata/`);
const DEFAULT_LICENSE_FILE_PATH = path.join(`${RIA_ROOT_PATH}/licenses`);
const devMode = process.env.NODE_ENV !== "production";
export default (function(importMetaUrl, sampleConfig = {}) {
  const sampleSourcePath = path.dirname(fileURLToPath(importMetaUrl));
  const sampleName = path.basename(sampleSourcePath);
  const modulePath = path.resolve(sampleSourcePath, "../");
  const moduleName = path.basename(modulePath);
  return (environment, args) => {
    const env = environment || {};
    const portNumber = (args && args.port) || DEFAULT_WEBPACK_PORT;
    let sampleOutputDir = env.sampleOutputDir ?
                          path.resolve(env.sampleOutputDir) : path.join(OUTPUT_PATH, moduleName, sampleName);
    const sampleServerUrl = env.sampleServerUrl || DEFAULT_SAMPLE_SERVER_URL;
    const sampleDataPath = env.sampleDataPath || DEFAULT_SAMPLE_DATA_PATH;
    const licenseFilePath = env.licenseFilePath || DEFAULT_LICENSE_FILE_PATH;
    const isWebGL = typeof env.isWebGL !== "undefined" ? env.isWebGL === "true" || env.isWebGL === true : true;
    const is3D = env.is3D === "true" || env.is3D === true;
    const licenseLoader = env.licenseLoader || DEFAULT_LICENSE_LOADER_PATH;
    let openPage = "http://localhost:" + portNumber + "/"; // On windows, you cannot browse to 0.0.0.0
    if (isWebGL || is3D) {
      openPage += "?webgl=true";
    } else {
      openPage += "?webgl=false";
    }
    if (is3D) {
      openPage += "&reference=EPSG:4978";
    }
    const realPath = (modulePath) => {
      if (fs.existsSync(modulePath)) {
        return fs.realpathSync(modulePath); // resolve symlink if path exists
      }
      return modulePath; // otherwise just return path as-is, to avoid webpack config errors
    };
    // make sure the _real_ filepath (disregarding symlinks) is used in webpack config includes / excludes.
    // webpack uses the _real_ filepath for its modules (it follows symlinks and then uses the final path)
    const realRiaDir = realPath(path.dirname(require.resolve('@luciad/ria/package.json')));
    let realGeometryDir = null;
    try {
      realGeometryDir = realPath(path.dirname(require.resolve('@luciad/ria-geometry/package.json')));
    } catch (e) {
      // geometry package not installed, ignore
    }
    let realMilsymDir = null;
    try {
      realMilsymDir = realPath(path.dirname(require.resolve('@luciad/ria-milsym/package.json')));
    } catch (e) {
      // milsym package not installed, ignore
    }
    // RIA modules are already minified and optimized, so little need to optimize them again.
    // Especially Photon (photon_painter.js) takes a long time be processed by TerserPlugin.
    // Put all RIA modules in a separate chunk and exclude that chunk from TerserPlugin.
    // This makes production webpack builds a lot faster (10-20 sec for a sample, instead of 2 minutes+)
    const isRIAModule = (module) => {
      if (!module || !module.resource) {
        return false;
      }
      const filename = module.resource;
      const isInRia = realRiaDir && filename.indexOf(realRiaDir) >= 0;
      const isInGeometry = realGeometryDir && filename.indexOf(realGeometryDir) >= 0;
      const isInMilsym = realMilsymDir && filename.indexOf(realMilsymDir) >= 0;
      return isInRia || isInGeometry || isInMilsym;
    };
    const webSocketUrl = sampleServerUrl.replace("http", "ws");
    //always transpile _all_ sample sources
    //sample source might be symlinked into samples
    //asset-typings might not be in the samples dir when importing as npm package
    const transpileDirectories = [SAMPLES_PATH,TOOLBOX_PATH, sampleSourcePath, path.join(__dirname, "asset-typings.d.ts")];
    const mainTSXExists = fs.existsSync(path.join(sampleSourcePath, "main.tsx"));
    const mainTSExists = fs.existsSync(path.join(sampleSourcePath, "main.ts"));
    const mainJSXExists = fs.existsSync(path.join(sampleSourcePath, "main.jsx"));
    const mainEntry = path.join(sampleSourcePath,
        mainTSXExists ? "main.tsx" : mainTSExists ? "main.ts" : mainJSXExists ? "main.jsx" : "main.js");
    return {
      mode: "development",
      context: sampleSourcePath,
      entry: ["core-js", licenseLoader, mainEntry],
      output: {
        filename: "[name].bundle.[fullhash].js",
        path: sampleOutputDir,
        publicPath: ""
      },
      plugins: [
        new webpack.ProgressPlugin(),
        new CopyWebpackPlugin({
          patterns: [{
            from: "./",
            to: "./",
            noErrorOnMissing: true,
            globOptions: {
              //we can safely ignore all files that are handled by loaders/plugins.
              ignore: [
                "**/*.js",
                "**/*.jsx",
                "**/*.css",
                "**/*.ts",
                "**/*.tsx",
                "**/index.html",
                "**/package.json",
                "**/package-lock.json",
                "**/tsconfig.json",
                "**/node_modules/**/*"
              ]
            }
          }]
        }),
        new HtmlWebpackPlugin({
          template: "index.html",
          filename: "index.html",
        }),
        new MiniCssExtractPlugin({
          filename: devMode ? "[name].css" : "[name].bundle.[fullhash].css",
          chunkFilename: devMode ? "[id].css" : "[id].[contenthash].css"
        })
      ],
      devtool: "source-map",
      resolve: {
        extensions: ['.wasm', '.mjs', '.js', '.jsx', '.json', '.ts', '.tsx'],
        extensionAlias: {
          '.jsx': ['.tsx', '.jsx'],
          '.js': ['.ts', '.js'],
        },
        fallback: {
          "fs": false,
          "tls": false,
          "net": false,
          "path": false,
          "zlib": false,
          "http": false,
          "https": false,
          "stream": false,
          "crypto": false,
        }
      },
      module: {
        rules: [
          {
            test: /.(jsx?|tsx?)$/,
            include: transpileDirectories,
            exclude: [/photon_painter.js/],
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              configFile: path.join(CONFIG_PATH, "transpile-browser.babelrc")
            }
          },
          {
            test: /\.css$/i,
            use: [
              //loader to have separate CSS files, this avoids flashes of unstyled pages
              {loader: MiniCssExtractPlugin.loader, options: {}},
              //loader to resolve the imports inside css files
              "css-loader",
            ]
          },
          { // allows importing font files from ts(x) files (and puts them in the fonts folder when building)
            test: /\.(eot|woff|woff2|otf|ttf|svg)$/,
            type: 'asset/resource',
            generator: {
              filename: 'fonts/[name][ext]'
            }
          },
          { // allows importing image files from ts(x) files (and puts them in the images folder when building)
            test: /\.(png|gif)$/,
            type: 'asset/resource',
            generator: {
              filename: "images/[name].[contenthash][ext]"
            }
          },
          { // allows importing assets from ts(x) files (and puts them in the assets folder when building)
            test: /\.(glb|gltf)$/,
            type: 'asset/resource',
            generator: {
              filename: "assets/[name].[contenthash][ext]"
            }
          }
        ],
      },
      optimization: {
        minimizer: [new TerserPlugin({
          parallel: true,
          terserOptions: terserConfig,
          exclude: [/ria-modules/]
        })],
        splitChunks: {
          cacheGroups: {
            "ria-modules": {
              test: isRIAModule,
              name: 'ria-modules',
              enforce: true,
              chunks: 'all'
            }
          }
        }
      },
      devServer: {
        host: "0.0.0.0",
        hot: true,
        open: openPage,
        port: portNumber,
        static: [
          {directory: sampleDataPath, publicPath: "/sampledata"},
          {directory: licenseFilePath, publicPath: "/licenses"}
        ],
        proxy: [
          {context: ["/sampleservices/tracks"], target: webSocketUrl, ws: true},
          {context: ["/sampleservices/blueforces"], target: webSocketUrl, ws: true},
          {context: ["/sampleservices/db/notifications"], target: webSocketUrl, ws: true},
          {context: ["/sampleservices/annotation/notifications"], target: webSocketUrl, ws: true},
          {context: ["/sampleservices"], target: sampleServerUrl}
        ]
      }
    };
  };
});
