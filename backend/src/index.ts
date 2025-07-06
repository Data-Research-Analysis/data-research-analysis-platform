import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { UtilityService } from './services/UtilityService';
import home from './routes/home';
import auth from './routes/auth';
import project from './routes/project';
import data_source from './routes/data_source';
import data_model from './routes/data_model';
import dashboard from './routes/dashboard';
import article from './routes/admin/article';
import category from './routes/admin/category';
import image from './routes/admin/image';
import public_article from './routes/article';
import path from 'path';
import "reflect-metadata";

console.log('Starting up Data Research Analysis API Server');
const app = express();
UtilityService.getInstance().initialize();
const port = parseInt(UtilityService.getInstance().getConstants('PORT'));
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '1000mb', extended: true }));
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

app.use('/', home);
app.use('/auth', auth);
app.use('/project', project);
app.use('/data-source', data_source);
app.use('/data-model', data_model);
app.use('/dashboard', dashboard);
app.use('/admin/article', article);
app.use('/admin/category', category);
app.use('/admin/image', image);
app.use('/article', public_article);

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});