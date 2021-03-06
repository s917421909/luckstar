var compose = require('composable-middleware');
var User = require('../user/user.model');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var setting = require('../../config/setting');

function isAuthenticated() {
  return compose()
    .use(function(req, res, next) {
      if (req.query && req.query.hasOwnProperty('access_token')) {
        req.headers.authorization = 'Bearer ' + req.query.access_token;
      }
      expressJwt({secret: SECRET})(req, res, next);

    })
    .use(function(req, res, next) {
      User.findById(req.user.id, '-salt -hashedPassword').exec().then(function(user) {
        if (!user) {
          return res.send(400);
        }
        req.user = user;
        next();
      });
    });
}

function genToken(user) {
  return jwt.sign({id: user.id}, setting.SECRET_KEY, {expiresIn: setting.USER.AUTH_EXPRIES_IN});
}
exports.isAuth = isAuthenticated;
exports.genToken = genToken;
