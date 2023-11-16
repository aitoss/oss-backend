const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: [true, 'Please provide the company name'],
  },
  industry: {
    type: String,
    trim: true,
    required: [true, 'Please provide the industry of the company'],
  },
  location: {
    type: String,
    trim: true,
  },
  employees: {
    type: Number,
    min: 0,
  },
  website: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  established: {
    type: Date,
  },
});

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
