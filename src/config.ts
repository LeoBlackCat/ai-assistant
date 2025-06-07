// API Configuration
export const _LOCAL_API_URL = 'http://192.168.0.104:1234/v1/chat/completions';
export const _OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
export const USE_LOCAL_API = false;  // Toggle between local and OpenAI API
export const API_URL = USE_LOCAL_API ? _LOCAL_API_URL : _OPENAI_API_URL;

// Model Configuration
// Available models: "gpt-4.1-nano", "google/gemma-3-1b", 'deepseek-r1-0528-qwen3-8b-mlx'
export const OPENAI_MODEL = USE_LOCAL_API ? 'google/gemma-3-4b' : 'gpt-4.1-nano'; 