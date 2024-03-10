const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');

// @route  GET /api/anubhav/blogs?useLatest=true
// @desc   get all blogs
// @access public
router.get('/blogs', async (req, res) => {
  try {
    const useLatest = req.query.useLatest === 'true';

    if (useLatest) {
      const latestArticles = await Article.find().sort({createdAt: -1}).limit(5);
      res.json(latestArticles);
    } else {
      const blogs = await Article.find({}).sort({createdAt: -1}).limit(10);
      res.json(blogs);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route  GET /api/anubhav/blogs/:id
// @desc   get a single blog by its ID
// @access public
router.get('/blog/:index', async (req, res) => {
  try {
    const index = req.params.index;

    const blog = await Article.findById(index);

    res.json(blog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route  GET /api/anubhav/search
// @desc   implement search and filters
// @access public
router.get('/search', async (req, res) => {
  const query = req.query.q;
  const companyName = req.query.company;
  const tags = req.query.tags;

  const baseQuery = { $text: { $search: query } };

  if (companyName) {
    baseQuery.companyName = companyName;
  }
  if (tags) {
    baseQuery.articleTags = { $in: tags.split(',') }
  }

  try {
    const suggestions = await Article.find(baseQuery, { score: { $meta: 'textScore' }, title: 1 })
      .sort({ score: { $meta: 'textScore' } })
      .limit(5);

    res.json(suggestions);
  } catch (error) {
    console.error('Error searching for suggestions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route  POST /api/anubhav/blogs
// { 
//   "title": "heheh", 
//   "article": "mera blog" , 
//   "role": "Internship",
//   "articleTags": ["1","2"], 
//   "companyName": "FYLE", 
//   "authorName": "HArshal PAtil", 
//   "authorEmailId": "2@gmail.com" 
// }

router.post('/blogs', async (req, res) => {
  const { title, article, role, articleTags, companyName, authorName, authorEmailId } = req.body;

  const createArticle = new Article({
    title,
    companyName,
    description: article,
    typeOfArticle: role,
    articleTags,
    author: {
      name: authorName,
      contact: authorEmailId
    }
  });

  try {
    await createArticle.save();
    res.status(201).json({ message: 'Article created successfully', createArticle });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
