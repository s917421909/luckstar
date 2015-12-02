define([
    'socketio',
    'lodash',
    'app',
    'settings'
], function (io, _, app, settings) {

    app.factory('socketSrv', function (httpq, store, $q) {
        var connect = function (namespace) {
            var _socket = settings.socket;
            namespace = namespace || "";
            return io.connect('http://'+_socket.host+':'+_socket.port + namespace);
        };

        return {
            connect: connect,
            init: function (cb) {
                cb = cb || _.noop;
                var self = this;
                this.socket = connect();

                this.socket.on('connect', function () {
                    self.socket.emit('authenticate', {token: store.get('token')});
                    cb();
                });

            },
            // Support user socket service api

            register: function (eventName, cb) {
                var _cb = cb || _.noop;
                this.socket.off(eventName);
                this.socket.on(eventName, _cb);
            },
            changeUserStatus: function (status) {
                this.socket.emit('user change status', status);
            },
            userOnline: function (id) {
                this.socket.emit('user online', id);
            },
            userOffline: function () {
                this.socket.emit('user offline');
            },
            // Support room socket service api
            createRoom: function (room, cb) {
                this.socket.emit('room create', room, cb || _.noop);
            },
            updateRooms: function () {
                this.socket.emit('update rooms');
            },
            joinRoom: function(id){
                this.socket.emit('join room', id);
            },
            leaveRoom: function(){
                this.socket.emit('leave room');
            },
            sendMsg: function (msg) {
                this.socket.emit('send message', msg);
            },
            sendRoomMsg: function (msg) {
                this.socket.emit('send room message', msg);
            },
            readyCompete: function(){
                this.socket.emit('ready compete');
            },
            unreadyComplate: function(){
                this.socket.emit('unready compete');
            },
            terminateCompete: function(){
                this.socket.emit('terminate compete');
            },
            startCompete: function(){
                this.socket.emit('start compete');
            },
            topicCheckOpt: function(opt){
                this.socket.emit('complete check topic', opt);
            },
            getTopic: function(opt){
                this.socket.emit('complete get topic');
            },
            getRoomStat: function(opt){
                this.socket.emit('room get stat');
            },
            saveTopic: function(topic, cb){
                this.socket.emit('topic save', topic, cb || _.noop);
            }
        }
    });

});