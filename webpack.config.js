const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'docs/scripts'),
        filename: 'bundle.js',
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
        contentBase: path.join(__dirname, 'public'), // Use 'public' for local dev
        compress: true,
        port: 9000,
        open: true,
        historyApiFallback: true // SPA routing
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser.js',
        }),
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
        fallback: {
            process: require.resolve('process/browser.js'),
        },
    },
};