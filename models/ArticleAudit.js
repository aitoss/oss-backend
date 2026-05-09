const mongoose = require('mongoose');

const articleAuditSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    changedFields: {
      type: [String],
      default: [],
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model('ArticleAudit', articleAuditSchema);
