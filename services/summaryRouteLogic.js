const crypto = require('crypto');
const Article = require('../models/Article');
const ArticleSummary = require('../models/ArticleSummary');
const { generateArticleSummary } = require('./geminiSummary');

const SUMMARY_VERSION = 'gemini-2.5-flash-v1';
const MAX_SUMMARY_ATTEMPTS = 3;

const inFlightJobs = new Map();

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

function logSummaryEvent(stage, article, summary, extra = {}) {
  const length = summary ? summary.length : 0;
  console.log(`\n[ArticleSummary:${stage}] articleId=${article?._id || 'unknown'} title=${article?.title || 'unknown'} length=${length}`);
  if (extra && Object.keys(extra).length > 0) {
    console.log('[ArticleSummary:meta]', extra);
  }
  if (summary) {
    console.log(summary);
  }
  console.log('[ArticleSummary:end]\n');
}

async function getArticleOr404(articleId, res) {
  const article = await Article.findById(articleId).select(
    'title typeOfArticle companyName companyDomainName description articleTags showName imageUrl isAuthentic',
  );

  if (!article || !article.isAuthentic) {
    res.status(404).json({ message: 'Article not found' });
    return null;
  }

  return article;
}

async function updateSummaryMeta(articleId, data = {}) {
  const update = {
    $set: {
      updatedAt: new Date(),
      ...data.set,
    },
  };

  if (data.inc) {
    update.$inc = data.inc;
  }

  if (data.setOnInsert) {
    update.$setOnInsert = data.setOnInsert;
  }

  return ArticleSummary.findOneAndUpdate({ articleId }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
}

async function scheduleGeneration({ article, requestedBy = null }) {
  const jobKey = String(article._id);
  if (inFlightJobs.has(jobKey)) {
    return inFlightJobs.get(jobKey);
  }

  const job = (async () => {
    const sourceHash = buildSourceHash(article);
    const existing = await ArticleSummary.findOne({ articleId: article._id });

    if (existing && existing.status === 'ready' && existing.sourceHash === sourceHash && existing.summary) {
      await updateSummaryMeta(article._id, {
        set: {
          requestedBy,
          lastRequestedAt: new Date(),
        },
        inc: { requestCount: 1 },
      });
      return ArticleSummary.findById(existing._id);
    }

    if (existing && existing.status === 'failed' && existing.attemptCount >= MAX_SUMMARY_ATTEMPTS) {
      return existing;
    }

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
      inc: { requestCount: 1, attemptCount: 1 },
      setOnInsert: {
        articleId: article._id,
        summary: '',
        generatedAt: null,
      },
    });

    try {
      const prompt = buildPrompt(article);
      console.log(`\n[ArticleSummary:generate:start] articleId=${article._id} title=${article.title || 'unknown'}`);
      const rawSummary = await generateArticleSummary(prompt);
      logSummaryEvent('raw', article, rawSummary, {
        sourceHash,
        promptLength: prompt.length,
      });

      const summary = cleanSummaryText(rawSummary);
      logSummaryEvent('cleaned', article, summary, {
        sourceHash,
      });

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
      console.error(`[ArticleSummary:generate:error] articleId=${article._id}`, error);
      return updateSummaryMeta(article._id, {
        set: {
          status: 'failed',
          errorMessage: error.message || 'Summary generation failed',
          lastAttemptAt: new Date(),
        },
      });
    } finally {
      inFlightJobs.delete(jobKey);
    }
  })();

  inFlightJobs.set(jobKey, job);
  return job;
}

module.exports = {
  SUMMARY_VERSION,
  MAX_SUMMARY_ATTEMPTS,
  buildSourceHash,
  buildPrompt,
  cleanSummaryText,
  logSummaryEvent,
  getArticleOr404,
  updateSummaryMeta,
  scheduleGeneration,
};