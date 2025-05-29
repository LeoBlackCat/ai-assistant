import React from 'react';

export default function VoiceAssistant() {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white">
      {/* Virtual Assistant Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-cyan-500">
          <img
            src="https://via.placeholder.com/150"
            alt="Virtual Assistant"
            className="w-full h-full object-cover"
          />
        </div>
        <h2 className="mt-4 text-lg md:text-xl font-bold">Voice Assistant</h2>
        <div className="mt-4">
          <button className="btn btn-primary">Listening...</button>
        </div>
      </div>

      {/* PDF Viewer + Chat */}
      <div className="flex-1 flex flex-col p-4 md:p-8 space-y-4">
        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden p-4">
          <h3 className="text-cyan-400 font-semibold">Document.pdf</h3>
          <p className="mt-2 text-sm leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam
            placerat iaculis sem, at posuere urna iaculis sed. Integer ut diam
            vel ex commodo commodo.
          </p>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col bg-gray-800 rounded-lg overflow-hidden p-4">
          <div className="flex-1 overflow-y-auto space-y-2">
            <div className="bg-gray-700 p-2 rounded">Hello! How can I assist you today?</div>
            <div className="bg-cyan-600 p-2 rounded self-end">Hi! Can you help me with a question?</div>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="input input-bordered flex-1 text-black"
            />
            <button className="btn btn-accent">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
