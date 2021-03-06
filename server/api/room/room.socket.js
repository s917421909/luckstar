var roomService = require('./room.service');
var userService = require('../user/user.service');
var topicService = require('../topic/topic.service');

var competeSocket = require('./compete.socket');
var log = require('../../log');
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var setting = require('../../config/setting');
var socketSrv;

function updateRooms(socket) {
  log.verbose("room.socket#UpdateRooms", socket.room);

  return roomService.list().then(function(rooms) {
    roomid = socket.room;
    // if currRoom is null, this room is closed.
    if (!_.isEmpty(roomid)) {
      socket.io.sockets.in(roomid).emit('updateRoom', _.find(rooms, {"id": roomid}));
    }
    socket.io.emit("updateRooms", rooms);
  });
};

function sendRoomMessage(socket, message, isSystem) {
  log.verbose("room.socket#SendRoomMessage", socket.room);

  socket.io.sockets.in(socket.room).emit('updateRoomMessage', {
    message: message,
    system: isSystem,
    time: moment().format()
  });
};

function getRoom(socket, id, cb) {
  log.verbose("room.socket#GetRoom", id);

  roomService.list(id).then(function(room) {
    if (room) {
      userService.list(socket.uid).then(function(user) {
        cb(room, user);
      });
    } else {
      cb(null, null);
      log.warn("GetRoom: not found room ", id);
    }
  });
};

// Only join room as player.
function joinRoom(socket, id) {
  log.verbose("room.socket#JoinRoom", id);
  socket.room = id;

  getRoom(socket, id, function(room, user) {

    if (_.isEmpty(room)) {
      log.verbose("Room is empty for now");
      socket.emit('updateRoom', null);
      return;
    }
    //管理员默认在room.users里面, 如果这句话放倒if中,管理员将得不到房间的消息通知.
    socket.join(socket.room);
    if (!_.find(room.users, {'id': socket.uid})) {
      roomService.join(room, user).then(function(room) {
        return userService.setRoom(socket.uid, room.id).then(function() {
          sendRoomMessage(socket, '用户' + user.username + '加入房间', true);
        });
      }).then(function() {
        updateRooms(socket);
      });
    } else {
      log.verbose("User already in room ", room.id);
      sendRoomMessage(socket, '用户' + user.username + '加入房间', true);
    }
  });
};

function leaveRoom(socket) {
  log.verbose("room.socket#LeaveRoom", socket.room);
  var roomid = socket.room;
  if (_.isEmpty(socket.room)) {
    return;
  }
  /*
   function obPolicy(room, user) {
   sendRoomMessage(socket, '观众' + user.username + '离开房间, 观众' + room.obs.length - 1 + '人', true);
   return roomService.update(room, function(locked) {
   _.pull(locked.obs, user.id);
   });
   }
   */
  getRoom(socket, roomid, function(room, user) {
    var promise = roomService.leave(room, user);
    if (_.isEmpty(promise)) {
      return;
    }
    promise.then(function() {
      //Tell to all player.
      sendRoomMessage(socket, user.username + '离开房间', true);
      return updateRooms(socket)
    }).then(function() {
      socket.emit('updateRoom', null);
      socket.room = '';
      socket.leave(room);
    });
  });

};

function startRoomCompete(socket) {
  log.verbose("room.socket#StartRoomCompete");
  var COUNTDOWN_MAXNUMBER = 3;
  getRoom(socket, socket.room, function(room, user) {
    if (room.admin.id !== user.id) {
      socket.io.sockets.in(socket.room).emit('RoomAlert', '需要管理员开启比赛.');
      return;
    }
    if (room.readyUsers.length == room.users.length) {
      roomService.createCompeteState(room).then(function(roomStat) {
        (function startCountDown(number) {
          setTimeout(function() {
            if (number > 0) {
              socket.io.sockets.in(socket.room).emit('StartCompeteCountDown', number);
              sendRoomMessage(socket, number + '秒后开始...', true);
              startCountDown(--number);
            } else {
              competeSocket.nextTopic(socket);
            }
          }, 1500);
        })(COUNTDOWN_MAXNUMBER);
      });

      roomService.startCompete(room).then(function() {
        updateRooms(socket);
      });
    } else {
      socket.io.sockets.in(socket.room).emit('RoomAlert', '需要全部用户准备就绪后才可开始');
    }

  });
};

function unreadyRoomCompete(socket) {
  log.verbose("room.socket#UnReadyRoomCompete");

  getRoom(socket, socket.room, function(room, user) {

    roomService.update(socket.room, function(locked) {
      var userIndex = locked.readyUsers.indexOf(user.id);

      if (userIndex > -1) {
        _.pullAt(locked.readyUsers, userIndex);
        socket.io.sockets.in(socket.room).emit('updateRoom', locked);
      } else {
        log.warn("User %s was not in ready status yet ", user.id);
      }
    }).then(function() {
      sendRoomMessage(socket, '用户' + user.username + '取消准备.', true);
    });
  });
};
var readyRoomCompete = function(socket) {
  log.verbose("room.socket#ReadyRoomCompete");

  getRoom(socket, socket.room, function(room, user) {

    roomService.update(socket.room, function(locked) {
      if (locked.readyUsers.indexOf(user.id) == -1) {
        locked.readyUsers.push(user.id);
        socket.io.sockets.in(socket.room).emit('updateRoom', locked);
      } else {
        log.warn("User %s was in ready status ", user.id);
      }
    }).then(function() {
      sendRoomMessage(socket, '用户' + user.username + '准备就绪.', true);
    })

  });
};

function terminateRoomCompete(socket) {
  log.verbose("room.socket#TerminateRoomCompete");

  getRoom(socket, socket.room, function(room, user) {
    roomService.terminateCompete(room).then(function() {
      sendRoomMessage(socket, '管理员已终止答题', true);
    }).then(function() {
      updateRooms(socket);
    });
  });
};

function getRoomStat(socket) {
  log.verbose("room.socket#GetRoomStat, " + socket.room);
  return roomService.listRoomStat(socket.room);
};

function createRoom(socket, newroom, cb) {
  log.verbose("room.socket#CreateRoom ", socket.uid, socket.room);

  function do_save() {
    roomService.save(newroom, socket.uid).then(function(room) {
      return userService.setRoom(socket.uid, room.id).then(function() {
        updateRooms(socket);
        cb(room);
      });
    });
  }

  if (socket.room) {
    roomService.list(socket.room).then(function(room) {
      if (_.isEmpty(room)) {
        socket.room = '';
        do_save();
      } else {
        cb({
          error: 'ALREADY_IN_ROOM'
        });
      }
    });
  } else {
    do_save();
  }
};
function inviteUser(socket, userid) {
  log.verbose("room.socket#InviteUser");
  getRoom(socket, socket.room, function(room, me) {
    //make sure that i am a player in room
    if (_.find(room.users, {'id': me.id})) {
      userService.list(userid).then(function(user) {
        var userSocket = socketSrv.getSocketByUser(user);
        if (userSocket) {
          userSocket.emit('inviteUser', {
            'room': socket.room,
            'user': me.username,
            'userid': me.id
          });
        }
      });
    }
  });
}

function inviteUserResponse(socket, userid, response) {
  userService.list(userid).then(function(user) {
    var userSocket = socketSrv.getSocketByUser(user);
    userSocket.emit('inviteUserResponse', {
      response: response,
      username : user.username
    });
  });
};

function kickOff(socket, userid) {
  log.verbose("room.socket#KickOff");
  getRoom(socket, socket.room, function(room, me) {
    if (room.admin.id === me.id) {
      userService.list(userid).then(function(user) {
        roomService.leave(room, user).then(function() {
          var userSocket = socket.io.sockets.connected[user.sid];

          if (userSocket) {
            userSocket.emit('updateRoom', null);
          }
          updateRooms(socket);
        });
      });
    } else {
      log.warn('Only room admin can kick off user.');
    }

  });
}

exports.updateRooms = updateRooms;
exports.sendRoomMessage = sendRoomMessage;


exports.register = function(socket) {
  socketSrv = require('../socket/socket.service');

  socketSrv.on(socket, 'update rooms', function() {
    updateRooms(socket);
  });

  socketSrv.on(socket, 'join room', function(id) {
    joinRoom(socket, id);
  });

  socketSrv.on(socket, 'leave room', function() {
    leaveRoom(socket);
  });

  socketSrv.on(socket, 'send room message', function(msg) {
    sendRoomMessage(socket, msg, false);
  });

  socketSrv.on(socket, 'ready compete', function() {
    readyRoomCompete(socket);
  });

  socketSrv.on(socket, 'unready compete', function() {
    unreadyRoomCompete(socket);
  });

  socketSrv.on(socket, 'start compete', function() {
    startRoomCompete(socket);
  });

  socketSrv.on(socket, 'terminate compete', function() {
    terminateRoomCompete(socket);
  });

  socketSrv.on(socket, 'room get stat', function(cb) {
    getRoomStat(socket).then(cb);
  });

  socketSrv.on(socket, 'room get', function(id, cb) {
    id = id || socket.room;
    if (!_.isEmpty(id)) {
      roomService.list(id).then(cb);
    } else {
      cb({});
    }
  });

  socketSrv.on(socket, 'room create', function(room, cb) {
    createRoom(socket, room, cb);
  });

  socketSrv.on(socket, 'kick off', function(userid) {
    kickOff(socket, userid);
  });
  socketSrv.on(socket, 'invite user', function(userid) {
    inviteUser(socket, userid);
  });

  socketSrv.on(socket, 'invite user response', function(data) {
    inviteUserResponse(socket, data.id, data.response);
  });
};

exports.deregister = function(socket) {
  leaveRoom(socket);
};
