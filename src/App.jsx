import { useState } from 'react'
import VoiceChat from "./VoiceChat";
import VoiceAssistant from "./VoiceAssistant";
import Audio from "./pages/Audio";
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="bg-base-200 min-h-screen">
        <Audio />
        {/* <VoiceChat />  */}
        {/* <VoiceAssistant/> */}
      </div>
    </>
  )
}

export default App
