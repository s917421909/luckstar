'use strict';

require('./room-tools.css');
module.exports = ['$scope', 'socketSrv', 'messageCenter', function($scope, socketSrv, messageCenter) {
  $scope.roomstatVisiable = false;

  $scope.showRoomStat = function() {
    if ($scope.roomstatVisiable) {
      $scope.updateRoomstat();
    }
    $scope.roomstatVisiable = !$scope.roomstatVisiable;
  };

  $scope.topicBug = function() {
    messageCenter.confirm('这个题目有问题, 我要举报!').then(function() {
      socketSrv.reportTopicBug();
      messageCenter.notify('我们已经收到您的举报.');
    });
  };
}];
