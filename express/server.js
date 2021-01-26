'use strict';
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const jsdom = require("jsdom");
const fs = require('fs');
const {JSDOM} = jsdom;
const fetch = require("node-fetch");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

let tokenType;
let accessToken;

const dbAllegro = low(new FileSync('allegroCategories.json'));
const dbOlx = low(new FileSync('olxCategories.json'));

const ALLEGRO_CLIENT_ID = "aea655fde4f04b349a4bbad8102296a3";
const ALLEGRO_CLIENT_SECRET = "MVe8KDA305fHqWZrtzY9Ce3maTJ2bDTVdmfTEbnNAThLtFUsF1VsU6YELDYuVfLE";
const ALLEGRO_API_URL = "https://api.allegro.pl";
const OLX_URL = "https://www.olx.pl";

const router = express.Router();
router.get('/', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write('<h1>Hello from Express.js!</h1>');
  res.end();
});
router.get('/another', (req, res) => res.json({ route: req.originalUrl }));
router.post('/', (req, res) => res.json({ postBody: req.body }));
router.get('/allegro/categories', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(dbAllegro.read().value()));
});

app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
//app.use(cors());
//app.use(express.static('client'));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit: '50mb', extended: true}));

module.exports = app;
module.exports.handler = serverless(app);
