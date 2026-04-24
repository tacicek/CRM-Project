// LLM Model Definitions for AI Content Generation

export type LLMProvider = "openai" | "anthropic" | "google";

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  modelId: string;
  description: string;
  maxTokens: number;
  costPerMToken: number;
  isLatest: boolean;
  isRecommended: boolean;
  speed: "fast" | "medium" | "slow";
  quality: "good" | "great" | "excellent";
}

// Available LLM Models
export const LLM_MODELS: LLMModel[] = [
  // ===== OpenAI Models =====
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    modelId: "gpt-5.2",
    description: "OpenAI's latest and most powerful model.",
    maxTokens: 4096,
    costPerMToken: 15.0,
    isLatest: true,
    isRecommended: true,
    speed: "medium",
    quality: "excellent",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    description: "OpenAI's flagship multimodal model.",
    maxTokens: 4096,
    costPerMToken: 5.0,
    isLatest: true,
    isRecommended: true,
    speed: "medium",
    quality: "excellent",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    description: "Fast and affordable. Good for quick drafts.",
    maxTokens: 4096,
    costPerMToken: 0.15,
    isLatest: true,
    isRecommended: false,
    speed: "fast",
    quality: "good",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    modelId: "gpt-4-turbo",
    description: "Powerful and reliable. Great for complex content.",
    maxTokens: 4096,
    costPerMToken: 10.0,
    isLatest: false,
    isRecommended: false,
    speed: "medium",
    quality: "excellent",
  },
  
  // ===== Anthropic Models =====
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    modelId: "claude-opus-4-6-20260213",
    description: "Anthropic's most intelligent model. Best for premium content.",
    maxTokens: 8192,
    costPerMToken: 25.0,
    isLatest: true,
    isRecommended: false,
    speed: "slow",
    quality: "excellent",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    description: "Best balance of speed and intelligence. Great for content writing.",
    maxTokens: 8192,
    costPerMToken: 15.0,
    isLatest: true,
    isRecommended: true,
    speed: "medium",
    quality: "excellent",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    description: "Fast and cost-effective. Good for quick generations.",
    maxTokens: 8192,
    costPerMToken: 5.0,
    isLatest: true,
    isRecommended: false,
    speed: "fast",
    quality: "great",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    description: "Previous generation. Still excellent for writing.",
    maxTokens: 4096,
    costPerMToken: 3.0,
    isLatest: false,
    isRecommended: false,
    speed: "medium",
    quality: "excellent",
  },
  
  // ===== Google Models =====
  {
    id: "gemini-3-pro",
    name: "Gemini 3.0 Pro",
    provider: "google",
    modelId: "gemini-3.0-pro",
    description: "Google's latest and most powerful model.",
    maxTokens: 4096,
    costPerMToken: 1.25,
    isLatest: true,
    isRecommended: true,
    speed: "medium",
    quality: "excellent",
  },
  {
    id: "gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    modelId: "gemini-2.0-flash-exp",
    description: "Fast experimental model.",
    maxTokens: 4096,
    costPerMToken: 0.1,
    isLatest: true,
    isRecommended: false,
    speed: "fast",
    quality: "great",
  },
  {
    id: "gemini-1-5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    modelId: "gemini-1.5-pro",
    description: "Advanced model with long context.",
    maxTokens: 4096,
    costPerMToken: 1.25,
    isLatest: false,
    isRecommended: false,
    speed: "medium",
    quality: "great",
  },
  {
    id: "gemini-1-5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    modelId: "gemini-1.5-flash",
    description: "Fast and cost-effective.",
    maxTokens: 4096,
    costPerMToken: 0.075,
    isLatest: false,
    isRecommended: false,
    speed: "fast",
    quality: "good",
  },
];

// Get default model (GPT-5.2 - latest)
export const getDefaultModel = (): LLMModel => {
  return LLM_MODELS.find(m => m.id === "gpt-5.2") || LLM_MODELS[0];
};

// Get model by ID
export const getModelById = (id: string): LLMModel | undefined => {
  return LLM_MODELS.find(m => m.id === id);
};

// Get models by provider
export const getModelsByProvider = (provider: LLMProvider): LLMModel[] => {
  return LLM_MODELS.filter(m => m.provider === provider);
};

// Get latest models
export const getLatestModels = (): LLMModel[] => {
  return LLM_MODELS.filter(m => m.isLatest);
};

// Get recommended models
export const getRecommendedModels = (): LLMModel[] => {
  return LLM_MODELS.filter(m => m.isRecommended);
};

// Provider display names
export const PROVIDER_NAMES: Record<LLMProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

// Provider icons/colors
export const PROVIDER_COLORS: Record<LLMProvider, string> = {
  openai: "bg-green-500",
  anthropic: "bg-orange-500",
  google: "bg-blue-500",
};
