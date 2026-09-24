const mongoose = require('mongoose');

/**
 * One row per (article, user, kind) reaction.
 *
 * Kept out of the user document so counting reactions for an article stays a
 * single indexed query instead of a scan over every user's arrays. The
 * composite _id makes a repeated like a no-op rather than a duplicate.
 */
const interactionSchema = new mongoose.Schema(
    {
      _id: {
        a: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Article',
          required: true,
        },
        u: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        k: {
          type: String,
          enum: ['like', 'save'],
          required: true,
        },
      },
      at: {
        type: Date,
        default: Date.now,
      },
    },
    {_id: false},
);

// Covers both "what has this user reacted to" and "who reacted to this
// article", which is the count query the arrays would have made slow.
interactionSchema.index({'_id.u': 1, '_id.k': 1, 'at': -1});
interactionSchema.index({'_id.a': 1, '_id.k': 1});

module.exports = mongoose.model('Interaction', interactionSchema);
