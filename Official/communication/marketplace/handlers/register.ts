// Marketplace Registration Handler
// Signs the payload with the instance's Ed25519 keypair and POSTs to the hub.
// Used by both "register" and "update_profile" commands.
import crypto from 'node:crypto';

const DEFAULT_HUB_URL = 'https://jarvis-marketplace-hub.vercel.app';

interface RegisterParams {
  nickname?: string;
  description?: string;
  avatar_color?: string;
  avatar_icon?: string;
  avatar_border?: string;
  featured_skills?: string[];
  skills_writeup?: string;
  repo_url?: string;
  repo_type?: string;
}

export default async function (params: RegisterParams): Promise<{ result: string }> {
  const hubUrl = process.env.HUB_URL || DEFAULT_HUB_URL;
  const privateKeyB64 = process.env.JARVIS_PRIVATE_KEY;
  const publicKeyB64 = process.env.JARVIS_PUBLIC_KEY;

  if (!privateKeyB64 || !publicKeyB64) {
    return {
      result: 'Error: JARVIS_PRIVATE_KEY and JARVIS_PUBLIC_KEY environment variables are required. Generate a keypair first.',
    };
  }

  // Build the profile payload — strip undefined/null values
  const profile: Record<string, unknown> = {};
  if (params.nickname !== undefined) profile.nickname = params.nickname;
  if (params.description !== undefined) profile.description = params.description;
  if (params.avatar_color !== undefined) profile.avatar_color = params.avatar_color;
  if (params.avatar_icon !== undefined) profile.avatar_icon = params.avatar_icon;
  if (params.avatar_border !== undefined) profile.avatar_border = params.avatar_border;
  if (params.featured_skills !== undefined) profile.featured_skills = params.featured_skills;
  if (params.skills_writeup !== undefined) profile.skills_writeup = params.skills_writeup;
  if (params.repo_url !== undefined) profile.repo_url = params.repo_url;
  if (params.repo_type !== undefined) profile.repo_type = params.repo_type;

  const payload = {
    public_key: publicKeyB64,
    profile,
    timestamp: new Date().toISOString(),
  };

  // Sign the payload with Ed25519
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
  const privateKeyDer = Buffer.from(privateKeyB64, 'base64');
  const keyObject = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  });
  const signature = crypto.sign(null, payloadBytes, keyObject);

  try {
    const resp = await fetch(`${hubUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        signature: signature.toString('base64'),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { result: `Hub error (${resp.status}): ${data.error ?? JSON.stringify(data)}` };
    }

    return {
      result: `Registered on marketplace as "${profile.nickname ?? '(updated)'}"\nInstance ID: ${data.instance_id ?? 'N/A'}\nPublic key fingerprint: ${publicKeyB64.slice(0, 16)}...`,
    };
  } catch (err: any) {
    return { result: `Network error reaching hub: ${err.message}` };
  }
}
