const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');
const mongoose = require('mongoose')
const algoliasearch = require("algoliasearch")
const { v4: uuid } = require('uuid');
// const multer = require('multer');
const cors = require('cors');
const app = express();

const client = algoliasearch('TECKNOOFBW', 'f6fe142af541c3fd4d51d48d626d2252')

const index = client.initIndex('blog_name');

app.use(
    cors({
      origin: '*',
    }),
);

// @route  GET /api/anubhav/blogs?useLatest=true
// @desc   get all blogs
// @access public
router.get('/blogs', async (req, res) => {
  try {
    const useLatest = req.query.useLatest === 'true';

    if (useLatest) {
      const latestArticles = await Article.find()
          .sort({createdAt: -1})
          .limit(5);
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

router.get('/startMigration', async (req, res) => {
    try {
        //mongoose.connect('mongodb://admin:password@localhost:27017/ANUBHAV-AITOSS', { useNewUrlParser: true, useUnifiedTopology: true });
        const articleSchema = new mongoose.Schema({
            id: String,
            title: String,
            typeOfArticle: String,
            companyName: String,
            description: String,
            articleTags: [String],
            isAuthentic: Boolean,
            showName: Boolean,
            author: {
                name: String,
                contact: String
            },
            imageUrl: String,
            createdAt: Date
        });

        const Article = mongoose.model('articles', articleSchema);

        const articles = await Article.find();

        await index.saveObjects(articles.map(article => ({
            title: article.title,
            authorName: article.author.name,
            objectID: article._id
        })));
        
        console.log("Data Migration to algolia completed succesfully")
    } catch (error) {
        console.error('Error Migrating Data to algolia', error)
    }
});

// @route  GET /api/anubhav/blog/:id
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

    console.log(query)

    index.search(query).then(({hits}) => {
        res.status(200).json({ results: hits })
    });
});


// @route  GET /api/anubhav/search
// @desc   implement search and filters
// @access public
router.get('/similarBlogs', async (req, res) => {
  const query = req.query.q;
  const companyName = req.query.company;
  const tags = req.query.tags;

  const baseQuery = {$text: {$search: query}};
  if (companyName) {
    baseQuery.companyName = companyName;
  }
  if (tags) {
    baseQuery.articleTags = {$in: tags.split(',')};
  }

  try {
    const suggestions = await Article.find(baseQuery, {
      score: {$meta: 'textScore'},
    })
        .sort({score: {$meta: 'textScore'}})
        .limit(5);

    res.json(suggestions);
  } catch (error) {
    console.error('Error searching for suggestions:', error);
    res.status(500).json({message: 'Internal server error'});
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

// Multer configuration
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   }
// });

// const upload = multer({ storage: storage });

// POST route with Multer middleware for file uploads
router.post('/blogs', async (req, res) => {
  const {
    title,
    article,
    role,
    articleTags,
    companyName,
    authorName,
    authorEmailId,
    image,
  } = req.body;

  // Check if image data is provided
  if (!image) {
    return res.status(400).json({message: 'No image provided'});
  }

  try {
    const createArticle = new Article({
      title,
      companyName,
      description: article,
      typeOfArticle: role,
      articleTags,
      author: {
        name: authorName,
        contact: authorEmailId,
      },
      imageUrl: image,
    });

    const savedarticle = await createArticle.save();
    const articleId = savedArticle._id;

    const objectForAlgolia = [{
        title: title,
        author: authorName,
        objectID: articleId,
    }]

    const response = await index.saveObjects(objectForAlgolia, {autoGenerateObjectIDIfNotExist: true})
    if(!response || response.error) {
        console.error("Error Uploading objects to Algolia: ", response ? response.message: "Unknown Error");
        return res.status(500).json({ message: 'Failed to Upload article to Algolia' });
    }
    res
        .status(201)
        .json({message: 'Article created successfully', createArticle});
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({message: 'Internal server error'});
  }
});

module.exports = router;
