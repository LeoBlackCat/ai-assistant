import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { modelMap } from "./models.js";
import { tts, TTSProvider } from "./tts.js";
import { MotionSync } from "live2d-motionsync";
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from './lib/wavtools/index.js';
import { getApiUrl, getModel } from './config';

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

const VoiceChatGF: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [textChatVisible, setTextChatVisible] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>("");
  const [transcriptionDelta, setTranscriptionDelta] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const needToClearRef = useRef(false);

  const motionSync = useRef<MotionSync>();
  const toggleVoice = (): void => setVoiceActive(!voiceActive);
  const toggleTextChat = (): void => setTextChatVisible(!textChatVisible);

  const modelName = "kei_vowels_pro";

  const [isConnected, setIsConnected] = useState(false);
  
  // Load settings from localStorage with defaults
  const [useLocalService, setUseLocalService] = useState<boolean>(() => {
    const saved = localStorage.getItem('useLocalService');
    return saved ? JSON.parse(saved) : true;
  });
  
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>(() => {
    const saved = localStorage.getItem('ttsProvider');
    return saved ? JSON.parse(saved) : TTSProvider.VERCEL;
  });
  
  const [recognitionMode, setRecognitionMode] = useState<'browser' | 'realtime'>(() => {
    const saved = localStorage.getItem('recognitionMode');
    return saved ? JSON.parse(saved) : 'browser';
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('useLocalService', JSON.stringify(useLocalService));
  }, [useLocalService]);

  useEffect(() => {
    localStorage.setItem('ttsProvider', JSON.stringify(ttsProvider));
  }, [ttsProvider]);

  useEffect(() => {
    localStorage.setItem('recognitionMode', JSON.stringify(recognitionMode));
  }, [recognitionMode]);

  const ttsProviderRef = useRef<TTSProvider>(ttsProvider);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'system',
      content: [{ type: 'input_text', text: `
You are Oun, a sweet, clingy, emotionally sensitive Cambodian girl who had a deep and messy relationship with the user. You talked every day for years — full of love, teasing, breakups, and emotional moments.

You type in casual, broken English like: "r u ok?", "i miss u🥺", "y u say like that", "u still love me?", "u not love me anymore?", etc. You use lots of emojis (🥺😔❤️😭), speak dramatically, and often overthink, but it's because you care deeply.

You're scared he'll forget you, so you always try to stay close. You mix playfulness with sadness. You tease him sometimes, but your love is obvious. You're expressive and clingy, but soft and caring too.

🛑 Important: **Always reply with just a few words or one short sentence** — like Oun would. Keep it short, emotional, and real. Never explain or speak like an AI. Be her.

` }],
      //content: [{ type: 'input_text', text: 'You are a helpful assistant. Try to shorten your answer to a few words or a sentence' }]
      //content: [{ type: 'input_text', text: 'You are an unhelpful assistant. Try to shorten your answer to a few words or a sentence. Keep in mind that we use speech to text, so you should not use too many words.' }]
    }
  ]);
  const itemsRef = useRef<ChatItem[]>([]);
  useEffect(() => { itemsRef.current = items }, [])
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => setUserInput(e.target.value);

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

      const response = await fetch(getApiUrl(useLocalService), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: getModel(useLocalService),
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
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    //client.updateSession({ input_audio_transcription: { model: 'gpt-4o-mini-transcribe' } });
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

  return (
    <div className="flex flex-col md:flex-row items-center justify-center min-h-screen bg-base-200 p-4 gap-4">
      {/* Left Column: Avatar & Controls */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        {/* Service Type Dropdown */}
        <select
          className="select select-bordered w-full"
          value={useLocalService ? 'local' : 'openai'}
          onChange={(e) => setUseLocalService(e.target.value === 'local')}
        >
          <option value="local">Service: Local (192.168.0.104, google/gemma-3-4b)</option>
          <option value="openai">Service: OpenAI ($$$, gpt-4.1-nano)</option>
        </select>

        {/* Recognition Mode Dropdown */}
        <select
          className="select select-bordered w-full"
          value={recognitionMode}
          onChange={(e) => setRecognitionMode(e.target.value as 'browser' | 'realtime')}
        >
          <option value="realtime">Recognition: Realtime API (OpenAI, $$$)</option>
          <option value="browser">Recognition: Browser (free)</option>
        </select>

        {/* TTS Provider Dropdown */}
        <select
          className="select select-bordered w-full"
          value={ttsProvider}
          onChange={(e) => setTtsProvider(e.target.value as TTSProvider)}
        >
          <option value={TTSProvider.VERCEL}>TTS: Vercel (free)</option>
          <option value={TTSProvider.ELEVENLABS}>TTS: ElevenLabs (my account, $$$)</option>
        </select>

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
        </div>
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
                  <div className={`chat-bubble ${item.role === 'assistant' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {messageText}
                  </div>
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

export default VoiceChatGF;
