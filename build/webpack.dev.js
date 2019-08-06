const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// TODO not work
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'development',

  context: path.resolve(__dirname, '..'),

  entry: {
    'app': './src/index.ts',
    // 'dragonbones-phaser.min': path.resolve(__dirname, '../src/index.ts'),
  },

  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: ['.ts', '.tsx', '.js'],
  },

  output: {
    path: path.resolve(__dirname, '../dist/'),
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'babel-loader'
          },
          {
            loader: 'ts-loader'
          }
        ]
      },
      { test: /\.js$/, use: ['babel-loader'] },
    ]
  },

  plugins: [
    new webpack.ProgressPlugin(),
    new CleanWebpackPlugin({
      verbose: true
    }),
    new HtmlWebpackPlugin({
      template: './public/template.html',
    }),
    new CopyWebpackPlugin([
      { from: './assets/', to: 'assets/' }
    ]),
  ],

  devServer: {
    // contentBase: `${__dirname}/../dist`,
    // publicPath: 'Demos/dist/',
    // compress: true,
    port: 9000
  }
}