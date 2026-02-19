import axios from 'axios';
import crypto from 'crypto';
import { getConfig } from './config.js';

const SERVICE = 'braket';

// ============================================================
// AWS SigV4 Request Signing
// ============================================================

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, region, service) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  const kSigning = sign(kService, 'aws4_request');
  return kSigning;
}

function getAmzDate() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signedRequest({ method, path, body, region, accessKeyId, secretAccessKey, sessionToken }) {
  const host = `braket.${region}.amazonaws.com`;
  const endpoint = `https://${host}`;
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);

  const bodyStr = body ? JSON.stringify(body) : '';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  const headers = {
    'content-type': 'application/json',
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': contentHash
  };

  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, contentHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, SERVICE);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { endpoint: endpoint + path, headers: { ...headers, authorization }, bodyStr };
}

// ============================================================
// API Client
// ============================================================

async function apiRequest(method, path, body = null, params = null) {
  const region = getConfig('region') || 'us-east-1';
  const accessKeyId = getConfig('accessKeyId');
  const secretAccessKey = getConfig('secretAccessKey');
  const sessionToken = getConfig('sessionToken');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Run: awsbraket config set --access-key-id <id> --secret-access-key <secret>');
  }

  const { endpoint, headers, bodyStr } = signedRequest({
    method, path, body, region, accessKeyId, secretAccessKey, sessionToken
  });

  try {
    const response = await axios({
      method,
      url: endpoint,
      headers,
      data: bodyStr || undefined,
      params: params || undefined
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

function handleApiError(error) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    if (status === 401 || status === 403) throw new Error('Authentication failed. Check your AWS credentials.');
    if (status === 404) throw new Error('Resource not found.');
    if (status === 429) throw new Error('Rate limit exceeded. Please wait before retrying.');
    const message = data?.message || data?.Message || JSON.stringify(data);
    throw new Error(`API Error (${status}): ${message}`);
  } else if (error.request) {
    throw new Error('No response from AWS Braket API. Check your internet connection and region.');
  } else {
    throw error;
  }
}

// ============================================================
// QUANTUM TASKS
// ============================================================

export async function listQuantumTasks({ deviceArn, status, maxResults = 10 } = {}) {
  const body = { maxResults };
  if (deviceArn) body.deviceArn = deviceArn;
  if (status) body.filters = [{ name: 'status', values: [status] }];
  const data = await apiRequest('POST', '/quantum-tasks', body);
  return data.quantumTasks || [];
}

export async function getQuantumTask(taskId) {
  return await apiRequest('GET', `/quantum-tasks/${encodeURIComponent(taskId)}`);
}

export async function createQuantumTask({ deviceArn, shots, outputS3Bucket, outputS3KeyPrefix, action }) {
  const body = {
    deviceArn,
    shots,
    outputS3Bucket,
    outputS3KeyPrefix,
    action: typeof action === 'string' ? action : JSON.stringify(action)
  };
  return await apiRequest('POST', '/quantum-tasks', body);
}

export async function cancelQuantumTask(taskId) {
  return await apiRequest('PUT', `/quantum-tasks/${encodeURIComponent(taskId)}/cancel`);
}

// ============================================================
// DEVICES
// ============================================================

export async function listDevices({ type, provider, status } = {}) {
  const body = {};
  const filters = [];
  if (type) filters.push({ name: 'deviceType', values: [type] });
  if (provider) filters.push({ name: 'providerName', values: [provider] });
  if (status) filters.push({ name: 'deviceStatus', values: [status] });
  if (filters.length) body.filters = filters;
  const data = await apiRequest('POST', '/devices', body);
  return data.devices || [];
}

export async function getDevice(deviceArn) {
  return await apiRequest('GET', `/devices/${encodeURIComponent(deviceArn)}`);
}

// ============================================================
// JOBS (circuits/algorithms)
// ============================================================

export async function createJob({ algorithmSpecification, instanceConfig, jobName, outputDataConfig, roleArn, checkpointConfig }) {
  const body = {
    algorithmSpecification,
    instanceConfig,
    jobName,
    outputDataConfig,
    roleArn
  };
  if (checkpointConfig) body.checkpointConfig = checkpointConfig;
  return await apiRequest('POST', '/jobs', body);
}

export async function getJob(jobName) {
  return await apiRequest('GET', `/jobs/${encodeURIComponent(jobName)}`);
}

export async function listJobs({ maxResults = 10, state } = {}) {
  const params = { maxResults };
  if (state) params.filters = `state:${state}`;
  const data = await apiRequest('GET', '/jobs', null, params);
  return data.jobs || [];
}

export async function cancelJob(jobName) {
  return await apiRequest('PUT', `/jobs/${encodeURIComponent(jobName)}/cancel`);
}
