const crypto = require('crypto');
const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleSummary = require('../models/ArticleSummary');
const {assertGeminiConfigured, generateArticleSummary} = require('./geminiSummary');

const SUMMARY_VERSION = 'gemini-2.5-flash-v1';
const MAX_SUMMARY_ATTEMPTS = 3;

// A `processing` row older than this is assumed to belong to an invocation that
// died before it could write a terminal status (serverless timeout, redeploy,
// crash). Without this, such a row blocks the article forever.
const PROCESSING_STALE_MS = Number(process.env.SUMMARY_PROCESSING_STALE_MS) || 2 * 60 * 1000;

// Full summary bodies are only logged when explicitly opted in; on a hosted
// platform these go to durable log storage.
const SUMMARY_DEBUG = process.env.SUMMARY_DEBUG === 'true';

// Only dedupes concurrent work inside a single process. Serverless instances do
// not share it, which is why the stale-`processing` recovery above is required.
const inFlightJobs = new Map();

/**
 * Fingerprints the fields that feed the prompt, so an edited article invalidates
 * its stored summary.
 * @param {object} article article document
 * @return {string} sha256 of the summarisable fields
 */
function buildSourceHash(article) {
  const payload = {
    title: article.title || '',
    typeOfArticle: article.typeOfArticle || '',
    companyName: article.companyName || '',
    companyDomainName: article.companyDomainName || '',
    description: article.description || '',
    articleTags: Array.isArray(article.articleTags) ? [...article.articleTags].sort() : [],
    imageUrl: article.imageUrl || '',
    showName: Boolean(article.showName),
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * @param {object} article article document
 * @return {string} the summarisation prompt for this article
 */
function buildPrompt(article) {
  const tags = Array.isArray(article.articleTags) ? article.articleTags.join(', ') : '';
  const isInterviewArticle = /interview/i.test(`${article.title || ''} ${article.typeOfArticle || ''} ${article.description || ''}`);

  const interviewInstructions = isInterviewArticle
    ? [
        'This is an interview experience article.',
        'Write a useful, detailed summary that captures the interview flow and key takeaways.',
        'Mention the role, company, rounds, DSA or system design topics, HR points, and final result when present.',
      ]
    : [
        'Write a useful, detailed summary that captures the main idea, process, and takeaways from the article.',
      ];

  return [
    'You are writing an article summary for a blog reader.',
    'Do not start with filler phrases such as "This article details", "This article is about", "The article discusses", or "In this article".',
    'Start directly with the content. Do not mention that you are summarizing the article.',
    'Keep the tone factual, crisp, and readable.',
    'Prefer a detailed summary with concrete points over a generic one-line intro.',
    'Avoid repeating the article title verbatim in the first sentence unless it is necessary for clarity.',
    ...interviewInstructions,
    'Use 1 short paragraph followed by 3 to 5 bullet points when the content is interview-heavy; otherwise use 2 compact paragraphs.',
    'Do not invent details that are not present in the article.',
    '',
    `Title: ${article.title || ''}`,
    `Type: ${article.typeOfArticle || ''}`,
    `Company: ${article.companyName || ''}`,
    `Tags: ${tags}`,
    '',
    'Article content:',
    article.description || '',
  ].join('\n');
}

/**
 * Strips the filler openers and duplicated lines models tend to emit.
 * @param {string} summary raw model output
 * @return {string} cleaned summary
 */
function cleanSummaryText(summary) {
  if (!summary) return '';

  let cleaned = summary.trim();
  cleaned = cleaned.replace(/^[-•\s]+/gm, '').trim();

  const genericOpeners = [
    /^this article details[^.?!]*[.?!]?\s*/i,
    /^this article is about[^.?!]*[.?!]?\s*/i,
    /^the article discusses[^.?!]*[.?!]?\s*/i,
    /^in this article[^.?!]*[.?!]?\s*/i,
    /^this is an? interview experience[^.?!]*[.?!]?\s*/i,
  ];

  for (const pattern of genericOpeners) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  const lines = cleaned.split('\n');
  const dedupedLines = [];
  let previousNormalizedLine = '';

  for (const line of lines) {
    const normalizedLine = line.trim().replace(/\s+/g, ' ');
    if (normalizedLine && normalizedLine.toLowerCase() === previousNormalizedLine) {
      continue;
    }

    dedupedLines.push(line);
    previousNormalizedLine = normalizedLine.toLowerCase();
  }

  cleaned = dedupedLines.join('\n').trim();

  return cleaned;
}

/**
 * @param {string} stage label for the lifecycle point being logged
 * @param {object} article article document
 * @param {string} summary summary text, logged in full only under SUMMARY_DEBUG
 * @param {object} extra structured context
 */
function logSummaryEvent(stage, article, summary, extra = {}) {
  const length = summary ? summary.length : 0;
  console.log(`[ArticleSummary:${stage}] articleId=${article?._id || 'unknown'} length=${length}`, extra);
  if (SUMMARY_DEBUG && summary) {
    console.log(summary);
  }
}

/**
 * @param {*} articleId candidate id straight off the request path
 * @return {Promise<object|null>} the article, or null when absent/unpublished/malformed
 */
async function findPublishedArticle(articleId) {
  // findById would throw a CastError on a malformed id, surfacing as a 500.
  if (!mongoose.Types.ObjectId.isValid(articleId)) {
    return null;
  }

  const article = await Article.findById(articleId).select(
    'title typeOfArticle companyName companyDomainName description articleTags showName imageUrl isAuthentic',
  );

  return article && article.isAuthentic ? article : null;
}

/**
 * @param {*} articleId article the summary belongs to
 * @param {object} data $set / $inc / $setOnInsert fragments
 * @return {Promise<object>} the updated summary document
 */
async function updateSummaryMeta(articleId, data = {}) {
  // `updatedAt` is left to the schema's `timestamps: true`.
  const update = {$set: {...data.set}};

  if (data.inc) {
    update.$inc = data.inc;
  }

  if (data.setOnInsert) {
    update.$setOnInsert = data.setOnInsert;
  }

  const options = {new: true, upsert: true, setDefaultsOnInsert: true};

  try {
    return await ArticleSummary.findOneAndUpdate({articleId}, update, options);
  } catch (error) {
    // Two concurrent upserts can race the unique index on articleId; by the time
    // we retry the loser's document exists, so the update path succeeds.
    if (error.code === 11000) {
      return ArticleSummary.findOneAndUpdate({articleId}, update, options);
    }
    throw error;
  }
}

/**
 * @param {object} record summary document
 * @return {boolean} whether the record is mid-generation and still trustworthy
 */
function isLiveProcessing(record) {
  if (!record || !['pending', 'processing'].includes(record.status)) {
    return false;
  }

  const startedAt = record.lastAttemptAt || record.updatedAt;
  return Boolean(startedAt) && Date.now() - new Date(startedAt).getTime() < PROCESSING_STALE_MS;
}

/**
 * Resolves the summary for an article, generating it only when no usable one exists.
 * @param {object} params article to summarise and the requesting user, if any
 * @return {Promise<object>} the resulting summary document
 */
async function scheduleGeneration({article, requestedBy = null}) {
  const jobKey = String(article._id);
  if (inFlightJobs.has(jobKey)) {
    return inFlightJobs.get(jobKey);
  }

  const job = runGeneration({article, requestedBy})
      // The cleanup has to sit outside the worker: every early return and every
      // throw must release the key, or the article keeps serving this one
      // settled promise for the life of the process.
      .finally(() => inFlightJobs.delete(jobKey));

  inFlightJobs.set(jobKey, job);
  return job;
}

/**
 * @param {object} params article to summarise and the requesting user, if any
 * @return {Promise<object>} the resulting summary document
 */
async function runGeneration({article, requestedBy}) {
  const sourceHash = buildSourceHash(article);
  const existing = await ArticleSummary.findOne({articleId: article._id});

  if (existing && existing.status === 'ready' && existing.sourceHash === sourceHash && existing.summary) {
    return updateSummaryMeta(article._id, {
      set: {requestedBy, lastRequestedAt: new Date()},
      inc: {requestCount: 1},
    });
  }

  if (existing && existing.status === 'failed' && existing.attemptCount >= MAX_SUMMARY_ATTEMPTS) {
    return existing;
  }

  // Another live invocation already owns this article; don't double-spend on the
  // upstream call. A row whose worker died falls through and is retried.
  if (isLiveProcessing(existing)) {
    return existing;
  }

  // Checked before any write so a misconfigured deploy cannot consume the
  // article's retry budget and lock it out permanently.
  assertGeminiConfigured();

  await updateSummaryMeta(article._id, {
    set: {
      status: 'processing',
      summaryVersion: SUMMARY_VERSION,
      sourceHash,
      requestedBy,
      lastRequestedAt: new Date(),
      lastAttemptAt: new Date(),
      errorMessage: '',
    },
    inc: {requestCount: 1, attemptCount: 1},
    setOnInsert: {
      articleId: article._id,
      summary: '',
      generatedAt: null,
    },
  });

  try {
    const prompt = buildPrompt(article);
    const summary = cleanSummaryText(await generateArticleSummary(prompt));
    logSummaryEvent('generated', article, summary, {sourceHash, promptLength: prompt.length});

    if (!summary) {
      return updateSummaryMeta(article._id, {
        set: {
          status: 'failed',
          errorMessage: 'AI returned an empty summary',
          lastAttemptAt: new Date(),
        },
      });
    }

    return updateSummaryMeta(article._id, {
      set: {
        summary,
        status: 'ready',
        generatedAt: new Date(),
        sourceHash,
        summaryVersion: SUMMARY_VERSION,
        errorMessage: '',
        lastAttemptAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[ArticleSummary:error] articleId=${article._id}`, error.message);
    return updateSummaryMeta(article._id, {
      set: {
        status: 'failed',
        errorMessage: error.message || 'Summary generation failed',
        lastAttemptAt: new Date(),
      },
    });
  }
}

module.exports = {
  SUMMARY_VERSION,
  MAX_SUMMARY_ATTEMPTS,
  PROCESSING_STALE_MS,
  buildSourceHash,
  buildPrompt,
  cleanSummaryText,
  logSummaryEvent,
  findPublishedArticle,
  isLiveProcessing,
  updateSummaryMeta,
  scheduleGeneration,
};
