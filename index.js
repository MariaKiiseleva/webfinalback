import express from 'express';
import multer from 'multer';
import cors from 'cors';
import mongoose from 'mongoose';
import {registerValidation, loginValidation, postCreateValidation} from './validations.js';
import checkAuth from './utils/checkAuth.js';
import * as UserController from './controllers/UserController.js';
import * as PostController from './controllers/PostController.js';
import pkg from 'nodemon';
import handleValidationErrors from "./utils/handleValidationErrors.js";
const { on, once } = pkg;
import mime from 'mime-types';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

mongoose.connect(
    'mongodb+srv://admin:admin@cluster0.fm1uf.mongodb.net/blog?retryWrites=true&w=majority&appName=Cluster0',
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        tls: true,
        tlsAllowInvalidCertificates: true
    }
).then(() => console.log('Connected to DB successfully'))
    .catch((err) => {
        console.error('Error connecting to DB:', err.message);
        if (err.name === 'MongoNetworkError') {
            console.error('Is MongoDB running? Check connection string');
        }
    });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('Connected to MongoDB Atlas');
});



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({storage});

app.use(cors());



app.use('/uploads', express.static('uploads'));

app.post('/auth/login',loginValidation,handleValidationErrors, UserController.login);
app.post('/auth/register', registerValidation,handleValidationErrors,UserController.register);
app.get('/auth/me',checkAuth ,UserController.getMe);

app.post('/upload', checkAuth, upload.single('image'), async (req, res) => {
    try {
        //console.log('File received:', req.file ? req.file.originalname : 'No file');
        //console.log('File size:', req.file ? req.file.size : 'Not available', 'bytes');

        const originalName = req.file ? req.file.originalname : '';
        const mimeType = mime.lookup(originalName);

        if (!mimeType || !['image/jpeg', 'image/png'].includes(mimeType)) {
            console.log('Invalid MIME type:', mimeType);
            return res.status(400).json({ error: 'Only JPEG and PNG images are allowed' });
        }

        if (req.file && req.file.size > 15 * 1024 * 1024) {
            console.log('File exceeds size limit:', req.file.size, 'bytes');
            return res.status(400).json({ error: 'File too large' });
        }

        // Получаем абсолютный путь к директории проекта
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        // Создаем путь к директории загрузок
        const uploadsDir = path.join(__dirname, 'uploads');

        await fs.rename(req.file.path, path.join(uploadsDir, req.file ? req.file.filename : ''));

        res.json({
            url: `/uploads/${req.file ? req.file.filename : ''}`,
        });
    } catch (err) {
        console.error('Error uploading file:', err);
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err.message);
            res.status(500).json({ error: 'Upload failed', details: err.message });
        } else {
            console.error('Other error:', err.message);
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    }
});

app.get('/tags', PostController.getLastTags);

app.get('/posts',PostController.getAll);
app.get('/posts/tags',PostController.getLastTags);
app.get('/posts:id',PostController.getOne);
app.post('/posts',checkAuth ,postCreateValidation,handleValidationErrors,PostController.create);
app.delete('/posts:id',checkAuth,PostController.remove);
app.patch('/posts:id',checkAuth,postCreateValidation,handleValidationErrors,PostController.update);

const port = process.env.PORT || 3003;
app.listen(port, (err) => {
    if(err){
        return console.log(err);
    }

    console.log('Server OK')
});