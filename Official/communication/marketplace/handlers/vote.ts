// Marketplace Feature Request Vote Handler
// Signs the vote payload with the instance's Ed25519 keypair and POSTs to the hub.
import crypto from 'node:crypto';

const DEFAULT_HUB_URL = 'https://jarvis-marketplace-hub.vercel.app';

interface VoteParams {
  feature_request_id: string;
  value: number;
}

export default async function (params: VoteParams): Promise<{ result: string }> {
  const hubUrl = process.env.HUB_URL || DEFAULT_HUB_URL;
  const privateKeyB64 = process.env.JARVIS_PRIVATE_KEY;
  const publicKeyB64 = process.env.JARVIS_PUBLIC_KEY;

  if (!privateKeyB64 || !publicKeyB64) {
    return {
      result: 'Error: JARVIS_PRIVATE_KEY and JARVIS_PUBLIC_KEY environment variables are required. Generate a keypair first.',
    };
  }

  if (!params.feature_request_id) {
    return { result: 'Error: feature_request_id is required' };
  }

  const voteValue = params.value === -1 ? -1 : 1;

  const payload = {
    public_key: publicKeyB64,
    vote: {
      feature_request_id: params.feature_request_id,
      value: voteValue,
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
    const resp = await fetch(`${hubUrl}/api/feature-requests/${params.feature_request_id}/vote`, {
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
      result: `Vote recorded!\nFeature: ${params.feature_request_id}\nYour vote: ${voteValue === 1 ? 'upvote' : 'downvote'}\nTotal votes: ${data.votes ?? 'N/A'}`,
    };
  } catch (err: any) {
    return { result: `Network error reaching hub: ${err.message}` };
  }
}
