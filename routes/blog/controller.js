const Blog = require('./model');

exports.getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({}).exec();
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
