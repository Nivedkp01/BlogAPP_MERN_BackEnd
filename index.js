const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./Model/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const NewPost = require('./Model/NewPost');

const app = express();
const port = 3000;
const secret = 'MySecretKey';

const uploadMiddle = multer({ dest: 'uploads/' });

app.use(cors({ credentials: true, origin: 'http://localhost:3001' }));
app.use(express.json());
app.use(cookieParser());
app.use('/Uploads', express.static(__dirname + '/Uploads'));

app.get('/', (req, res) => {
  res.send('<h1>Hello World</h1>');
});

mongoose.connect('mongodb+srv://nivedkp001:nivedmon@cluster0.lu0c0be.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userData = await User.create({ username, password: hashedPassword });
    res.json(userData);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try { 
    const userDoc = await User.findOne({ username });

    if (!userDoc) {
      return res.status(400).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(password, userDoc.password);

    if (match) {
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) {
          console.error('Error signing JWT:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.cookie('token', token, { httpOnly: true, secure: true }).json({ id: userDoc._id, username });
      });
      console.log('Login Success');
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error logging in user:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      console.error('Error verifying JWT:', err);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json({ message: 'user logged out' });
});

app.post('/post', uploadMiddle.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const part = parts[parts.length - 1];
  const fullpath = path + '.' + part;
  fs.renameSync(path, fullpath);


  const { title, summary, content } = req.body;
  const postDoc = await NewPost.create({
    title,
    summary,
    content,
    fileurl: fullpath
  });

  res.json(postDoc);
});

app.get('/post', async (req, res) => {
  try {
    let query = {};
    const { search,limit,skip } = req.query;
    const allPosts=await NewPost.find()

    // if (search) {
    //   // If a search query is provided, construct a regex pattern to match posts
    //   query = {
    //     $or: [
    //       { title: { $regex: search, $options: 'i' } }, // Case-insensitive title search
    //       { summary: { $regex: search, $options: 'i' } } // Case-insensitive summary search
    //     ]
    //   };
    // }
    // const filteredPosts = await NewPost.find(query);

    const filteredPosts = allPosts.filter(post => {
      return post.title.toLowerCase().includes(search.toLowerCase());
    });

    const actualPost=filteredPosts.limit(parseInt(limit)).skip(parseInt(skip))
    

    // Send the filtered posts as response
    res.json(filteredPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.post('/rate', async (req, res) => {
  try {
    const { postId, rate } = req.body;

    // Find the document with the given postId
    const RatedPost = await NewPost.findOne({ _id: postId });

    if (!RatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    } else {
      // Update count and sum of ratings
      RatedPost.count = (RatedPost.count || 0) + 1;
      RatedPost.totalRating = (RatedPost.totalRating || 0) + rate;

      // Calculate average rating
      RatedPost.rate = (RatedPost.totalRating / RatedPost.count).toFixed(1);


      await RatedPost.save();

      // Send the response after the operation is completed
      res.json(RatedPost);
    }
  } catch (error) {
    console.error('Error processing rating:', error);
    res.status(500).json({ error: 'Failed to process rating' });
  }
});


app.get('/rate', async (req, res) => {
  const allPost = await NewPost.find();
  res.json(allPost);
});



app.get('/post/:id', async (req, res) => {
  const { id } = req.params
  const selectedPost = await NewPost.findById(id)
  res.json(selectedPost)
})


app.post('/comment', async (req, res) => {
  const { comment, pageId,author } = req.body;
  try {
    const CommentedPost = await NewPost.findById(pageId);
    if (!CommentedPost) {
      return res.status(404).json({ error: "Post not found" });
    }
    CommentedPost.comments.push({ text: comment, author: author });
    const updatedPost = await CommentedPost.save();
    res.json(updatedPost);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




app.get('/comment/:id',async(req,res)=>{
  const {id}=req.params
  const viewComments=await NewPost.findById(id)
  res.json(viewComments)
})


app.put('/post/:id', uploadMiddle.single('file'), async (req, res) => {
  const { id } = req.params;

  try {
    // Extract file details
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const part = parts[parts.length - 1];
    const fullpath = path + '.' + part;
    fs.renameSync(path, fullpath);

    // Extract other fields from the request body
    const { title, summary, content } = req.body;

    // Find the post by ID
    const postDoc = await NewPost.findById(id);

    if (!postDoc) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Update post fields
    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    postDoc.fileurl = fullpath;

    // Save the updated post document
    await postDoc.save();

    // Return the updated post document
    res.json(postDoc);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(port, () => {
  console.log(`Server Running On ${port}`);
});
