import { json, modelConfig } from './_shared.js';

export function onRequestGet({ env }) {
  const config = modelConfig(env);
  return json({
    configured: Boolean(config.key),
    provider: config.provider,
    model: config.model,
    runtime: 'cloudflare-pages'
  });
}
