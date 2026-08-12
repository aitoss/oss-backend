const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { LRUCache } = require('lru-cache')
const Article = require('../../models/Article');
const Company = require('../../models/Company');
const User = require('../../models/User');
const ArticleAudit = require('../../models/ArticleAudit');
const { verifySession } = require('supertokens-node/recipe/session/framework/express');
const normalizeCompanyName = require('../../utils/normalizeCompanyName');

// Resolve companyId from either explicit companyId or a companyName (upsert path)
async function resolveCompany({ companyId, companyName }) {
  if (companyId) {
    const company = await Company.findById(companyId);
    if (!company) throw new Error('Invalid companyId');
    return { companyId: company._id, companyName: company.name };
  }
  if (companyName) {
    const normalized = normalizeCompanyName(companyName);
    if (!normalized) return { companyId: null, companyName };
    let company = await Company.findOne({ normalizedName: normalized });
    if (!company) {
      company = await Company.create({ name: companyName.trim(), normalizedName: normalized, status: true });
    }
    return { companyId: company._id, companyName: company.name };
  }
  return { companyId: null, companyName: null };
}
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
      .limit(limit)
      .populate('authorId', 'name email contact logoUrl linkedinUrl');

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
      .limit(limit)
      .populate('authorId', 'name email contact');

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

    const blog = await Article.findById(index)
      .populate('authorId', 'name email contact logoUrl linkedinUrl');

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
  const { companyId, company: companyName, sort = 'relevance' } = req.query;
  const tags = req.query.tags;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const baseQuery = { isAuthentic: true, $text: { $search: query } };
  if (companyId) {
    baseQuery.companyId = companyId;
  } else if (companyName) {
    baseQuery.companyName = companyName;
  }
  if (tags) {
    baseQuery.articleTags = { $in: tags.split(',') };
  }

  const sortOrder = sort === 'date' ? { createdAt: -1 } : { score: { $meta: 'textScore' } };

  try {
    const totalArticles = await Article.countDocuments(baseQuery);
    const articles = await Article.find(baseQuery, { score: { $meta: 'textScore' } })
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'name email contact logoUrl linkedinUrl');

    res.json({ totalArticles, articles });
  } catch (error) {
    console.error('Error searching articles:', error);
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
  const { companyId, company: companyName } = req.query;

  try {
    let query = {};
    if (companyId) {
      query.companyId = companyId;
    } else if (companyName) {
      query.companyName = companyName;
    }

    const [totalArticles, articles] = await Promise.all([
      Article.countDocuments(query),
      Article.find(query).populate('authorId', 'name email contact logoUrl linkedinUrl'),
    ]);

    res.json({ totalArticles, articles });
  } catch (error) {
    console.error('Error fetching company articles:', error);
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

router.get("/countCompanies", async (req, res) => {
  try {
    const data = await Company.aggregate([
      {
        $lookup: {
          from: 'articles',
          let: { companyId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$companyId', '$$companyId'] }, { $eq: ['$isAuthentic', true] }] } } },
          ],
          as: 'articles',
        },
      },
      { $match: { $expr: { $gt: [{ $size: '$articles' }, 0] } } },
      { $sort: { name: 1 } },
      { $project: { _id: 0, company: '$name', domain: 1, count: { $size: '$articles' } } },
    ]);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching company counts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

/**
 * @swagger
 * /api/anubhav/searchCompanies:
 *   get:
 *     summary: Search companies for suggestion dropdown
 *     description: Returns companies matching the query string, ranked text-first (exact > prefix > substring) with article count as a tiebreaker.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search text. If omitted, returns top companies by article count.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: List of company suggestions
 *       500:
 *         description: Server error
 */
router.get('/searchCompanies', async (req, res) => {
  try {
    const rawQ = (req.query.q || '').toString().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = rawQ.toLowerCase().replace(/[^a-z0-9]/g, '');

    const pipeline = [{ $match: { status: true } }];

    if (rawQ) {
      const safe = escapeRegex(rawQ);
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: safe, $options: 'i' } },
            { normalizedName: { $regex: escapeRegex(normalized) } },
          ],
        },
      });
      pipeline.push({
        $addFields: {
          rank: {
            $switch: {
              branches: [
                { case: { $eq: ['$normalizedName', normalized] }, then: 0 },
                { case: { $regexMatch: { input: '$name', regex: `^${safe}`, options: 'i' } }, then: 1 },
              ],
              default: 2,
            },
          },
        },
      });
    } else {
      pipeline.push({ $addFields: { rank: 0 } });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'articles',
          let: { companyId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$companyId', '$$companyId'] }, { $eq: ['$isAuthentic', true] }] } } },
            { $count: 'n' },
          ],
          as: 'articleCount',
        },
      },
      { $addFields: { articleCount: { $ifNull: [{ $arrayElemAt: ['$articleCount.n', 0] }, 0] } } },
      { $sort: { rank: 1, articleCount: -1, name: 1 } },
      { $limit: limit },
      { $project: { _id: 1, company: '$name', domain: 1 } },
    );

    const data = await Company.aggregate(pipeline);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error searching companies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
  const { companyId, company: companyName } = req.query;
  const tags = req.query.tags;

  const baseQuery = { isAuthentic: true, $text: { $search: query } };
  if (companyId) {
    baseQuery.companyId = companyId;
  } else if (companyName) {
    baseQuery.companyName = companyName;
  }
  if (tags) {
    baseQuery.articleTags = { $in: tags.split(',') };
  }

  try {
    const suggestions = await Article.find(baseQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(5)
      .populate('authorId', 'name email contact logoUrl linkedinUrl');

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching similar blogs:', error);
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

router.get('/companies', async (req, res) => {
  try {
    const companies = await Company.find({ status: true }, 'name domain normalizedName').sort({ name: 1 });
    res.json({ companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/blogs', verifySession(), async (req, res) => {
  const {
    title,
    article,
    role,
    articleTags,
    companyId: companyIdInput,
    companyName: companyNameInput,
    image,
  } = req.body;

  if (!image) {
    return res.status(400).json({ message: 'No image provided' });
  }

  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({ supertokensUserId });
    if (!user) {
      return res.status(401).json({ message: 'User not found in local DB' });
    }

    let resolved;
    try {
      resolved = await resolveCompany({ companyId: companyIdInput, companyName: companyNameInput });
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const createArticle = new Article({
      title,
      companyName: resolved.companyName,
      companyId: resolved.companyId,
      description: article,
      typeOfArticle: role,
      articleTags,
      authorId: user._id,
      imageUrl: image,
    });

    await createArticle.save();

    await ArticleAudit.create({
      articleId: createArticle._id,
      userId: user._id,
      action: 'create',
      after: createArticle.toObject(),
    });

    res.status(201).json({ message: 'Article created successfully', createArticle });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/blogs/{id}:
 *   patch:
 *     summary: Edit an existing article (owner only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       403: { description: Not the author }
 *       404: { description: Article not found }
 */
router.patch('/blogs/:id', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({ supertokensUserId });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found' });
    if (!article.authorId || String(article.authorId) !== String(user._id)) {
      return res.status(403).json({ message: 'You are not the author of this article' });
    }

    const before = article.toObject();
    const allowed = ['title', 'description', 'typeOfArticle', 'articleTags', 'imageUrl', 'showName'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    // map FE-friendly names too
    if (req.body.article !== undefined) update.description = req.body.article;
    if (req.body.role !== undefined) update.typeOfArticle = req.body.role;
    if (req.body.image !== undefined) update.imageUrl = req.body.image;

    if (req.body.companyId !== undefined || req.body.companyName !== undefined) {
      try {
        const resolved = await resolveCompany({
          companyId: req.body.companyId,
          companyName: req.body.companyName,
        });
        update.companyId = resolved.companyId;
        update.companyName = resolved.companyName;
      } catch (e) {
        return res.status(400).json({ message: e.message });
      }
    }

    Object.assign(article, update);
    await article.save();
    const after = article.toObject();

    const changedFields = Object.keys(update).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );

    await ArticleAudit.create({
      articleId: article._id,
      userId: user._id,
      action: 'update',
      changedFields,
      before,
      after,
    });

    res.json({ message: 'Article updated', article });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/me:
 *   get:
 *     summary: Get current logged-in user's profile
 *     responses:
 *       200: { description: User profile }
 *       401: { description: Not authenticated }
 */
router.get('/me', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({ supertokensUserId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/me:
 *   patch:
 *     summary: Update current user's profile
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               contact: { type: string }
 *               logoUrl: { type: string }
 *               linkedinUrl: { type: string }
 */
router.patch('/me', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const allowed = ['name', 'contact', 'logoUrl', 'linkedinUrl'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    const user = await User.findOneAndUpdate(
      { supertokensUserId },
      { $set: update },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/me/articles:
 *   get:
 *     summary: List articles authored by the current user
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 */
router.get('/me/articles', verifySession(), async (req, res) => {
  try {
    const supertokensUserId = req.session.getUserId();
    const user = await User.findOne({ supertokensUserId }, '_id');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [total, articles] = await Promise.all([
      Article.countDocuments({ authorId: user._id }),
      Article.find({ authorId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({ total, page, limit, articles });
  } catch (error) {
    console.error('Error listing user articles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/users/{id}:
 *   get:
 *     summary: Public user profile
 *     description: Returns a user's public profile. Email and supertokensUserId are intentionally omitted.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User profile }
 *       404: { description: User not found }
 */
router.get('/users/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await User.findById(
      req.params.id,
      'name contact logoUrl linkedinUrl status createdAt updatedAt',
    );
    if (!user || user.status !== 'active') {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Error fetching public user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/anubhav/users/{id}/articles:
 *   get:
 *     summary: Public list of articles authored by a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated articles }
 *       404: { description: User not found }
 */
router.get('/users/:id/articles', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await User.findById(req.params.id, '_id status');
    if (!user || user.status !== 'active') {
      return res.status(404).json({ message: 'User not found' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [total, articles] = await Promise.all([
      Article.countDocuments({ authorId: user._id }),
      Article.find({ authorId: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({ total, page, limit, articles });
  } catch (error) {
    console.error('Error listing user articles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;