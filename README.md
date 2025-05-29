# AI Assistant

An interactive AI assistant application that offers two different interaction modes: Voice Chat with Live2D character and Lottie Chat with animated character.

## Features

### Voice Chat
- Real-time voice interaction with a Live2D character
- Natural language processing for voice commands
- Responsive Live2D character animations
- Voice synthesis for character responses

### Lottie Chat
- Text-based interaction with an animated character
- Lottie animations for character expressions
- Text-to-speech capabilities
- Real-time chat interface

## Tech Stack

- React
- TypeScript
- DaisyUI (Tailwind CSS)
- React Router
- Lottie React
- Live2D

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/LeoBlackCat/ai-assistant.git
cd ai-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

1. On the landing page, choose your preferred interaction mode:
   - Voice Chat: For voice-based interaction with Live2D character
   - Lottie Chat: For text-based interaction with animated character

2. Voice Chat Mode:
   - Click "Start Voice" to begin voice interaction
   - Speak naturally to interact with the AI
   - The Live2D character will respond with animations and voice

3. Lottie Chat Mode:
   - Type your messages in the chat input
   - The character will respond with animations and text-to-speech
   - Toggle between text and voice responses as needed

## Project Structure

```
src/
├── App.tsx              # Main application component
├── VoiceChat.tsx        # Voice chat implementation
├── LottieChat.tsx       # Lottie chat implementation
├── animations/          # Lottie animation files
└── pages/              # Additional page components
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Live2D for character animations
- DaisyUI for the beautiful UI components
- Lottie for the animation framework
