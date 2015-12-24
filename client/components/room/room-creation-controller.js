define([
    'angular'
], function (angular) {
    "use strict";

    angular.module('luckStar').controller('roomCreationCtrl', function ($scope, $location, $timeout, socketSrv, messageCenter) {
        $scope.numbers = [
            {'value': '1', 'label': '单人答题'},
            {'value': '2', 'label': '2人对战'},
            {'value': '3', 'label': '3人对战'},
            {'value': '4', 'label': '4人对战'},
            {'value': '5', 'label': '5人对战'},
        ]

        $scope.newroom = {
            mode: 0,
            title: "",
            number: $scope.numbers[0].value
        }

        $scope.create = function () {
            socketSrv.createRoom(_.clone($scope.newroom), function (message) {
                if (message.id) {
                    messageCenter.notify('房间' + $scope.newroom.title + '创建成功');
                    $location.path('/home/rooms/' + message.id);
                } else {
                    if (message.error == "ALREADY_IN_ROOM") {
                        messageCenter.confirm({
                            title: '创建提示',
                            content: '不可以同时进入多个房间中, 是否需要退出之前的房间.'
                        }).then(function () {
                            socketSrv.leaveRoom();
                            $timeout(function () {
                                $scope.create();
                            }, 1000);
                        });
                    }

                }
            })
        };
    });

});
