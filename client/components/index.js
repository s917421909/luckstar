'use strict';

module.exports = angular.module('luckstar.components', [require('./utils')])
.service('authSrv', require('./auth-service'))
.service('socketSrv', require('./socket-service'))
.service('navbarSrv', require('./navbar-service'))
.service('roomSrv', require('./room-service'))
.service('fileSrv', require('./fileService'))
.service('utilSrv', require('./utilService')).name;
