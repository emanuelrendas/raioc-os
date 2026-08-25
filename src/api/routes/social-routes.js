/**
 * RAIOC API - Social Media & Content Automation Routes
 * Provides programmatic access to Brand Strategy, Comment Watchdog, DM Conversion, and Social Analytics.
 */

import { brandContentAgent } from '../../agents/agent-brand.js';
import { commentWatchdogAgent } from '../../agents/agent-engage.js';
import { dmConversionAgent } from '../../agents/agent-dm.js';
import { socialAnalyticsAgent } from '../../agents/agent-analytics.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleSocialRequest(path, method = 'POST', body = {}, query = {}, headers = {}) {
  const normalized = path.replace(/^\/api\/social\/?/, '');
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || `corr_soc_${Date.now()}`;

  // 1. Content Generation & Script Synthesis (/api/social/brand/generate or /api/social/brand)
  if (normalized.startsWith('brand')) {
    try {
      const topic = body.topic || query.topic || 'dubai-south';
      const format = body.format || query.format || 'video_script';
      const targetAudience = body.targetAudience || 'UHNW_FAMILY_OFFICE';

      const result = await brandContentAgent.executeTask(
        { topic, format, targetAudience },
        { correlationId }
      );

      return {
        status: result.status === 'SUCCESS' ? 200 : 500,
        body: result.output || result,
      };
    } catch (err) {
      logger.error('SOCIAL_API', `Brand content generation failed: ${err.message}`);
      return { status: 500, body: { error: err.message } };
    }
  }

  // 2. Comment Moderation & Statutory Engagement (/api/social/engage/process or /api/social/engage)
  if (normalized.startsWith('engage')) {
    try {
      const platform = body.platform || 'instagram';
      const commentId = body.commentId || `cmt_${Date.now()}`;
      const author = body.author || body.username || 'investor';
      const text = body.text || body.comment || '';

      if (!text) {
        return { status: 400, body: { error: "Missing required 'text' field for comment analysis" } };
      }

      const result = await commentWatchdogAgent.executeTask(
        { platform, commentId, author, text },
        { correlationId }
      );

      return {
        status: result.status === 'SUCCESS' ? 200 : 500,
        body: result.output || result,
      };
    } catch (err) {
      logger.error('SOCIAL_API', `Comment engagement processing failed: ${err.message}`);
      return { status: 500, body: { error: err.message } };
    }
  }

  // 3. Inbound DM Conversion & DIRA Qualification (/api/social/dm/process or /api/social/dm)
  if (normalized.startsWith('dm')) {
    try {
      const platform = body.platform || 'instagram';
      const senderId = body.senderId || `sender_${Date.now()}`;
      const senderHandle = body.senderHandle || body.sender || 'prospect_user';
      const messageText = body.messageText || body.message || '';
      const extractedData = body.extractedData || body.lead || {};

      const result = await dmConversionAgent.executeTask(
        { platform, senderId, senderHandle, messageText, extractedData },
        { correlationId }
      );

      return {
        status: result.status === 'SUCCESS' ? 200 : 500,
        body: result.output || result,
      };
    } catch (err) {
      logger.error('SOCIAL_API', `DM conversion processing failed: ${err.message}`);
      return { status: 500, body: { error: err.message } };
    }
  }

  // 4. Social Analytics & Telemetry (/api/social/analytics or /api/social/metrics)
  if (normalized.startsWith('analytics') || normalized.startsWith('metrics')) {
    try {
      const action = method === 'POST' && body.action ? body.action : 'get_metrics';
      const result = await socialAnalyticsAgent.executeTask(
        { action, delta: body.delta || {} },
        { correlationId }
      );

      return {
        status: result.status === 'SUCCESS' ? 200 : 500,
        body: result.output || result,
      };
    } catch (err) {
      logger.error('SOCIAL_API', `Social analytics retrieval failed: ${err.message}`);
      return { status: 500, body: { error: err.message } };
    }
  }

  return { status: 404, body: { error: `Unknown social endpoint: ${path}` } };
}
