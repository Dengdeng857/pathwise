import { json, modelConfig } from './_shared.js';

export function onRequestGet({ env }) {
  const config = modelConfig(env);
  return json({
    configured: Boolean(config.key),
    model: config.model,
    runtime: 'cloudflare-pages'
  });
}
