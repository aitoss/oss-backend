const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');
const multer = require('multer');
const cors = require('cors');
const app = express();

app.use(
    cors({
      origin: '*',
    }),
);

// Using memory storage to keep the file in memory
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });
require('dotenv').config();
app.use(express.json());


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
  const companyName = req.query.company;
  const tags = req.query.tags;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const baseQuery = { $text: { $search: query } };
  if (companyName) {
    baseQuery.companyName = companyName;
  }
  if (tags) {
    baseQuery.articleTags = { $in: tags.split(',') };
  }

  try {
    const totalArticles = await Article.countDocuments(baseQuery);
    const articles = await Article.find(baseQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    res.json({ totalArticles, articles });
  } catch (error) {
    console.error('Error searching for suggestions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
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

// Image upload route
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append('image', req.file.buffer.toString('base64'));

    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Error uploading image' });
  }
});
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

    await createArticle.save();
    res
        .status(201)
        .json({message: 'Article created successfully', createArticle});
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({message: 'Internal server error'});
  }
});

module.exports = router;