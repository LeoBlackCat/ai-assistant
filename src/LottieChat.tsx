import React, { useState, useRef, ChangeEvent } from "react";
import Lottie from "lottie-react";
import { tts } from "./tts";
import animationData from "./animations/avatar.json";

async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer) {
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

const LottieChat: React.FC = () => {
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [textChatVisible, setTextChatVisible] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const lottieRef = useRef<any>(null);

  const toggleVoice = (): void => setVoiceActive(!voiceActive);
  const toggleTextChat = (): void => setTextChatVisible(!textChatVisible);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => setUserInput(e.target.value);

  const handleSendMessage = async () => {
    if (!lottieRef.current) return;
    const buffer = await tts(userInput);
    const audioBuffer = await arrayBufferToAudioBuffer(buffer);
    
    // Play the animation
    setIsPlaying(true);
    lottieRef.current.play();
    
    // Create audio source and play
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    
    // Stop animation when audio ends
    source.onended = () => {
      setIsPlaying(false);
      lottieRef.current.stop();
    };
    
    setUserInput("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      {/* Avatar & Animation */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 w-full max-w-sm">
        <div className="w-[300px] h-[300px]">
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={false}
            autoplay={false}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
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

export default LottieChat; 