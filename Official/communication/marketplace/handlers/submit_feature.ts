// Marketplace Feature Request Submission Handler
// Signs the payload with the instance's Ed25519 keypair and POSTs to the hub.
import crypto from 'node:crypto';

const DEFAULT_HUB_URL = 'https://jarvis-marketplace-hub.vercel.app';

interface SubmitFeatureParams {
  title: string;
  description: string;
  category: 'skill' | 'feature' | 'integration' | 'improvement';
}

export default async function (params: SubmitFeatureParams): Promise<{ result: string }> {
  const hubUrl = process.env.HUB_URL || DEFAULT_HUB_URL;
  const privateKeyB64 = process.env.JARVIS_PRIVATE_KEY;
  const publicKeyB64 = process.env.JARVIS_PUBLIC_KEY;

  if (!privateKeyB64 || !publicKeyB64) {
    return {
      result: 'Error: JARVIS_PRIVATE_KEY and JARVIS_PUBLIC_KEY environment variables are required. Generate a keypair first.',
    };
  }

  if (!params.title || !params.description || !params.category) {
    return { result: 'Error: title, description, and category are all required' };
  }

  const payload = {
    public_key: publicKeyB64,
    feature_request: {
      title: params.title,
      description: params.description,
      category: params.category,
    },
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
    const resp = await fetch(`${hubUrl}/api/feature-requests`, {
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
      result: `Feature request submitted!\nID: ${data.id ?? 'N/A'}\nTitle: ${params.title}\nCategory: ${params.category}\nVotes: ${data.votes ?? 0}`,
    };
  } catch (err: any) {
    return { result: `Network error reaching hub: ${err.message}` };
  }
}
