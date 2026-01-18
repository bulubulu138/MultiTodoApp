const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.tsx',
  target: 'web', // 改为web目标，避免electron-renderer的Node.js polyfill问题
  devtool: 'cheap-module-source-map', // 使用更快的 source map
  cache: {
    type: 'filesystem', // 启用文件系统缓存
    buildDependencies: {
      config: [__filename], // 当配置文件更改时，缓存失效
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          /\.test\.tsx?$/,  // Exclude test files
          /\.verify\.ts$/,  // Exclude verification files
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
        // 确保包含 node_modules 中的 CSS（如 react-quill）
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "events": require.resolve("events/"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "crypto": require.resolve("crypto-browserify"),
      "fs": false,
      "child_process": false,
      "net": false,
      "tls": false,
    }
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist'),
    globalObject: 'this',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
    }),
    new webpack.DefinePlugin({
      global: 'globalThis',
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      global: 'global',
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.join(__dirname, 'public'),
    },
  },
};