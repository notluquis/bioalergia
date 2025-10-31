module.exports = {
  plugins: {
    "postcss-preset-env": {
      stage: 0,
      features: {
        // enable features that help with modern CSS features
        "custom-properties": true,
        "nesting-rules": true,
      },
    },
    autoprefixer: {},
  },
};
