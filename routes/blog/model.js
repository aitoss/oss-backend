const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    required: [true, 'Please provide a Title of Blog'],
  },
  typeOfBlog: {
    type: String,
    enum: ['Internship', 'FullTime', 'Interview-experience'],
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
  blogTags: {
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
    name: {
      type: String,
      required: [true, 'Please provide your Name'],
    },
    contact: {
      type: String,
      required: [true, 'Please provide a point of contact (any social medial URLs) !'],
    },
  },
});

const Blog = mongoose.model('Blog', articleSchema);

module.exports = Blog;
