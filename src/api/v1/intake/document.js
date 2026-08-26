/**
 * RAIOC OS - MARK Document Intake Adapter & API Gateway (Phase 3)
 * Pure input surface for uploading real estate and financial documents (PDF, JPEG, PNG, WEBP).
 * Validates payload constraints (15MB max, MIME type), sanitizes sensitive binary data,
 * computes cryptographic SHA-256 hashes, and emits CloudEvent v1.1 events.
 * 
 * Endpoints:
 * - POST /api/v1/intake/document
 * - Legacy alias: POST /api/intake/document (with Deprecation header)
 */

import { createHash } from 'node:crypto';
import { enterpriseEventBus } from '../../../core/event-bus.js';
import { logger } from '../../../logging/audit-logger.js';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_SIZE_BYTES * 1.37); // approx 20.5MB base64 string

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function handleDocumentIntakeRequest(url, method = 'POST', body = {}, query = {}, headers = {}) {
  const isLegacy = url.startsWith('/api/intake') && !url.startsWith('/api/v1/intake');
  const responseHeaders = isLegacy
    ? {
        'Deprecation': '@deprecated Use canonical route /api/v1/intake/document',
        'Sunset': '2026-12-31',
      }
    : {};

  if (method !== 'POST') {
    return {
      status: 405,
      headers: responseHeaders,
      body: { success: false, error: `Method ${method} not allowed on document intake endpoint` },
    };
  }

  const startTime = Date.now();
  const fileBase64 = body.fileBase64 || body.file_base64 || body.content || '';
  const textContent = body.textContent || body.text || '';
  const fileName = body.fileName || body.file_name || 'document.pdf';
  let mimeType = (body.mimeType || body.mime_type || '').toLowerCase();
  const documentType = body.documentType || body.document_type || body.type || 'GENERIC_SCAN';
  const investorId = body.investorId || body.investor_id || null;

  // Infer MIME type from file extension if not explicitly provided
  if (!mimeType) {
    if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (fileName.endsWith('.png')) mimeType = 'image/png';
    else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
    else mimeType = 'application/pdf';
  }

  // 1. Validate File Size Constraint (15MB limit)
  if (fileBase64 && fileBase64.length > MAX_BASE64_LENGTH) {
    logger.warn('DOCUMENT_INTAKE', `Rejected document: File size exceeds 15MB limit (${fileBase64.length} chars)`);
    return {
      status: 413,
      headers: responseHeaders,
      body: {
        success: false,
        error: 'Document exceeds 15MB size limit',
        maxSizeBytes: MAX_FILE_SIZE_BYTES,
      },
    };
  }

  // 2. Validate MIME Type
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    logger.warn('DOCUMENT_INTAKE', `Rejected document: Unsupported MIME type (${mimeType})`);
    return {
      status: 400,
      headers: responseHeaders,
      body: {
        success: false,
        error: `Unsupported file format '${mimeType}'. Supported types: PDF, JPEG, PNG, WEBP`,
        supportedMimeTypes: Array.from(SUPPORTED_MIME_TYPES),
      },
    };
  }

  // 3. Ensure content is present
  if (!fileBase64 && !textContent) {
    return {
      status: 400,
      headers: responseHeaders,
      body: {
        success: false,
        error: 'Missing document payload: fileBase64 or textContent is required',
      },
    };
  }

  // 4. Compute Cryptographic SHA-256 (Never store massive raw base64 in audit logs)
  const rawBytes = fileBase64 || textContent;
  const fileSha256 = createHash('sha256').update(rawBytes).digest('hex');

  // 5. W3C Distributed Tracing Context
  const correlationId = headers['x-correlation-id'] || body.correlationId || body.correlation_id || `corr_doc_${Date.now()}`;
  const traceparent = headers.traceparent || headers['traceparent'];
  const causationId = `doc_upd_${fileSha256.substring(0, 16)}`;

  // 6. Build CloudEvent Payload (Sanitized - raw base64 passed in data only for vision worker execution)
  const intakeEventPayload = {
    fileSha256,
    fileName,
    mimeType,
    documentType: documentType.toUpperCase(),
    investorId,
    textContent: textContent ? textContent.substring(0, 5000) : '',
    fileBase64: fileBase64 || '', // Available for event-router vision execution
    sizeBytes: fileBase64 ? Math.round(fileBase64.length * 0.75) : textContent.length,
    uploadedAt: new Date().toISOString(),
  };

  // 7. Publish CloudEvent v1.1 to Event Bus
  const event = await enterpriseEventBus.publishEvent(
    'raioc.document.intake.uploaded.v1',
    'raioc://intake/document/gateway',
    intakeEventPayload,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `doc_${fileSha256.substring(0, 12)}`,
    }
  );

  const durationMs = Date.now() - startTime;
  logger.info('DOCUMENT_INTAKE', `Ingested document [${fileName}] (${mimeType}, SHA: ${fileSha256.substring(0, 12)}...) in ${durationMs}ms`, {
    eventId: event.id,
    correlationId,
  });

  return {
    status: 200,
    headers: responseHeaders,
    body: {
      status: 'RECEIVED',
      eventId: event.id,
      traceparent: event.traceparent,
      correlationId: event.correlation_id,
      fileSha256,
      documentType: documentType.toUpperCase(),
      timestamp: new Date().toISOString(),
    },
  };
}
