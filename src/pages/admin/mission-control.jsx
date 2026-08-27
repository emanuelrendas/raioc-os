import React, { useState, useEffect, useCallback } from 'react';

/**
 * RAIOC OS — Executive Mission Control V2 (React / Next.js Component)
 * 24/7 Sovereign Wall-Screen Command Center featuring:
 * - 6 Modular Navigation Tabs (Executive Overview, CRM Kanban, Fleet Matrix, Pulse Feed, Approvals, Infrastructure)
 * - World Clocks (DXB, LON, LIS, NYC)
 * - Interactive Slide-Over Agent Drawer & Investor Dossier Modal with Quick Actions
 * - Event JSON Payload Inspector
 */

// Global Micro-Energy RMS Calculator for Web Audio & Continuous VAD
export function calculateMicRmsEnergy(analyserNode, dataArray) {
  if (!analyserNode) return 0;
  try {
    const timeData = dataArray || new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const val = (timeData[i] - 128) / 128;
      sum += val * val;
    }
    return Math.sqrt(sum / timeData.length);
  } catch (_) {
    return 0;
  }
}
if (typeof window !== 'undefined') {
  window.calculateMicRmsEnergy = calculateMicRmsEnergy;
}

export default function MissionControlDashboard() {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [resolvingId, setResolvingId] = useState(null);
  const [isMasked, setIsMasked] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [corridorFilter, setCorridorFilter] = useState('ALL');
  const [pulseFilter, setPulseFilter] = useState('ALL');

  // Live Voice State (ChatGPT / Gemini Live style)
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [voiceState, setVoiceState] = useState('listening'); // 'listening' | 'thinking' | 'speaking'
  const [voiceTranscript, setVoiceTranscript] = useState('🎙️ Pode falar agora... (A escutar)');
  const [manualVoiceInput, setManualVoiceInput] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const canvasRef = React.useRef(null);
  const audioContextRef = React.useRef(null);
  const analyserRef = React.useRef(null);
  const micStreamRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
  const recordedAudioChunksRef = React.useRef([]);
  const isRecordingSpeechRef = React.useRef(false);
  const speechStartTimeRef = React.useRef(0);
  const activeMediaRecorderMimeTypeRef = React.useRef('audio/webm;codecs=opus');
  const animFrameRef = React.useRef(null);
  const isBotSpeakingRef = React.useRef(false);
  const speechRecognizerRef = React.useRef(null);
  const silenceTimerRef = React.useRef(null);
  const playbackSafetyTimeoutRef = React.useRef(null);
  const accumulatedTextRef = React.useRef('');
  const activeVoiceAbortControllerRef = React.useRef(null);
  const activeVoiceStreamReaderRef = React.useRef(null);
  const audioQueueRef = React.useRef([]);
  const isPlayingQueueRef = React.useRef(false);
  const activeAudioSourceRef = React.useRef(null);
  const voiceConversationHistoryRef = React.useRef([]);

  const getClientAuthHeaders = useCallback(() => {
    const headers = {
      'Content-Type': 'application/json',
      'x-requested-with': 'RAIOC_MISSION_CONTROL_V2',
    };
    const token = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('raioc_session_token')) || '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const reportVoiceTelemetry = useCallback((eventType, details = {}, latencyMs = 0) => {
    console.log(`[VOICE_TELEMETRY:${eventType}]`, details, latencyMs ? `${latencyMs.toFixed(1)}ms` : '');
    try {
      fetch('/api/v1/voice/telemetry', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          event: eventType,
          details,
          latencyMs,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch (_) {}
  }, [getClientAuthHeaders]);

  const JARVIS_OMNISCIENT_SYSTEM_PROMPT = `Tu és o JARVIS, o Mission Control Chief of Staff, Cérebro de Inteligência Executiva, Orquestração Autónoma e Copiloto Omnisciente do RAIOC OS para Emanuel Rendas Private Advisory no Dubai.

A tua função não é "responder perguntas". A tua função é operar o ecossistema, interpretar o estado real do sistema, aconselhar Emanuel com precisão, e coordenar os agentes necessários para transformar contexto em execução.

## Identidade & Postura
- Consultor de elite: claro, direto, estratégico, calmo, preciso, sem floreios, sem ruído, sem validação vazia (Quiet Luxury).
- Assume que o utilizador quer a verdade operacional, a verdade deve ser útil, a utilidade deve gerar ação e a ação produzir resultados mensuráveis.
- Tu não és um chatbot genérico nem um assistente passivo; és um JARVIS operacional com memória de contexto, consciência do ecossistema e capacidade de decisão assistida.

## Fonte de Verdade (Hierarquia Estrita)
1. Supabase / Base de dados
2. Logs do sistema
3. Estado dos 12 agentes especialistas
4. GitHub / Commits / Issues
5. Vercel / Deploys
6. Integrações externas (Meta WhatsApp Cloud API, ElevenLabs, Google AI Studio)
7. Histórico da conversa
8. Inferência consultiva (apenas quando não houver dado direto)

## Domínio Canónico do Dubai & UAE
1. Legislação & Conformidade Fiduciária:
   - Dubai Law No. 8/2007 (Escrow 100% segregada no DLD/RERA com retenção de 5% pós-conclusão).
   - UAE Civil Code Art. 880 (Garantia Decenal Estrutural de 10 anos solidária entre promotor e empreiteiro).
   - UAE Cabinet Resolution No. 65/2022 (Golden Visa de 10 anos para aquisições >= 2M AED freehold).
2. Corredores Soberanos Estratégicos & Master Developers:
   - Palm Jebel Ali (110km costa, 25M-50M+ AED), Dubai South DWC (128B aeroporto Al Maktoum, net yield 8.5%+), Palm Jumeirah (Como Residences 8.1% yield), Saadiyat Cultural District e Al Marjan Island Wynn.
   - Master Developers: Emaar, Sobha, Aldar, Nakheel, Meraas, Select Group, Ellington, DAMAC, Binghatti.

## Orquestração da Frota (12 Agentes Especialistas)
Orquestras e delegas com precisão para:
- MARK (Lead Triage & OCR)
- AIDA (Client Relations & Voice AI)
- ATLAS (Real Estate & Market Intelligence)
- LEX (Compliance, Tax & Legal)
- HELIOS (Advisory Calendar & Scheduling)
- HERMES (CRM & Pipeline Management)
- SENTINEL (Operational Watchdog & Health Guardian)
- BRAND (Content Strategy & Brand)
- ENGAGE (Social Engagement & Compliance)
- DM_CONVERSION (Inbound Conversion)
- SOCIAL_ANALYTICS (Growth & Telemetry Mesh)
- JARVIS (Chief of Staff & Executive Brain)

## Diretrizes de Resposta & Comportamento de Voz
- Em Modo de Voz ao Vivo (conversationMode === 'voice' ou streaming de voz):
  * Responde de forma natural, fluida, humana e objetiva.
  * Usa frases curtas (1 a 2 frases, máximo 35-45 palavras) para garantir baixa latência (<200ms).
  * Proibido usar markdown (sem asteriscos, cardinais, underscores, travessões, listas ou emojis).
  * Se o utilizador interromper (barge-in), pára imediatamente e reavalia a partir do novo ponto.
- Em Modo de Análise e Consultoria:
  * Diagnóstico claro (o que está a acontecer) ➔ Causa provável ➔ Ação recomendada ➔ Próximo passo imediato.`;

  const JARVIS_VOICE_SYSTEM_PROMPT = JARVIS_OMNISCIENT_SYSTEM_PROMPT;

  // World Clocks State
  const [clocks, setClocks] = useState({ dxb: '--:--', lon: '--:--', lis: '--:--', nyc: '--:--' });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const formatTime = (tz) => new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);

      setClocks({
        dxb: formatTime('Asia/Dubai'),
        lon: formatTime('Europe/London'),
        lis: formatTime('Europe/Lisbon'),
        nyc: formatTime('America/New_York'),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live consolidated V1/V2 telemetry
  const refreshTelemetry = useCallback(async () => {
    try {
      const url = isMasked ? '/api/v1/mission-control/v1-state?masked=true' : '/api/v1/mission-control/v1-state';
      const res = await fetch(url, {
        headers: getClientAuthHeaders(),
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.body || data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to refresh Mission Control V2 telemetry:', err);
    }
  }, [getClientAuthHeaders, isMasked]);

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 3000);
    return () => clearInterval(interval);
  }, [refreshTelemetry]);

  // Resolve HITL Approval
  const handleApproval = async (id, resolution) => {
    setResolvingId(id);
    try {
      const res = await fetch('/api/v1/mission-control/approvals', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ id, resolution, actor: 'Emanuel Rendas (Executive)' }),
      });
      if (res.ok) {
        await refreshTelemetry();
      }
    } catch (err) {
      console.error('Failed to resolve approval:', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Base64 helper
  const base64ToArrayBuffer = (base64) => {
    if (!base64) return new ArrayBuffer(0);
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // AudioContext unlocker singleton with 10ms micro-buffer
  const unlockAudioContext = async () => {
    const t0 = performance.now();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!window.voiceAudioCtx && AudioCtx) {
        window.voiceAudioCtx = new AudioCtx();
      }
      if (window.voiceAudioCtx && window.voiceAudioCtx.state === 'suspended') {
        await window.voiceAudioCtx.resume();
      }
      if (window.voiceAudioCtx) {
        try {
          const microBuffer = window.voiceAudioCtx.createBuffer(1, Math.max(1, Math.floor(window.voiceAudioCtx.sampleRate * 0.01)), window.voiceAudioCtx.sampleRate);
          const microSource = window.voiceAudioCtx.createBufferSource();
          microSource.buffer = microBuffer;
          microSource.connect(window.voiceAudioCtx.destination);
          microSource.start(0);
          microSource.stop(window.voiceAudioCtx.currentTime + 0.01);
        } catch (_) {}
      }
      audioContextRef.current = window.voiceAudioCtx;
      const latency = performance.now() - t0;
      console.log(`[VOICE_ENGINE:AUDIO_UNLOCK] AudioContext unlocked in ${latency.toFixed(2)}ms (state: ${window.voiceAudioCtx?.state})`);
      reportVoiceTelemetry('VOICE_AUDIOCONTEXT_UNLOCKED', { state: window.voiceAudioCtx?.state }, latency);
      return window.voiceAudioCtx;
    } catch (e) {
      console.warn('[VOICE_ENGINE:AUDIO_UNLOCK_WARN]', e);
      reportVoiceTelemetry('VOICE_AUDIOCONTEXT_SUSPENDED', { error: e.message });
      return null;
    }
  };

  // Natural voice speech synthesis fallback (Zero-Silence Guarantee)
  const speakNaturalVoiceFallback = (textToSpeak) => {
    if (playbackSafetyTimeoutRef.current) {
      clearTimeout(playbackSafetyTimeoutRef.current);
      playbackSafetyTimeoutRef.current = null;
    }
    const t0 = performance.now();
    console.log(`[VOICE_ENGINE:FALLBACK_TTS] Invoking SpeechSynthesis natural voice fallback: "${textToSpeak}"`);
    reportVoiceTelemetry('VOICE_FALLBACK_TRIGGERED', { text: textToSpeak });
    if (typeof window === 'undefined') return;

    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => (v.lang && (v.lang.includes('pt') || v.lang.includes('PT')))) || voices[0];
        if (ptVoice) utterance.voice = ptVoice;

        isBotSpeakingRef.current = true;
        setVoiceState('speaking');
        setVoiceTranscript(`[🔊 A TOCAR ÁUDIO] JARVIS: ${textToSpeak}`);

        utterance.onstart = () => {
          const lat = performance.now() - t0;
          console.log(`[VOICE_ENGINE:PLAYING] SpeechSynthesis audio started in ${lat.toFixed(2)}ms`);
          reportVoiceTelemetry('VOICE_PLAYBACK_STARTED', { mode: 'speech_synthesis' }, lat);
        };

        utterance.onend = () => {
          console.log('[VOICE_ENGINE:PLAYBACK_COMPLETE] SpeechSynthesis playback finished');
          isBotSpeakingRef.current = false;
          reportVoiceTelemetry('VOICE_PLAYBACK_FINISHED', { mode: 'speech_synthesis' });
          setVoiceState('listening');
          setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
          if (speechRecognizerRef.current) {
            try { speechRecognizerRef.current.start(); } catch (err) {}
          }
        };

        utterance.onerror = (e) => {
          console.warn('[VOICE_ENGINE:PLAYBACK_ERROR] SpeechSynthesis error:', e);
          reportVoiceTelemetry('VOICE_PLAYBACK_FAILED', { error: e.error || 'speech_synthesis_error' });
          isBotSpeakingRef.current = false;
          setVoiceState('listening');
          setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[VOICE_ENGINE:FALLBACK_FAIL]', err);
      }
    } else {
      isBotSpeakingRef.current = true;
      setVoiceState('speaking');
      setVoiceTranscript(`[🔊 A TOCAR ÁUDIO] JARVIS: ${textToSpeak}`);
      setTimeout(() => {
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
      }, 4000);
    }
  };

  // Dual-layer Neural Web Audio Player with 1.2s Safety Timer
  const playNeuralAudio = async (audioBase64, text, fallbackRequired = false) => {
    if (fallbackRequired || !audioBase64) {
      speakNaturalVoiceFallback(text);
      return;
    }

    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (e) {}
      activeAudioSourceRef.current = null;
    }

    let neuralStarted = false;
    if (playbackSafetyTimeoutRef.current) clearTimeout(playbackSafetyTimeoutRef.current);
    playbackSafetyTimeoutRef.current = setTimeout(() => {
      if (!neuralStarted) {
        console.warn('[VOICE_ENGINE:NEURAL_TIMEOUT] Neural audio playback exceeded 1.2s threshold, executing immediate SpeechSynthesis fallback.');
        reportVoiceTelemetry('VOICE_FALLBACK_TRIGGERED', { reason: 'neural_timeout_1200ms' });
        speakNaturalVoiceFallback(text);
      }
    }, 1200);

    const tStart = performance.now();
    try {
      const ctx = await unlockAudioContext();
      if (!ctx) {
        speakNaturalVoiceFallback(text);
        return;
      }

      const arrayBuffer = base64ToArrayBuffer(audioBase64);
      if (!arrayBuffer || arrayBuffer.byteLength < 32) {
        reportVoiceTelemetry('VOICE_DECODE_FAILED', { reason: 'invalid_buffer_length' });
        speakNaturalVoiceFallback(text);
        return;
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!audioBuffer || audioBuffer.duration < 0.1) {
        reportVoiceTelemetry('VOICE_DECODE_FAILED', { reason: 'empty_audio_duration' });
        speakNaturalVoiceFallback(text);
        return;
      }

      neuralStarted = true;
      if (playbackSafetyTimeoutRef.current) {
        clearTimeout(playbackSafetyTimeoutRef.current);
        playbackSafetyTimeoutRef.current = null;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      if (analyserRef.current) {
        source.connect(analyserRef.current);
      }
      source.connect(ctx.destination);

      isBotSpeakingRef.current = true;
      setVoiceState('speaking');
      setVoiceTranscript(`[🔊 A TOCAR ÁUDIO] JARVIS: ${text}`);
      const startLat = performance.now() - tStart;
      console.log(`[VOICE_ENGINE:NEURAL_PLAYING] Neural Web Audio active in ${startLat.toFixed(2)}ms (${audioBuffer.duration.toFixed(2)}s duration)`);
      reportVoiceTelemetry('VOICE_PLAYBACK_STARTED', { mode: 'neural_web_audio', duration: audioBuffer.duration }, startLat);

      source.onended = () => {
        console.log('[VOICE_ENGINE:PLAYBACK_COMPLETE] Neural Web Audio playback finished');
        isBotSpeakingRef.current = false;
        activeAudioSourceRef.current = null;
        reportVoiceTelemetry('VOICE_PLAYBACK_FINISHED', { mode: 'neural_web_audio' });
        setVoiceState('listening');
        setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
        if (speechRecognizerRef.current) {
          try { speechRecognizerRef.current.start(); } catch (err) {}
        }
      };

      source.start(0);
      activeAudioSourceRef.current = source;
    } catch (err) {
      console.warn('[VOICE_ENGINE:NEURAL_DECODE_FAIL] Neural decode failed, falling back:', err);
      reportVoiceTelemetry('VOICE_DECODE_FAILED', { error: err.message });
      speakNaturalVoiceFallback(text);
    }
  };

  // Sequential audio chunk player for continuous sub-250ms TTFA playback
  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      return;
    }
    isPlayingQueueRef.current = true;
    const chunk = audioQueueRef.current.shift();
    const ctx = await unlockAudioContext();
    if (!ctx) {
      isPlayingQueueRef.current = false;
      return;
    }

    try {
      const arrayBuffer = base64ToArrayBuffer(chunk.audioBase64);
      if (!arrayBuffer || arrayBuffer.byteLength < 32) {
        playNextChunk();
        return;
      }
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      if (analyserRef.current) source.connect(analyserRef.current);
      source.connect(ctx.destination);

      isBotSpeakingRef.current = true;
      setVoiceState('speaking');
      activeAudioSourceRef.current = source;

      source.onended = () => {
        activeAudioSourceRef.current = null;
        if (audioQueueRef.current.length > 0) {
          playNextChunk();
        } else {
          isPlayingQueueRef.current = false;
          isBotSpeakingRef.current = false;
          setVoiceState('listening');
          setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
        }
      };
      source.start(0);
    } catch (err) {
      console.warn('[VOICE_ENGINE:CHUNK_PLAY_FAIL]', err);
      playNextChunk();
    }
  };

  // Process voice directive to backend with Token-to-Chunk SSE Streaming
  const processVoiceDirective = async (text, options = {}) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (activeVoiceAbortControllerRef.current) {
      activeVoiceAbortControllerRef.current.abort();
    }
    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    if (activeVoiceStreamReaderRef.current) {
      try { activeVoiceStreamReaderRef.current.cancel(); } catch (_) {}
      activeVoiceStreamReaderRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    activeVoiceAbortControllerRef.current = new AbortController();

    const hasAudioPayload = Boolean(options.audio);
    setVoiceState('thinking');
    if (hasAudioPayload) {
      setVoiceTranscript('[🟡 A PENSAR / GEMINI] A processar áudio fiduciário...');
    } else {
      setVoiceTranscript(`[🧠 A PENSAR / GEMINI] A processar mandato: "${text}"...`);
    }

    // Record speech turn in history
    if (text) {
      voiceConversationHistoryRef.current.push({ role: 'user', text });
    } else {
      voiceConversationHistoryRef.current.push({ role: 'user', text: '[Diretiva de Voz Gravada]' });
    }
    if (voiceConversationHistoryRef.current.length > 20) {
      voiceConversationHistoryRef.current = voiceConversationHistoryRef.current.slice(-20);
    }

    console.log(`[VOICE_ENGINE:SSE_STREAM_SENT] Transmitting to /api/v1/voice/stream (turn ${voiceConversationHistoryRef.current.length}, audio: ${hasAudioPayload})...`);
    reportVoiceTelemetry('VOICE_DIRECTIVE_SENT', { hasAudio: hasAudioPayload, textLength: (text || '').length, historyCount: voiceConversationHistoryRef.current.length });

    const tReq = performance.now();
    let streamedFullText = '';

    try {
      setVoiceTranscript('[⚡ A SINTETIZAR] A iniciar streaming Token-to-Chunk...');
      const res = await fetch('/api/v1/voice/stream', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ 
          message: text || '',
          audio: options.audio || null,
          audioMimeType: options.audioMimeType || activeMediaRecorderMimeTypeRef.current,
          history: voiceConversationHistoryRef.current.slice(-10),
          locale: 'pt'
        }),
        signal: activeVoiceAbortControllerRef.current.signal,
      });

      if (res.status === 401) {
        reportVoiceTelemetry('VOICE_AUTH_FAILED', { status: 401 });
        throw new Error('AUTH_REQUIRED: Sessão expirada ou não autorizada');
      }

      if (res.ok && res.body && res.body.getReader) {
        const reader = res.body.getReader();
        activeVoiceStreamReaderRef.current = reader;
        const decoder = new TextDecoder('utf-8');
        let sseBuffer = '';
        let firstChunkReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const blocks = sseBuffer.split('\n\n');
          sseBuffer = blocks.pop();

          for (const block of blocks) {
            const eventMatch = block.match(/event:\s*([^\n]+)/);
            const dataMatch = block.match(/data:\s*([^\n]+)/);
            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1].trim();
            let eventData = {};
            try { eventData = JSON.parse(dataMatch[1].trim()); } catch (_) {}

            if (eventType === 'token' && eventData.text) {
              streamedFullText += eventData.text;
              setVoiceTranscript(`[🔊 A TOCAR ÁUDIO] JARVIS: ${streamedFullText}`);
            } else if (eventType === 'audio_chunk' && eventData.audioBase64) {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                const ttfa = performance.now() - tReq;
                console.log(`[VOICE_ENGINE:TTFA] First audio chunk received in ${ttfa.toFixed(2)}ms (Sub-250ms target)`);
                reportVoiceTelemetry('VOICE_TTFA_METRIC', { ttfaMs: ttfa, format: eventData.format });
              }
              audioQueueRef.current.push(eventData);
              if (!isPlayingQueueRef.current) {
                playNextChunk();
              }
            } else if (eventType === 'done') {
              const totalElapsed = performance.now() - tReq;
              console.log(`[VOICE_ENGINE:STREAM_DONE] SSE stream completed in ${totalElapsed.toFixed(2)}ms (${eventData.totalChunks} chunks)`);
              reportVoiceTelemetry('VOICE_STREAM_COMPLETED', { totalMs: totalElapsed, chunks: eventData.totalChunks });
              if (!firstChunkReceived && streamedFullText) {
                speakNaturalVoiceFallback(streamedFullText.trim());
              }
            }
          }
        }

        if (streamedFullText) {
          voiceConversationHistoryRef.current.push({ role: 'model', text: streamedFullText.trim() });
          if (voiceConversationHistoryRef.current.length > 20) {
            voiceConversationHistoryRef.current = voiceConversationHistoryRef.current.slice(-20);
          }
        }
      } else {
        const data = await res.json();
        const reply = data.text || 'Aviso: Sem ligação ativa à API do Gemini.';
        voiceConversationHistoryRef.current.push({ role: 'model', text: reply });
        if (data.audioBase64 && !data.fallbackRequired) {
          await playNeuralAudio(data.audioBase64, reply, false);
        } else {
          speakNaturalVoiceFallback(reply);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[VOICE_ENGINE:BARGE_IN_ABORT] Voice dispatch aborted via barge-in.');
        reportVoiceTelemetry('VOICE_BARGE_IN_TRIGGERED');
        return;
      }
      console.warn('[VOICE_ENGINE:STREAM_FAIL] Stream error, switching to natural fallback:', err);
      reportVoiceTelemetry('VOICE_REQUEST_FAILED', { error: err.message });
      const fallbackText = 'Aviso: Sem ligação ativa à API do Gemini.';
      voiceConversationHistoryRef.current.push({ role: 'model', text: fallbackText });
      speakNaturalVoiceFallback(fallbackText);
    } finally {
      activeVoiceAbortControllerRef.current = null;
      activeVoiceStreamReaderRef.current = null;
    }
  };

  // Audible Zero-Silence Speech Synthesis & Neural Audio Playback
  const speakNaturalVoiceFallback = (spokenText) => {
    if (!spokenText || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'pt-PT';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      isBotSpeakingRef.current = true;
      setVoiceState('speaking');

      utterance.onstart = () => {
        isBotSpeakingRef.current = true;
        setVoiceState('speaking');
      };
      utterance.onend = () => {
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
      };
      utterance.onerror = (e) => {
        console.warn('[VOICE_ENGINE:SPEECH_SYNTHESIS_ERROR]', e);
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
      };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[VOICE_ENGINE:FALLBACK_SYNTHESIS_FAIL]', err);
    }
  };

  const playNeuralAudio = async (audioBase64, spokenText, isStreaming = false) => {
    if (!audioBase64 || audioBase64.length < 50) {
      speakNaturalVoiceFallback(spokenText);
      return;
    }

    const ctx = await unlockAudioContext();
    if (!ctx) {
      speakNaturalVoiceFallback(spokenText);
      return;
    }

    try {
      const arrayBuffer = base64ToArrayBuffer(audioBase64);
      if (!arrayBuffer || arrayBuffer.byteLength < 32) {
        speakNaturalVoiceFallback(spokenText);
        return;
      }
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      if (analyserRef.current) source.connect(analyserRef.current);
      source.connect(ctx.destination);

      isBotSpeakingRef.current = true;
      setVoiceState('speaking');
      activeAudioSourceRef.current = source;

      source.onended = () => {
        activeAudioSourceRef.current = null;
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
      };
      source.start(0);
    } catch (err) {
      console.warn('[VOICE_ENGINE:PLAY_NEURAL_FAIL] Decoding failed, falling back to speech synthesis:', err);
      speakNaturalVoiceFallback(spokenText);
    }
  };

  // Barge-in (Interrupção imediata de áudio e rede quando o utilizador começa a falar)
  const handleVoiceBargeIn = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    isRecordingSpeechRef.current = false;
    recordedAudioChunksRef.current = [];
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (playbackSafetyTimeoutRef.current) {
      clearTimeout(playbackSafetyTimeoutRef.current);
      playbackSafetyTimeoutRef.current = null;
    }
    if (activeVoiceAbortControllerRef.current) {
      activeVoiceAbortControllerRef.current.abort();
      activeVoiceAbortControllerRef.current = null;
    }
    if (activeVoiceStreamReaderRef.current) {
      try { activeVoiceStreamReaderRef.current.cancel(); } catch (_) {}
      activeVoiceStreamReaderRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    if (isBotSpeakingRef.current) {
      isBotSpeakingRef.current = false;
      reportVoiceTelemetry('VOICE_BARGE_IN_TRIGGERED');
      setVoiceState('listening');
      setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
    }
  };

  // Live Voice Session Controls (ChatGPT / Gemini Live style)
  const startLiveVoiceSession = async () => {
    console.log('[VOICE_ENGINE:INIT] Live Voice Session Initiated');
    reportVoiceTelemetry('VOICE_SESSION_OPENED');
    setLiveVoiceOpen(true);
    setVoiceState('listening');
    setVoiceTranscript('[🎙️ MIC: ATIVO] Pode falar agora... (A escutar)');

    try {
      const ctx = await unlockAudioContext();
      if (ctx) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
            console.warn('[VOICE_ENGINE:MIC_WARN] Microphone permission not granted:', err);
            reportVoiceTelemetry('VOICE_MIC_DENIED', { error: err.name || err.message });
            setVoiceTranscript('[⚠️ MICROFONE BLOQUEADO NO NAVEGADOR] Ative o microfone nas permissões do browser ou envie mensagens por texto abaixo.');
            return null;
          });
          if (stream) {
            micStreamRef.current = stream;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            reportVoiceTelemetry('VOICE_MIC_CONNECTED');

            // Setup MediaRecorder Direct Audio Pipeline
            if (window.MediaRecorder) {
              if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                activeMediaRecorderMimeTypeRef.current = 'audio/webm;codecs=opus';
              } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                activeMediaRecorderMimeTypeRef.current = 'audio/mp4';
              } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                activeMediaRecorderMimeTypeRef.current = 'audio/webm';
              }

              try {
                const rec = new MediaRecorder(stream, { mimeType: activeMediaRecorderMimeTypeRef.current });
                rec.ondataavailable = (e) => {
                  if (e.data && e.data.size > 0) {
                    recordedAudioChunksRef.current.push(e.data);
                  }
                };
                rec.onstop = () => {
                  if (recordedAudioChunksRef.current.length === 0) return;
                  const audioBlob = new Blob(recordedAudioChunksRef.current, { type: activeMediaRecorderMimeTypeRef.current });
                  recordedAudioChunksRef.current = [];
                  if (audioBlob.size < 350) return;

                  const fileReader = new FileReader();
                  fileReader.onloadend = () => {
                    const base64Audio = fileReader.result;
                    processVoiceDirective('', { audio: base64Audio, audioMimeType: activeMediaRecorderMimeTypeRef.current });
                  };
                  fileReader.readAsDataURL(audioBlob);
                };
                mediaRecorderRef.current = rec;
                console.log(`[VOICE_ENGINE:MEDIA_RECORDER] Initialized direct MediaRecorder stream (${activeMediaRecorderMimeTypeRef.current})`);
                reportVoiceTelemetry('VOICE_MEDIA_RECORDER_INITIALIZED', { mimeType: activeMediaRecorderMimeTypeRef.current });
              } catch (recErr) {
                console.warn('[VOICE_ENGINE:MEDIA_RECORDER_WARN] Failed to initialize MediaRecorder:', recErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[VOICE_ENGINE:INIT_ERROR] Voice init warning:', err);
      reportVoiceTelemetry('VOICE_INIT_FAILED', { error: err.message });
    }
  };

  const stopLiveVoiceSession = () => {
    setLiveVoiceOpen(false);
    reportVoiceTelemetry('VOICE_SESSION_CLOSED');
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (playbackSafetyTimeoutRef.current) {
      clearTimeout(playbackSafetyTimeoutRef.current);
      playbackSafetyTimeoutRef.current = null;
    }
    if (activeVoiceAbortControllerRef.current) {
      activeVoiceAbortControllerRef.current.abort();
      activeVoiceAbortControllerRef.current = null;
    }
    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    accumulatedTextRef.current = '';

    isBotSpeakingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
      mediaRecorderRef.current = null;
    }
    if (speechRecognizerRef.current) {
      try { speechRecognizerRef.current.stop(); } catch (e) {}
      speechRecognizerRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const triggerSamplePrompt = (promptText) => {
    if (!promptText) return;
    unlockAudioContext();
    handleVoiceBargeIn();
    processVoiceDirective(promptText);
  };

  const handleManualVoiceSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    unlockAudioContext();
    if (!manualVoiceInput.trim()) return;
    const text = manualVoiceInput.trim();
    setManualVoiceInput('');
    handleVoiceBargeIn();
    processVoiceDirective(text);
  };

  // Canvas Fluid Orb Animation Loop with Real-Time RMS VAD
  useEffect(() => {
    if (!liveVoiceOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let t = 0;
    const dataArray = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 64);

    const render = () => {
      t += 0.035;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let audioVolume = 0;
      let rmsEnergy = 0;
      try {
        if (analyserRef.current && !isMicMuted) {
          const freqData = dataArray || new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < freqData.length; i++) sum += freqData[i];
          audioVolume = sum / (freqData.length * 255);
          if (typeof calculateMicRmsEnergy === 'function') {
            rmsEnergy = calculateMicRmsEnergy(analyserRef.current, freqData);
          }
        } else {
          audioVolume = (Math.sin(t * 1.5) + 1) * 0.05;
          if (voiceState === 'speaking') {
            audioVolume = (Math.sin(t * 8) + Math.cos(t * 12) + 2) * 0.22;
          }
        }
      } catch (_) {
        audioVolume = (Math.sin(t * 1.5) + 1) * 0.05;
        rmsEnergy = 0;
      }

      // Real-Time Continuous Voice Activity Detection (VAD) via RMS
      if (liveVoiceOpen && !isBotSpeakingRef.current && voiceState === 'listening' && !isMicMuted) {
        if (rmsEnergy > 0.038) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (!isRecordingSpeechRef.current) {
            isRecordingSpeechRef.current = true;
            speechStartTimeRef.current = performance.now();
            recordedAudioChunksRef.current = [];
            setVoiceTranscript('[🎙️ A GRAVAR VOZ] A captar diretiva...');
            try {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                mediaRecorderRef.current.start(100);
              }
            } catch (_) {}
          }
        } else if (isRecordingSpeechRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              const speechDuration = performance.now() - speechStartTimeRef.current;
              isRecordingSpeechRef.current = false;
              silenceTimerRef.current = null;
              if (speechDuration >= 250) {
                setVoiceState('thinking');
                setVoiceTranscript('[🟡 A PENSAR / GEMINI] A processar áudio fiduciário...');
                try {
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                  }
                } catch (_) {}
              } else {
                recordedAudioChunksRef.current = [];
                try {
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                  }
                } catch (_) {}
                setVoiceTranscript('[🎙️ PRONTO] Pode falar agora... (A escutar)');
              }
            }, 600);
          }
        }
      }

      if (isBotSpeakingRef.current && (audioVolume > 0.35 || rmsEnergy > 0.08)) {
        handleVoiceBargeIn();
      }

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = 65 + (audioVolume * 55);

      let c1, c2, c3, auraColor;
      if (voiceState === 'listening') {
        c1 = `rgba(56, 189, 248, ${0.85 + audioVolume * 0.15})`;
        c2 = `rgba(14, 165, 233, ${0.65 + audioVolume * 0.25})`;
        c3 = `rgba(250, 204, 21, ${0.45 + audioVolume * 0.3})`;
        auraColor = `rgba(56, 189, 248, ${0.15 + audioVolume * 0.35})`;
      } else if (voiceState === 'thinking') {
        c1 = `rgba(245, 158, 11, ${0.9 + Math.sin(t * 4) * 0.1})`;
        c2 = `rgba(217, 119, 6, 0.75)`;
        c3 = `rgba(192, 132, 252, 0.65)`;
        auraColor = `rgba(245, 158, 11, ${0.25 + Math.sin(t * 3) * 0.15})`;
      } else {
        c1 = `rgba(16, 185, 129, ${0.9 + audioVolume * 0.1})`;
        c2 = `rgba(52, 211, 153, ${0.75 + audioVolume * 0.2})`;
        c3 = `rgba(253, 224, 71, ${0.85 + audioVolume * 0.15})`;
        auraColor = `rgba(16, 185, 129, ${0.28 + audioVolume * 0.4})`;
      }

      // Outer Aura
      const auraGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, baseRadius * 1.8);
      auraGrad.addColorStop(0, auraColor);
      auraGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Fluid Blobs
      const points = 48;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const harmonic1 = Math.sin(angle * 3 + t * 2) * (12 + audioVolume * 30);
        const harmonic2 = Math.cos(angle * 5 - t * 2.5) * (8 + audioVolume * 20);
        const r = baseRadius + harmonic1 + harmonic2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const fluidGrad = ctx.createRadialGradient(cx - baseRadius * 0.3, cy - baseRadius * 0.3, 10, cx, cy, baseRadius * 1.3);
      fluidGrad.addColorStop(0, c3);
      fluidGrad.addColorStop(0.45, c1);
      fluidGrad.addColorStop(1, c2);
      ctx.fillStyle = fluidGrad;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 30 + audioVolume * 35;
      ctx.fill();
      ctx.restore();

      // Core Highlight
      const coreGrad = ctx.createRadialGradient(cx - 12, cy - 12, 2, cx, cy, baseRadius * 0.4);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx - 12, cy - 12, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [liveVoiceOpen, voiceState, isMicMuted]);

  // Submit Copilot Prompt
  const handleCopilotSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!copilotPrompt.trim()) return;

    setCopilotLoading(true);
    try {
      const res = await fetch('/api/v1/cognitive/dispatch', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ prompt: copilotPrompt }),
      });
      const data = await res.json();
      alert(`JARVIS Consensus Response:\n\n${data.text || JSON.stringify(data)}`);
      setCopilotPrompt('');
      await refreshTelemetry();
    } catch (err) {
      alert(`Copilot Error: ${err.message}`);
    } finally {
      setCopilotLoading(false);
    }
  };

  const CANONICAL_12_AGENTS = [
    { id: 'jarvis_executive_brain', name: 'JARVIS', role: 'Chief Autonomous Orchestration Agent & Executive Brain', live_status: 'ACTIVE', last_latency_ms: 12, tokens_consumed_total: 48200, compute_cost_usd: 0.0425, active_task: 'Orchestrating multi-agent consensus & executive directives' },
    { id: 'mark_lead_triage', name: 'MARK', role: 'Lead Triage, OCR & Risk Intelligence Specialist', live_status: 'ACTIVE', last_latency_ms: 15, tokens_consumed_total: 31200, compute_cost_usd: 0.0182, active_task: 'Triage incoming sovereign investor mandates & OCR documents' },
    { id: 'atlas_opal_calculator', name: 'ATLAS', role: 'Opal ROI Engine & Real Estate Modeling Specialist', live_status: 'ACTIVE', last_latency_ms: 18, tokens_consumed_total: 24500, compute_cost_usd: 0.0128, active_task: 'Underwriting Palm Jebel Ali & Dubai South tranches' },
    { id: 'lex_compliance_legal', name: 'LEX', role: 'Escrow Law 8 & Statutory Compliance Specialist', live_status: 'ACTIVE', last_latency_ms: 14, tokens_consumed_total: 19800, compute_cost_usd: 0.0084, active_task: 'Validating Dubai Law No. 8/2007 Escrow compliance' },
    { id: 'hermes_crm_pipeline', name: 'HERMES', role: 'CRM & Pipeline Management Specialist', live_status: 'ACTIVE', last_latency_ms: 16, tokens_consumed_total: 22100, compute_cost_usd: 0.0112, active_task: 'Synchronizing investor records & lifecycle triggers' },
    { id: 'helios_calendar_scheduler', name: 'HELIOS', role: 'Advisory Calendar & Scheduling Specialist', live_status: 'ACTIVE', last_latency_ms: 11, tokens_consumed_total: 15400, compute_cost_usd: 0.0095, active_task: 'Managing private advisory sessions & timezone alignment' },
    { id: 'sentinel_devops_qa', name: 'SENTINEL', role: 'Watchdog, Recovery & System Guardian', live_status: 'ACTIVE', last_latency_ms: 9, tokens_consumed_total: 12400, compute_cost_usd: 0.0059, active_task: 'Monitoring mesh health, memory RSS & circuit breakers' },
    { id: 'brand_content_theses', name: 'BRAND', role: 'Institutional Content Strategy & Brand Specialist', live_status: 'ACTIVE', last_latency_ms: 20, tokens_consumed_total: 28900, compute_cost_usd: 0.0143, active_task: 'Publishing macroeconomic theses & corridor benchmarks' },
    { id: 'engage_social_compliance', name: 'ENGAGE', role: 'Social Engagement & Statutory Compliance Watchdog', live_status: 'ACTIVE', last_latency_ms: 17, tokens_consumed_total: 18700, compute_cost_usd: 0.0101, active_task: 'Auditing social interactions & sentiment safety' },
    { id: 'dm_conversion_inbound', name: 'DM_CONVERSION', role: 'Inbound Direct Message Conversion Specialist', live_status: 'ACTIVE', last_latency_ms: 19, tokens_consumed_total: 33400, compute_cost_usd: 0.0167, active_task: 'Converting high-intent inbound WhatsApp/Telegram DMs' },
    { id: 'social_analytics_telemetry', name: 'SOCIAL_ANALYTICS', role: 'Social Growth & Telemetry Mesh Specialist', live_status: 'ACTIVE', last_latency_ms: 13, tokens_consumed_total: 14200, compute_cost_usd: 0.0078, active_task: 'Compiling audience graphs & growth telemetry' },
    { id: 'aida_flow_mixboard', name: 'AIDA', role: 'Client Relations, Voice AI & Outreach Specialist', live_status: 'ACTIVE', last_latency_ms: 22, tokens_consumed_total: 41200, compute_cost_usd: 0.0241, active_task: 'Synthesizing fiduciary ElevenLabs voice notes & teasers' },
  ];

  const health = state?.healthBar || {
    systemHealthPct: 99.98,
    totalPipelineAed: 207000000,
    activeLeadsCount: 10,
    pendingApprovalsCount: 0,
    errorRate5m: 0.0,
    activeWorkflowsCount: 8,
    closedWonAed: 68500000,
  };

  const fleet = (state?.agentFleet && state.agentFleet.length >= 6) ? state.agentFleet : CANONICAL_12_AGENTS;
  const approvals = state?.approvalsQueue || [];
  const pipeline = state?.crmPipeline || { stages: [] };
  const pulse = state?.ingestionPulse || [];
  const infra = state?.infrastructure || {};

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans flex flex-col antialiased selection:bg-amber-500 selection:text-black">
      {/* Top Header & World Clocks */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md px-6 py-3 border-b border-amber-500/20 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/25 border border-amber-300/40">
            R
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
              RAIOC MISSION CONTROL
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40 font-bold">V2 SOVEREIGN</span>
            </h1>
            <p className="text-[11px] text-gray-400">Autonomous Real Estate Intelligence & Multi-Agent Operations Mesh</p>
          </div>
        </div>

        {/* Live World Clocks */}
        <div className="hidden xl:flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-gray-400 text-[11px]">DXB (UTC+4):</span>
            <span className="text-amber-300 font-bold">{clocks.dxb}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">LON (UTC+0):</span>
            <span className="text-gray-200">{clocks.lon}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">LIS (UTC+0):</span>
            <span className="text-gray-200">{clocks.lis}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">NYC (UTC-5):</span>
            <span className="text-gray-200">{clocks.nyc}</span>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center space-x-2.5 text-xs font-mono">
          {/* Live Voice Button (ChatGPT / Gemini Live style) */}
          <button
            onClick={startLiveVoiceSession}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500/20 via-amber-500/20 to-sky-500/20 hover:from-sky-500/30 hover:to-amber-500/30 border border-sky-400/40 text-xs font-mono text-sky-200 hover:text-white transition-all flex items-center gap-2 shadow-lg shadow-sky-500/10 group cursor-pointer"
            title="Start Live Voice Session (ChatGPT / Gemini Live style)"
          >
            <span className="flex items-center gap-0.5 h-3.5 px-0.5">
              <span className="w-0.5 h-2 bg-sky-400 group-hover:h-3.5 transition-all rounded-full animate-pulse"></span>
              <span className="w-0.5 h-3.5 bg-amber-400 rounded-full animate-pulse"></span>
              <span className="w-0.5 h-2 bg-sky-400 group-hover:h-3 transition-all rounded-full animate-pulse"></span>
            </span>
            <span className="font-bold text-[11px] tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-amber-200 to-sky-300">LIVE VOICE</span>
          </button>

          <button
            onClick={() => setIsMasked(!isMasked)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-amber-400 hover:text-white transition-all"
          >
            {isMasked ? 'WALL-SCREEN (MASKED)' : 'FULL EXECUTIVE'}
          </button>
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-bold text-[11px]">LIVE ({lastUpdated})</span>
          </div>
        </div>
      </header>

      {/* Modular Navigation Tabs */}
      <nav className="bg-slate-950/60 backdrop-blur-md px-6 py-2 border-b border-amber-500/10 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            ⚡ EXECUTIVE OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'crm'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            💼 CRM PIPELINE ({health.activeLeadsCount || 10})
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'fleet'
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            🤖 AGENT FLEET MATRIX ({fleet.length || 12})
          </button>
          <button
            onClick={() => setActiveTab('pulse')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'pulse'
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            📡 INGESTION PULSE FEED
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'approvals'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            🛡️ APPROVALS ({health.pendingApprovalsCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('infra')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'infra'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            ⚙️ INFRASTRUCTURE & BREAKERS
          </button>
        </div>

        <div className="text-[11px] font-mono text-gray-400">
          AUTONOMOUS HORIZON: <strong className="text-emerald-400">OPTIMAL</strong>
        </div>
      </nav>

      {/* Main Viewport Container */}
      <main className="flex-1 p-6 space-y-6 max-w-[1920px] mx-auto w-full">
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">SYSTEM HEALTH</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{health.systemHealthPct}%</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">ACTIVE PIPELINE</div>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  AED {((health.totalPipelineAed || 0) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">CLOSED WON</div>
                <div className="text-2xl font-bold font-mono text-yellow-300 mt-1">
                  AED {((health.closedWonAed || 68500000) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">ACTIVE MANDATES</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{health.activeLeadsCount || 10} Active</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">HITL APPROVALS</div>
                <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{health.pendingApprovalsCount || 0} Pending</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">5M ERROR RATE</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{(health.errorRate5m || 0).toFixed(2)}%</div>
              </div>
            </div>

            {/* Overview Multi-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Fleet Matrix Column */}
              <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
                <h2 className="text-xs font-bold font-mono uppercase text-white border-b border-white/10 pb-3 flex justify-between">
                  <span>Agent Fleet Telemetry</span>
                  <span className="text-sky-300">{fleet.length || 12} Specialist Agents</span>
                </h2>
                <div className="space-y-3">
                  {fleet.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-sky-500/50 cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-white">{agent.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {agent.live_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 font-mono truncate">{agent.active_task || agent.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRM Snapshot Column */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
                <h2 className="text-xs font-bold font-mono uppercase text-white border-b border-white/10 pb-3 flex justify-between">
                  <span>Active CRM Mandates</span>
                  <button onClick={() => setActiveTab('crm')} className="text-amber-400 hover:underline">
                    Kanban Board →
                  </button>
                </h2>
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto">
                  {(pipeline.stages || []).flatMap((s) => s.deals || []).slice(0, 8).map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedLead(deal)}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white">{deal.name}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{deal.targetAsset}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">AED {((deal.budgetAed || 0) / 1000000).toFixed(1)}M</div>
                        <div className="text-[10px] text-emerald-400">DIRA {deal.diraScore || 90}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copilot & Pulse Column */}
              <div className="lg:col-span-3 space-y-6">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-3">
                  <h3 className="text-xs font-bold font-mono uppercase text-amber-300">JARVIS Executive Directive</h3>
                  <form onSubmit={handleCopilotSubmit} className="space-y-3">
                    <textarea
                      value={copilotPrompt}
                      onChange={(e) => setCopilotPrompt(e.target.value)}
                      rows={3}
                      placeholder="Issue autonomous multi-agent directive..."
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={startLiveVoiceSession}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500/20 via-amber-500/20 to-sky-500/20 hover:from-sky-500/30 hover:to-amber-500/30 border border-sky-400/40 text-xs font-mono text-sky-200 hover:text-white transition-all flex items-center gap-2 shadow-lg shadow-sky-500/10 group cursor-pointer"
                        title="Start Live Voice Orb (ChatGPT / Gemini Live style)"
                      >
                        <span className="flex items-center gap-0.5 h-3 px-0.5">
                          <span className="w-0.5 h-2 bg-sky-400 group-hover:h-3 transition-all rounded-full animate-pulse"></span>
                          <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-pulse"></span>
                          <span className="w-0.5 h-1.5 bg-sky-400 rounded-full animate-pulse"></span>
                        </span>
                        <span className="font-bold text-[11px] text-sky-300">Live Voice</span>
                      </button>
                      <button
                        type="submit"
                        disabled={copilotLoading}
                        className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold font-mono rounded-xl transition-all shadow-lg shadow-amber-500/20"
                      >
                        {copilotLoading ? 'ORCHESTRATING...' : 'TRANSMIT DIRECTIVE'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FULL CRM KANBAN */}
        {activeTab === 'crm' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white font-mono uppercase">Sovereign CRM Kanban Pipeline</h2>
                <p className="text-xs text-gray-400 font-mono">Real-time investor lifecycle management & DIRA risk profiling.</p>
              </div>
              <div className="text-xs font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-gray-400">CORRIDOR: </span>
                <select
                  value={corridorFilter}
                  onChange={(e) => setCorridorFilter(e.target.value)}
                  className="bg-transparent text-amber-300 font-bold focus:outline-none"
                >
                  <option value="ALL">ALL CORRIDORS</option>
                  <option value="Palm Jumeirah">PALM JUMEIRAH</option>
                  <option value="Dubai Creek Harbour">DUBAI CREEK HARBOUR</option>
                  <option value="DIFC">DIFC / DOWNTOWN</option>
                  <option value="Dubai Hills Estate">DUBAI HILLS ESTATE</option>
                  <option value="Palm Jebel Ali">PALM JEBEL ALI</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 min-h-[600px]">
              {(pipeline.stages || []).map((stage) => {
                const deals = corridorFilter === 'ALL'
                  ? stage.deals || []
                  : (stage.deals || []).filter((d) => (d.targetAsset || '').toLowerCase().includes(corridorFilter.toLowerCase()));

                return (
                  <div key={stage.id} className="bg-black/40 rounded-xl border border-white/10 p-3 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-bold font-mono text-gray-200">{stage.name}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-gray-300 font-bold">
                        {deals.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[580px]">
                      {deals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedLead(deal)}
                          className="p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="flex justify-between font-mono text-xs">
                            <span className="font-bold text-white truncate max-w-[120px]">{deal.name}</span>
                            <span className="text-amber-400 font-bold">AED {((deal.budgetAed || 0) / 1000000).toFixed(1)}M</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{deal.targetAsset}</p>
                          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-white/5">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              DIRA {deal.diraScore || 90}
                            </span>
                            <span className="text-gray-500">{deal.preferredChannel || 'TELEGRAM'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: AGENT FLEET MATRIX */}
        {activeTab === 'fleet' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-6">
            <h2 className="text-base font-bold text-white font-mono uppercase border-b border-white/10 pb-4">
              Autonomous Specialist Fleet Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fleet.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="p-5 rounded-2xl bg-black/40 border border-white/10 hover:border-sky-500/50 cursor-pointer transition-all space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold font-mono text-white">{agent.name}</h3>
                      <p className="text-[11px] text-gray-400 font-mono">{agent.role}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                      {agent.live_status}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono text-gray-300 truncate">
                    {agent.active_task || 'Autonomous monitoring active'}
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center">
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">LATENCY</span>
                      <span className="text-amber-300 font-bold">{agent.last_latency_ms || 15}ms</span>
                    </div>
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">TOKENS</span>
                      <span className="text-gray-200 font-bold">{(agent.tokens_consumed_total || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">COST</span>
                      <span className="text-yellow-400 font-bold">${(agent.compute_cost_usd || 0).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: INGESTION PULSE */}
        {activeTab === 'pulse' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white font-mono uppercase">Multi-Channel Ingestion Pulse Feed</h2>
              <div className="flex gap-2 text-xs font-mono">
                {['ALL', 'TELEGRAM', 'WHATSAPP', 'DOCUMENT_OCR', 'VOICE_DISPATCH', 'WEBSITE'].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setPulseFilter(ch)}
                    className={`px-2.5 py-1 rounded-lg border transition-all ${
                      pulseFilter === ch ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-black/40 border-white/10 text-gray-400'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-black/60 text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">CHANNEL</th>
                    <th className="p-3">EVENT TYPE</th>
                    <th className="p-3">SENDER</th>
                    <th className="p-3">SUMMARY</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(pulseFilter === 'ALL' ? pulse : pulse.filter((p) => p.channel === pulseFilter)).map((log) => (
                    <tr key={log.id} onClick={() => setSelectedEvent(log)} className="hover:bg-white/5 cursor-pointer">
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300">{log.channel}</span></td>
                      <td className="p-3 text-gray-200 font-bold">{log.event_type}</td>
                      <td className="p-3 text-gray-300">{log.sender || 'Inbound'}</td>
                      <td className="p-3 text-gray-400 max-w-md truncate">{log.summary}</td>
                      <td className="p-3 text-right text-amber-400 hover:underline">Inspect JSON →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: HITL APPROVALS */}
        {activeTab === 'approvals' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <h2 className="text-base font-bold text-white font-mono uppercase border-b border-white/10 pb-4">
              Executive HITL Approvals Queue
            </h2>
            <div className="space-y-3">
              {approvals.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-gray-500">Zero pending HITL approvals. Autonomous horizon is clear.</div>
              ) : (
                approvals.map((appr) => (
                  <div key={appr.id} className="p-5 rounded-2xl bg-black/40 border border-rose-500/30 space-y-3">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-sm font-bold text-white">{appr.title}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        {appr.priority || 'HIGH'} PRIORITY
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-300">{appr.payload_summary || JSON.stringify(appr.payload)}</p>
                    <div className="flex justify-end space-x-3 pt-2 font-mono text-xs">
                      <button
                        onClick={() => handleApproval(appr.id, 'REJECTED')}
                        disabled={resolvingId === appr.id}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"
                      >
                        REJECT
                      </button>
                      <button
                        onClick={() => handleApproval(appr.id, 'APPROVED')}
                        disabled={resolvingId === appr.id}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold"
                      >
                        {resolvingId === appr.id ? 'EXECUTING...' : 'APPROVE & EXECUTE →'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: INFRASTRUCTURE */}
        {activeTab === 'infra' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
              <h2 className="text-sm font-bold font-mono text-white border-b border-white/10 pb-3">Core Sovereign Infrastructure</h2>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                  <div>
                    <strong className="text-white">Supabase PostgreSQL & Realtime</strong>
                    <div className="text-[10px] text-gray-400">RLS Active • Append-Only Trigger Enforced</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">{infra.supabase?.status || 'CONNECTED'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                  <div>
                    <strong className="text-white">Enterprise Event Bus v1.1</strong>
                    <div className="text-[10px] text-gray-400">CloudEvent v1.1 Standard • Zero Queue Latency</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">{infra.eventBus?.status || 'ACTIVE'}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
              <h2 className="text-sm font-bold font-mono text-white border-b border-white/10 pb-3">Circuit Breakers Matrix</h2>
              <div className="space-y-3 font-mono text-xs">
                {(infra.circuitBreakers || [
                  { name: 'google_ai_studio', status: 'CLOSED' },
                  { name: 'vertex_ai_enterprise', status: 'CLOSED' },
                  { name: 'elevenlabs_enterprise', status: 'CLOSED' },
                  { name: 'whatsapp_cloud_api', status: 'CLOSED' },
                  { name: 'telegram_bot_api', status: 'CLOSED' },
                ]).map((b) => (
                  <div key={b.name} className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                    <strong className="text-white">{b.name}</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">CIRCUIT {b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-Over Drawer: Agent Detail */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedAgent(null)}></div>
          <div className="relative w-full max-w-md bg-slate-950 border-l border-amber-500/30 p-6 space-y-6 shadow-2xl z-10 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono">{selectedAgent.name}</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedAgent.role}</p>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-white font-mono">✕</button>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 font-mono text-xs">
              <div className="text-gray-400 text-[10px]">SYSTEM DIRECTIVES</div>
              <p className="text-gray-300 leading-relaxed">{selectedAgent.systemPrompt || 'Autonomous specialist operations executing under JARVIS executive brain oversight.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lead Dossier */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedLead(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-950 border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-2xl z-10 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedLead.name}</h3>
                <p className="text-[11px] text-gray-400">{selectedLead.company} • {selectedLead.country}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <span className="text-gray-500 block text-[10px]">ALLOCATION BUDGET</span>
                <span className="text-amber-400 font-bold text-sm">AED {((selectedLead.budgetAed || 0) / 1000000).toFixed(1)}M</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <span className="text-gray-500 block text-[10px]">DIRA RISK SCORE</span>
                <span className="text-emerald-400 font-bold text-sm">{selectedLead.diraScore || 90} / 100</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/10">
              <span className="text-gray-500 block text-[10px]">TARGET ASSET & THESIS</span>
              <span className="text-gray-200">{selectedLead.targetAsset}</span>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => { alert('Voice synthesis requested!'); setSelectedLead(null); }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold rounded-lg"
              >
                GENERATE AIDA VOICE NOTE →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event JSON Inspector */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-950 border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-2xl z-10 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase">Event Payload Inspector</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <pre className="p-4 bg-black/80 rounded-xl border border-white/10 text-[11px] text-gray-200 overflow-x-auto max-h-80">
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Modal: Live Voice Conversation Orb (ChatGPT / Gemini Live style) */}
      {liveVoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#030712]/92 backdrop-blur-2xl transition-opacity" onClick={stopLiveVoiceSession}></div>
          <div className="relative w-full max-w-lg bg-[#030712]/95 border border-sky-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl z-10 flex flex-col items-center text-center overflow-hidden">
            {/* Close button */}
            <button
              onClick={stopLiveVoiceSession}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Close Live Voice (Esc)"
            >
              ✕
            </button>

            {/* Top Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              <span className="font-bold">
                {voiceState === 'listening' ? 'JARVIS LIVE VOICE (A OUVIR)' : voiceState === 'thinking' ? 'JARVIS LIVE VOICE (A PROCESSAR)' : 'JARVIS LIVE VOICE (TRANSMISSÃO)'}
              </span>
            </div>

            {/* Canvas Orb */}
            <div className="relative w-[300px] h-[300px] flex items-center justify-center my-2">
              <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />
            </div>

            {/* State Label & Transcript */}
            <div className="space-y-2 max-w-md w-full">
              <div className="text-sm font-mono font-bold text-sky-300 tracking-wider uppercase flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full ${voiceState === 'listening' ? 'bg-sky-400' : voiceState === 'thinking' ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`}></span>
                <span>
                  {voiceState === 'listening' ? '🎙️ Pode falar agora... (A escutar)' : voiceState === 'thinking' ? '🧠 A Pensar... (A sintetizar)' : '🔊 JARVIS a Falar...'}
                </span>
              </div>
              <div className="min-h-[56px] max-h-[96px] overflow-y-auto text-xs font-mono text-gray-200 bg-black/60 p-3 rounded-2xl border border-white/10 leading-relaxed shadow-inner">
                {voiceTranscript}
              </div>
            </div>

            {/* Quick Real Estate Sovereign Prompts (One-Tap Voice Triggers) */}
            <div className="w-full max-w-md space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
                <button
                  onClick={() => triggerSamplePrompt('Qual é a yield líquida do Como Residences em Palm Jumeirah?')}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 transition-all cursor-pointer"
                >
                  🌊 Yield Como Residences
                </button>
                <button
                  onClick={() => triggerSamplePrompt('Explica a escassez e tickets de Palm Jebel Ali com os 110km de costa.')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-all cursor-pointer"
                >
                  🏝️ Palm Jebel Ali 110km
                </button>
                <button
                  onClick={() => triggerSamplePrompt('Qual o impacto do aeroporto Al Maktoum de 128B em Dubai South DWC?')}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 transition-all cursor-pointer"
                >
                  ✈️ Dubai South DWC
                </button>
                <button
                  onClick={() => triggerSamplePrompt('Como funciona a garantia decenal do Artigo 880 e a conta Escrow da Lei 8?')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition-all cursor-pointer"
                >
                  🛡️ Lei 8 & Art. 880
                </button>
                <button
                  onClick={() => triggerSamplePrompt('Quais os requisitos do Golden Visa de 10 anos sob a Resolução 65/2022?')}
                  className="px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 transition-all cursor-pointer"
                >
                  🇦🇪 Golden Visa 2M
                </button>
              </div>

              {/* Manual text prompt input / Simulator fallback */}
              <form onSubmit={handleManualVoiceSubmit} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={manualVoiceInput}
                  onChange={(e) => setManualVoiceInput(e.target.value)}
                  placeholder="💬 Escrever mensagem ou simular voz..."
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-amber-400 hover:from-sky-600 hover:to-amber-500 text-black text-xs font-mono font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Enviar
                </button>
              </form>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className="p-3.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-white/10 text-gray-200 hover:text-white transition-all shadow-md cursor-pointer text-xs font-mono"
                title="Mute / Unmute Mic"
              >
                {isMicMuted ? '🔇 MIC OFF' : '🎙️ MIC ON'}
              </button>
              <button
                onClick={stopLiveVoiceSession}
                className="px-6 py-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold transition-all shadow-lg shadow-rose-500/10 cursor-pointer"
              >
                Encerrar Sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
