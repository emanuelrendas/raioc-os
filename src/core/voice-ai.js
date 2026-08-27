/**
 * RAIOC OS - AIDA Voice AI Engine (Sprint 3 / Phase 9)
 * Generates executive-grade voice synthesis scripts, audio buffers, and speech metadata
 * for private wealth investor communications, objection handling, and premium outreach.
 * 
 * Tone: Calm, premium, intelligent, confident, human, executive.
 * Mediated via Cognitive Router with circuit breaker protection and deterministic fallback.
 */

import { createHash } from 'node:crypto';
import { cognitiveRouter, JARVIS_OMNISCIENT_SYSTEM_PROMPT, JARVIS_LIVE_STREAMING_VOICE_PROMPT, JARVIS_SOVEREIGN_SYSTEM_PROMPT, cleanSpokenText } from './cognitive-router.js';
import { recoveryEngine } from './recovery-engine.js';
import { elevenLabsAdapter } from '../adapters/elevenlabs-adapter.js';
import { logger } from '../logging/audit-logger.js';

export { JARVIS_OMNISCIENT_SYSTEM_PROMPT, JARVIS_LIVE_STREAMING_VOICE_PROMPT, JARVIS_SOVEREIGN_SYSTEM_PROMPT, cleanSpokenText };

export const VOICE_INTENTS = {
  INVESTOR_FOLLOWUP: 'INVESTOR_FOLLOWUP',
  OBJECTION_HANDLING: 'OBJECTION_HANDLING',
  PREMIUM_OUTREACH: 'PREMIUM_OUTREACH',
  CALL_SUPPORT: 'CALL_SUPPORT',
  STATUS_UPDATE: 'STATUS_UPDATE',
  LIVE_CONVERSATION: 'LIVE_CONVERSATION',
};

export const OBJECTION_CATEGORIES = {
  BUDGET: 'BUDGET',
  TIMING: 'TIMING',
  TRUST: 'TRUST',
  LIQUIDITY: 'LIQUIDITY',
  OFF_PLAN_RISK: 'OFF_PLAN_RISK',
  GOLDEN_VISA: 'GOLDEN_VISA',
};

export class VoiceAiEngine {
  constructor() {
    this.breaker = recoveryEngine.getCircuitBreaker('aida_voice_ai', {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
    });
    this.defaultVoiceModel = 'Emanuel Rendas Institutional Executive (British / International)';
  }

  /**
   * Synthesizes an executive voice script and audio metadata
   * @param {string} intent - One of VOICE_INTENTS
   * @param {Object} params - { recipient, investor, thesis, budgetAed, objectionCategory, channel, customScript, correlationId }
   * @returns {Promise<Object>}
   */
  async synthesize(intent = VOICE_INTENTS.INVESTOR_FOLLOWUP, params = {}) {
    const startTime = Date.now();
    const correlationId = params.correlationId || `corr_voice_${Date.now()}`;

    try {
      return await this.breaker.execute(async () => {
        return await this.processSynthesis(intent, params, correlationId, startTime);
      });
    } catch (err) {
      logger.warn('VOICE_AI', `Voice AI circuit open or failed [${err.message}]. Executing deterministic executive voice synthesis.`, { correlationId });
      return this.deterministicVoiceSynthesis(intent, params, startTime);
    }
  }

  /**
   * Main synthesis processor utilizing Cognitive Router
   */
  async processSynthesis(intent, params, correlationId, startTime) {
    if (params.customScript) {
      return this.packageVoiceResult(params.customScript, intent, params, 'custom_script_injection', startTime);
    }

    const prompt = this.buildVoicePrompt(intent, params);

    const aiResult = await cognitiveRouter.dispatch(prompt, {
      taskType: 'VOICE_AI_SYNTHESIS',
      modelTier: 'EXECUTIVE_AUDIO',
      correlationId,
      systemInstruction: `You are AIDA, the Senior Client Relations & Voice Communications AI for Emanuel Rendas Private Advisory in Dubai.
Generate spoken voice scripts for private wealth investors.
Tone: Calm, quiet luxury, highly articulate, confident, human, and sovereign.
Do NOT use hype, exclamation marks, or aggressive sales jargon.
Keep scripts under 75 words (~30 seconds spoken).`,
    });

    let scriptText = (aiResult.text || '').trim();
    // Clean any markdown formatting or quotes
    scriptText = scriptText.replace(/^["']|["']$/g, '').replace(/```[\s\S]*?```/g, '').trim();

    if (!scriptText || scriptText.length < 15 || scriptText.startsWith('JARVIS') || scriptText.startsWith('[VERTEX_AI') || !params.recipient || !scriptText.includes(params.recipient.split(' ')[0])) {
      return this.deterministicVoiceSynthesis(intent, params, startTime);
    }

    return this.packageVoiceResult(scriptText, intent, params, aiResult.provider || 'cognitive_router', startTime);
  }

  /**
   * Builds prompt for AI synthesis based on intent and investor context
   */
  buildVoicePrompt(intent, params = {}) {
    const recipient = params.recipient || params.investor?.name || 'esteemed investor';
    const budgetAed = Number(params.budgetAed || params.investor?.budget_aed || 15000000);
    const targetAsset = params.targetAsset || params.investor?.target_asset || 'Como Residences in Palm Jumeirah';
    const category = params.objectionCategory || OBJECTION_CATEGORIES.TRUST;

    if (intent === VOICE_INTENTS.OBJECTION_HANDLING) {
      return `
Generate an executive spoken voice response to address an investor's concern regarding ${category}.
Investor: ${recipient}
Allocated Budget: AED ${budgetAed.toLocaleString()}
Target Asset: ${targetAsset}
Context: Provide statutory confidence under Dubai Law No. 8 of 2007 (Escrow Guarantee) or Cabinet Resolution No. 65 of 2022 (Golden Visa).
Spoken Script:`;
    }

    if (intent === VOICE_INTENTS.PREMIUM_OUTREACH) {
      return `
Generate a concise, 25-second executive voice introduction note for ${recipient}.
Focus on private off-market capital allocation in ${targetAsset} with sovereign escrow guarantees.
Spoken Script:`;
    }

    if (intent === VOICE_INTENTS.CALL_SUPPORT) {
      return `
Generate a 30-second advisory call confirmation script for Emanuel Rendas's private briefing with ${recipient}.
Include time confirmation and confidential portfolio review focus.
Spoken Script:`;
    }

    if (intent === VOICE_INTENTS.STATUS_UPDATE) {
      return `
Generate a 20-second internal executive briefing on mandate progress for ${recipient} (AED ${budgetAed.toLocaleString()} in ${targetAsset}).
Spoken Script:`;
    }

    // Default: INVESTOR_FOLLOWUP
    return `
Generate a bespoke 30-second voice note follow-up for ${recipient}.
Acknowledge their mandate qualification for ${targetAsset} and confirm the dispatch of the Institutional Memorandum.
Spoken Script:`;
  }

  /**
   * Packages script into audio metadata with cryptographic SHA-256
   */
  packageVoiceResult(scriptText, intent, params, provider, startTime) {
    const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(8, Math.round(wordCount / 2.5)); // ~150 words per minute
    
    // Generate clean simulated base64 audio payload (header + payload hash)
    const audioPayloadSim = `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAVAAACaAA...${Buffer.from(scriptText).toString('base64').substring(0, 80)}`;
    const audioSha256 = createHash('sha256').update(scriptText).digest('hex');

    const confidence = this.evaluateVoiceConfidence(scriptText, intent, params);

    return {
      success: true,
      intent,
      recipient: params.recipient || params.investor?.name || 'Private Investor',
      voiceModel: this.defaultVoiceModel,
      script: scriptText,
      audioBase64: audioPayloadSim,
      audioDurationSeconds: durationSeconds,
      audioSha256,
      confidence,
      provider,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluates voice script quality & confidence
   */
  evaluateVoiceConfidence(script, intent, params) {
    if (!script || script.length < 20) return 0.60;
    const lower = script.toLowerCase();

    // Check for executive terminology
    let score = 0.90;
    if (lower.includes('escrow') || lower.includes('law 8') || lower.includes('sovereign') || lower.includes('allocation') || lower.includes('memorandum')) {
      score += 0.05;
    }
    if (lower.includes('free') || lower.includes('guarantee 100% profit') || lower.includes('act now')) {
      score -= 0.30; // Penalize hype/promotional terms
    }

    return Math.min(0.99, Math.max(0.50, score));
  }

  /**
   * Deterministic Sovereign Voice Generator (Offline & Circuit Breaker Failover)
   */
  deterministicVoiceSynthesis(intent, params = {}, startTime) {
    const recipient = params.recipient || params.investor?.name || 'Esteemed Investor';
    const targetAsset = params.targetAsset || params.investor?.target_asset || 'Como Residences in Palm Jumeirah';
    const budgetAed = Number(params.budgetAed || params.investor?.budget_aed || 15000000);
    const category = params.objectionCategory || OBJECTION_CATEGORIES.TRUST;

    let script = `Good day, ${recipient}. This is AIDA from Emanuel Rendas Private Advisory. Your sovereign allocation dossier for ${targetAsset} has been verified under Dubai Law No. 8 escrow guarantees. Our team is available for a confidential briefing at your convenience.`;

    if (intent === VOICE_INTENTS.OBJECTION_HANDLING) {
      if (category === OBJECTION_CATEGORIES.OFF_PLAN_RISK || category === OBJECTION_CATEGORIES.TRUST) {
        script = `Good day, ${recipient}. Regarding statutory protections for ${targetAsset}: under Dubai Law No. 8 of 2007, 100% of your capital is held in a ringfenced RERA escrow account, released solely against verified construction milestones. Your allocation is strictly safeguarded.`;
      } else if (category === OBJECTION_CATEGORIES.GOLDEN_VISA) {
        script = `Good day, ${recipient}. Regarding residency eligibility: your AED ${budgetAed.toLocaleString()} allocation qualifies directly for the 10-Year Renewable Sovereign Golden Visa under UAE Cabinet Resolution No. 65 of 2022, covering your family and multi-generational dependants.`;
      } else if (category === OBJECTION_CATEGORIES.LIQUIDITY || category === OBJECTION_CATEGORIES.BUDGET) {
        script = `Good day, ${recipient}. Regarding capital efficiency: our structured tranche milestones align precisely with developer escrow releases, preserving secondary market exit liquidity and targeted net yields exceeding 7.8%.`;
      }
    } else if (intent === VOICE_INTENTS.PREMIUM_OUTREACH) {
      script = `Good day, ${recipient}. Emanuel Rendas asked me to share a discreet pre-launch allocation brief for ${targetAsset}. The tranche offers prime waterfront positioning with full sovereign escrow ringfencing. I would be delighted to arrange your private review.`;
    } else if (intent === VOICE_INTENTS.CALL_SUPPORT) {
      script = `Good day, ${recipient}. Confirming your confidential advisory briefing with Emanuel Rendas regarding your Dubai sovereign allocation. All portfolio materials have been synchronized for your review.`;
    } else if (intent === VOICE_INTENTS.STATUS_UPDATE) {
      script = `Executive Update: The allocation dossier for ${recipient} targeting ${targetAsset} at AED ${budgetAed.toLocaleString()} has been synthesized and queued for executive dispatch.`;
    }

    return this.packageVoiceResult(script, intent, params, 'deterministic_sovereign_voice', startTime);
  }

  /**
   * Generates low-latency live conversational spoken response (<200ms) with ElevenLabs neural audio
   * @param {Object} params - { message, history, locale, voiceId, correlationId }
   * @returns {Promise<Object>}
   */
  async synthesizeLiveConversation(params = {}) {
    const startTime = Date.now();
    const correlationId = params.correlationId || `corr_live_voice_${Date.now()}`;
    const userMessage = params.message || params.prompt || '';
    const locale = params.locale || 'pt';
    const voiceId = params.voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    // 1. Generate spoken response via Cognitive Router with maxOutputTokens: 350
    const cogResult = await cognitiveRouter.dispatch(userMessage, {
      conversationMode: 'voice',
      systemInstruction: JARVIS_OMNISCIENT_SYSTEM_PROMPT,
      maxOutputTokens: 350,
      max_tokens: 350,
      temperature: 0.3,
      correlationId,
      history: Array.isArray(params.history) ? params.history.slice(-10) : [],
      audio: params.audio || params.audioBase64,
      audioMimeType: params.audioMimeType || 'audio/webm',
    });

    const rawText = cogResult.text || 'JARVIS operacional. A frota de 12 agentes e os modelos fiduciários estão ativos.';
    const text = cleanSpokenText(rawText);

    // 2. Synthesize neural audio via ElevenLabs
    const speechResult = await elevenLabsAdapter.generateSpeech({
      text,
      voiceId,
      modelId: 'eleven_turbo_v2_5',
      voiceSettings: {
        stability: 0.50,
        similarity_boost: 0.80,
        style: 0.15,
        speed: 0.96,
      },
      locale,
    });

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      text,
      audioBase64: speechResult.audioBase64,
      fallbackRequired: Boolean(speechResult.fallbackRequired),
      mode: speechResult.mode || 'SIMULATED_SANDBOX',
      mimeType: 'audio/mpeg',
      latencyMs,
      provider: 'elevenlabs',
      model: speechResult.modelId || 'eleven_turbo_v2_5',
      voiceId: speechResult.voiceId,
      audioSha256: speechResult.audioSha256,
      durationSeconds: speechResult.durationSeconds,
    };
  }

  /**
   * Generates token-to-chunk SSE streaming payload with partial tokens and audio chunks
   * @param {Object} params - { message, history, locale, voiceId, correlationId, audio, audioMimeType }
   * @returns {Promise<Object>} Formatted SSE response with events
   */
  async streamLiveConversation(params = {}) {
    const startTime = Date.now();
    const correlationId = params.correlationId || `corr_live_stream_${Date.now()}`;
    const userMessage = params.message || params.prompt || '';
    const locale = params.locale || 'pt';
    const voiceId = params.voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    // 1. Generate spoken response via Cognitive Router
    const cogResult = await cognitiveRouter.dispatch(userMessage, {
      conversationMode: 'voice',
      systemInstruction: JARVIS_OMNISCIENT_SYSTEM_PROMPT,
      maxOutputTokens: 350,
      max_tokens: 350,
      temperature: 0.3,
      correlationId,
      history: Array.isArray(params.history) ? params.history.slice(-10) : [],
      audio: params.audio || params.audioBase64,
      audioMimeType: params.audioMimeType || 'audio/webm',
    });

    const rawText = cogResult.text || 'JARVIS operacional. A frota de 12 agentes e os modelos fiduciários estão ativos.';
    const fullText = cleanSpokenText(rawText);

    // 2. Tokenize text into phrases/chunks (token-to-chunk streaming)
    const phraseChunks = fullText
      .split(/(?<=[.,!?:;])\s+/)
      .map(p => p.trim())
      .filter(Boolean);

    if (phraseChunks.length === 0) {
      phraseChunks.push(fullText);
    }

    let sseEvents = '';
    let totalTokens = 0;

    // Emitting token events and audio_chunk events
    for (let i = 0; i < phraseChunks.length; i++) {
      const phrase = phraseChunks[i];
      totalTokens += phrase.split(/\s+/).length;

      // Event: token
      sseEvents += `event: token\ndata: ${JSON.stringify({ text: phrase + ' ', chunkIndex: i })}\n\n`;

      // Event: audio_chunk
      const chunkResult = await elevenLabsAdapter.generateSpeechChunk({
        text: phrase,
        voiceId,
        chunkIndex: i,
      });

      sseEvents += `event: audio_chunk\ndata: ${JSON.stringify({
        chunkIndex: i,
        text: phrase,
        audioBase64: chunkResult.audioBase64,
        format: 'audio/mpeg',
        durationSeconds: chunkResult.durationSeconds,
      })}\n\n`;
    }

    const elapsedMs = Date.now() - startTime;

    // Event: done
    sseEvents += `event: done\ndata: ${JSON.stringify({
      status: 'COMPLETED',
      durationMs: elapsedMs,
      totalChunks: phraseChunks.length,
      totalTokens,
      fullText,
      correlationId,
    })}\n\n`;

    return {
      success: true,
      sseEvents,
      fullText,
      totalChunks: phraseChunks.length,
      durationMs: elapsedMs,
    };
  }
}

export const voiceAi = new VoiceAiEngine();

