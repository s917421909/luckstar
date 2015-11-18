var roomService = require('./room.service');
var userService = require('../user/user.service');
var topicService = require('../topic/topic.service');
var competeSocket = require('./compete.socket');
var log = require('../../log');
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var setting = require('../../config/setting');

var updateRooms = function (socket, roomid) {
    log.info("UpdateRooms");
    var roomid = roomid || socket.room;

    roomService.list().then(function (rooms) {
        if (roomid) {
            var currRoom = _.find(rooms, "id", roomid);
            socket.io.sockets.in(roomid).emit('updateRoom', currRoom);
        }

        socket.io.emit("updateRooms", rooms);
    });
};

var sendRoomSystemMessage = function (socket, content) {
    socket.io.sockets.in(socket.room).emit('updateRoomMessage', {
        content: content,
        system: true,
        time: moment().format()
    });
};

var getAndUpdateRoom = function (socket, id, cb) {
    log.info("GetAndUpdateRoom");
    if (!cb) {
        return;
    }

    roomService.list(id).then(function (rooms) {
        if (rooms && rooms.length == 1) {
            var room = rooms[0];

            userService.list(socket.uid).then(function (users) {
                var postGET = function () {
                    updateRooms(socket, room.id);
                };

                var promise = cb(room, _.first(users));
                promise && promise.then(postGET) || postGET();
            })

        } else {
            if (socket.room === id) {
                socket.leave(id);
                socket.room = null
            }
            log.warn("getAndUpdateRoom: not found room ", id);
        }

    });
};

var joinRoom = function (socket, id) {
    log.info("JoinRoom");
    socket.room = id;
    getAndUpdateRoom(socket, id, function (room, user) {

        socket.join(socket.room);

        userService.joinRoom(user, room);

        if (!_.find(room.users, 'id', user.id)) {

            sendRoomSystemMessage(socket, '用户' + user.username + '加入房间');
            return roomService.save(room, function (locked) {
                locked.users.push(user);
            });
        }

    });
};

var leaveRoom = function (socket) {
    log.info("LeaveRoom");
    var room = socket.room;

    getAndUpdateRoom(socket, room, function (room, user) {

        if (user.id === room.admin.id) {
            room.admin = null;
            socket.io.sockets.in(socket.room).emit('closeRoom');
        }
        socket.leave(room);
        _.remove(room.users, 'id', user.id);

        sendRoomSystemMessage(socket, '用户' + user.username + '离开房间');

        socket.room = null;
        if (_.isEmpty(room.users) || _.isEmpty(room.admin)) {
            return roomService.remove(room);
        } else {
            return roomService.save(room);
        }

    });
};

var sendChatMessage = function (socket, msg) {
    msg.system = false;
    msg.time = moment().format();
    socket.broadcast.to(socket.room).emit('updateRoomMessage', msg);
};

var readyRoomCompete = function (socket) {
    log.info("ReadyRoomCompete");
    getAndUpdateRoom(socket, socket.room, function (room, user) {
        if (room.admin.id !== user.id) {
            log.error('readyRoomCompete: Only admin user can start competition');
            return;
        }
        return new Promise(function (resolve, reject) {
            var countdown = 2;

            (function doCountDown () {
                setTimeout(function () {
                    if (countdown == 0) {
                        resolve(roomService.startCompete(room));
                    } else {
                        sendRoomSystemMessage(socket, countdown-- + '秒后答题开始..');
                        doCountDown();
                    }
                }, 1000);
            }).call(this);
        });
    });
};

var startRoomCompete = function (socket) {
    log.info("StartRoomCompete");

    getAndUpdateRoom(socket, socket.room, function (room, user) {

        if (room.readyUsers.indexOf(user.id) > -1) {
            log.warn("User %s readied", user.id);
            return;
        }

        roomService.save(room, function (locked) {
            locked.readyUsers.push(user.id);
            sendRoomSystemMessage(socket, '用户' + user.username + '已准备就绪.');
        }).then(function (room) {
            if (room.readyUsers.length == room.users.length) {
                roomService.createCompeteState(room).then(function (roomStat) {
                    socket.io.sockets.in(socket.room).emit('updateRoomStat', roomStat);
                });
                competeSocket.nextTopic(socket);
            }
        });
    });
};
var terminateRoomCompete = function (socket) {
    log.info("TerminateRoomCompete");

    getAndUpdateRoom(socket, socket.room, function (room, user) {

        return roomService.terminateCompete(room).then(function () {
            sendRoomSystemMessage(socket, '管理员已终止答题');
        });
    });
};

var getRoomStat = function (socket) {
    log.info("GetRoomStat, "+ socket.room);
    roomService.listRoomStat(socket.room).then(function (roomstat) {
        if(roomstat){
            socket.emit("updateRoomStat", roomstat);
        }

    });
};

exports.updateRooms = updateRooms;
exports.sendRoomSystemMessage = sendRoomSystemMessage;

exports.register = function (socket) {
    var socketService = require('../socket/socket.service');

    socket.on('update rooms', function () {
        socketService.authCall(socket, updateRooms);
    });

    socket.on('join room', function (id) {
        socketService.authCall(socket, joinRoom, id);
    });

    socket.on('leave room', function () {
        socketService.authCall(socket, leaveRoom);
    });

    socket.on('send room message', function (msg) {
        socketService.authCall(socket, sendChatMessage, msg);
    });

    socket.on('ready compete', function () {
        socketService.authCall(socket, readyRoomCompete);
    });
    socket.on('start compete', function () {
        socketService.authCall(socket, startRoomCompete);
    })
    socket.on('terminate compete', function () {
        socketService.authCall(socket, terminateRoomCompete);
    })
    socket.on('room get stat', function () {
        socketService.authCall(socket, getRoomStat);
    })
};

exports.deregister = function (socket) {
    //leaveRoom(socket);
};