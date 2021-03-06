'use strict';

require('./room-statistic-directive.css');

module.exports = ['$timeout', function($timeout) {
  return {
    scope: {
      room: '=',
      roomstat: '='
    },
    template: require('./room-statistic.html'),
    controller: ['$scope', 'roomSrv', function($scope, roomSrv) {
      $scope.statTable = false;
      roomSrv.onEndCompetition($scope.setScorebarWidth);

      $scope.switchStatTable = function() {
        $scope.statTable = !$scope.statTable;
        $scope.statTable || $scope.setScorebarWidth();
      };

      // Fix F5 issue.
      $timeout(function() {
        $scope.setScorebarWidth();
      }, 500);
    }],
    link: function(scope, elem) {
      var $elem = $(elem);
      scope.setScorebarWidth = function() {
        $timeout(function() {
          var _stat = scope.roomstat;
          if (_stat) {
            $elem.find('.statistic .progress>.progress-bar').each(function(index) {
              $(this).width(_stat.users[index].point / _stat.maxNum * 10 + '%');
            });

            $timeout(function() {
              $elem.find('.statistic .progress>.progress-bar').removeClass('active');
            }, 2000);
          }
        });
      };
    }
  };
}];
