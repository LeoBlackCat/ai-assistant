import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LottieChat from './LottieChat';
import VoiceChatGF from './VoiceChatGF';
import VoiceChatMalay from './VoiceChatMalay';

const maskApiKey = (key: string): string => {
  if (!key) return '';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

const LandingPage: React.FC = () => {
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [elevenlabsKey, setElevenlabsKey] = useState<string>('');

  useEffect(() => {
    const storedOpenaiKey = localStorage.getItem('tmp::openai_api_key') || '';
    const storedElevenlabsKey = localStorage.getItem('tmp::elevenlabs_api_key') || '';
    setOpenaiKey(storedOpenaiKey);
    setElevenlabsKey(storedElevenlabsKey);
  }, []);

  const handleOpenaiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setOpenaiKey(newKey);
    localStorage.setItem('tmp::openai_api_key', newKey);
  };

  const handleElevenlabsKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setElevenlabsKey(newKey);
    localStorage.setItem('tmp::elevenlabs_api_key', newKey);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">AI Assistant</h1>
        <p className="text-lg text-base-content/70">Choose your preferred interaction style</p>
      </div>

      <div className="w-full max-w-sm mb-8 space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">OpenAI API Key</span>
            {openaiKey && <span className="label-text-alt text-base-content/70">{maskApiKey(openaiKey)}</span>}
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={handleOpenaiKeyChange}
            placeholder="Enter your OpenAI API key"
            className="input input-bordered w-full"
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">ElevenLabs API Key</span>
            {elevenlabsKey && <span className="label-text-alt text-base-content/70">{maskApiKey(elevenlabsKey)}</span>}
          </label>
          <input
            type="password"
            value={elevenlabsKey}
            onChange={handleElevenlabsKeyChange}
            placeholder="Enter your ElevenLabs API key"
            className="input input-bordered w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md md:max-w-2xl">
        <Link to="/voice-chat-gf" className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow w-full max-w-[280px] mx-auto">
          <div className="card-body items-center text-center p-4">
            <h2 className="card-title text-2xl mb-2">Voice Chat</h2>
            <p className="text-base-content/70">Virtual GF</p>
          </div>
        </Link>

        <Link to="/voice-chat-malay" className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow w-full max-w-[280px] mx-auto">
          <div className="card-body items-center text-center p-4">
            <h2 className="card-title text-2xl mb-2">Voice Chat</h2>
            <p className="text-base-content/70">Bahasa Melayu</p>
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
        <Route path="/voice-chat-gf" element={<VoiceChatGF />} />
        <Route path="/voice-chat-malay" element={<VoiceChatMalay />} />
        <Route path="/lottie-chat" element={<LottieChat />} />
      </Routes>
    </Router>
  );
};

export default App;
