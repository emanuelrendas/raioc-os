/**
 * RAIOC OS - Google Gemini 2.5 Flash Adapter (Sprint 3 & Executive Chat)
 * Connects the executive chat endpoint (/api/chat) to Google Generative AI (Gemini 2.5 Flash)
 * using the official Google Gen AI endpoint and institutional RAIOC / JARVIS system context.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class GeminiAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY || config.gemini?.apiKey || '';
    this.model = options.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    this.timeoutMs = options.timeoutMs || 8000;
    this.systemInstruction = options.systemInstruction || 
      'You are JARVIS, the Chief Intelligence System for Emanuel Rendas Private Advisory in Dubai. Respond precisely using IKL data, verified yields, and statutory Escrow frameworks (Law 8 of 2007).';
  }

  /**
   * Retrieves the active Gemini API key
   * @returns {string}
   */
  getApiKey() {
    return this.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY || config.gemini?.apiKey || '';
  }

  /**
   * Generates an executive intelligence response using Gemini 2.5 Flash
   * @param {string} prompt - User message or executive directive
   * @param {Object} context - Optional context (lead details, portfolio parameters, history)
   * @returns {Promise<Object>} Structured AI response
   */
  async generateResponse(prompt, context = {}) {
    const activeKey = this.getApiKey();
    const correlationId = context.correlationId || `corr_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    // 1. Live Google Generative Language API call if key is configured
    if (activeKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(activeKey)}`;
      
      const contents = [];
      if (Array.isArray(context.history) && context.history.length > 0) {
        const recentHistory = context.history.slice(-10);
        for (const item of recentHistory) {
          const rawRole = (item.role || item.speaker || '').toLowerCase();
          const role = (rawRole === 'model' || rawRole === 'assistant' || rawRole === 'bot' || rawRole === 'jarvis') ? 'model' : 'user';
          const text = item.text || item.message || item.content || '';
          if (text) {
            contents.push({
              role,
              parts: [{ text: String(text) }],
            });
          }
        }
      }
      const promptText = typeof prompt === 'string' ? prompt : (prompt ? JSON.stringify(prompt) : '');
      const userParts = [];
      const audioInput = context.audio || context.audioBase64 || context.audioBlob;
      if (audioInput) {
        let rawBase64 = '';
        let mimeType = 'audio/webm';
        if (typeof audioInput === 'string') {
          const match = audioInput.match(/^data:([^;]+);base64,(.*)$/s);
          if (match) {
            mimeType = match[1];
            rawBase64 = match[2];
          } else {
            rawBase64 = audioInput;
          }
        } else if (typeof audioInput === 'object') {
          rawBase64 = audioInput.data || audioInput.base64 || audioInput.audioBase64 || '';
          mimeType = audioInput.mimeType || audioInput.type || 'audio/webm';
          if (rawBase64.startsWith('data:')) {
            rawBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
          }
        }
        if (rawBase64) {
          userParts.push({
            inlineData: {
              mimeType,
              data: rawBase64,
            },
          });
        }
      }

      if (promptText) {
        userParts.push({ text: promptText });
      } else if (userParts.length > 0) {
        userParts.push({ text: 'Ouve a diretiva em áudio e responde em conformidade executiva e fiduciária como JARVIS:' });
      }

      if (userParts.length > 0) {
        contents.push({
          role: 'user',
          parts: userParts,
        });
      }

      const payload = {
        contents,
        systemInstruction: {
          parts: [
            {
              text: context.systemInstruction || context.systemPrompt || this.systemInstruction,
            },
          ],
        },
        generationConfig: {
          temperature: context.temperature !== undefined ? context.temperature : 0.3,
          maxOutputTokens: context.maxOutputTokens || context.max_tokens || 1024,
          topP: 0.95,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        logger.info('GEMINI_ADAPTER', `Dispatching prompt to Google AI Studio (${this.model})...`, { correlationId });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          logger.warn('GEMINI_ADAPTER', `Gemini API returned HTTP ${response.status}: ${errorText}`, { correlationId, status: response.status });
          throw new Error(`Google AI API HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        let generatedText = candidate?.content?.parts?.[0]?.text;

        if (generatedText) {
          const durationMs = Date.now() - startTime;
          const isVoice = context.conversationMode === 'voice' || context.conversationMode === 'voice_live' || context.voice === true || (context.maxOutputTokens && context.maxOutputTokens <= 60);
          if (isVoice) {
            generatedText = generatedText
              .replace(/[*_~`#\[\]{}<>|]/g, '')
              .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{E0020}-\u{E007F}]/gu, '')
              .replace(/^[ \t]*[-•+>][ \t]+/gm, '')
              .replace(/[ \t]+[-•+>][ \t]+/g, ', ')
              .replace(/\s+/g, ' ')
              .trim();
          }
          logger.info('GEMINI_ADAPTER', `Received Gemini 2.5 Flash response in ${durationMs}ms`, { correlationId, durationMs });
          return {
            success: true,
            model: this.model,
            provider: 'google_ai_studio',
            text: generatedText.trim(),
            finishReason: candidate.finishReason || 'STOP',
            latencyMs: durationMs,
            raw: data,
          };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        logger.warn('GEMINI_ADAPTER', `Gemini API call failed: ${err.message}`, { correlationId });
      }
    } else {
      logger.warn('GEMINI_ADAPTER', 'GEMINI_API_KEY not configured in environment', { correlationId });
    }

    // 2. Clear Conversational Notification when Gemini is unavailable
    const fallbackText = 'Aviso: Sem ligação ativa à API do Gemini.';
    return {
      success: false,
      model: this.model,
      provider: 'google_ai_studio_notice',
      text: fallbackText,
      finishReason: 'API_UNAVAILABLE',
      latencyMs: Date.now() - startTime,
    };
  }
}

export const geminiAdapter = new GeminiAdapter();
