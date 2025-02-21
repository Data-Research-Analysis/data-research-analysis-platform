import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Utility } from './utility/Utility';
import home from './routes/home';

console.log('Starting up Data Research Analysis Marketing API Server');
const app = express();
Utility.getInstance().initialize();
const port = parseInt(Utility.getInstance().getConstants('PORT'));
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '1000mb', extended: true }));
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

app.use('/', home);

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});