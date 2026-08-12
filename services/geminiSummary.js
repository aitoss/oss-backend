const axios = require('axios');

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in .env');
  }
  return apiKey;
}

function buildGeminiUrl() {
  const model = 'gemini-2.5-flash';
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function generateArticleSummary(prompt) {
  const response = await axios.post(
    buildGeminiUrl(),
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
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
        // Increased to 4096 to guarantee the API does not cut off long summaries
        maxOutputTokens: 4096, 
      },
    },
    {
      params: {
        key: getApiKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );

  const candidate = response?.data?.candidates?.[0];
  
  if (!candidate) {
    throw new Error('No candidates returned from Gemini API');
  }

  // Debugging check: If the API cuts off the response for any reason, this will log it to your console.
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`⚠️ Gemini API stopped early! Reason: ${candidate.finishReason}`);
  }

  const text = candidate.content?.parts?.map((part) => part.text || '').join('') || '';
  return text.trim();
}

module.exports = {
  generateArticleSummary,
};