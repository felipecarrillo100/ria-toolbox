const path = require('path');
const url = require('url');

// ensure compatibility with old samples, that import the webpack config with a CJS require() iso an ESM import
module.exports = function(dirname, sampleConfig) {
  return import(path.resolve(__dirname,"./webpack.config.js")).then(module => {
    const createWebpackConfig = module.default;
    const urlToWebpackConfig = url.pathToFileURL(path.join(dirname, 'webpack.config.js'));
    return createWebpackConfig(urlToWebpackConfig, sampleConfig);
  });
}