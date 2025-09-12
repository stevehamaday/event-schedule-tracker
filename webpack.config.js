import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/index.js',
    cache: false,
    output: {
        path: path.resolve(__dirname, 'docs'),
        filename: 'bundle.[contenthash].js',
        publicPath: '/' // SPA routing
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(xlsx|xls)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'files/'
                        }
                    }
                ]
            }
        ]
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'), // Use 'public' for local dev
        },
        compress: true,
        port: 3000,
        host: 'localhost',
        open: true,
        historyApiFallback: true // SPA routing
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/index.html',
            filename: './index.html'
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser.js',
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
        fallback: {
            process: 'process/browser',
            buffer: 'buffer'
        }
    }
};