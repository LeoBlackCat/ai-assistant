import React, { useState } from "react";

export default function VoiceChat() {
  const [voiceActive, setVoiceActive] = useState(false);
  const [textChatVisible, setTextChatVisible] = useState(true);
  const [userInput, setUserInput] = useState("");

  const toggleVoice = () => setVoiceActive(!voiceActive);
  const toggleTextChat = () => setTextChatVisible(!textChatVisible);

  const handleInputChange = (e) => setUserInput(e.target.value);

  const handleSendMessage = () => {
    console.log("User message:", userInput);
    setUserInput("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      {/* Avatar & Animation */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 w-full max-w-sm">
        <img
          src="/assets/rigged-avatar.png" // Replace with your actual avatar source
          alt="Virtual Assistant"
          className="w-full h-auto object-contain rounded"
        />
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
}
