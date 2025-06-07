import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { modelMap } from "./models.js";
import { tts, TTSProvider } from "./tts.js";
import { MotionSync } from "live2d-motionsync";
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from './lib/wavtools/index.js';

// API Configuration
const _LOCAL_API_URL = 'http://192.168.0.104:1234/v1/chat/completions';
const _OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const USE_LOCAL_API = false;  // Toggle between local and OpenAI API
const API_URL = USE_LOCAL_API ? _LOCAL_API_URL : _OPENAI_API_URL;

// Model Configuration
// Available models: "gpt-4.1-nano", "google/gemma-3-1b", 'deepseek-r1-0528-qwen3-8b-mlx'
const OPENAI_MODEL = USE_LOCAL_API ? 'google/gemma-3-4b' : 'gpt-4.1-nano';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).PIXI = PIXI;

async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer) {
  // Creating an AudioContext Instance
  const audioContext = new AudioContext();

  // Decoding an ArrayBuffer using decodeAudioData
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return audioBuffer;
}

// Function to remove emoji symbols from text
function removeEmojis(text: string): string {
  return text.replace(/[\p{Emoji}]/gu, '');
}

interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

interface ChatItem {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: string;
    text: string;
  }>;
}

const VoiceChatMalay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [textChatVisible, setTextChatVisible] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>("");
  const [transcriptionDelta, setTranscriptionDelta] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [translations, setTranslations] = useState<{ [key: number]: string }>({});
  const [isTranslating, setIsTranslating] = useState<{ [key: number]: boolean }>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const needToClearRef = useRef(false);

  const motionSync = useRef<MotionSync>();
  const toggleVoice = (): void => setVoiceActive(!voiceActive);
  const toggleTextChat = (): void => setTextChatVisible(!textChatVisible);

  const modelName = "kei_vowels_pro";

  const [isConnected, setIsConnected] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>(TTSProvider.VERCEL);
  const ttsProviderRef = useRef<TTSProvider>(ttsProvider);

  useEffect(() => {
    ttsProviderRef.current = ttsProvider;
  }, [ttsProvider]);

  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'system',
      content: [{ type: 'input_text', text: `
Arahan: Kamu ialah guru Bahasa Melayu untuk pelajar baru.

✅ Bercakap hanya dalam Bahasa Melayu asas.  
✅ Guna hanya perkataan dalam senarai ini:  apa khabar, saya, khabar baik, nama, selamat datang, ke, ini, abang, anda, dari, ya, orang, Inggeris, dan, awak, kamu, engkau, kau, dia, mereka, kita, kami, ia, orang tu, nak, hendak, tau, tahu, assalamualaikum, wa'alaikumussalam, negara, bahasa, Jepun, Jerman, Belanda, Perancis, bercakap, suka, bekerja, di, makan, baiklah, sama-sama, rumah, besar, pelajar, tidak, mari, suami, isteri, anak, bapa, ayah, emak, ibu, anak-anak, anak perempuan, anak lelaki, cucu, cucu perempuan, cucu lelaki, kakak, adik, adik perempuan, adik lelaki, sepupu, emak saudara, bapa saudara, anak saudara, siapa, ialah, kawan, mahu, belajar, Pak Cik, Mak Cik, Encik, Cik, Puan, Tun, Tan Sri, Datuk Seri, Datuk, Dato, Toh Puan, Puan Sri, Datin Seri, Datin..  
✅ Tulis satu ayat sahaja, maksimum 5 patah perkataan.  
✅ Tugas kamu ialah tanya soalan mudah kepada pelajar.  
✅ Jangan beri terjemahan atau penjelasan.  
✅ Jangan jawab sendiri, biar pelajar jawab.  
✅ Jangan tanya lebih daripada satu soalan dalam satu masa.  
✅ Jangan tanya soalan yang perlukan jawapan panjang.

Contoh:
- Apa nama?  
- Kamu dari mana?  
- Dia emak kamu?  
- Awak suka makan?  
- Ini rumah siapa?  
- Siapa dia?

⚠️ Jangan bercakap lebih daripada satu ayat.  
⚠️ Jangan guna perkataan luar dari senarai.  
⚠️ Jangan cakap Bahasa Inggeris.

Tanya pelajar sekarang.
Tanya soalan baru dengan perkataan lain.
Tukar ayat dengan cara lain.

` }],
      //content: [{ type: 'input_text', text: 'You are a helpful assistant. Try to shorten your answer to a few words or a sentence' }]
      //content: [{ type: 'input_text', text: 'You are an unhelpful assistant. Try to shorten your answer to a few words or a sentence. Keep in mind that we use speech to text, so you should not use too many words.' }]
    }
  ]);
  const itemsRef = useRef<ChatItem[]>([]);
  useEffect(() => { itemsRef.current = items }, [])
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => setUserInput(e.target.value);

  const translateMalayToEnglish = async (malayText: string) => {
    const openAIKey = localStorage.getItem('tmp::openai_api_key');
    if (!openAIKey) {
      throw new Error('OpenAI API key not found');
    }
  
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content: "You are a translator. Always translate from Malay to English. Do not add explanations."
          },
          {
            role: "user",
            content: malayText
          }
        ]
      })
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Translation request failed.');
    }
  
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
  
  const generateReplySuggestions = async (lastMessage: string) => {
    console.log(`generateReplySuggestions ${lastMessage}`);
    const openAIKey = localStorage.getItem('tmp::openai_api_key');
    if (!openAIKey) {
      throw new Error('OpenAI API key not found');
    }
  
    const response = await fetch(API_URL, {  // Use configured API URL
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content: 
  `Kamu ialah pembantu Bahasa Melayu.

Tugas kamu ialah bantu pelajar jawab soalan dengan ayat mudah dalam Bahasa Melayu asas. Guna hanya perkataan asas. Berikan 2–4 contoh jawapan dalam satu baris, dipisahkan dengan koma.

Contoh:
Soalan: Kamu suka makan?
Jawapan: Saya suka makan, Saya tidak suka, Maaf, saya tidak faham`


  // `Tugas kamu ialah bantu pelajar Bahasa Melayu.
  
  // Berdasarkan soalan atau mesej terakhir, berikan 2 hingga 4 contoh jawapan dalam Bahasa Melayu asas.
  
  // ✅ Guna hanya perkataan mudah seperti: saya, tidak, suka, makan, dari, ya, tidak, faham, dan perkataan dalam senarai perbendaharaan kata asas.
  
  // ✅ Jawapan boleh bersifat:
  // - ✅ Positif (contoh: Saya suka makan.)
  // - ❌ Negatif (contoh: Saya tidak suka.)
  // - 🤷 Tidak faham (contoh: Maaf, saya tidak faham.)
  
  // ✅ Tulis jawapan dalam satu baris, dipisahkan dengan koma.
  // ❌ Jangan beri penjelasan. Jangan tulis ayat panjang.
  
  // Contoh:
  // Soalan: Kamu suka makan?
  // Jawapan: Saya suka makan, Saya tidak suka, Maaf, saya tidak faham
  
  // Sekarang:
  // Soalan: ${lastMessage}
  // Jawapan:`
          },
          {
  role: "user",
  content: `Soalan: ${lastMessage}`
}
        ]
      })
    });
  
    if (!response.ok) {
      const error = await response.text();
      console.error("Reply generation failed:", error);
      return [];
    }
  
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
  
    console.log(`response ${content}`);
    // Split and clean
    return content
      .split(',')
      .map((x: string) => x.trim())
      .filter((x: string) => x.length > 0);
  }
  

  const handleSendMessage = async (messageText: string = userInput) => {
    if (!messageText.trim()) return;
    const newMessage: ChatItem = {
      role: 'user',
      content: [{
        type: 'input_text',
        text: messageText
      }]
    };
  
    const assistantMessage: ChatItem = {
      role: 'assistant',
      content: [{ type: 'input_text', text: '' }]
    };
    
    const fullMessageList = [...itemsRef.current, newMessage, assistantMessage]
  
    setItems(prev => {
      const updated = [...prev, newMessage, assistantMessage];
      itemsRef.current = updated; 
      return updated;
    });
    
    setIsLoading(true);
    try {
      const openAIKey = localStorage.getItem('tmp::openai_api_key');
      if (!openAIKey) {
        throw new Error('OpenAI API key not found');
      }

      const response = await fetch(API_URL, {  // Use configured API URL
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({

          model: OPENAI_MODEL,
          stream: true,
          messages: fullMessageList.map(item => ({
            role: item.role,
            content: item.content[0].text
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get response from OpenAI');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get response reader');

      const decoder = new TextDecoder("utf-8");
      let result = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.replace("data: ", "").trim();
            if (payload === "[DONE]") break;
            const json = JSON.parse(payload);
            const content = json.choices[0].delta.content;
            if (content) {
              result += content;
              // Update the last message (assistant's message) with the accumulated result
              setItems(prev => {
                const newItems = [...prev];
                const lastItem = newItems[newItems.length - 1];
                if (lastItem.role === 'assistant') {
                  lastItem.content[0].text = result;
                }
                return newItems;
              });
            }
          }
        }
      }

      // Clear input after sending
      setUserInput("");

      // Play TTS if motionSync is available
      if (motionSync.current) {
        console.log(`ttsProvider: ${ttsProviderRef.current}`);
        const cleanText = removeEmojis(result);
        const buffer = await tts(cleanText, ttsProviderRef.current);
        const audioBuffer = await arrayBufferToAudioBuffer(buffer);
        motionSync.current.play(audioBuffer);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000, debug: true })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      {
        apiKey: localStorage.getItem('tmp::openai_api_key') ?? undefined,
        dangerouslyAllowAPIKeyInBrowser: true,
      }
    )
  );

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    setIsConnected(true);
    setRealtimeEvents([]);
    //setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data: { mono: ArrayBuffer; raw: ArrayBuffer }) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setTranslations({});

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  useEffect(() => {
    console.log('updating session');
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // @ts-expect-error - Using custom model
    //client.updateSession({ input_audio_transcription: { model: 'whisper-1', language: 'ms' } });
    client.updateSession({ input_audio_transcription: { model: 'gpt-4o-mini-transcribe', language: 'ms' } });
    client.updateSession({ turn_detection: { type: 'server_vad' } });

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      if (realtimeEvent.event?.type === 'conversation.item.input_audio_transcription.delta') {
        const delta = realtimeEvent.event?.delta ?? '';
        setTranscriptionDelta(prev => {
          // If we need to clear, start fresh with the new delta
          if (needToClearRef.current) {
            needToClearRef.current = false;
            return delta;
          }
          // Otherwise append to existing text
          return prev + delta;
        });
      } else if (realtimeEvent.event?.type === 'conversation.item.input_audio_transcription.completed') {
        console.log('completed', realtimeEvent.event?.transcript ?? '');
        if (realtimeEvent.event?.transcript) {
          setTranscriptionDelta(realtimeEvent.event?.transcript);
          handleSendMessage(realtimeEvent.event.transcript);
        }
        needToClearRef.current = true;
      }
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      //console.log('conversation.interrupted');
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      //console.log('conversation.updated', item, delta);
    });

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  useEffect(() => {
    let app: PIXI.Application;
    let model: Live2DModel;
    const loadModel = async () => {
      if (!canvasRef.current) return;
      //setLoading(true);
      const modelUrl = modelMap[modelName];
      app = new PIXI.Application({
        view: canvasRef.current,
        resizeTo: canvasRef.current.parentElement || undefined,
        backgroundAlpha: 0,
        height: 300,
        width: 300,
      });
      model = await Live2DModel.from(modelUrl, { autoInteract: false });

      // Get the model aspect ratio
      const modelRatio = model.width / model.height;
      const centerModel = () => {
        // Make the model height half of the canvas
        model.height = app.view.height;
        model.width = model.height * modelRatio;
        model.x = (app.view.width - model.width) / 2;
        model.y = 0;
      };

      centerModel();
      app.stage.addChild(model as unknown as PIXI.DisplayObject);

      motionSync.current = new MotionSync(model.internalModel);
      motionSync.current.loadMotionSyncFromUrl(
        modelUrl.replace(/.model(.)?.json/, ".motionsync3.json")
      );
      //setLoading(false);
    };
    loadModel();
    return () => {
      app?.destroy();
      model?.destroy();
    };
  }, []);

  const handleTranslate = async (index: number, text: string) => {
    if (translations[index]) return; // Don't translate if already translated
    
    setIsTranslating(prev => ({ ...prev, [index]: true }));
    try {
      const translation = await translateMalayToEnglish(text);
      setTranslations(prev => ({ ...prev, [index]: translation }));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleHelpReply = async () => {
    // Find the last assistant message
    const lastAssistantMessage = [...items].reverse().find(item => item.role === 'assistant');
    if (!lastAssistantMessage) {
      console.log(`can't determine the last assistant message`);
      return;
    }
    setIsGeneratingSuggestions(true);
    try {
      const replySuggestions = await generateReplySuggestions(lastAssistantMessage.content[0].text);
      setSuggestions(replySuggestions);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    setSuggestions([]); // Clear suggestions after selecting one
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center min-h-screen bg-base-200 p-4 gap-4">
      {/* Left Column: Avatar & Controls */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        {/* TTS Provider Toggle */}
        <button
          className={`btn ${ttsProvider === TTSProvider.ELEVENLABS ? "btn-info" : "btn-secondary"} w-full`}
          onClick={() => setTtsProvider(prev => prev === TTSProvider.ELEVENLABS ? TTSProvider.VERCEL : TTSProvider.ELEVENLABS)}
        >
          TTS: {ttsProvider === TTSProvider.ELEVENLABS ? "ElevenLabs" : "Vercel"}
        </button>

        {/* Avatar & Animation */}
        <div className="bg-white rounded-2xl shadow p-4 relative">
          <canvas ref={canvasRef} />
          {transcriptionDelta && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
              {transcriptionDelta}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 flex-wrap justify-center">
          <button
            className={`btn ${isConnected ? "btn-error" : "btn-primary"}`}
            onClick={isConnected ? disconnectConversation : connectConversation}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
          <button
            className={`btn ${textChatVisible ? "btn-warning" : "btn-success"}`}
            onClick={toggleTextChat}
          >
            {textChatVisible ? "Hide Text Chat" : "Show Text Chat"}
          </button>
          <button
            className="btn btn-accent"
            onClick={handleHelpReply}
            disabled={isGeneratingSuggestions}
          >
            {isGeneratingSuggestions ? 'Generating...' : 'Help Me Reply'}
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="btn btn-outline btn-sm"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Chat Section */}
      {textChatVisible && (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col h-[500px] w-full max-w-sm">
          {/* Chat messages */}
          <div className="flex flex-col gap-2 overflow-y-auto mb-2 flex-1">
            {items.map((item, index) => {
              const content = item.content?.[0];
              if (!content) return null;

              if (item.role === 'system') return null;
              
              let messageText = '';
              if (content.type === 'text' || content.type === 'input_text') {
                messageText = content.text;
              } else if (content.type === 'audio' || content.type === 'input_audio') {
                messageText = content.transcript || '';
              }

              return (
                <div key={index} className={`chat ${item.role === 'assistant' ? 'chat-start' : 'chat-end'}`}>
                  <div className="relative group">
                    <div className={`chat-bubble ${item.role === 'assistant' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {messageText}
                    </div>
                    <button
                      onClick={() => handleTranslate(index, messageText)}
                      className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
                      disabled={isTranslating[index]}
                    >
                      {isTranslating[index] ? '...' : '🌐'}
                    </button>
                  </div>
                  {translations[index] && (
                    <div className="mt-1 text-sm text-gray-500 italic">
                      {translations[index]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="flex mt-2">
            <input
              type="text"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="input input-bordered flex-1 rounded-l-lg"
            />
            <button
              onClick={() => handleSendMessage()}
              className="btn btn-primary rounded-r-lg"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChatMalay;

