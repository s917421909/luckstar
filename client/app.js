define([
        'angular',
        'jquery',
        'moment',
        'moment-zh',
        'lodash',
        'require',
        'bootstrap',
        'angular-ui-route',
        'angular-cookie',
        'angular-animate',
        'angular-sanitize',
        'angular-resource',
        'angular-strap',
        'angular-strap-tpl',
    ],
    function (angular, $, moment) {
        "use strict";

        var componentRequires = [
            'common/all',
            'matches/all',
            'topics/all',
            'users/all',
            'components/all',
            'components/all'
        ];

        var apps_deps = [
            'luckStar',
            'luckStar.matches',
            'luckStar.topics',
            'luckStar.users',
        ];

        moment.locale('zh-cn');

        var app = angular.module('luckStar', ['ui.router', 'ngAnimate', 'ngResource', 'ngSanitize', 'mgcrea.ngStrap']);

        app.config(function ($stateProvider, $urlRouterProvider, $httpProvider, $locationProvider) {
            $urlRouterProvider.otherwise("/login");
            $stateProvider
                .state('index', {
                    abstract: true,
                    templateUrl: "/index-tpl.html"
                })
                .state('home', {
                    templateUrl: '/home-tpl.html',
                    controller: 'homeCtrl',
                    resolve: {
                        user: function (authSrv) {
                            return authSrv.getCurrentUser().$promise;
                        }
                    }
                })
                .state('home.index', {
                    url: "/home",
                    templateUrl: 'home.html',
                });

            $locationProvider.html5Mode(true);
            $httpProvider.interceptors.push('authInterceptor');
        })
            .factory('authInterceptor', function ($rootScope, $q, store, $window) {
                return {
                    request: function (config) {
                        config.headers = config.headers || {};
                        if (store.get('token')) {
                            config.headers.Authorization = 'Bearer ' + store.get('token');
                        }
                        return config;
                    },

                    responseError: function (response) {
                        console.info("response error", response.status);
                        if (response.status === 401) {
                            store.delete('token');
                            $window.location = '/';
                            //$location.path('/'); sometime browser cannot jump to path '/'.
                            return $q.reject(response);
                        }
                        else {
                            return $q.reject(response);
                        }
                    }
                };
            })
            .boot = function (cb) {
            require(componentRequires, function () {
                (cb || function () {
                    angular
                        .element(document)
                        .ready(function () {
                            angular.bootstrap(document, apps_deps)
                                .invoke(['$rootScope', '$location', 'store', function ($rootScope, $location, store) {
                                    $rootScope.$on('$stateChangeSuccess',
                                        function (event, toState, toParams, fromState, fromParams) {
                                            if (_.startsWith(toState.url, '/home') && !store.get('token')) {
                                                //event.preventDefault();
                                                $location.path('/');
                                            }
                                        })
                                }]);
                        });
                })();
            });
        };

        app.factory('store', function ($window) {
            return {
                get: function (key) {
                    return $window.localStorage[key];
                },
                set: function (key, value) {
                    $window.localStorage[key] = value;
                },
                getBool: function (key) {
                    return $window.localStorage[key] === 'true' ? true : false;
                },
                delete: function (key) {
                    $window.localStorage.removeItem(key);
                },
                deleteAll: function () {
                    $window.localStorage.clear();
                }

            };

        });

        app.factory('httpq', function ($http, $q) {
            return {
                get: function () {
                    var deferred = $q.defer();
                    $http.get.apply(null, arguments)
                        .success(deferred.resolve)
                        .error(deferred.reject);
                    return deferred.promise;
                },
                post: function () {
                    var deferred = $q.defer();
                    $http.post.apply(null, arguments)
                        .success(deferred.resolve)
                        .error(deferred.reject);
                    return deferred.promise;
                }
            }
        });
        return app;
    });
