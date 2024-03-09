const mongoose = require('mongoose');

const reqArticleSchema = new mongoose.Schema({
  requesterName: {
    type: String,
    required: true,
  },
  requesteeName: {
    type: String,
    required: true,
  },
  requesteeContact: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  note: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Draft', 'Requested', 'Complete'],
    default: 'Draft',
  },
});

const ReqArticle = mongoose.model('ReqArticle', reqArticleSchema);
module.exports = ReqArticle;
