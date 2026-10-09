'use strict';

let client = null;

if (process.env.NODE_ENV !== 'test' && process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoCollectConsole(false, true)
    .setSendLiveMetrics(true)
    .start();
  client = appInsights.defaultClient;
}

function trackEvent(name, properties = {}, measurements = {}) {
  if (!client) return;
  client.trackEvent({
    name,
    properties: Object.fromEntries(Object.entries(properties)
      .map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)])),
    measurements,
  });
}

module.exports = { trackEvent };
