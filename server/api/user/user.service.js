"use strict";
var db = require('../redis/redis.service');

var Promise = require('bluebird');
var _ = require('lodash');
var log = require('../../log');
var setting = require('../../config/setting');

var update = function(id, setFunc) {
  return db.saveObj("users", id, function(lockedUser) {
    setFunc(lockedUser);
    return lockedUser;
  });
};

exports.online = function(id) {
  log.debug("user.service#UserOnline", id);
  return db.set("users:" + id, "state", 1);
};

exports.changeStatus = function(id, status) {
  log.debug("user.service#ChangeStatus", id, status);
  return db.set("users:" + id, "status", status);
};

exports.offline = function(id) {
  log.debug("user.service#UserOffline", id);
  return db.set("users:" + id, "state", 0).then(function() {
    this.changeStatus(id, setting.USER.STATUS.OFFLINE);
  }.bind(this));
};

exports.add = function(user) {
  log.debug("user.service#AddUser", user.id);

  if (user.id) {
    return db.saveObj("users", {
      avatar: user.avatar,
      point: user.point,
      id: user.id,
      status: setting.USER.STATUS.OFFLINE,
      state: 0,
      username: user.username,
      sid: ''
    })
  } else {
    log.error("addUser: invalid id", user);
  }

};

exports.joinRoom = function(userid, room) {
  log.debug("user.service#JoinRoom", userid, room.id);
  return update(userid, function(lockedUser) {
    lockedUser.room = room.id;
  });
};

exports.updatePoint = function(uid, point) {
  log.debug("user.service#UpdatePoint", uid, point);
  return this.list(uid).get(0).then(function(user) {
    return update(user.id, function(lockedUser) {
      lockedUser.point = parseInt(user.point) + parseInt(point);
    });
  });
};

exports.list = function(ids) {

  if (ids === undefined) {
    return db.listObj("users", ids);
  } else if (_.isString(ids) && ids !== "") {
    return db.listObj("users", ids);
  } else if (_.isArray(ids)) {
    return Promise.all(_.map(ids, function(id) {
      return db.listObj("users", id)
    })).then(_.flatten);
  } else {
    return Promise.resolve();
  }

};
