// Creating express Router
const express=require("express")
const router=express.Router()

// @route  GET login
// @desc   get all blogs
// @access public
router.get('/blogs', (req, res) => {
    res.send("blogs")
});

module.exports=router