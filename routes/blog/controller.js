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

// @route : /api/addBlog/
// @req-type : POSTrouter.route('/:articleId').get(getArticle)

// @description : Add new blog
exports.addBlog = asyncHandler(async (req, res, next) => {
  const response = await axios.get(`https://autocomplete.clearbit.com/api/companies/suggest?query=${req.body.companyName}`);
  let companyDomainName;
  if (response.data.length === 0) {
      companyDomainName = 'https://cdn.pixabay.com/photo/2014/04/02/17/03/globe-307805_960_720.png';
  } else {
      companyDomainName = response.data[0].logo;
  }
  const body = {
      title: req.body.title,
      typeOfBlog: req.body.typeOfBlog,
      companyName: req.body.companyName,
      companyDomainName,
      description: req.body.description,
      blogTags: req.body.blogTags,
      showName: req.body.showName,
      author: {
          name: req.body.author.name,
          contact: req.body.author.contact
      }
  }
  const blog = await Blog.create(body);
  const encryptedString = cryptr.encrypt(blog._id);
  await sendMail(body, encryptedString);
  return res.status(200).json({
      success: true,
      message: 'Blog added successfully',
      blog
  })
});

// @route : /api/blog/:blog
// @req-type : GET
// @description : Get single blog detail by blog id
exports.getBlog = asyncHandler(async (req, res, next) => {
  const Blog = await Blog.find({ _id: req.params.articleId, isAuthentic: true });
  if (Blog.length === 0)
      return next(new ErrorResponse(`No blog with ${req.params.blogId} found !!`, 404));
  Blog.forEach((Blog)=>{
      if(Blog.showName===false){
          Blog.author.name = "AITian";
          Blog.author.contact = "anonymous@aitpune.edu.in";}
  });  
  return res.status(200).json({
      success: true,
      Blog
  });
});

