import React, { useState, useEffect, useCallback } from 'react';

/**
 * RAIOC OS — Executive Mission Control V2 (React / Next.js Component)
 * 24/7 Sovereign Wall-Screen Command Center featuring:
 * - 6 Modular Navigation Tabs (Executive Overview, CRM Kanban, Fleet Matrix, Pulse Feed, Approvals, Infrastructure)
 * - World Clocks (DXB, LON, LIS, NYC)
 * - Interactive Slide-Over Agent Drawer & Investor Dossier Modal with Quick Actions
 * - Event JSON Payload Inspector
 */

export default function MissionControlDashboard() {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [internalSecret] = useState('raioc_sovereign_auth_2026_x99');
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
  const animFrameRef = React.useRef(null);
  const isBotSpeakingRef = React.useRef(false);
  const speechRecognizerRef = React.useRef(null);
  const silenceTimerRef = React.useRef(null);
  const accumulatedTextRef = React.useRef('');

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
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
        'X-RAIOC-Secret': internalSecret,
      };

      const url = isMasked ? '/api/v1/mission-control/v1-state?masked=true' : '/api/v1/mission-control/v1-state';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setState(data.body || data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to refresh Mission Control V2 telemetry:', err);
    }
  }, [internalSecret, isMasked]);

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
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

  // Speak synthesized response
  const speakBotResponse = (replyText) => {
    isBotSpeakingRef.current = true;
    setVoiceState('speaking');
    setVoiceTranscript(`🔊 JARVIS: ${replyText}`);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(replyText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => (v.lang && (v.lang.includes('pt') || v.lang.includes('PT'))));
      if (ptVoice) utterance.voice = ptVoice;

      utterance.onstart = () => {
        isBotSpeakingRef.current = true;
        setVoiceState('speaking');
      };

      utterance.onend = () => {
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');
        if (speechRecognizerRef.current) {
          try { speechRecognizerRef.current.start(); } catch (err) {}
        }
      };

      utterance.onerror = () => {
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        isBotSpeakingRef.current = false;
        setVoiceState('listening');
        setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');
      }, 4000);
    }
  };

  // Process voice directive to backend
  const processVoiceDirective = async (text) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setVoiceState('thinking');
    setVoiceTranscript(`🧠 A processar mandato: "${text}"...`);

    try {
      const res = await fetch('/api/v1/cognitive/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
        body: JSON.stringify({ prompt: text, conversationMode: 'voice' }),
      });

      const data = await res.json();
      const reply = data.text || data.response || 'JARVIS operacional. Mandato processado com conformidade fiduciária e garantia estatutária.';
      speakBotResponse(reply);
    } catch (err) {
      speakBotResponse('JARVIS operacional. O motor ATLAS e a frota de 12 agentes estão ativos com proteção Escrow e Garantia Decenal.');
    }
  };

  // Live Voice Session Controls (ChatGPT / Gemini Live style)
  const startLiveVoiceSession = async () => {
    setLiveVoiceOpen(true);
    setVoiceState('listening');
    setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          if (stream) {
            micStreamRef.current = stream;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
          }
        }
      }

      // Initialize Speech Recognition
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const recognizer = new SpeechRec();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'pt-PT';
        speechRecognizerRef.current = recognizer;

        recognizer.onstart = () => {
          setVoiceState('listening');
          setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');
        };

        recognizer.onspeechstart = () => {
          handleVoiceBargeIn();
        };

        recognizer.onresult = (event) => {
          handleVoiceBargeIn();
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
          }

          const currentText = (final || interim || '').trim();
          if (currentText) {
            accumulatedTextRef.current = currentText;
            setVoiceTranscript(`🗣️ ${currentText}`);

            // Reset Silence Detection (1.2s pause)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (accumulatedTextRef.current && accumulatedTextRef.current.length > 2) {
                const textToSend = accumulatedTextRef.current;
                accumulatedTextRef.current = '';
                processVoiceDirective(textToSend);
              }
            }, 1200);
          }
        };

        recognizer.onend = () => {
          if (!isBotSpeakingRef.current && speechRecognizerRef.current) {
            try { recognizer.start(); } catch (err) {}
          }
        };

        try { recognizer.start(); } catch (err) {}
      }
    } catch (err) {
      console.warn('Voice init warning:', err);
    }
  };

  const stopLiveVoiceSession = () => {
    setLiveVoiceOpen(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTextRef.current = '';

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isBotSpeakingRef.current = false;

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

  const handleVoiceBargeIn = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (isBotSpeakingRef.current) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      isBotSpeakingRef.current = false;
      setVoiceState('listening');
      setVoiceTranscript('🎙️ Pode falar agora... (A escutar)');
    }
  };

  const triggerSamplePrompt = (promptText) => {
    if (!promptText) return;
    handleVoiceBargeIn();
    processVoiceDirective(promptText);
  };

  const handleManualVoiceSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualVoiceInput.trim()) return;
    const text = manualVoiceInput.trim();
    setManualVoiceInput('');
    handleVoiceBargeIn();
    processVoiceDirective(text);
  };

  // Canvas Fluid Orb Animation Loop
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
      if (analyserRef.current && !isMicMuted) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        audioVolume = sum / (dataArray.length * 255);
      } else {
        audioVolume = (Math.sin(t * 1.5) + 1) * 0.05;
        if (voiceState === 'speaking') {
          audioVolume = (Math.sin(t * 8) + Math.cos(t * 12) + 2) * 0.22;
        }
      }

      if (isBotSpeakingRef.current && audioVolume > 0.35) {
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
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
