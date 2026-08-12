const axios = require('axios');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Measured ~8.4s for a 10k-character article, so anything tighter fails the long
// ones outright. This must stay below the deployment's function duration limit:
// if the platform kills the invocation first, no terminal status is written and
// recovery falls to the stale-`processing` sweep in summaryRouteLogic.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;

/**
 * Thrown when the service is misconfigured rather than when generation failed.
 * Callers use this to avoid burning a retry attempt on an operator mistake.
 * @param {string} message reason the configuration is unusable
 * @return {Error} error tagged with code CONFIG_ERROR
 */
function configError(message) {
  const error = new Error(message);
  error.code = 'CONFIG_ERROR';
  return error;
}

/**
 * @return {string} the configured Gemini API key
 */
function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw configError('GEMINI_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Fails fast before any DB state is written, so a missing key cannot poison records.
 */
function assertGeminiConfigured() {
  getApiKey();
}

/**
 * @return {string} generateContent endpoint for the configured model
 */
function buildGeminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
}

/**
 * @param {string} prompt fully built summarisation prompt
 * @return {Promise<string>} trimmed summary text
 */
async function generateArticleSummary(prompt) {
  const response = await axios.post(
    buildGeminiUrl(),
    {
      contents: [
        {
          role: 'user',
          parts: [{text: prompt}],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: [
              'You are a careful summarizer for blog articles and interview experiences.',
              'Follow the user prompt, keep the response factual, and do not invent details.',
            ].join(' '),
          },
        ],
      },
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        // Header rather than a `key` query param, which would land in proxy
        // access logs and in axios error dumps.
        'x-goog-api-key': getApiKey(),
      },
      timeout: GEMINI_TIMEOUT_MS,
    },
  );

  const candidate = response?.data?.candidates?.[0];

  if (!candidate) {
    throw new Error('No candidates returned from Gemini API');
  }

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`[gemini] stopped early, reason=${candidate.finishReason}`);
  }

  const text = candidate.content?.parts?.map((part) => part.text || '').join('') || '';
  return text.trim();
}

module.exports = {
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  assertGeminiConfigured,
  generateArticleSummary,
};
