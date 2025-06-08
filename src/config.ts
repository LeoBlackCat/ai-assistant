// API Configuration
export const _LOCAL_API_URL = 'http://192.168.0.104:1234/v1/chat/completions';
export const _OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Model Configuration
// Available models: "gpt-4.1-nano", "google/gemma-3-1b", 'deepseek-r1-0528-qwen3-8b-mlx'
export const getApiUrl = (useLocal: boolean) => useLocal ? _LOCAL_API_URL : _OPENAI_API_URL;
export const getModel = (useLocal: boolean) => useLocal ? 'google/gemma-3-4b' : 'gpt-4.1-nano'; 