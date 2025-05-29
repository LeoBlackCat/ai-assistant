import { useState } from 'react'
import VoiceChat from "./VoiceChat";
import Audio from "./pages/Audio";

const App: React.FC = () => {
  const [count, setCount] = useState<number>(0)

  return (
    <>
      <div className="bg-base-200 min-h-screen">
        {/* <Audio /> */}
        <VoiceChat /> 
        {/* <VoiceAssistant/> */}
      </div>
    </>
  )
}

export default App
