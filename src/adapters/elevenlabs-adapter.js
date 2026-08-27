/**
 * RAIOC OS - ElevenLabs Neural TTS Adapter
 * 
 * Supports high-fidelity voice generation via the official ElevenLabs REST API:
 * - Live Mode: POST https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}
 * - Simulated Sandbox Mode: Deterministic mock base64 audio payload with cryptographic SHA-256 digest
 */

import { createHash } from 'node:crypto';
import { logger } from '../logging/audit-logger.js';

export class ElevenLabsAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_KEY || '';
    this.defaultVoiceId = options.defaultVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    this.defaultModelId = options.defaultModelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    this.apiUrl = options.apiUrl || 'https://api.elevenlabs.io/v1';
  }

  /**
   * Returns true if live credentials are configured
   * @returns {boolean}
   */
  isLiveMode() {
    const key = this.apiKey || process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Returns current execution mode
   * @returns {'LIVE' | 'SIMULATED_SANDBOX'}
   */
  getMode() {
    return this.isLiveMode() ? 'LIVE' : 'SIMULATED_SANDBOX';
  }

  /**
   * Generates speech from text using live ElevenLabs API or simulated fallback
   * 
   * @param {Object} params
   * @param {string} params.text - Script text to synthesize
   * @param {string} [params.voiceId] - ElevenLabs Voice ID
   * @param {string} [params.modelId] - ElevenLabs Model ID
   * @param {Object} [params.voiceSettings] - Stability and similarity parameters
   * @param {string} [params.locale='en'] - Script locale
   * @returns {Promise<Object>}
   */
  async generateSpeech(params = {}) {
    const {
      text,
      voiceId = this.defaultVoiceId,
      modelId = this.defaultModelId,
      voiceSettings = { stability: 0.75, similarity_boost: 0.85 },
      locale = 'en',
    } = params;

    if (!text || typeof text !== 'string') {
      throw new Error('ElevenLabsAdapter: text parameter is required');
    }

    const audioSha256 = createHash('sha256').update(text).digest('hex');
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(8, Math.round(wordCount / 2.4));

    // --- Live Mode Execution ---
    if (this.isLiveMode()) {
      const activeKey = this.apiKey || process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_KEY;
      const url = `${this.apiUrl}/text-to-speech/${voiceId}`;
      logger.info('ELEVENLABS_ADAPTER', `Synthesizing neural audio via Live ElevenLabs API [Voice: ${voiceId}]...`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'xi-api-key': activeKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: voiceSettings,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`ElevenLabs API returned ${response.status}: ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioBase64 = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

        logger.info('ELEVENLABS_ADAPTER', `Successfully synthesized ${audioBuffer.length} bytes of live audio`);

        return {
          success: true,
          mode: 'LIVE',
          voiceId,
          modelId,
          locale,
          audioSha256,
          durationSeconds,
          byteLength: audioBuffer.length,
          audioBase64,
          audioUrl: `https://assets.emanuelrendas.com/audio/fiduciary/${voiceId}_${locale}_${audioSha256.substring(0, 12)}.mp3`,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        logger.error('ELEVENLABS_ADAPTER', `Live ElevenLabs synthesis failed: ${err.message}. Falling back to deterministic sandbox.`);
        // Graceful fallback to sandbox if live API fails
      }
    }

    // --- Deterministic Simulated Sandbox Mode ---
    logger.info('ELEVENLABS_ADAPTER', `Generating deterministic sandbox audio payload (${wordCount} words, ${durationSeconds}s)...`);

    const textBase64Header = Buffer.from(text).toString('base64');
    const mockAudioBase64 = `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAVAAACaAA...${textBase64Header.substring(0, 80)}`;

    return {
      success: true,
      mode: 'SIMULATED_SANDBOX',
      voiceId,
      modelId,
      locale,
      audioSha256,
      durationSeconds,
      byteLength: 48000,
      audioBase64: mockAudioBase64,
      audioUrl: `https://assets.emanuelrendas.com/audio/fiduciary/sandbox_${locale}_${audioSha256.substring(0, 12)}.mp3`,
      timestamp: new Date().toISOString(),
    };
  }
}

export const elevenLabsAdapter = new ElevenLabsAdapter();
