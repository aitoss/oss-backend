/* eslint-disable no-useless-escape */
const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    required: [true, 'Please provide a Title of Article'],
  },
  typeOfArticle: {
    type: String,
    enum: ['Internship', 'FullTime', 'Interview-experience', 'Hackathon', 'GSOC', 'Off Campus'],
    trim: true,
    required: [true, 'Please provide a Type of Experience'],
  },
  companyName: {
    type: String,
    required: [true, 'Please provide your company name'],
    trim: true,
  },
  companyDomainName: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    required: [true, 'Please provide your Experience in detail'],
  },
  articleTags: {
    type: [String],
  },
  isAuthentic: {
    type: Boolean,
    default: false,
  },
  showName: {
    type: Boolean,
    default: true,
  },
  author: {
    name: { type: String },
    contact: { type: String },
  },
  imageUrl: {
    type: String,
    required: [true, 'Please provide a Image URL'],
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true,
  },
});

// Deletes are soft, so reads exclude them here rather than at ~19 call sites.
// Opt out with `.setOptions({withDeleted: true})`.
const excludeDeleted = function excludeDeleted(next) {
  if (this.getOptions && this.getOptions().withDeleted) return next();
  if (this.getFilter().deletedAt === undefined) this.where({deletedAt: null});
  return next();
};

articleSchema.pre(/^find/, excludeDeleted);
articleSchema.pre('countDocuments', excludeDeleted);
articleSchema.pre('distinct', excludeDeleted);

articleSchema.pre('aggregate', function excludeDeletedFromAggregate(next) {
  if (this.options && this.options.withDeleted) return next();
  this.pipeline().unshift({$match: {deletedAt: null}});
  return next();
});

module.exports = mongoose.model('Article', articleSchema);
