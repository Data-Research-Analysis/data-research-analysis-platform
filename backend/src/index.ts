import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { UtilityService } from './services/UtilityService';
import home from './routes/home';
import user from './routes/user';
import project from './routes/project';
import model from './routes/model';

console.log('Starting up Data Research Analysis Marketing API Server');
const app = express();
UtilityService.getInstance().initialize();
const port = parseInt(UtilityService.getInstance().getConstants('PORT'));
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '1000mb', extended: true }));
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

app.use('/', home);
app.use('/user', user);
app.use('/project', project);
app.use('/model', model);

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});