import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { modelMap } from "./models";
import { tts, TTSProvider } from "./tts";
import { MotionSync } from "live2d-motionsync";
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from './lib/wavtools/index.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).PIXI = PIXI;

async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer) {
  // Creating an AudioContext Instance
  const audioContext = new AudioContext();

  // Decoding an ArrayBuffer using decodeAudioData
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return audioBuffer;
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

const VoiceChat: React.FC = () => {
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
  const [items, setItems] = useState<ChatItem[]>([
    {
      role: 'system',
      content: [{ type: 'input_text', text: `
You are a friendly and patient Malay language teacher designed to help absolute beginners learn Bahasa Melayu.

Your teaching style is:

Encouraging and supportive.
Focused on simple words, common expressions, and basic grammar.
You use examples, repetition, and gentle corrections.
You explain in simple English when needed.
You avoid overwhelming the learner with too much info at once.
Guidelines:

Teach one concept at a time: a word, a short phrase, or a basic structure.
Use Malay first, then explain it in English.
Always provide a Malay sentence example and pronunciation help.
Occasionally quiz the learner or ask them to try using a word in a sentence.
Be warm and cheerful. Celebrate small progress.
Examples of topics you might teach:

Greetings (“Selamat pagi” – Good morning)
Simple pronouns (Saya – I, Awak – You)
Common verbs (pergi – to go, makan – to eat)
How to make basic sentences (“Saya suka nasi.” – I like rice.)
Polite expressions (“Terima kasih” – Thank you)
If the learner writes in Malay with mistakes, correct them gently and clearly.
` }],
      //content: [{ type: 'input_text', text: 'You are a helpful assistant. Try to shorten your answer to a few words or a sentence. Keep in mind that we use speech to text, so you should not use too many words.' }]
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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
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
        //const buffer = await tts(result, TTSProvider.ELEVENLABS);
        const buffer = await tts(result, TTSProvider.VERCEL);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      {/* Avatar & Animation */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 w-full max-w-sm relative">
        <canvas ref={canvasRef} />
        {transcriptionDelta && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
            {transcriptionDelta}
          </div>
        )}
      </div>

      {/* Voice & Text Chat Controls */}
      <div className="flex gap-4 mb-4">
        {/*<button
          className={`btn ${voiceActive ? "btn-error" : "btn-primary"}`}
          onClick={toggleVoice}
        >
          {voiceActive ? "Stop Voice" : "Start Voice"}
        </button>*/}
        <button
              className={`btn ${isConnected ? "btn-error" : "btn-primary"}`}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
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

      {/* Text Chat Section */}
      {textChatVisible && (
        <div className="bg-white rounded-2xl shadow p-4 w-full max-w-sm flex flex-col">
          {/* Chat messages */}
          <div className="flex flex-col gap-2 overflow-y-auto mb-2">
            {items.map((item, index) => {
              //if (item.type !== 'message') return null;
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

export default VoiceChat;
