const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  normalizedName: {
    type: String,
    required: true,
    unique: true,
  },
  domain: {
    type: String,
    trim: true,
    default: null,
  },
  logo: {
    type: String,
    default: null,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('Company', companySchema);
