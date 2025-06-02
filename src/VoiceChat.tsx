import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { modelMap } from "./models";
import { tts } from "./tts";
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

const VoiceChat: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [textChatVisible, setTextChatVisible] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>("");
  const [transcriptionDelta, setTranscriptionDelta] = useState<string>("");
  const [needToClear, setNeedToClear] = useState<boolean>(false);
  const motionSync = useRef<MotionSync>();
  const toggleVoice = (): void => setVoiceActive(!voiceActive);
  const toggleTextChat = (): void => setTextChatVisible(!textChatVisible);

  const modelName = "kei_vowels_pro";

  const [isConnected, setIsConnected] = useState(false);
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => setUserInput(e.target.value);

  const handleSendMessage = async () => {
    // console.log("User message:", userInput);
    // setUserInput("");
    if (!motionSync.current) return;
    const buffer = await tts(userInput);
    const audioBuffer = await arrayBufferToAudioBuffer(buffer);
    motionSync.current.play(audioBuffer);
  };

  const openAIKey = localStorage.getItem('tmp::openai_api_key') ||
    prompt('Please enter your OpenAI API Key') ||
    '';
  if (openAIKey !== '') {
    localStorage.setItem('tmp::openai_api_key', openAIKey);
  }

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
        apiKey: openAIKey,
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
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);

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

    // Set instructions
    //client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    //client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    // Set turn detection to server VAD by default
    //client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    client.updateSession({ input_audio_transcription: { model: 'gpt-4o-mini-transcribe' } });
    client.updateSession({ turn_detection: { type: 'server_vad' } });

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      if (realtimeEvent.event?.type === 'conversation.item.input_audio_transcription.delta') {
        const delta = realtimeEvent.event?.delta ?? '';
        console.log('delta', delta);
        setTranscriptionDelta(prev => {
          // If we need to clear, start fresh with the new delta
          if (needToClear) {
            console.log('clearing transcription');
            setNeedToClear(false);
            return delta;
          }
          // Otherwise append to existing text
          return prev + delta;
        });
      } else if (realtimeEvent.event?.type === 'conversation.item.input_audio_transcription.completed') {
        console.log('completed', realtimeEvent.event?.transcript ?? '');
        setNeedToClear(true);
        console.log('setting need to clear to true');
      }
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      //console.log('conversation.interrupted');
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      //console.log('conversation.updated', item, delta);
    });

    setItems(client.conversation.getItems());

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
          {isConnected ? 'disconnect' : 'connect'}
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
            <div className="chat chat-start">
              <div className="chat-bubble bg-blue-100 text-blue-800">Hi! How can I help you today?</div>
            </div>
            <div className="chat chat-end">
              <div className="chat-bubble bg-green-100 text-green-800">Tell me about the Spanish Civil War.</div>
            </div>
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
              onClick={handleSendMessage}
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
