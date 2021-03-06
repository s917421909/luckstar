var errorHandler = require('express-error-handler');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var path = require('path');
var express = require('express');

var RSVP = require('rsvp');

module.exports = function(app) {
  //app.set('views', path.join(__dirname, 'views'));
  //app.set('view engine', 'ejs');

  //app.use(favicon(__dirname + '../../../client/libs/images/favicon.ico'));
  //app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(cookieParser());
  //app.use('/static', express.static(path.join(__dirname, '../../client')));

  app.use(errorHandler({dumpExceptions: true, showStack: true}));


};
