// @route  GET /api/anubhav/companies
// @desc   Get companies
// @access Public
const express = require('express');
const router = express.Router();
const companyController = require('./controller');

router.get('/companies', companyController.getAllCompanies);

module.exports = router;
