
var express = require('express');
var path = require('path');
var api = require('./routes/main');

var app = express();

app.use(express.static(path.join(__dirname, 'public'))); /* Public folder is served staticaly */

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.use('/api', api); /* redirect to routes */
app.use('/*', express.static(path.join(__dirname, 'public')));

app.listen(8000, function () {
  console.log('Example app listening on port 8000!');
});

module.exports = app;