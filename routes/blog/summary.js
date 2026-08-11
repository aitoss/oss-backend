const express = require('express');
const ArticleSummary = require('../../models/ArticleSummary');
const User = require('../../models/User');
const { verifySession } = require('supertokens-node/recipe/session/framework/express');
const {
  buildSourceHash,
  logSummaryEvent,
  getArticleOr404,
  updateSummaryMeta,
  scheduleGeneration,
} = require('../../services/summaryRouteLogic');

const router = express.Router();

router.get('/:id/summary', async (req, res) => {
  try {
    const article = await getArticleOr404(req.params.id, res);
    if (!article) return;

    const sourceHash = buildSourceHash(article);
    const summaryRecord = await ArticleSummary.findOne({ articleId: article._id });

    if (summaryRecord && summaryRecord.status === 'ready' && summaryRecord.sourceHash === sourceHash && summaryRecord.summary) {
      logSummaryEvent('db-hit', article, summaryRecord.summary, {
        summaryVersion: summaryRecord.summaryVersion,
        generatedAt: summaryRecord.generatedAt,
      });
      await updateSummaryMeta(article._id, {
        set: { lastRequestedAt: new Date() },
        inc: { requestCount: 1 },
      });

      return res.json({
        articleId: article._id,
        status: 'ready',
        summary: summaryRecord.summary,
        summaryVersion: summaryRecord.summaryVersion,
        generatedAt: summaryRecord.generatedAt,
      });
    }

    if (summaryRecord && ['pending', 'processing'].includes(summaryRecord.status)) {
      await updateSummaryMeta(article._id, {
        set: { lastRequestedAt: new Date() },
        inc: { requestCount: 1 },
      });

      return res.status(202).json({
        articleId: article._id,
        status: summaryRecord.status,
        message: 'Summary generation is in progress',
      });
    }

    const generated = await scheduleGeneration({ article });

    if (generated && generated.status === 'ready' && generated.summary) {
      logSummaryEvent('db-saved', article, generated.summary, {
        summaryVersion: generated.summaryVersion,
        generatedAt: generated.generatedAt,
      });
      return res.json({
        articleId: article._id,
        status: 'ready',
        summary: generated.summary,
        summaryVersion: generated.summaryVersion,
        generatedAt: generated.generatedAt,
      });
    }

    return res.status(202).json({
      articleId: article._id,
      status: generated ? generated.status : 'pending',
      message: 'Summary generation queued',
      errorMessage: generated ? generated.errorMessage : undefined,
    });
  } catch (error) {
    console.error('Error fetching article summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/summary', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({ supertokensUserId }, '_id');
    if (!user) return res.status(401).json({ message: 'User not found' });

    const article = await getArticleOr404(req.params.id, res);
    if (!article) return;

    const sourceHash = buildSourceHash(article);
    const summaryRecord = await ArticleSummary.findOne({ articleId: article._id });

    if (summaryRecord && summaryRecord.status === 'ready' && summaryRecord.sourceHash === sourceHash && summaryRecord.summary) {
      logSummaryEvent('db-hit', article, summaryRecord.summary, {
        summaryVersion: summaryRecord.summaryVersion,
        generatedAt: summaryRecord.generatedAt,
      });
      await updateSummaryMeta(article._id, {
        set: {
          requestedBy: user._id,
          lastRequestedAt: new Date(),
        },
        inc: { requestCount: 1 },
      });

      return res.json({
        articleId: article._id,
        status: 'ready',
        summary: summaryRecord.summary,
        summaryVersion: summaryRecord.summaryVersion,
        generatedAt: summaryRecord.generatedAt,
      });
    }

    const generated = await scheduleGeneration({ article, requestedBy: user._id });

    if (generated && generated.status === 'ready' && generated.summary) {
      // logSummaryEvent('db-saved', article, generated.summary, {
      //   summaryVersion: generated.summaryVersion,
      //   generatedAt: generated.generatedAt,
      // });
      return res.json({
        articleId: article._id,
        status: 'ready',
        summary: generated.summary,
        summaryVersion: generated.summaryVersion,
        generatedAt: generated.generatedAt,
      });
    }

    return res.status(202).json({
      articleId: article._id,
      status: generated ? generated.status : 'pending',
      message: 'Summary generation queued',
      errorMessage: generated ? generated.errorMessage : undefined,
    });
  } catch (error) {
    console.error('Error requesting article summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/summary/status', async (req, res) => {
  try {
    const article = await getArticleOr404(req.params.id, res);
    if (!article) return;

    const summaryRecord = await ArticleSummary.findOne({ articleId: article._id });
    const currentSourceHash = buildSourceHash(article);

    if (!summaryRecord) {
      return res.json({
        articleId: article._id,
        status: 'missing',
        canRetry: true,
      });
    }

    if (summaryRecord.status === 'ready' && summaryRecord.sourceHash !== currentSourceHash) {
      return res.json({
        articleId: article._id,
        status: 'stale',
        summaryVersion: summaryRecord.summaryVersion,
        generatedAt: summaryRecord.generatedAt,
        lastAttemptAt: summaryRecord.lastAttemptAt,
        attemptCount: summaryRecord.attemptCount,
        canRetry: summaryRecord.attemptCount < MAX_SUMMARY_ATTEMPTS,
      });
    }

    return res.json({
      articleId: article._id,
      status: summaryRecord.status,
      summaryVersion: summaryRecord.summaryVersion,
      generatedAt: summaryRecord.generatedAt,
      lastAttemptAt: summaryRecord.lastAttemptAt,
      attemptCount: summaryRecord.attemptCount,
      errorMessage: summaryRecord.errorMessage,
      canRetry: summaryRecord.status === 'failed' && summaryRecord.attemptCount < MAX_SUMMARY_ATTEMPTS,
      summary: summaryRecord.status === 'ready' && summaryRecord.sourceHash === currentSourceHash ? summaryRecord.summary : undefined,
    });
  } catch (error) {
    console.error('Error fetching summary status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;