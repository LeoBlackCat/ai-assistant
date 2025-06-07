export enum TTSProvider {
  VERCEL = 'vercel',
  ELEVENLABS = 'elevenlabs'
}

async function speakWithElevenLabs(text: string): Promise<ArrayBuffer> {// Don't expose this in frontend in production
  const VOICE_ID = 'aeEByg7KUSvDrf9yJwhH';

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': localStorage.getItem('tmp::elevenlabs_api_key') ?? undefined,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2', // 'eleven_monolingual_v1', // or try 'eleven_multilingual_v1' for other languages
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.7
      }
    })
  });

  if (!response.ok) {
    throw new Error('TTS failed: ' + response.statusText);
  }

  return await response.arrayBuffer(); // For use with AudioContext or Howler.js
}

async function speakWithVercel(text: string): Promise<ArrayBuffer> {
  const response = await fetch(
    "https://edge-tts-stream-api.vercel.app/tts/stream",
    {
      method: "POST",
      body: JSON.stringify({
        voice: "ms-MY-YasminNeural",
        //voice: "ru-RU-SvetlanaNeural",
        //voice: "en-US-AvaMultilingualNeural",
        text,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }
  ).then((res) => res.arrayBuffer());
  return response;
}

export const tts = async (text: string, provider: TTSProvider = TTSProvider.VERCEL) => {
  switch (provider) {
    case TTSProvider.ELEVENLABS:
      return await speakWithElevenLabs(text);
    case TTSProvider.VERCEL:
    default:
      return await speakWithVercel(text);
  }
};
