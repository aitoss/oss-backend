const { default: mongoose } = require('mongoose');

const reqArticle = new mongoose.Schema({
          requesterName:{
                    type: String,
                    required: true
          },
          requesteeName:{
                    type: String,
                    require: true
          },
          requesteeContact:{
                    type: String,
                    require: true
          },
          company:{
                    type: String,
                    require: true
          },
          note: {
                    type: String,
                    require: true
          }
})

module.exports = mongoose.model('ReArticle', reqArticle);