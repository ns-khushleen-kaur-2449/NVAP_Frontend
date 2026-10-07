import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { 
  User, MessageSquare, Sparkles, Volume2, Book, Phone, 
  Settings, Play, Send, Check, Loader2, Upload, X, 
  Mic, Globe, Target, Trash2, ShieldCheck, Zap, Pause, 
  ListRestart, Plus, FileEdit, Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const TONES = ['Consultative', 'Friendly', 'Formal', 'Empathetic', 'Assertive', 'Urgent', 'Casual'];

const VOICES = [
  // ElevenLabs
  { 
    id: 'sarah', 
    name: 'Sarah', 
    provider: '11labs', 
    meta: 'Mature, Reassuring, Confident', 
    avatar: '👩‍💼',
    previewUrl: ''
  },
  { 
    id: 'matilda', 
    name: 'Matilda', 
    provider: '11labs', 
    meta: 'Knowledgeable, Professional', 
    avatar: '👩‍🏫',
    previewUrl: ''
  },
  { 
    id: 'river', 
    name: 'River', 
    provider: '11labs', 
    meta: 'Relaxed, Neutral, Interviewer', 
    avatar: '👤',
    previewUrl: ''
  },
  { 
    id: 'roger', 
    name: 'Roger', 
    provider: '11labs', 
    meta: 'Laid-back, Casual, Conversational', 
    avatar: '👨‍💼',
    previewUrl: ''
  },
  { 
    id: 'will', 
    name: 'Will', 
    provider: '11labs', 
    meta: 'Relaxed Optimist', 
    avatar: '👨‍🎨',
    previewUrl: ''
  },
  { 
    id: 'george', 
    name: 'George', 
    provider: '11labs', 
    meta: 'Warm, Captivating Storyteller', 
    avatar: '👨‍🏫',
    previewUrl: ''
  },
  { 
    id: 'harry', 
    name: 'Harry', 
    provider: '11labs', 
    meta: 'Fierce Warrior', 
    avatar: '💂‍♂️',
    previewUrl: ''
  },
  { 
    id: 'jessica', 
    name: 'Jessica', 
    provider: '11labs', 
    meta: 'Playful, Bright, Conversational', 
    avatar: '👩‍🎤',
    previewUrl: ''
  },
  { 
    id: 'laura', 
    name: 'Laura', 
    provider: '11labs', 
    meta: 'Enthusiast, Quirky Attitude', 
    avatar: '👩‍🎨',
    previewUrl: ''
  },
  { 
    id: 'liam', 
    name: 'Liam', 
    provider: '11labs', 
    meta: 'Energetic, Social Media Expert', 
    avatar: '👨‍🎤',
    previewUrl: ''
  },
  { 
    id: 'lily', 
    name: 'Lily', 
    provider: '11labs', 
    meta: 'Velvety Actress', 
    avatar: '🎭',
    previewUrl: ''
  },

  // Vapi built-in voices. `id` must match VAPI's voiceId exactly (capitalised)
  // so imported assistants resolve to the right entry in the list view.
  { 
    id: 'Savannah', 
    name: 'Savannah', 
    provider: 'vapi', 
    meta: 'Warm, Professional, Consultative', 
    avatar: '👩‍💼',
    previewUrl: ''
  },
  { 
    id: 'Elliot', 
    name: 'Elliot', 
    provider: 'vapi', 
    meta: 'Clear, Neutral, Business', 
    avatar: '👨‍💼',
    previewUrl: ''
  },
  { 
    id: 'Rohan', 
    name: 'Rohan', 
    provider: 'vapi', 
    meta: 'Indian English, Friendly', 
    avatar: '👨',
    previewUrl: ''
  },
  { 
    id: 'Neha', 
    name: 'Neha', 
    provider: 'vapi', 
    meta: 'Indian English, Bright', 
    avatar: '👩',
    previewUrl: ''
  },
  { 
    id: 'Hana', 
    name: 'Hana', 
    provider: 'vapi', 
    meta: 'Soft, Calm, Patient', 
    avatar: '👩‍🦰',
    previewUrl: ''
  },
  { 
    id: 'Cole', 
    name: 'Cole', 
    provider: 'vapi', 
    meta: 'Confident, Direct', 
    avatar: '🧔',
    previewUrl: ''
  },
  { 
    id: 'Paige', 
    name: 'Paige', 
    provider: 'vapi', 
    meta: 'Upbeat, Energetic', 
    avatar: '👩‍🎤',
    previewUrl: ''
  },
  { 
    id: 'Spencer', 
    name: 'Spencer', 
    provider: 'vapi', 
    meta: 'Relaxed, Conversational', 
    avatar: '👨‍🦱',
    previewUrl: ''
  }
];

const REAL_ESTATE_TOOLS = [
  {
    id: 'book_site_visit',
    name: 'Book Site Visit',
    description: 'Enables the AI to schedule physical property tours and units inspections for the lead.',
    icon: Sparkles,
    vapiTool: {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Let me look up the calendar to book a site visit for you...' },
        { type: 'request-complete', content: 'Awesome, I have scheduled your site visit!' }
      ],
      function: {
        name: 'bookSiteVisit',
        description: 'Schedule a physical site visit to inspect properties.',
        parameters: {
          type: 'object',
          properties: {
            propertyName: { type: 'string', description: 'The property project name.' },
            visitDate: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
            visitTime: { type: 'string', description: 'Time of visit (e.g., 2:00 PM).' }
          },
          required: ['propertyName', 'visitDate']
        }
      }
    }
  },
  {
    id: 'qualify_lead',
    name: 'Qualify Lead',
    description: 'Enables the AI to qualify budget, timeline, and purchase readiness dynamically.',
    icon: Target,
    vapiTool: {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Saving your preferences to our system...' },
        { type: 'request-complete', content: 'Preferences saved.' }
      ],
      function: {
        name: 'qualifyLead',
        description: 'Qualify a lead by saving budget, requirement type, and timelines.',
        parameters: {
          type: 'object',
          properties: {
            budgetMin: { type: 'number', description: 'Minimum budget range.' },
            budgetMax: { type: 'number', description: 'Maximum budget range.' },
            propertyType: { type: 'string', description: 'Apartment, villa, or commercial unit.' },
            timeline: { type: 'string', description: 'Immediate, 3 months, or 6 months.' }
          },
          required: ['propertyType', 'timeline']
        }
      }
    }
  },
  {
    id: 'send_brochure',
    name: 'Send Brochure',
    description: 'Enables the AI to instantly dispatch property catalogs via WhatsApp/Email.',
    icon: Send,
    vapiTool: {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Sending the property brochure to your phone right now...' },
        { type: 'request-complete', content: 'Brochure sent successfully.' }
      ],
      function: {
        name: 'sendBrochure',
        description: 'Send brochure of the property to customer via WhatsApp or Email.',
        parameters: {
          type: 'object',
          properties: {
            propertyName: { type: 'string', description: 'The property project name.' },
            deliveryChannel: { type: 'string', description: 'whatsapp or email' }
          },
          required: ['propertyName', 'deliveryChannel']
        }
      }
    }
  },
  {
    id: 'check_availability',
    name: 'Check Unit Availability',
    description: 'Allows the agent to query real-time block inventory and units available in a tower.',
    icon: ShieldCheck,
    vapiTool: {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Checking units availability in the inventory system...' },
        { type: 'request-complete', content: 'I have found the units availability.' }
      ],
      function: {
        name: 'checkAvailability',
        description: 'Query block unit inventory for a specific property tower.',
        parameters: {
          type: 'object',
          properties: {
            propertyName: { type: 'string', description: 'The property project name.' },
            towerNumber: { type: 'string', description: 'The tower name or number.' }
          },
          required: ['propertyName']
        }
      }
    }
  },
  {
    id: 'transfer_call',
    name: 'Transfer Call',
    description: 'Enables the AI to transfer the call to a support executive or partner agent.',
    icon: Phone,
    vapiTool: {
      type: 'transferCall',
      destinations: [
        {
          type: 'number',
          number: '+919999999999',
          message: 'Connecting to support executive.'
        }
      ]
    }
  }
];

// Industry Standard Pricing and Configuration per Minute
const PROVIDER_CONFIG = {
  vapi: 0.1500, // Platform base fee
  stt: {
    '11labs': {
      name: 'ElevenLabs (Experimental)',
      models: [
        { id: 'eleven_multilingual_v2', name: 'Multilingual v2', price: 0.0100, latency: 150 }
      ],
      languages: [
        { id: 'en', name: 'English' },
        { id: 'hi', name: 'Hindi' }
      ]
    },
    deepgram: {
      name: 'Deepgram',
      models: [
        { id: 'nova-3', name: 'nova-3 (Priya Default)', price: 0.0040, latency: 80 },
        { id: 'flux', name: 'Flux General Multilingual (Recommended)', price: 0.0100, latency: 120 },
        { id: 'nova-2', name: 'nova-2 (Premium)', price: 0.0043, latency: 100 },
        { id: 'nova-2-ea', name: 'nova-2-ea (Early Access)', price: 0.0050, latency: 110 },
        { id: 'enhanced', name: 'enhanced (High Accuracy)', price: 0.0090, latency: 180 },
        { id: 'base', name: 'base (Standard)', price: 0.0075, latency: 150 }
      ],
      languages: [
        { id: 'multi', name: 'Multilingual (English/Hindi/Hinglish)' },
        { id: 'en', name: 'English (General)' },
        { id: 'hi', name: 'Hindi' },
        { id: 'en-US', name: 'English (US)' },
        { id: 'en-IN', name: 'English (India)' },
        { id: 'hi-IN', name: 'Hindi (India)' },
        { id: 'es', name: 'Spanish' },
        { id: 'fr', name: 'French' }
      ]
    },
    'assembly-ai': {
      name: 'Assembly AI',
      models: [
        { id: 'best', name: 'Best (Highest Accuracy)', price: 0.0150, latency: 250 },
        { id: 'nano', name: 'Nano (Lightweight & Fast)', price: 0.0075, latency: 200 }
      ],
      languages: [
        { id: 'en', name: 'English (General)' },
        { id: 'en_us', name: 'English (US)' },
        { id: 'en_in', name: 'English (India)' },
        { id: 'es', name: 'Spanish' },
        { id: 'fr', name: 'French' }
      ]
    },
    soniox: {
      name: 'Soniox (Realtime)',
      models: [
        { id: 'stt-rt-v5', name: 'stt-rt-v5 (Realtime v5)', price: 0.0062, latency: 90 },
        { id: 'stt-rt-preview', name: 'stt-rt-preview', price: 0.0062, latency: 95 }
      ],
      languages: [
        { id: 'en', name: 'English' },
        { id: 'hi', name: 'Hindi' },
        { id: 'es', name: 'Spanish' },
        { id: 'fr', name: 'French' },
        { id: 'ar', name: 'Arabic' }
      ]
    },
    google: {
      name: 'Google Cloud STT',
      models: [
        { id: 'chirp', name: 'Chirp (Next-Gen AI)', price: 0.0160, latency: 220 },
        { id: 'telephony', name: 'Telephony (Voice Call Optimized)', price: 0.0240, latency: 280 },
        { id: 'medical', name: 'Medical Transcription', price: 0.0780, latency: 450 }
      ],
      languages: [
        { id: 'en-US', name: 'English (US)' },
        { id: 'en-IN', name: 'English (India)' },
        { id: 'hi-IN', name: 'Hindi (India)' },
        { id: 'es-ES', name: 'Spanish (Spain)' },
        { id: 'fr-FR', name: 'French (France)' }
      ]
    }
  },
  llm: {
    openai: {
      name: 'OpenAI',
      models: [
        { id: 'gpt-4.1', name: 'gpt-4.1 (Long Context, SDR Default)', price: 0.0100, latency: 600 },
        { id: 'gpt-4.1-mini', name: 'gpt-4.1-mini (Fast & Cheap)', price: 0.0016, latency: 320 },
        { id: 'gpt-4.1-nano', name: 'gpt-4.1-nano (Ultra Low Latency)', price: 0.0004, latency: 200 },
        { id: 'gpt-4o', name: 'gpt-4o (Smartest & Expressive)', price: 0.0150, latency: 650 },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Blazing Fast)', price: 0.0020, latency: 350 },
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo (Legacy)', price: 0.0015, latency: 300 }
      ]
    },
    anthropic: {
      name: 'Anthropic',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'claude-sonnet-4-20250514 (Priya Default)', price: 0.0150, latency: 500 },
        { id: 'claude-3-5-sonnet', name: 'claude-3-5-sonnet (High Reasoning)', price: 0.0350, latency: 800 },
        { id: 'claude-3-haiku', name: 'claude-3-haiku (Fast Conversational)', price: 0.0030, latency: 400 }
      ]
    },
    groq: {
      name: 'Groq',
      models: [
        { id: 'llama-3.1-70b-versatile', name: 'llama-3.1-70b-versatile', price: 0.0015, latency: 150 },
        { id: 'llama-3.1-8b-instant', name: 'llama-3.1-8b-instant (Sub-50ms)', price: 0.0005, latency: 80 },
        { id: 'mixtral-8x7b-instruct', name: 'mixtral-8x7b-instruct', price: 0.0008, latency: 120 }
      ]
    },
    together: {
      name: 'Together AI',
      models: [
        { id: 'llama-3-1-8b', name: 'llama-3.1-8b-instruct', price: 0.0006, latency: 180 },
        { id: 'llama-3-1-70b', name: 'llama-3.1-70b-instruct', price: 0.0018, latency: 280 }
      ]
    },
    google: {
      name: 'Google Gemini',
      models: [
        { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro (Advanced)', price: 0.0100, latency: 600 },
        { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash (Fast Voice Engine)', price: 0.0003, latency: 250 }
      ]
    }
  },
  tts: {
    '11labs': { name: 'ElevenLabs (Premium)', price: 0.1800, latency: 1200 },
    vapi: { name: 'Vapi (Built-in)', price: 0.0500, latency: 250 }
  }
};

export default function CreateAgent() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Save Draft');
  const [playingVoice, setPlayingVoice] = useState(null);
  const [audio] = useState(new Audio());
  
  // List view vs Create view
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [existingAssistants, setExistingAssistants] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);

  // Form State
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTones, setSelectedTones] = useState(['Consultative']);
  const [language, setLanguage] = useState('English (India)');
  const [callIntent, setCallIntent] = useState('Lead Qualification');
  const [selectedVoice, setSelectedVoice] = useState('sarah'); // Default to Sarah
  const [files, setFiles] = useState([]); // Array of selected Vapi File IDs
  const [availableKnowledgeFiles, setAvailableKnowledgeFiles] = useState([]);
  const [isLoadingKnowledgeFiles, setIsLoadingKnowledgeFiles] = useState(false);
  
  // Dynamic settings
  // COUPLED TO THE BACKEND — change both sides together.
  //
  // The provider is no longer user-selectable; this constant is the only thing
  // deciding what every new assistant is published with. It must agree with:
  //
  //   SDR-Backend/app/voice/models_assistant.py  model_provider column default
  //   SDR-Backend/app/voice/schemas/assistant.py AssistantCreate.model_provider
  //
  // Those two are what a create request falls back to when the form omits the
  // field. This form pinning to 'anthropic' while the backend defaulted to
  // 'openai' is what sent provider: "anthropic" to Vapi, which needs your own
  // Anthropic key on the Vapi account and fails without one. Divergence here
  // is silent — nothing validates the two against each other — so if you
  // change this line, change those two.
  //
  // Editing an existing assistant loads whatever provider it was saved with
  // (see loadAssistantIntoForm below), so publishing does not silently move a
  // live assistant off its provider — an assistant deliberately kept on
  // Anthropic stays on Anthropic through an edit and re-save.
  //
  // The flip side: with the Select gone there is no way to move one OFF a
  // non-openai provider through the UI. That is accepted, not migrated — the
  // existing Anthropic assistants work and rewriting them would change live
  // agent behaviour. Move one deliberately with a direct UPDATE, or restore
  // the Select.
  const [modelProvider, setModelProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4.1');
  const [modelTemperature, setModelTemperature] = useState(0.7);
  const [modelMaxTokens, setModelMaxTokens] = useState(300);
  
  // Transcriber (STT) Config
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');
  const [transcriberModel, setTranscriberModel] = useState('nova-3');
  const [transcriberLanguage, setTranscriberLanguage] = useState('multi');

  // Text-to-Speech (TTS) Config
  const [voiceProvider, setVoiceProvider] = useState('11labs');
  const [voiceModel, setVoiceModel] = useState('eleven_turbo_v2_5');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.75);
  const [voiceSimilarityBoost, setVoiceSimilarityBoost] = useState(0.75);
  const [voiceFillerInjection, setVoiceFillerInjection] = useState(false);

  // Speaking & Compliance Plan states
  const [startSpeakingWaitSeconds, setStartSpeakingWaitSeconds] = useState(0.4);
  const [startSpeakingOnPunctuationSeconds, setStartSpeakingOnPunctuationSeconds] = useState(0.1);
  const [startSpeakingOnNoPunctuationSeconds, setStartSpeakingOnNoPunctuationSeconds] = useState(1.5);
  const [startSpeakingOnNumberSeconds, setStartSpeakingOnNumberSeconds] = useState(0.5);

  const [stopSpeakingNumWords, setStopSpeakingNumWords] = useState(0);
  const [stopSpeakingVoiceSeconds, setStopSpeakingVoiceSeconds] = useState(0.2);
  const [stopSpeakingBackoffSeconds, setStopSpeakingBackoffSeconds] = useState(1);

  const [hipaaEnabled, setHipaaEnabled] = useState(false);
  const [pciEnabled, setPciEnabled] = useState(false);
  const [zdrEnabled, setZdrEnabled] = useState(false);
  
  const [firstMessageMode, setFirstMessageMode] = useState('assistant-speaks-first');
  const [backgroundSound, setBackgroundSound] = useState('office');
  const [backchannelingEnabled, setBackchannelingEnabled] = useState(false);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(600);
  const [silenceTimeoutSeconds, setSilenceTimeoutSeconds] = useState(30);
  const [successEvaluationRubric, setSuccessEvaluationRubric] = useState('PassFail');
  const [selectedTools, setSelectedTools] = useState([]);

  const [phoneBehavior, setPhoneBehavior] = useState({
    recording: true,
    aiSummary: true,
    whatsappFollowup: false,
    voicemailDrop: true,
    crmAutoUpdate: true
  });

  // Event handlers to dynamically keep models and languages synced when providers change
  const handleTranscriberProviderChange = (val) => {
    setTranscriberProvider(val);
    const config = PROVIDER_CONFIG.stt[val];
    if (config) {
      if (config.models && config.models.length > 0) {
        setTranscriberModel(config.models[0].id);
      }
      if (config.languages && config.languages.length > 0) {
        setTranscriberLanguage(config.languages[0].id);
      }
    }
  };

  // Model Provider picker is hidden — restore this handler with the Select below.
  // const handleModelProviderChange = (val) => {
  //   setModelProvider(val);
  //   const config = PROVIDER_CONFIG.llm[val];
  //   if (config && config.models && config.models.length > 0) {
  //     setModelName(config.models[0].id);
  //   }
  // };

  const handleVoiceProviderChange = (val) => {
    setVoiceProvider(val);
    const matchingVoice = VOICES.find(v => v.provider === val);
    if (matchingVoice) {
      setSelectedVoice(matchingVoice.id);
    } else {
      setSelectedVoice('');
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Apply a brief highlight effect
      element.classList.add('bg-blue-500/10');
      setTimeout(() => {
        element.classList.remove('bg-blue-500/10');
      }, 1500);
    }
  };

  // Calculate pricing breakdown and latencies per minute dynamically
  const pricingBreakdown = useMemo(() => {
    const vapiCost = PROVIDER_CONFIG.vapi; // $0.1500
    
    // Look up STT cost & latency by provider and active model ID
    const sttProviderData = PROVIDER_CONFIG.stt[transcriberProvider];
    const sttModelObj = sttProviderData?.models?.find(m => m.id === transcriberModel);
    const sttCost = sttModelObj ? sttModelObj.price : (sttProviderData?.models?.[0]?.price || 0.0075);
    const sttLatency = sttModelObj ? sttModelObj.latency : (sttProviderData?.models?.[0]?.latency || 100);
    
    // Look up LLM cost & latency by provider and active model ID
    const llmProviderData = PROVIDER_CONFIG.llm[modelProvider];
    const llmModelObj = llmProviderData?.models?.find(m => m.id === modelName);
    const llmCost = llmModelObj ? llmModelObj.price : (llmProviderData?.models?.[0]?.price || 0.0010);
    const llmLatency = llmModelObj ? llmModelObj.latency : (llmProviderData?.models?.[0]?.latency || 400);
    
    // Look up TTS cost & latency by voice provider
    const ttsCost = PROVIDER_CONFIG.tts[voiceProvider]?.price || 0.1800;
    const ttsLatency = PROVIDER_CONFIG.tts[voiceProvider]?.latency || 800;
    
    const totalCost = vapiCost + sttCost + llmCost + ttsCost;
    const totalLatency = sttLatency + llmLatency + ttsLatency;
    
    // Calculate cost percentages for the segmented progress bar
    const vapiCostPercent = (vapiCost / totalCost) * 100;
    const sttCostPercent = (sttCost / totalCost) * 100;
    const llmCostPercent = (llmCost / totalCost) * 100;
    const ttsCostPercent = (ttsCost / totalCost) * 100;
    
    // Calculate latency percentages for the segmented progress bar
    const sttLatencyPercent = (sttLatency / totalLatency) * 100;
    const llmLatencyPercent = (llmLatency / totalLatency) * 100;
    const ttsLatencyPercent = (ttsLatency / totalLatency) * 100;
    
    return {
      vapi: vapiCost,
      stt: sttCost,
      llm: llmCost,
      tts: ttsCost,
      total: totalCost,
      
      // Latencies
      sttLatency,
      llmLatency,
      ttsLatency,
      totalLatency,
      
      // Segment percentages
      vapiCostPercent,
      sttCostPercent,
      llmCostPercent,
      ttsCostPercent,
      
      sttLatencyPercent,
      llmLatencyPercent,
      ttsLatencyPercent
    };
  }, [transcriberProvider, transcriberModel, voiceProvider, modelProvider, modelName]);

  // Filter voices dynamically based on selected voice provider
  const filteredVoices = useMemo(() => {
    return VOICES.filter(v => v.provider === voiceProvider);
  }, [voiceProvider]);

  useEffect(() => {
    if (view === 'list') {
      fetchAssistants();
    } else {
      fetchKnowledgeFiles();
    }
  }, [view]);

  const fetchKnowledgeFiles = async () => {
    setIsLoadingKnowledgeFiles(true);
    try {
      const response = await api.get('/api/v1/assistants/knowledge-base/files');
      setAvailableKnowledgeFiles(response.data);
    } catch (error) {
      toast.error('Failed to load available knowledge base documents');
    } finally {
      setIsLoadingKnowledgeFiles(false);
    }
  };

  const fetchAssistants = async () => {
    setIsLoadingList(true);
    try {
      const response = await api.get('/api/v1/assistants');
      setExistingAssistants(response.data);
    } catch (error) {
      toast.error('Failed to load assistants');
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleDelete = async (e, assistantId) => {
    e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to delete this agent?');
    if (!confirmed) return;

    setIsDeleting(assistantId);
    try {
      await api.delete(`/api/v1/assistants/${assistantId}`);
      toast.success('Agent deleted successfully');
      fetchAssistants();
    } catch (error) {
      console.error('Delete Error:', error);
      toast.error('Failed to delete agent');
    } finally {
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setAgentName('');
    setAgentRole('');
    setFirstMessage('');
    setSystemPrompt('');
    setSelectedTones(['Consultative']);
    setLanguage('English (India)');
    setCallIntent('Lead Qualification');
    setSelectedVoice('sarah');
    setFiles([]);
    setIsPublished(false);
    setEditingId(null);
    
    // Reset dynamic variables
    setModelProvider('openai');
    setModelName('gpt-4.1');
    setModelTemperature(0.7);
    setModelMaxTokens(300);
    setTranscriberProvider('deepgram');
    setTranscriberModel('nova-3');
    setTranscriberLanguage('multi');
    setVoiceProvider('11labs');
    setVoiceModel('eleven_turbo_v2_5');
    setVoiceSpeed(1.0);
    setVoiceStability(0.75);
    setVoiceSimilarityBoost(0.75);
    setVoiceFillerInjection(false);
    setStartSpeakingWaitSeconds(0.4);
    setStartSpeakingOnPunctuationSeconds(0.1);
    setStartSpeakingOnNoPunctuationSeconds(1.5);
    setStartSpeakingOnNumberSeconds(0.5);
    setStopSpeakingNumWords(0);
    setStopSpeakingVoiceSeconds(0.2);
    setStopSpeakingBackoffSeconds(1);
    setHipaaEnabled(false);
    setPciEnabled(false);
    setZdrEnabled(false);
    setFirstMessageMode('assistant-speaks-first');
    setBackgroundSound('office');
    setBackchannelingEnabled(false);
    setMaxDurationSeconds(600);
    setSilenceTimeoutSeconds(30);
    setSuccessEvaluationRubric('PassFail');
    setSelectedTools([]);
  };

  const handleEdit = (assistant) => {
    setEditingId(assistant.id);
    setAgentName(assistant.name || '');
    setAgentRole(assistant.role || '');
    setFirstMessage(assistant.first_message || assistant.firstMessage || '');
    setSystemPrompt(assistant.system_prompt || assistant.systemPrompt || '');
    setLanguage(assistant.language || 'English (India)');
    setCallIntent(assistant.call_intent || assistant.callIntent || 'Lead Qualification');
    setSelectedVoice(assistant.voice_id || assistant.voice || 'sarah');
    setIsPublished(assistant.is_live);
    
    // Parse speaking tone list from comma-separated string
    const tonesList = assistant.tone ? assistant.tone.split(',').map(t => t.trim()) : ['Consultative'];
    setSelectedTones(tonesList);

    // Set dynamic properties from backend if available
    setModelProvider(assistant.model_provider || assistant.modelProvider || 'openai');
    setModelName(assistant.model_name || assistant.modelName || 'gpt-4o');
    setModelTemperature(
      assistant.model_temperature !== undefined 
         ? parseFloat(assistant.model_temperature) 
         : (assistant.modelTemperature !== undefined ? parseFloat(assistant.modelTemperature) : 0.7)
    );
    const rawTokens = assistant.model_max_tokens || assistant.modelMaxTokens || 300;
    let mappedTokens = 300;
    if (rawTokens >= 500) {
      mappedTokens = 600;
    } else if (rawTokens >= 350) {
      mappedTokens = 400;
    }
    setModelMaxTokens(mappedTokens);
    
    // Transcriber (STT) Settings
    const tConfig = assistant.transcriber || {};
    setTranscriberProvider(tConfig.provider || 'deepgram');
    setTranscriberModel(tConfig.model || 'nova-2');
    setTranscriberLanguage(tConfig.language || 'en-US');

    // Voice (TTS) Settings
    setVoiceProvider(assistant.voice_provider || assistant.voiceProvider || '11labs');
    setVoiceModel(assistant.voice_model || assistant.voiceModel || 'eleven_turbo_v2_5');
    setVoiceSpeed(
      assistant.voice_speed !== undefined 
        ? parseFloat(assistant.voice_speed) 
        : (assistant.voiceSpeed !== undefined ? parseFloat(assistant.voiceSpeed) : 1.0)
    );
    
    // Speaking & Compliance Plans
    const startPlan = assistant.start_speaking_plan || assistant.startSpeakingPlan || {};
    const startEndpointing = startPlan.transcriptionEndpointingPlan || {};
    setStartSpeakingWaitSeconds(startPlan.waitSeconds !== undefined ? startPlan.waitSeconds : 0.4);
    setStartSpeakingOnPunctuationSeconds(startEndpointing.onPunctuationSeconds !== undefined ? startEndpointing.onPunctuationSeconds : 0.1);
    setStartSpeakingOnNoPunctuationSeconds(startEndpointing.onNoPunctuationSeconds !== undefined ? startEndpointing.onNoPunctuationSeconds : 1.5);
    setStartSpeakingOnNumberSeconds(startEndpointing.onNumberSeconds !== undefined ? startEndpointing.onNumberSeconds : 0.5);

    const stopPlan = assistant.stop_speaking_plan || assistant.stopSpeakingPlan || {};
    setStopSpeakingNumWords(stopPlan.numWords !== undefined ? stopPlan.numWords : 0);
    setStopSpeakingVoiceSeconds(stopPlan.voiceSeconds !== undefined ? stopPlan.voiceSeconds : 0.2);
    setStopSpeakingBackoffSeconds(stopPlan.backoffSeconds !== undefined ? stopPlan.backoffSeconds : 1);

    const compPlan = assistant.compliance_plan || assistant.compliancePlan || {};
    setHipaaEnabled(compPlan.hipaaEnabled !== undefined ? compPlan.hipaaEnabled : (assistant.hipaa_enabled || assistant.hipaaEnabled || false));
    setPciEnabled(compPlan.pciEnabled !== undefined ? compPlan.pciEnabled : false);
    setZdrEnabled(compPlan.zdrEnabled !== undefined ? compPlan.zdrEnabled : false);
    setVoiceStability(
      assistant.voice_stability !== undefined 
        ? parseFloat(assistant.voice_stability) 
        : (assistant.voiceStability !== undefined ? parseFloat(assistant.voiceStability) : 0.75)
    );
    setVoiceSimilarityBoost(
      assistant.voice_similarity_boost !== undefined 
        ? parseFloat(assistant.voice_similarity_boost) 
        : (assistant.voiceSimilarityBoost !== undefined ? parseFloat(assistant.voiceSimilarityBoost) : 0.75)
    );
    setVoiceFillerInjection(
      assistant.voice_filler_injection !== undefined 
        ? assistant.voice_filler_injection 
        : (assistant.voiceFillerInjection || false)
    );
    
    setFirstMessageMode(assistant.first_message_mode || assistant.firstMessageMode || 'assistant-speaks-first');
    setBackgroundSound(assistant.background_sound || assistant.backgroundSound || 'office');
    setBackchannelingEnabled(
      assistant.backchanneling_enabled !== undefined 
        ? assistant.backchanneling_enabled 
        : (assistant.backchannelingEnabled || false)
    );
    setMaxDurationSeconds(assistant.max_duration_seconds || assistant.maxDurationSeconds || 600);
    setSilenceTimeoutSeconds(assistant.silence_timeout_seconds || assistant.silenceTimeoutSeconds || 30);
    setSuccessEvaluationRubric(assistant.success_evaluation_rubric || assistant.successEvaluationRubric || 'PassFail');
    
    // Select correct tools preset based on what backend returned in model_tools
    const existingTools = assistant.model_tools || assistant.modelTools || [];
    const matchedToolIds = REAL_ESTATE_TOOLS
      .filter(t => existingTools.some(et => {
        if (t.vapiTool.type === 'transferCall') {
          return et?.type === 'transferCall';
        }
        return et?.function?.name === t.vapiTool?.function?.name;
      }))
      .map(t => t.id);
    setSelectedTools(matchedToolIds);

    setPhoneBehavior(prev => ({
      ...prev,
      recording: assistant.recording_enabled || false
    }));

    // Parse knowledge base IDs if any
    const kbIds = assistant.knowledgeBaseIds || assistant.knowledge_file_ids || [];
    setFiles(kbIds);
    
    setView('editor');
  };

  const handleToggleTone = (tone) => {
    setSelectedTones(prev => 
      prev.includes(tone) 
        ? prev.filter(t => t !== tone) 
        : [...prev, tone]
    );
  };

  const handleToggleTool = (toolId) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  const handlePlayVoice = (voice, e) => {
    e.stopPropagation();
    if (playingVoice === voice.id) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      audio.src = voice.previewUrl;
      audio.play();
      setPlayingVoice(voice.id);
      audio.onended = () => setPlayingVoice(null);
    }
  };

  const getPayload = () => {
    return {
      name: agentName,
      role: agentRole,
      firstMessage: firstMessage,
      firstMessageMode: firstMessageMode,
      systemPrompt: systemPrompt,
      voice: selectedVoice,
      voiceProvider: voiceProvider,
      voiceModel: voiceModel,
      language: language,
      tone: selectedTones.join(', '),
      callIntent: callIntent,
      knowledgeBaseIds: files,
      
      // Dynamic Settings
      modelProvider: modelProvider,
      modelName: modelName,
      modelTemperature: parseFloat(modelTemperature),
      modelMaxTokens: parseInt(modelMaxTokens),
      
      // Transcriber (STT) Configuration
      transcriber: {
        provider: transcriberProvider,
        model: transcriberModel,
        language: transcriberLanguage,
        endUtteranceSilenceThreshold: null,
        wordBoost: null
      },

      modelTools: REAL_ESTATE_TOOLS
        .filter(t => selectedTools.includes(t.id))
        .map(t => t.vapiTool),

      voiceSpeed: parseFloat(voiceSpeed),
      voiceStability: voiceStability ? parseFloat(voiceStability) : null,
      voiceSimilarityBoost: voiceSimilarityBoost ? parseFloat(voiceSimilarityBoost) : null,
      voiceFillerInjection: voiceFillerInjection,
      
      backgroundSound: backgroundSound,
      backchannelingEnabled: backchannelingEnabled,
      maxDurationSeconds: parseInt(maxDurationSeconds),
      silenceTimeoutSeconds: parseInt(silenceTimeoutSeconds),
      successEvaluationRubric: successEvaluationRubric,
      recordingEnabled: phoneBehavior.recording,

      // Speaking & Compliance plans
      startSpeakingPlan: {
        waitSeconds: parseFloat(startSpeakingWaitSeconds),
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: parseFloat(startSpeakingOnPunctuationSeconds),
          onNoPunctuationSeconds: parseFloat(startSpeakingOnNoPunctuationSeconds),
          onNumberSeconds: parseFloat(startSpeakingOnNumberSeconds)
        }
      },
      stopSpeakingPlan: {
        numWords: parseInt(stopSpeakingNumWords),
        voiceSeconds: parseFloat(stopSpeakingVoiceSeconds),
        backoffSeconds: parseFloat(stopSpeakingBackoffSeconds)
      },
      compliancePlan: {
        hipaaEnabled: hipaaEnabled,
        pciEnabled: pciEnabled,
        zdrEnabled: zdrEnabled
      },
      hipaaEnabled: hipaaEnabled
    };
  };

  const handleSaveDraft = async () => {
    if (!agentName) {
      toast.error('Please enter an agent name to save a draft');
      return;
    }

    setIsSaving(true);
    try {
      const payload = getPayload();
      if (editingId) {
        await api.patch(`/api/v1/assistants/${editingId}`, payload);
      } else {
        await api.post('/api/v1/assistants/draft', payload);
      }
      
      setIsSaving(false);
      setSaveStatus('✓ Saved');
      setTimeout(() => setSaveStatus('Save Draft'), 2000);
      toast.success('Agent draft saved to database');
    } catch (error) {
      setIsSaving(false);
      const msg = error.response?.data?.detail || 'Failed to save draft';
      toast.error(msg);
      console.error('Draft Error:', error);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const payload = getPayload();
      let response;
      if (editingId) {
        response = await api.patch(`/api/v1/assistants/${editingId}`, {
          ...payload,
          is_live: true // Ensure it's marked as live when publishing
        });
      } else {
        response = await api.post('/api/v1/assistants', payload);
      }
      
      setIsPublishing(false);
      setIsPublished(true);
      toast.success('Agent published to VAPI!');
      console.log('Published Agent:', response.data);
      setTimeout(() => setView('list'), 2000);
    } catch (error) {
      setIsPublishing(false);
      const msg = error.response?.data?.detail || 'Failed to publish agent';
      toast.error(msg);
      console.error('Publish Error:', error);
    }
  };

  const onFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const response = await api.post('/api/v1/assistants/knowledge-base', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFiles(prev => [...prev, { 
        id: response.data.id, 
        name: response.data.name, 
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB` 
      }]);
      
      toast.success('File added to knowledge base', { id: toastId });
    } catch (error) {
      toast.error('Failed to upload file', { id: toastId });
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden rounded-xl border border-border">
      {view === 'list' ? (
        <div className="flex flex-col h-full bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <div>
              <h2 className="text-xl font-bold">Agent Workshop</h2>
              <p className="text-sm text-muted-foreground">Manage and deploy your voice assistants</p>
            </div>
            <Button onClick={() => { resetForm(); setView('editor'); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Agent
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : existingAssistants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No agents yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1">Start by creating your first AI voice agent to handle property inquiries.</p>
                <Button onClick={() => { resetForm(); setView('editor'); }} variant="outline" className="mt-6 border-blue-500/30 text-blue-500">
                  Build your first agent
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {existingAssistants.map((agent) => (
                  <Card key={agent.id} className="group hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => handleEdit(agent)}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-2xl shadow-sm">
                          {VOICES.find(v => v.id === agent.voice_id)?.avatar || '🤖'}
                        </div>
                        <Badge variant="outline" className={`${agent.is_live ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-muted text-muted-foreground border-border'}`}>
                          {agent.is_live ? 'Live' : 'Draft'}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground leading-none">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{agent.role || 'No role defined'}</p>

                      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                           <Mic className="w-3 h-3" />
                           {VOICES.find(v => v.id === agent.voice_id)?.name || 'Default'} Voice
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={(e) => handleDelete(e, agent.id)}
                            disabled={isDeleting === agent.id}
                          >
                            {isDeleting === agent.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10">
                             <FileEdit className="w-3 h-3 mr-1.5" />
                             Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        <>
          {/* Top Header / Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setView('list')} className="mr-2 text-muted-foreground hover:text-foreground border border-transparent hover:border-border">
                <ListRestart className="w-4 h-4 mr-2" />
                Back to Agents
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {saveStatus}
              </Button>
              <Badge variant="outline" className={`${isPublished ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                {isPublished ? 'Live' : 'Draft'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left Side: Form Content */}
            <ScrollArea className="flex-1 border-r border-border bg-card">
              <div className="p-8 space-y-10 max-w-3xl mx-auto pb-20">
                
                {/* Section 1: Agent Identity */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Agent Identity</h3>
                      <p className="text-sm text-muted-foreground">Define how your agent identifies itself</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Agent Name</label>
                      <Input 
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="bg-muted border-border focus:border-blue-500 focus:ring-0 text-foreground"
                        placeholder="e.g. Sarah"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Role / Title</label>
                      <Input 
                        value={agentRole}
                        onChange={(e) => setAgentRole(e.target.value)}
                        className="bg-muted border-border focus:border-blue-500 focus:ring-0 text-foreground"
                        placeholder="e.g. Sales Executive"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">First Message</label>
                    <Textarea 
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      className="bg-muted border-border focus:border-blue-500 focus:ring-0 text-foreground min-h-[100px] resize-none"
                      placeholder="Greeting when the user picks up..."
                    />
                  </div>
                </section>

                {/* Section 2: Personality & Brain */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center border border-purple-600/20">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Personality & Logic</h3>
                      <p className="text-sm text-muted-foreground">Configure the core AI brain and speaking style</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground uppercase">System Prompt</label>
                      <span className="text-[10px] text-muted-foreground">{systemPrompt.length} / 5000</span>
                    </div>
                    <Textarea 
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="bg-muted border-border focus:border-blue-500 focus:ring-0 text-foreground font-mono text-sm min-h-[200px] leading-relaxed"
                      placeholder="Comprehensive instructions for the AI behavior..."
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Speaking Tone (Select Multiple)</label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map(tone => {
                        const isSelected = selectedTones.includes(tone);
                        return (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => handleToggleTone(tone)}
                            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                              isSelected 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-card text-muted-foreground border-border hover:border-muted-foreground'
                            } border`}
                          >
                            {tone}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Language</label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English (India)">English (India)</SelectItem>
                          <SelectItem value="Hindi">Hindi</SelectItem>
                          <SelectItem value="English (US)">English (US)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Call Intent</label>
                      <Select value={callIntent} onValueChange={setCallIntent}>
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-muted-foreground" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lead Qualification">Lead Qualification</SelectItem>
                          <SelectItem value="Appointment Booking">Appointment Booking</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* STT Speech-to-Text Config */}
                  <div id="form-stt-section" className="border-t border-border pt-6 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-600" />
                      STT (Speech-to-Text) Configuration
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">STT Provider</label>
                        <Select value={transcriberProvider} onValueChange={handleTranscriberProviderChange}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(PROVIDER_CONFIG.stt).map(p => (
                              <SelectItem key={p} value={p}>{PROVIDER_CONFIG.stt[p].name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">STT Model</label>
                        <Select value={transcriberModel} onValueChange={setTranscriberModel}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDER_CONFIG.stt[transcriberProvider]?.models?.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">STT Language</label>
                        <Select value={transcriberLanguage} onValueChange={setTranscriberLanguage}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDER_CONFIG.stt[transcriberProvider]?.languages?.map(lang => (
                              <SelectItem key={lang.id} value={lang.id}>{lang.name} ({lang.id})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* LLM Model Config */}
                  <div id="form-llm-section" className="border-t border-border pt-6 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      LLM Brain Configuration
                    </h4>
                    {/* Model Provider picker removed — the provider is pinned in state.
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Model Provider</label>
                        <Select value={modelProvider} onValueChange={handleModelProviderChange}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(PROVIDER_CONFIG.llm).map(p => (
                              <SelectItem key={p} value={p}>{PROVIDER_CONFIG.llm[p].name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Model Name</label>
                      <Select value={modelName} onValueChange={setModelName}>
                        <SelectTrigger className="bg-muted border-border text-foreground h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_CONFIG.llm[modelProvider]?.models?.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.id} ({PROVIDER_CONFIG.llm[modelProvider]?.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Temperature</label>
                          <span className="text-xs font-mono">{modelTemperature}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.1" 
                          value={modelTemperature} 
                          onChange={(e) => setModelTemperature(parseFloat(e.target.value))}
                          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Max Call Duration</label>
                          <div className="flex items-center gap-1">
                            {[
                              { label: '5m', tokens: 300, reason: 'Short, crisp responses' },
                              { label: '6m', tokens: 400, reason: 'Slightly more detail' },
                              { label: '10m', tokens: 600, reason: 'Fuller explanations' }
                            ].map(opt => (
                              <button
                                key={opt.label}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setModelMaxTokens(opt.tokens);
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  modelMaxTokens === opt.tokens 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-card text-muted-foreground border-border hover:border-blue-400'
                                }`}
                                title={opt.reason}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {modelMaxTokens === 300 && "Target: Short, crisp responses (~5 min)"}
                          {modelMaxTokens === 400 && "Target: Slightly more detail (~6 min)"}
                          {modelMaxTokens === 600 && "Target: Fuller explanations (~10 min)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Voice Selection - Moved here from Section 3 */}
                  <div id="form-tts-section" className="border-t border-border pt-6 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-orange-600" />
                      Voice Model & Provider
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">TTS (Text-to-Speech) Provider</label>
                        <Select value={voiceProvider} onValueChange={handleVoiceProviderChange}>
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-muted-foreground" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(PROVIDER_CONFIG.tts).map(p => (
                              <SelectItem key={p} value={p}>{PROVIDER_CONFIG.tts[p].name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {voiceProvider === '11labs' && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Voice Model</label>
                          <Select value={voiceModel} onValueChange={setVoiceModel}>
                            <SelectTrigger className="bg-muted border-border text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="eleven_turbo_v2_5">eleven_turbo_v2_5 (Priya Default)</SelectItem>
                              <SelectItem value="eleven_multilingual_v2">eleven_multilingual_v2</SelectItem>
                              <SelectItem value="eleven_turbo_v2">eleven_turbo_v2</SelectItem>
                              <SelectItem value="eleven_monolingual_v1">eleven_monolingual_v1</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Available Voices</label>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-14">
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <div className="flex items-center gap-2 text-left">
                                <span className="text-xl">
                                  {filteredVoices.find(v => v.id === selectedVoice)?.avatar || '👤'}
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">
                                    {filteredVoices.find(v => v.id === selectedVoice)?.name || 'Select Voice'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                    {filteredVoices.find(v => v.id === selectedVoice)?.meta || 'Voice personality'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {filteredVoices.map(voice => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <div className="flex items-center gap-3 py-1">
                                  <span className="text-2xl">{voice.avatar}</span>
                                  <div className="flex flex-col">
                                    <span className="font-semibold">{voice.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{voice.meta}</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Voice Settings */}
                    <div className="border-t border-border pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Voice Speed</label>
                            <span className="text-xs font-mono">{voiceSpeed}x</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2" 
                            step="0.1" 
                            value={voiceSpeed} 
                            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Stability</label>
                            <span className="text-xs font-mono">{voiceStability || 0.75}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={voiceStability || 0.75} 
                            onChange={(e) => setVoiceStability(parseFloat(e.target.value))}
                            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Similarity Boost</label>
                            <span className="text-xs font-mono">{voiceSimilarityBoost || 0.75}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={voiceSimilarityBoost || 0.75} 
                            onChange={(e) => setVoiceSimilarityBoost(parseFloat(e.target.value))}
                            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-4 border-l border-border pl-4">
                          <div>
                            <div className="text-xs font-semibold">Filler Injection</div>
                            <div className="text-[10px] text-muted-foreground">Inject natural filler words</div>
                          </div>
                          <Switch 
                            checked={voiceFillerInjection} 
                            onCheckedChange={setVoiceFillerInjection}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vapi Tools Configuration */}
                  <div className="border-t border-border pt-6 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      AI Call Actions & Tools
                    </h4>
                    <p className="text-xs text-muted-foreground">Select custom tools that the agent can trigger during the call.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {REAL_ESTATE_TOOLS.map(tool => {
                        const isSelected = selectedTools.includes(tool.id);
                        const ToolIcon = tool.icon;
                        return (
                          <div 
                            key={tool.id}
                            onClick={() => handleToggleTool(tool.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                              isSelected 
                                ? 'bg-blue-500/10 border-blue-500 shadow-sm'
                                : 'bg-muted border-border hover:border-muted-foreground'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-card text-muted-foreground border-border'
                              }`}>
                                <ToolIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-foreground">{tool.name}</div>
                                <div className="text-[10px] text-muted-foreground mt-1 leading-normal">{tool.description}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-end">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-border'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Section 4: Knowledge Base */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center border border-emerald-600/20">
                      <Book className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Knowledge Base</h3>
                      <p className="text-sm text-muted-foreground">Attach pre-uploaded documents or sheets from your Knowledge Library for context</p>
                    </div>
                  </div>

                  {isLoadingKnowledgeFiles ? (
                    <div className="flex items-center justify-center py-10 border border-dashed border-border rounded-xl">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
                      <span className="text-xs text-muted-foreground">Loading Knowledge Library...</span>
                    </div>
                  ) : availableKnowledgeFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-xl text-center bg-muted/30">
                      <Book className="w-8 h-8 text-muted-foreground mb-2" />
                      <div className="text-sm font-semibold text-foreground">No documents in library</div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-normal">
                        Please upload files first in your dedicated **Knowledge Base** page to attach them here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableKnowledgeFiles.map(file => {
                        const isSelected = files.includes(file.id);
                        return (
                          <div 
                            key={file.id}
                            onClick={() => {
                              setFiles(prev => 
                                prev.includes(file.id) 
                                  ? prev.filter(id => id !== file.id) 
                                  : [...prev, file.id]
                              );
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected 
                                ? 'bg-emerald-500/10 border-emerald-500/80 shadow-sm'
                                : 'bg-muted/50 border-border hover:border-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                                isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-card text-muted-foreground border-border shadow-sm'
                              }`}>
                                <Book className="w-5 h-5" />
                              </div>
                              <div className="max-w-[160px]">
                                <div className="text-xs font-semibold text-foreground line-clamp-1" title={file.name}>
                                  {file.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                  {file.size && !isNaN(file.size)
                                    ? `${(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB`
                                    : file.size || 'Size Unknown'}
                                </div>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border bg-card'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Section 5: Phone & Call Behavior */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-600/20">
                      <Phone className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Phone & Call Behavior</h3>
                      <p className="text-sm text-muted-foreground">Configure connectivity and automation rules</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-border bg-muted/50 space-y-5">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
                           <Zap className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="text-sm font-semibold text-foreground">Twilio Connected</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 bg-blue-500/15 text-blue-400 border-blue-500/25">Active</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Phone Number</label>
                        <Select defaultValue="india-primary">
                          <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="india-primary">+91 91191 19XXX</SelectItem>
                            <SelectItem value="international">+1 888 231 XXXX</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Max Retries</label>
                        <Select defaultValue="3">
                          <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Attempt</SelectItem>
                            <SelectItem value="3">3 Attempts</SelectItem>
                            <SelectItem value="5">5 Attempts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      {[
                        { id: 'recording', label: 'Call Recording', desc: 'Save audio for all interactions' },
                        { id: 'aiSummary', label: 'AI Call Summary', desc: 'Auto-generate notes' },
                        { id: 'whatsappFollowup', label: 'WhatsApp Follow-up', desc: 'Send brochure after call' },
                        { id: 'voicemailDrop', label: 'Voicemail Drop', desc: 'Leave message if no answer' },
                        { id: 'crmAutoUpdate', label: 'CRM Auto-update', desc: 'Sync data with Lead database' },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                          </div>
                          <Switch 
                            checked={phoneBehavior[item.id]} 
                            onCheckedChange={(checked) => setPhoneBehavior(prev => ({ ...prev, [item.id]: checked }))}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Advanced Call Controls */}
                    <div className="border-t border-border pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Advanced Call Controls</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">First Message Mode</label>
                          <Select value={firstMessageMode} onValueChange={setFirstMessageMode}>
                            <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="assistant-speaks-first">Assistant Speaks First</SelectItem>
                              <SelectItem value="assistant-waits-for-user">Waits For User</SelectItem>
                              <SelectItem value="assistant-speaks-first-with-model-generated-message">Model Generated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Background Sound</label>
                          <Select value={backgroundSound} onValueChange={setBackgroundSound}>
                            <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="cafe">Cafe</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Max Duration (secs)</label>
                          <Input 
                            type="number" 
                            value={maxDurationSeconds} 
                            onChange={(e) => setMaxDurationSeconds(parseInt(e.target.value) || 0)}
                            className="bg-card border-border h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Silence Timeout (secs)</label>
                          <Input 
                            type="number" 
                            value={silenceTimeoutSeconds} 
                            onChange={(e) => setSilenceTimeoutSeconds(parseInt(e.target.value) || 0)}
                            className="bg-card border-border h-9 text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase">Success Rubric</label>
                          <Select value={successEvaluationRubric} onValueChange={setSuccessEvaluationRubric}>
                            <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PassFail">Pass/Fail</SelectItem>
                              <SelectItem value="NumericScale">Numeric Scale</SelectItem>
                              <SelectItem value="DescriptiveScale">Descriptive Scale</SelectItem>
                              <SelectItem value="Checklist">Checklist</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-l border-border pl-4">
                          <div>
                            <div className="text-xs font-semibold">Backchanneling</div>
                            <div className="text-[10px] text-muted-foreground">Enable natural listening sounds</div>
                          </div>
                          <Switch 
                            checked={backchannelingEnabled} 
                            onCheckedChange={setBackchannelingEnabled}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Speaking & Endpointing Plans */}
                    <div className="border-t border-border pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Speaking & Endpointing Plans</h4>
                      
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-foreground">Start Speaking Plan (Response endpointing)</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Wait Seconds</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={startSpeakingWaitSeconds} 
                              onChange={(e) => setStartSpeakingWaitSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">On Punctuation (secs)</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={startSpeakingOnPunctuationSeconds} 
                              onChange={(e) => setStartSpeakingOnPunctuationSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">On No Punctuation (secs)</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={startSpeakingOnNoPunctuationSeconds} 
                              onChange={(e) => setStartSpeakingOnNoPunctuationSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">On Number (secs)</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={startSpeakingOnNumberSeconds} 
                              onChange={(e) => setStartSpeakingOnNumberSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="text-xs font-semibold text-foreground">Stop Speaking Plan (Interrupt handling)</div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Num Words</label>
                            <Input 
                              type="number" 
                              value={stopSpeakingNumWords} 
                              onChange={(e) => setStopSpeakingNumWords(parseInt(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Voice Secs</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={stopSpeakingVoiceSeconds} 
                              onChange={(e) => setStopSpeakingVoiceSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Backoff Secs</label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={stopSpeakingBackoffSeconds} 
                              onChange={(e) => setStopSpeakingBackoffSeconds(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border h-9 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4 space-y-4">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Compliance & Security</div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold">HIPAA Compliance</div>
                              <div className="text-[10px] text-muted-foreground">Enable HIPAA compliant call processing</div>
                            </div>
                            <Switch 
                              checked={hipaaEnabled} 
                              onCheckedChange={setHipaaEnabled}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold">PCI Compliance</div>
                              <div className="text-[10px] text-muted-foreground">Redact credit card details from logs/audio</div>
                            </div>
                            <Switch 
                              checked={pciEnabled} 
                              onCheckedChange={setPciEnabled}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold">Zero Data Retention (ZDR)</div>
                              <div className="text-[10px] text-muted-foreground">Prevent raw logs from being stored on Vapi</div>
                            </div>
                            <Switch 
                              checked={zdrEnabled} 
                              onCheckedChange={setZdrEnabled}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </section>

              </div>
            </ScrollArea>

            {/* Right Side: Preview Panel */}
            <aside className="w-[400px] flex flex-col bg-muted border-l border-border shrink-0 p-6">
              <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                
                {/* Live Preview UI */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Preview</label>
                  <div className="rounded-[2.5rem] border-[8px] border-slate-900 bg-slate-900 aspect-[9/16] overflow-hidden flex flex-col relative shadow-2xl">
                    {/* Simulated Phone Status Bar */}
                    <div className="h-8 flex items-center justify-between px-8 pt-4">
                      <div className="text-[10px] font-bold text-white">9:41</div>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-1.5 rounded-[1px] border border-white/40" />
                        <div className="w-3.5 h-1.5 rounded-[1px] bg-white" />
                      </div>
                    </div>

                    {/* Receiver Info */}
                    <div className="flex flex-col items-center pt-8 pb-6 border-b border-white/5 bg-slate-800">
                      <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-400/30 flex items-center justify-center text-4xl mb-4 animate-pulse">
                        {VOICES.find(v => v.id === selectedVoice)?.avatar || '👤'}
                      </div>
                      <h4 className="font-bold text-lg text-white">{agentName || 'Unnamed Agent'}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] uppercase text-slate-400 tracking-widest font-bold">Calling...</span>
                      </div>
                    </div>

                    {/* Chat Bubbles */}
                    <div className="flex-1 p-4 space-y-4 overflow-hidden mask-fade-bottom">
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-slate-800 border border-slate-700 p-3 rounded-2xl rounded-tl-none text-[11px] leading-relaxed text-white shadow-sm">
                          {firstMessage || 'Hello, how can I help you today?'}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[85%] bg-blue-600 p-3 rounded-2xl rounded-tr-none text-[11px] leading-relaxed text-white shadow-md">
                          "Yes, I want to know more about the 3BHK flats."
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-slate-800 border border-slate-700 p-3 rounded-2xl rounded-tl-none text-[11px] leading-relaxed text-slate-300 animate-pulse">
                          Processing response...
                        </div>
                      </div>
                    </div>

                    {/* Phone Controls */}
                    <div className="h-24 bg-slate-800 border-t border-white/5 flex items-center justify-center gap-8 px-6 pb-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Mic className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                        <Phone className="w-6 h-6 rotate-[135deg] text-white" />
                      </div>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Volume2 className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Cost and Latency Dashboard (Matching Vapi Screenshot) */}
                <div className="space-y-6 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl">
                  {/* Top indicators row */}
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-5">
                    {/* Cost indicator */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Cost</span>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-lg font-black text-emerald-400 font-mono">~${pricingBreakdown.total.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">/min</span>
                        </div>
                      </div>
                      
                      {/* Cost segmented progress bar */}
                      <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
                        <div 
                          style={{ width: `${pricingBreakdown.vapiCostPercent}%` }} 
                          className="bg-emerald-500 transition-all duration-300" 
                          title={`Vapi Base: $${pricingBreakdown.vapi.toFixed(4)}`} 
                        />
                        <div 
                          style={{ width: `${pricingBreakdown.sttCostPercent}%` }} 
                          className="bg-orange-500 transition-all duration-300" 
                          title={`STT: $${pricingBreakdown.stt.toFixed(4)}`} 
                        />
                        <div 
                          style={{ width: `${pricingBreakdown.llmCostPercent}%` }} 
                          className="bg-blue-500 transition-all duration-300" 
                          title={`LLM: $${pricingBreakdown.llm.toFixed(4)}`} 
                        />
                        <div 
                          style={{ width: `${pricingBreakdown.ttsCostPercent}%` }} 
                          className="bg-purple-500 transition-all duration-300" 
                          title={`TTS: $${pricingBreakdown.tts.toFixed(4)}`} 
                        />
                      </div>
                    </div>

                    {/* Latency indicator */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Latency</span>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-lg font-black text-amber-500 font-mono">~{pricingBreakdown.totalLatency}</span>
                          <span className="text-[10px] text-slate-400 font-normal">ms</span>
                        </div>
                      </div>

                      {/* Latency segmented progress bar */}
                      <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-800">
                        <div 
                          style={{ width: `${pricingBreakdown.sttLatencyPercent}%` }} 
                          className="bg-orange-500 transition-all duration-300" 
                          title={`STT Latency: ${pricingBreakdown.sttLatency}ms`} 
                        />
                        <div 
                          style={{ width: `${pricingBreakdown.llmLatencyPercent}%` }} 
                          className="bg-blue-500 transition-all duration-300" 
                          title={`LLM Latency: ${pricingBreakdown.llmLatency}ms`} 
                        />
                        <div 
                          style={{ width: `${pricingBreakdown.ttsLatencyPercent}%` }} 
                          className="bg-purple-500 transition-all duration-300" 
                          title={`TTS Latency: ${pricingBreakdown.ttsLatency}ms`} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Component Cards Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Transcriber card */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 relative hover:border-orange-500/30 transition-all group">
                      <button 
                        onClick={() => scrollToSection('form-stt-section')}
                        className="absolute top-3.5 right-3.5 w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
                        title="Edit Transcriber Settings"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        Transcriber
                      </div>
                      <div className="font-bold text-slate-200 mt-1.5 text-sm">
                        {PROVIDER_CONFIG.stt[transcriberProvider]?.name || 'Deepgram'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                        <Mic className="w-3 h-3 text-orange-500" />
                        {transcriberModel} ({transcriberLanguage})
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-900 font-medium">
                        <span className="text-orange-400 font-semibold">${pricingBreakdown.stt.toFixed(4)}/min</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{pricingBreakdown.sttLatency}ms latency</span>
                      </div>
                    </div>

                    {/* Model card */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 relative hover:border-blue-500/30 transition-all group">
                      <button 
                        onClick={() => scrollToSection('form-llm-section')}
                        className="absolute top-3.5 right-3.5 w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
                        title="Edit LLM Brain Settings"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Model
                      </div>
                      <div className="font-bold text-slate-200 mt-1.5 text-sm">
                        {modelName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        {PROVIDER_CONFIG.llm[modelProvider]?.name || 'OpenAI'} Brain
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-900 font-medium">
                        <span className="text-blue-400 font-semibold">${pricingBreakdown.llm.toFixed(4)}/min</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{pricingBreakdown.llmLatency}ms latency</span>
                      </div>
                    </div>

                    {/* Voice card */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 relative hover:border-purple-500/30 transition-all group">
                      <button 
                        onClick={() => scrollToSection('form-tts-section')}
                        className="absolute top-3.5 right-3.5 w-6 h-6 rounded bg-slate-800 border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
                        title="Edit Voice Settings"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Voice
                      </div>
                      <div className="font-bold text-slate-200 mt-1.5 text-sm">
                        {VOICES.find(v => v.id === selectedVoice)?.name || 'Default Voice'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-purple-500" />
                        {PROVIDER_CONFIG.tts[voiceProvider]?.name || 'ElevenLabs'} Text-to-Speech
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-900 font-medium">
                        <span className="text-purple-400 font-semibold">${pricingBreakdown.tts.toFixed(4)}/min</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{pricingBreakdown.ttsLatency}ms latency</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <Button 
                   className={`w-full py-6 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                     isPublished 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                   }`}
                   onClick={handlePublish}
                   disabled={isPublishing}
                >
                  {isPublishing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Publishing...</>
                  ) : isPublished ? (
                    <><Check className="w-5 h-5" /> Published!</>
                  ) : (
                    <><Send className="w-5 h-5" /> Publish to VAPI</>
                  )}
                </Button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
