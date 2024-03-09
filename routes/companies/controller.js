const Company = require('./model');

exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find({}).exec();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({error: 'Internal Server Error'});
  }
};
