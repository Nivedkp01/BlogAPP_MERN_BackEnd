const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: { type: String},
    author: { type: String, } // You can adjust this based on your user schema
}, { _id: false }); // This will prevent mongoose from automatically creating _id for each comment

const postSchema = new mongoose.Schema({
    title: { type: String },
    summary: { type: String },
    fileurl: { type: String },
    content: { type: String },
    totalRating: { type: Number },
    count: { type: Number },
    rate: { type: Number },
    comments: [commentSchema] // Array of comments using the comment schema
}, { timestamps: true });

module.exports = mongoose.model('NewPost', postSchema);
