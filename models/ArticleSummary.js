const mongoose = require('mongoose');

const articleSummarySchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
      unique: true,
      index: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
      index: true,
    },
    summaryVersion: {
      type: String,
      default: '1',
      trim: true,
    },
    sourceHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    lastRequestedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('ArticleSummary', articleSummarySchema);