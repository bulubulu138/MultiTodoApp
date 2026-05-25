const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = process.env.NODE_ENV === 'production' || argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/renderer/index.tsx',
    target: 'web', // 改为web目标，避免electron-renderer的Node.js polyfill问题
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map', // 生产环境使用完整source map，开发环境使用快速source map
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
    conditionNames: ['import', 'module', 'require', 'default', '*'], // 支持 ES modules
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
};