import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { modelMap } from "./models";
import { tts } from "./tts";
import { MotionSync } from "live2d-motionsync";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).PIXI = PIXI;

async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer) {
  // Creating an AudioContext Instance
  const audioContext = new AudioContext();

  // Decoding an ArrayBuffer using decodeAudioData
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return audioBuffer;
}

const VoiceChat: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [textChatVisible, setTextChatVisible] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>("");
  const motionSync = useRef<MotionSync>();
  const toggleVoice = (): void => setVoiceActive(!voiceActive);
  const toggleTextChat = (): void => setTextChatVisible(!textChatVisible);

  const modelName = "kei_vowels_pro";

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => setUserInput(e.target.value);

  const handleSendMessage = async () => {
    // console.log("User message:", userInput);
    // setUserInput("");
    if (!motionSync.current) return;
    const buffer = await tts(userInput);
    const audioBuffer = await arrayBufferToAudioBuffer(buffer);
    motionSync.current.play(audioBuffer);
  };

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

  // return (
  //   <div className="size-full flex">
  //     <div className="w-[600px] relative">
  //       <canvas ref={canvasRef} />
  //       </div>
  //       </div>
  // );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      {/* Avatar & Animation */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 w-full max-w-sm">
        <canvas ref={canvasRef} />
      </div>

      {/* Voice & Text Chat Controls */}
      <div className="flex gap-4 mb-4">
        <button
          className={`btn ${voiceActive ? "btn-error" : "btn-primary"}`}
          onClick={toggleVoice}
        >
          {voiceActive ? "Stop Voice" : "Start Voice"}
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
