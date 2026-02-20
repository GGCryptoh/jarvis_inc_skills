// Gemini Image Generation Handler
// Sends a text prompt to the Gemini multimodal API and extracts the
// generated image from the inline_data response parts.
//
// The Gemini generateContent response returns a mix of text and image parts:
//   candidates[0].content.parts[] -> { text } or { inlineData: { mimeType, data } }
//
// This handler reconstructs the output from those parts, returning the base64
// image data and any accompanying text from the model.

export default async function (params: {
  prompt: string;
  _apiKey: string;
  _baseUrl?: string;
  _model?: string;
}): Promise<{ result: string; imageData?: string; mimeType?: string; textResponse?: string }> {
  const { prompt, _apiKey } = params;
  if (!prompt) throw new Error('Image generation requires a "prompt" parameter');

  const model = params._model ?? 'gemini-2.5-flash-image';
  const baseUrl = params._baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${baseUrl}/models/${model}:generateContent?key=${_apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini Images API returned ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  let imageData: string | undefined;
  let mimeType: string | undefined;
  let textResponse = '';

  for (const part of parts) {
    if (part.inlineData) {
      mimeType = part.inlineData.mimeType ?? 'image/png';
      imageData = part.inlineData.data; // base64 encoded
    }
    if (part.text) {
      textResponse += part.text;
    }
  }

  if (!imageData) throw new Error('No image returned from Gemini');

  return {
    result: 'Image generated successfully via Gemini',
    imageData,
    mimeType,
    textResponse: textResponse || undefined,
  };
}
