const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          fs: false,
          path: false,
          crypto: false
        }
      }
    },
    plugins: {
      add: [
        new CopyPlugin({
          patterns: [
            {
              from: path.resolve(__dirname, 'node_modules/jq-web/jq.wasm'),
              to: 'static/js'
            }
          ]
        })
      ]
    }
  }
}; 