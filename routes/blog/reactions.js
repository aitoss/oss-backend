const express = require('express');
const mongoose = require('mongoose');
const {verifySession} =
  require('supertokens-node/recipe/session/framework/express');

const Article = require('../../models/Article');
const Interaction = require('../../models/Interaction');
const User = require('../../models/User');

const router = express.Router();

const KINDS = ['like', 'save'];

/**
 * Resolves the mongo user behind the SuperTokens session.
 * @param {object} req the express request, with a verified session
 * @return {Promise<object|null>} the user document, or null if none exists
 */
function currentUser(req) {
  return User.findOne({supertokensUserId: req.session.getUserId()})
      .select('_id')
      .lean();
}

/**
 * @swagger
 * /api/anubhav/me/reactions:
 *   get:
 *     summary: Which articles the caller has liked and saved
 *     responses:
 *       200: { description: Two arrays of article ids }
 *       401: { description: Not authenticated }
 */
router.get('/me/reactions', verifySession(), async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({message: 'User not found'});

    const rows = await Interaction.find({'_id.u': user._id}).lean();

    const byKind = {like: [], save: []};
    for (const row of rows) byKind[row._id.k].push(String(row._id.a));

    return res.json({liked: byKind.like, saved: byKind.save});
  } catch (error) {
    console.error('Error reading reactions:', error);
    return res.status(500).json({message: 'Internal server error'});
  }
});

/**
 * @swagger
 * /api/anubhav/me/reactions/articles:
 *   get:
 *     summary: The articles the caller has liked or saved
 *     parameters:
 *       - in: query
 *         name: kind
 *         required: true
 *         schema: { type: string, enum: [like, save] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: A page of articles }
 *       400: { description: Unknown kind }
 *       401: { description: Not authenticated }
 */
router.get('/me/reactions/articles', verifySession(), async (req, res) => {
  try {
    const kind = req.query.kind;
    if (!KINDS.includes(kind)) {
      return res.status(400).json({message: 'kind must be "like" or "save"'});
    }

    const user = await currentUser(req);
    if (!user) return res.status(401).json({message: 'User not found'});

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const filter = {'_id.u': user._id, '_id.k': kind};
    const [total, rows] = await Promise.all([
      Interaction.countDocuments(filter),
      Interaction.find(filter)
          .sort({at: -1})
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
    ]);

    const ids = rows.map((row) => row._id.a);
    const articles = await Article.find({_id: {$in: ids}})
        .populate('authorId', 'name email contact logoUrl linkedinUrl');

    // $in ignores the order it was given, and an article deleted since the
    // reaction drops out here rather than 404ing the whole page.
    const order = new Map(ids.map((id, index) => [String(id), index]));
    articles.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

    return res.json({total, page, limit, articles});
  } catch (error) {
    console.error('Error listing reacted articles:', error);
    return res.status(500).json({message: 'Internal server error'});
  }
});

/**
 * @swagger
 * /api/anubhav/blogs/{id}/reactions:
 *   put:
 *     summary: Like/unlike or save/unsave an article
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kind: { type: string, enum: [like, save] }
 *               value: { type: boolean }
 *     responses:
 *       200: { description: The stored state }
 *       400: { description: Unknown kind }
 *       401: { description: Not authenticated }
 *       404: { description: Article not found }
 */
router.put('/blogs/:id/reactions', verifySession(), async (req, res) => {
  try {
    const kind = req.body.kind;
    if (!KINDS.includes(kind)) {
      return res.status(400).json({message: 'kind must be "like" or "save"'});
    }
    const value = Boolean(req.body.value);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({message: 'Article not found'});
    }

    const user = await currentUser(req);
    if (!user) return res.status(401).json({message: 'User not found'});

    // Checked so rows cannot be written for ids that point at nothing.
    // Soft-deleted articles are already invisible to findById.
    const article = await Article.findById(req.params.id).select('_id').lean();
    if (!article) return res.status(404).json({message: 'Article not found'});

    const id = {a: article._id, u: user._id, k: kind};
    if (value) {
      // Upsert rather than insert: a double tap must not fail on the _id.
      await Interaction.updateOne(
          {_id: id},
          {$setOnInsert: {at: new Date()}},
          {upsert: true},
      );
    } else {
      await Interaction.deleteOne({_id: id});
    }

    return res.json({kind, value, articleId: article._id});
  } catch (error) {
    console.error('Error saving reaction:', error);
    return res.status(500).json({message: 'Internal server error'});
  }
});

module.exports = router;
