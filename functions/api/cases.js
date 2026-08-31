import { compactProfile, json, retrieveCases } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const profile = compactProfile(await request.json().catch(() => ({})));
  return json({ cases: await retrieveCases(env, profile, 8) });
}
