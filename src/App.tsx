import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LottieChat from './LottieChat';
import VoiceChat from './VoiceChat';

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">AI Assistant</h1>
        <p className="text-lg text-base-content/70">Choose your preferred interaction style</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md md:max-w-2xl">
        <Link to="/voice-chat" className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow w-full max-w-[280px] mx-auto">
          <div className="card-body items-center text-center p-4">
            <h2 className="card-title text-2xl mb-2">Voice Chat</h2>
            <p className="text-base-content/70">Interact with Live2D character using voice</p>
          </div>
        </Link>

        <Link to="/lottie-chat" className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow w-full max-w-[280px] mx-auto">
          <div className="card-body items-center text-center p-4">
            <h2 className="card-title text-2xl mb-2">Lottie Chat</h2>
            <p className="text-base-content/70">Chat with animated character using text</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router basename="/ai-assistant/">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/voice-chat" element={<VoiceChat />} />
        <Route path="/lottie-chat" element={<LottieChat />} />
      </Routes>
    </Router>
  );
};

export default App;
