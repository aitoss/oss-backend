const express = require('express');
const router = express.Router();
const { LRUCache } = require('lru-cache')
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

const cache = new LRUCache({ max: 100, maxAge: 60000*60*24 });

// Using memory storage to keep the file in memory
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });
require('dotenv').config();
app.use(express.json());


/**
 * @swagger
 * /api/anubhav/blogs:
 *   get:
 *     summary: Get a list of blogs
 *     tags: [Blogs]
 *     description: Retrieve blogs with pagination and optional sorting by latest
 *     parameters:
 *       - in: query
 *         name: useLatest
 *         description: Whether to sort blogs by the most recent
 *         required: false
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         description: The page number to fetch
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Successfully retrieved the blogs
 *       500:
 *         description: Server error
 */

router.get("/blogs", async (req, res) => {
  try {
    const useLatest = req.query.useLatest === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of articles per page

    const query = { isAuthentic: true };
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

/**
 * @swagger
 * /api/anubhav/articles:
 *   get:
 *     summary: Get a list of articles (Admin)
 *     tags: [Blogs]
 *     description: Retrieve articles with pagination and optional sorting by latest
 *     parameters:
 *       - in: query
 *         name: useLatest
 *         description: Whether to sort articles by the most recent
 *         required: false
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         description: The page number to fetch
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Successfully retrieved the articles
 *       500:
 *         description: Server error
 */

router.get("/articles", async (req, res) => {
  try {
    const useLatest = req.query.useLatest === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of articles per page

    const query = {};
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


/**
 * @swagger
 * /api/anubhav/blog/{id}:
 *   get:
 *     summary: Get a single blog by its ID
 *     tags: [Blogs]
 *     description: Retrieve a single blog post by its unique ID
 *     parameters:
 *       - in: path
 *         name: id
 *         description: The ID of the blog post
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved the blog
 *       404:
 *         description: Blog not found
 *       403:
 *         description: Blog is not authentic
 *       500:
 *         description: Server error
 */

router.get('/blog/:index', async (req, res) => {
  try {
    const index = req.params.index;

    if (cache.has(index)) {
      console.log(`Serving blog ${index} from cache`);
      return res.json(cache.get(index)); // Return cached blog data
    }

    const blog = await Article.findById(index);

    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }

    if (!blog.isAuthentic) {
      return res.status(403).json({ msg: 'Blog is not authentic' });
    }
    cache.set(index, blog);
    res.json(blog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


/**
 * @swagger
 * /api/anubhav/search:
 *   get:
 *     summary: Search blogs with filters
 *     description: Search for blogs by query, company name, or tags with pagination
 *     parameters:
 *       - in: query
 *         name: q
 *         description: The search query term
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: company
 *         description: Filter blogs by company name
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         description: Filter blogs by tags (comma separated)
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         description: The page number to fetch
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: The number of blogs per page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *       500:
 *         description: Server error
 */

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


/**
 * @swagger
 * /api/anubhav/getCompany:
 *   get:
 *     summary: Get company articles by company name
 *     tags: [Content]
 *     description: Retrieve articles for a specific company
 *     parameters:
 *       - in: query
 *         name: company
 *         description: The company name to fetch articles for
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved the company articles
 *       500:
 *         description: Server error
 */

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

/**
 * @swagger
 * /api/anubhav/countCompanies:
 *   get:
 *     summary: Get the count of companies and their logos
 *     description: Retrieve a list of companies with their article count and logo
 *     responses:
 *       200:
 *         description: Successfully retrieved company counts
 *       500:
 *         description: Server error
 */

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

/**
 * @swagger
 * /api/anubhav/similarBlogs:
 *   get:
 *     summary: Get similar blogs based on search query
 *     tags: [Blogs]
 *     description: Retrieve similar blogs based on search query, company name, or tags
 *     parameters:
 *       - in: query
 *         name: q
 *         description: The search query term
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: company
 *         description: Filter blogs by company name
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         description: Filter blogs by tags (comma separated)
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved similar blogs
 *       500:
 *         description: Server error
 */

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


/**
 * @swagger
 * /api/anubhav/upload-image:
 *   post:
 *     summary: Upload an image
 *     description: Upload an image to an external service (ImgBB)
 *     parameters:
 *       - in: body
 *         name: image
 *         description: The image to upload
 *         required: true
 *         schema:
 *           type: string
 *           format: binary
 *     responses:
 *       200:
 *         description: Successfully uploaded the image
 *       400:
 *         description: No image data provided
 *       500:
 *         description: Server error
 */

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

/**
 * @swagger
 * /api/anubhav/blogs:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blogs]
 *     description: Create a new blog post with provided details
 *     parameters:
 *       - in: body
 *         name: blog
 *         description: The blog details to create
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *             article:
 *               type: string
 *             role:
 *               type: string
 *             articleTags:
 *               type: array
 *               items:
 *                 type: string
 *             companyName:
 *               type: string
 *             authorName:
 *               type: string
 *             authorEmailId:
 *               type: string
 *             image:
 *               type: string
 *               format: binary
 *     responses:
 *       201:
 *         description: Successfully created the blog
 *       400:
 *         description: No image provided
 *       500:
 *         description: Server error
 */

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