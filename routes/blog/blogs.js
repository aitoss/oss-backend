const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');
const multer = require('multer');
const cors = require('cors');
const app = express();
const axios = require('axios');
const FormData = require('form-data');
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
router.get("/blogs", async (req, res) => {
  try {
    const useLatest = req.query.useLatest === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of articles per page

    const query = { };
    if (useLatest) {
      query.sort = { createdAt: -1 };
    }

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .sort(query.sort)
      .skip((page - 1) * limit)
      .limit(limit);

    // Check if there are more articles
    const hasMore = articles.length === limit;

    res.json({ articles, hasMore });
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

    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }

    if (!blog.isAuthentic) {
      return res.status(403).json({ msg: 'Blog is not authentic' });
    }

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

// @route  GET /api/anubhav/companies?company=Microsoft
// @desc Get company articles
router.get('/getCompany', async (req, res) => {
  const companyName = req.query.company;
  console.log("here", companyName);

  try {
    const totalArticles = await Article.countDocuments({ companyName: companyName });
    const articles = await Article.find({ companyName: companyName });
    res.json({ totalArticles, articles });
  } catch (error) {
    console.error('Error searching for suggestions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route  GET /api/anubhav/countCompanies
// @desc   Get the companies and there count with logo
// @access public
router.get("/countCompanies", async (req,res)=>{
  try{
    const allCompanies = await Article.find({ isAuthentic: true }).sort({ companyName: 1 });
    const data = [];
    allCompanies.forEach((article) => {
      let company = article.companyName;
      let domainName = article.companyDomainName;
      let isCompanyFound = false;
      for (let d of data) {
          if (d.company === company) {
              isCompanyFound = true;
              d.count++;
              break;
          }
      }
      if (!isCompanyFound) {
          data.push({
            company,
            domainName,
            count: 1,
          });
      }
  });

  return res.status(200).json({
    success: true,
    data,
  });

  } catch (error) {
    console.error('Error searching for suggestions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

// @route  GET /api/anubhav/search
// @desc   implement search and filters
// @access public
router.get('/similarBlogs', async (req, res) => {
  const query = req.query.q;
  const companyName = req.query.company;
  const tags = req.query.tags;

  const baseQuery = {$text: {$search: query},};
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
// POST /api/upload-image
router.post('/upload-image', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const formData = new FormData();
    formData.append('image', image);

    const imgBBResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      params: {
        key: process.env.IMGBB_API_KEY, 
      },
    });

    res.json(imgBBResponse.data);
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    res.status(500).json({ error: 'Failed to upload image' });
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