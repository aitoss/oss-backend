const Request = require('./model');

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await Request.find({}).exec();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
