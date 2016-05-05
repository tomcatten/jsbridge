define('biliapp', function() {
    'use strict';

    var currentData = null;
    var currentCallback = null;
    var MAX_TIME = 5;

    var apis = [
        'openScheme', 'closeBrowser',
        'setTitle', 'setShareContent',
        'alert', 'setBackHandler'
    ];

    var apis2 = [
        'openScheme', 'closeBrowser',
        'setTitle', 'setShareContent',
        'alert', 'setBackHandler',
        'getUserInfo', 'jumpToScheme',
        'config', 'alipay', 'confirm',
        'wechatpay'
    ];

    var queue = function(worker) {
        return {
            timeout: null,
            running: false,
            tasks: [],
            push: function(data, cb) {
                var callback = cb || function(data) {};
                q.tasks.push({
                    data: data,
                    callback: callback
                });
                setTimeout(function() {
                    q.process();
                }, 0);
            },
            dequeue: function() {
                currentCallback && currentCallback();
            },
            process: function() {
                if (q.tasks.length && !q.running) {
                    var task = q.tasks.shift();
                    q.running = true;
                    currentCallback = function() {
                        q.running = false;
                        task.callback(task.data);
                        q.process();
                    };
                    currentData = task.data;
                    worker(task.data, currentCallback);
                }
            }
        }
    }

    var q = queue(function(data) {
        _biliapp._doSendMessage(data.method, data.args, data.callback, data.handle);
    });

    var callbacksCount = 1;
    var _maxTime = MAX_TIME;


    function getQueryString(name) {
        var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return unescape(r[2]);
        return null;
    }

    var _biliapp = {
        _callbacks: {},
        _dequeueTimeout: null,
        isSupport: function(funcName) {
            var platform = getQueryString('platform');
            var build = getQueryString('build');
            if (platform == 'ios' && build < 2020) {
                return false;
            } else if (platform == 'android' && build < 408010) {
                return false;
            }
            return true;
        },
        dequeue: function() {
            var self = this;
            setTimeout(function() {
                clearTimeout(self._dequeueTimeout);
                self._dequeueTimeout = null;
                q.dequeue();
            }, 0);
        },
        ready: function(callback) {
            var self = this;
            if (window.biliapp) {
                callback && callback();
            } else {
                setTimeout(function() {
                    _maxTime--;
                    if (_maxTime === 0) {
                        callback && callback();
                        return;
                    }
                    self.ready(callback);
                }, 100);
            }
        },
        _sendMessage: function(method, args) {
            var self = this;
            q.push({
                method: method,
                args: args,
                callback: args ? args.success : null,
                handle: args ? args.handle : null
            });
            this._dequeueTimeout = setTimeout(function() {
                self.dequeue();
            }, 1000);
        },
        _doSendMessage: function(method, args, callback, handle) {
            if (window.biliapp) {
                if (!args) {
                    window.biliapp[method] && window.biliapp[method]();
                    return;
                } else if (typeof args !== 'object') {
                    window.biliapp[method] && window.biliapp[method](args);
                    return;
                }

                var hasCallback = callback && typeof callback == 'function';
                var hasHandle = handle && typeof handle == 'function';

                var callbackId = hasCallback ? callbacksCount++ : 0;
                if (hasCallback) {
                    this._callbacks[callbackId] = callback;
                    args.callbackId = callbackId;
                }
                if (hasHandle) {
                    this._callbacks[callbackId] = handle;
                    args.handle = callbackId;
                }
                window.biliapp[method] && window.biliapp[method](JSON.stringify(args));
            } else {
                this._mock(method, args);
            }
        },
        _mock: function(method, args) {
            if (method == 'alert') {
                alert(args.message);
            } else if (method == 'openScheme') {
                window.open(args.url, '_blank');
            }
        },
        login: function(opts) {
            var self = this;
            function getUser(callback) {
                self.getUserInfo({
                    success: callback
                });
            }
            getUser(function(result) {
                if (result.mid) {
                    opts.success && opts.success(result);
                } else {
                    self.openScheme({
                        url: 'bilibili://loginWithGoBackUrl?gobackurl=' + encodeURIComponent(location.href)
                    });
                }
            });
        },
        boloLogin: function(opts) { 
            var self = this;
            opts = opts || {};
            var url = opts.url || location.href;
            function getUser(callback) {
                self.getUserInfo({
                    success: callback
                });
            }
            getUser(function(result) {
                if (result.mid) {
                    location.href = 'http://fkac-goo.bilibili.cn/autojump.html?gourl=' + encodeURIComponent(url);
                } else {
                    self.openScheme({
                        url: 'bilibili://loginWithGoBackUrl?gobackurl=' + encodeURIComponent('http://fkac-goo.bilibili.cn/autojump.html?gourl=' + encodeURIComponent(url))
                    });
                }
            });
        },
        callback: (function(originCallback) {
            return function(callbackId, retValue) {
                if (callbackId && this._callbacks.hasOwnProperty(callbackId)) {
                    var callback = this._callbacks[callbackId];
                    callback && callback.call(this, retValue);
                    this._callbacks[callbackId] = null;
                    delete this._callbacks[callbackId];
                } else if (typeof originCallback === 'function') {
                    originCallback.apply(window._biliapp, arguments);
                }
            };
        })(window._biliapp && window._biliapp.callback)
    }

    apis2.forEach(function(name) {
        if (!_biliapp[name]) {
            _biliapp[name] = function(options) {
                _biliapp._sendMessage(name, options);
            }
        }
    });

    window._biliapp = _biliapp;

    return _biliapp;
});