const path = require('path');
const webpack = require("webpack");

module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  },
  plugins: [],
  entry: {
	filename: path.resolve(__dirname, 'webpack-src.js')
  },
  output: {
    path: path.resolve(__dirname, 'umd'),
    filename: 'ReduxCluster.js',
	libraryTarget: "umd"
  }
};