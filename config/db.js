const path = require('path');
const dotenv = require('dotenv');

const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

dotenv.config({path: path.resolve(__dirname, '../.env')});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGOURI);
        console.log('MongoDB Connected...');
    } catch(err) {
        console.error(err.message);
        // Exit process with failure
        process.exit(1);
    }
}

module.exports = connectDB;