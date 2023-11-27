const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requesterName: {
    type: String,
    trim:true,
    required: [true, 'Please provide requester name'],
},
requesteeName: {
    type: String,
    required: [true, 'Provide Requestee Name'],
},
requesteeContact: {
    type: String,
    required: [true, 'Please provide some direct contact to the requestee'],
},
company: {
    type: String,
    required: [true, 'Please specify which company senior is in !']
},
note:{
    type: String,
    trim: true
}
});

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
