const express = require('express');
const rateLimit = require('express-rate-limit');
const ArticleSummary = require('../../models/ArticleSummary');
const User = require('../../models/User');
const {verifySession} = require('supertokens-node/recipe/session/framework/express');
const {
  MAX_SUMMARY_ATTEMPTS,
  buildSourceHash,
  logSummaryEvent,
  findPublishedArticle,
  updateSummaryMeta,
  scheduleGeneration,
} = require('../../services/summaryRouteLogic');

const router = express.Router();

// Tighter than the global 500/min because these routes can reach a paid upstream,
// but still roomy: a whole campus shares one public IP (see server.js), and once
// an article is summarised every later read is a cache hit that costs nothing.
const summaryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: {message: 'Too many summary requests, please try again later.'},
});

router.use(summaryLimiter);

/**
 * Shapes the payload returned for a usable summary.
 * @param {object} article the summarised article
 * @param {object} record the summary document
 * @return {object} response body
 */
function readySummaryResponse(article, record) {
  return {
    articleId: article._id,
    status: 'ready',
    summary: record.summary,
    summaryVersion: record.summaryVersion,
    generatedAt: record.generatedAt,
  };
}

/**
 * @param {object} record summary document, if one exists
 * @param {string} sourceHash hash of the article as it stands now
 * @return {boolean} whether the stored summary still matches the article
 */
function isUsable(record, sourceHash) {
  return Boolean(record && record.status === 'ready' && record.sourceHash === sourceHash && record.summary);
}

/**
 * A missing API key is an operator problem, not a client one, so it must not be
 * reported as a generic 500.
 * @param {Error} error failure raised while resolving a summary
 * @param {object} res express response
 * @param {string} context log label
 * @return {object} the express response
 */
function handleSummaryError(error, res, context) {
  if (error.code === 'CONFIG_ERROR') {
    console.error(`[${context}] summary generation is not configured:`, error.message);
    return res.status(503).json({message: 'Summary generation is temporarily unavailable'});
  }

  console.error(`[${context}]`, error);
  return res.status(500).json({message: 'Internal server error'});
}

router.get('/:id/summary', async (req, res) => {
  try {
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({message: 'Article not found'});

    const sourceHash = buildSourceHash(article);
    const summaryRecord = await ArticleSummary.findOne({articleId: article._id});

    if (isUsable(summaryRecord, sourceHash)) {
      logSummaryEvent('db-hit', article, summaryRecord.summary, {
        summaryVersion: summaryRecord.summaryVersion,
      });
      await updateSummaryMeta(article._id, {
        set: {lastRequestedAt: new Date()},
        inc: {requestCount: 1},
      });

      return res.json(readySummaryResponse(article, summaryRecord));
    }

    const generated = await scheduleGeneration({article});

    if (generated && generated.status === 'ready' && generated.summary) {
      return res.json(readySummaryResponse(article, generated));
    }

    return res.status(202).json({
      articleId: article._id,
      status: generated ? generated.status : 'pending',
      message: 'Summary generation queued',
      errorMessage: generated ? generated.errorMessage : undefined,
    });
  } catch (error) {
    return handleSummaryError(error, res, 'summary:get');
  }
});

router.post('/:id/summary', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({supertokensUserId}, '_id');
    if (!user) return res.status(401).json({message: 'User not found'});

    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({message: 'Article not found'});

    const sourceHash = buildSourceHash(article);
    const summaryRecord = await ArticleSummary.findOne({articleId: article._id});

    if (isUsable(summaryRecord, sourceHash)) {
      await updateSummaryMeta(article._id, {
        set: {requestedBy: user._id, lastRequestedAt: new Date()},
        inc: {requestCount: 1},
      });

      return res.json(readySummaryResponse(article, summaryRecord));
    }

    const generated = await scheduleGeneration({article, requestedBy: user._id});

    if (generated && generated.status === 'ready' && generated.summary) {
      return res.json(readySummaryResponse(article, generated));
    }

    return res.status(202).json({
      articleId: article._id,
      status: generated ? generated.status : 'pending',
      message: 'Summary generation queued',
      errorMessage: generated ? generated.errorMessage : undefined,
    });
  } catch (error) {
    return handleSummaryError(error, res, 'summary:post');
  }
});

router.get('/:id/summary/status', async (req, res) => {
  try {
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({message: 'Article not found'});

    const summaryRecord = await ArticleSummary.findOne({articleId: article._id});
    const currentSourceHash = buildSourceHash(article);

    if (!summaryRecord) {
      return res.json({
        articleId: article._id,
        status: 'missing',
        canRetry: true,
      });
    }

    const isStale = summaryRecord.status === 'ready' && summaryRecord.sourceHash !== currentSourceHash;
    const retriesLeft = summaryRecord.attemptCount < MAX_SUMMARY_ATTEMPTS;

    return res.json({
      articleId: article._id,
      status: isStale ? 'stale' : summaryRecord.status,
      summaryVersion: summaryRecord.summaryVersion,
      generatedAt: summaryRecord.generatedAt,
      lastAttemptAt: summaryRecord.lastAttemptAt,
      attemptCount: summaryRecord.attemptCount,
      errorMessage: summaryRecord.errorMessage || undefined,
      canRetry: isStale ? retriesLeft : summaryRecord.status === 'failed' && retriesLeft,
      summary: isStale || summaryRecord.status !== 'ready' ? undefined : summaryRecord.summary,
    });
  } catch (error) {
    return handleSummaryError(error, res, 'summary:status');
  }
});

module.exports = router;
