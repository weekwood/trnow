module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-transform-react-jsx'
  ],
  ignore: [
    /node_modules\/(?!ink)/
  ]
}; 