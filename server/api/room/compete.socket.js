var userService = require('../user/user.service');
var topicService = require('../topic/topic.service');
var roomService = require('./room.service');
var roomSocket = require('./room.socket');
var log = require('../../log');
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var settings = require('../../config/setting');

var nodifyRoom = function (socket, key, obj) {
    socket.io.sockets.in(socket.room).emit(key, obj);
};

var nodifyVerdict = function (socket, room, verdictObj) {
    log.info("NodifyVerdict");

    nodifyRoom(socket, 'topicVerdict', verdictObj);

    roomService.updateRoomStat(room, verdictObj).then(function (competeStat) {
        if (verdictObj.verdict == 0) {
            roomSocket.sendRoomMessage(socket, "第" + competeStat.currNum + "题: 用户" + verdictObj.user.username + "回答错误", true);
        } else if (verdictObj.verdict == 1) {
            roomSocket.sendRoomMessage(socket, "第" + competeStat.currNum + "题: 用户" + verdictObj.user.username + "回答正确", true);
        } else if (verdictObj.verdict == -1) {
            roomSocket.sendRoomMessage(socket, "第" + competeStat.currNum + "题: 答题超时", true);
        }


        setTimeout(function () {
            nodifyRoom(socket, 'updateRoomStat', competeStat);
            if (competeStat.currNum >= competeStat.maxNum) {

                roomService.finishCompete(room, competeStat).then(function () {

                    Promise.map(competeStat.users, function(user){
                        return userService.updatePoint(user.userid, user.point);
                    }).then(function(){
                        roomSocket.updateRooms(socket);
                    })

                })
            } else {
                //nextTopic(socket);
            }
        }, 2000);

    })
};
var topicCountDown = function (socket, topic) {
    log.info("TopicCountDown");
    var number = settings.ROOM.COMPETE_TOPIC_COUNTDOWN;

    roomService.enableRoomCountDown(socket.room);

    (function countdown () {
       setTimeout(function () {

            if (socket.room) {
                roomService.list(socket.room).get(0).then(function (room) {
                    if(room.status == 1){
                        if(!!parseInt(room.countdown)){
                            if (number > 0) {
                                nodifyRoom(socket, 'updateTopicCountdown', --number);
                                countdown();
                            } else {
                                roomService.disableRoomCountDown(room).then(function(){
                                    nodifyVerdict(socket, room, {
                                        verdict: -1
                                    });
                                })
                            }
                        }
                    }


                });
            }

        }, 1000);

    })();

};

function nextTopic (socket) {
    log.info("NextTopic");
    var self = this;
    roomService.list(socket.room).get(0).then(function (room) {
        if(room){
            topicService.get().then(function (topic) {
                delete topic.correct;

                nodifyRoom(socket, 'topicUpdate', topic);

                roomService.update(room, function (locked) {
                    locked.topic = topic._id;
                }).then(function () {
                    roomService.disableRoomCountDown(room).then(function(){
                        topicCountDown(socket, topic);
                    })
                })

            });
        }

    });
};

function checkTopic (socket, answer) {
    log.info("CheckTopic");
    var self = this;

    Promise.props({
        'users': userService.list(socket.uid),
        'rooms': roomService.list(socket.room)
    }).then(function (results) {
        var user = results.users[0];
        var room = results.rooms[0];

        if(_.find(room.users, "id", socket.uid)){
            roomService.disableRoomCountDown(room).then(function(){
                topicService.isCorrect(room.topic, answer).then(function (verdictObj) {
                    verdictObj.user = user;
                    verdictObj.opt = answer;
                    nodifyVerdict(socket, room, verdictObj);
                });
            })
        }else{
            log.warn("User as observer can't able to answer topic ", socket.uid);
        }

    });
};

var getTopic = function (socket) {
    roomService.list(socket.room).then(function (rooms) {
        var room = rooms[0];
        if (room && room.topic) {
            topicService.get(room.topic).then(function (topic) {
                socket.emit('topicUpdate', topic);
            });
        } else {
            log.warn("no current topic in this competition");
        }

    })
}

exports.checkTopic = checkTopic;

exports.nextTopic = nextTopic;

exports.register = function (socket) {
    var ss = require('../socket/socket.service');
    ss.on(socket, 'complete get topic', function () {
        getTopic(socket);
    });

    ss.on(socket, 'complete check topic', function (answer) {
        checkTopic(socket, answer);
    });
};

exports.deregister = function (socket) {
};