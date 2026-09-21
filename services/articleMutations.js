const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleAudit = require('../models/ArticleAudit');

/**
 * Domain error carrying the status the route should return, so the service
 * never has to know about `res`.
 */
class ArticleMutationError extends Error {
  /**
   * @param {string} message human-readable reason
   * @param {number} status HTTP status the route should return
   */
  constructor(message, status) {
    super(message);
    this.name = 'ArticleMutationError';
    this.status = status;
  }
}

/**
 * Loads an article the given user is allowed to mutate.
 *
 * Soft-deleted articles are already filtered out by the model, so a second
 * delete or an edit after deletion reads as "not found" rather than silently
 * succeeding.
 *
 * @param {string} articleId id from the request
 * @param {object} user the mongo user document of the caller
 * @return {Promise<object>} the article document
 */
async function loadOwnedArticle(articleId, user) {
  if (!mongoose.Types.ObjectId.isValid(articleId)) {
    throw new ArticleMutationError('Article not found', 404);
  }

  const article = await Article.findById(articleId);
  if (!article) throw new ArticleMutationError('Article not found', 404);

  if (!article.authorId || String(article.authorId) !== String(user._id)) {
    throw new ArticleMutationError(
        'You are not the author of this article', 403);
  }

  return article;
}

/**
 * Marks an article deleted without removing the row, and records who did it.
 *
 * Kept soft so an accidental delete is recoverable and the audit trail still
 * resolves `articleId`; a hard delete would orphan every audit entry.
 *
 * @param {object} input
 * @param {string} input.articleId id of the article to delete
 * @param {object} input.user the mongo user document of the caller
 * @return {Promise<object>} the updated article document
 */
async function softDeleteArticle({articleId, user}) {
  const article = await loadOwnedArticle(articleId, user);
  const before = article.toObject();

  article.deletedAt = new Date();
  await article.save();

  await ArticleAudit.create({
    articleId: article._id,
    userId: user._id,
    action: 'delete',
    changedFields: ['deletedAt'],
    before,
    after: article.toObject(),
  });

  return article;
}

module.exports = {ArticleMutationError, loadOwnedArticle, softDeleteArticle};
