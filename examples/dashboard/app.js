(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = dragDrop

var flatten = require('flatten')
var parallel = require('run-parallel')

function dragDrop (elem, listeners) {
  if (typeof elem === 'string') {
    elem = window.document.querySelector(elem)
  }

  if (typeof listeners === 'function') {
    listeners = { onDrop: listeners }
  }

  var timeout

  elem.addEventListener('dragenter', stopEvent, false)
  elem.addEventListener('dragover', onDragOver, false)
  elem.addEventListener('dragleave', onDragLeave, false)
  elem.addEventListener('drop', onDrop, false)

  // Function to remove drag-drop listeners
  return function remove () {
    removeDragClass()
    elem.removeEventListener('dragenter', stopEvent, false)
    elem.removeEventListener('dragover', onDragOver, false)
    elem.removeEventListener('dragleave', onDragLeave, false)
    elem.removeEventListener('drop', onDrop, false)
  }

  function onDragOver (e) {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.items) {
      // Only add "drag" class when `items` contains a file
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
    }

    elem.classList.add('drag')
    clearTimeout(timeout)

    if (listeners.onDragOver) {
      listeners.onDragOver(e)
    }

    e.dataTransfer.dropEffect = 'copy'
    return false
  }

  function onDragLeave (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    timeout = setTimeout(removeDragClass, 50)

    return false
  }

  function onDrop (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    removeDragClass()

    var pos = {
      x: e.clientX,
      y: e.clientY
    }

    if (e.dataTransfer.items) {
      // Handle directories in Chrome using the proprietary FileSystem API
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })

      if (items.length === 0) return

      parallel(items.map(function (item) {
        return function (cb) {
          processEntry(item.webkitGetAsEntry(), cb)
        }
      }), function (err, results) {
        // This catches permission errors with file:// in Chrome. This should never
        // throw in production code, so the user does not need to use try-catch.
        if (err) throw err
        if (listeners.onDrop) {
          listeners.onDrop(flatten(results), pos)
        }
      })
    } else {
      var files = toArray(e.dataTransfer.files)

      if (files.length === 0) return

      files.forEach(function (file) {
        file.fullPath = '/' + file.name
      })

      if (listeners.onDrop) {
        listeners.onDrop(files, pos)
      }
    }

    return false
  }

  function removeDragClass () {
    elem.classList.remove('drag')
  }
}

function stopEvent (e) {
  e.stopPropagation()
  e.preventDefault()
  return false
}

function processEntry (entry, cb) {
  var entries = []

  if (entry.isFile) {
    entry.file(function (file) {
      file.fullPath = entry.fullPath  // preserve pathing for consumer
      cb(null, file)
    }, function (err) {
      cb(err)
    })
  } else if (entry.isDirectory) {
    var reader = entry.createReader()
    readEntries()
  }

  function readEntries () {
    reader.readEntries(function (entries_) {
      if (entries_.length > 0) {
        entries = entries.concat(toArray(entries_))
        readEntries() // continue reading entries until `readEntries` returns no more
      } else {
        doneEntries()
      }
    })
  }

  function doneEntries () {
    parallel(entries.map(function (entry) {
      return function (cb) {
        processEntry(entry, cb)
      }
    }), cb)
  }
}

function toArray (list) {
  return Array.prototype.slice.call(list || [], 0)
}

},{"flatten":2,"run-parallel":3}],2:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],3:[function(require,module,exports){
(function (process){
module.exports = function (tasks, cb) {
  var results, pending, keys
  var isSync = true

  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      done(err)
    }
  }

  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](function (err, result) { each(key, err, result) })
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(function (err, result) { each(i, err, result) })
    })
  }

  isSync = false
}

}).call(this,require('_process'))

},{"_process":73}],4:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.2.1
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }
    function lib$es6$promise$then$$then(onFulfillment, onRejection) {
      var parent = this;

      var child = new this.constructor(lib$es6$promise$$internal$$noop);

      if (child[lib$es6$promise$$internal$$PROMISE_ID] === undefined) {
        lib$es6$promise$$internal$$makePromise(child);
      }

      var state = parent._state;

      if (state) {
        var callback = arguments[state - 1];
        lib$es6$promise$asap$$asap(function(){
          lib$es6$promise$$internal$$invokeCallback(state, child, callback, parent._result);
        });
      } else {
        lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
      }

      return child;
    }
    var lib$es6$promise$then$$default = lib$es6$promise$then$$then;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    var lib$es6$promise$$internal$$PROMISE_ID = Math.random().toString(36).substring(16);

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable, then) {
      if (maybeThenable.constructor === promise.constructor &&
          then === lib$es6$promise$then$$default &&
          constructor.resolve === lib$es6$promise$promise$resolve$$default) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value, lib$es6$promise$$internal$$getThen(value));
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    var lib$es6$promise$$internal$$id = 0;
    function lib$es6$promise$$internal$$nextId() {
      return lib$es6$promise$$internal$$id++;
    }

    function lib$es6$promise$$internal$$makePromise(promise) {
      promise[lib$es6$promise$$internal$$PROMISE_ID] = lib$es6$promise$$internal$$id++;
      promise._state = undefined;
      promise._result = undefined;
      promise._subscribers = [];
    }

    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      if (!lib$es6$promise$utils$$isArray(entries)) {
        return new Constructor(function(resolve, reject) {
          reject(new TypeError('You must pass an array to race.'));
        });
      } else {
        return new Constructor(function(resolve, reject) {
          var length = entries.length;
          for (var i = 0; i < length; i++) {
            Constructor.resolve(entries[i]).then(resolve, reject);
          }
        });
      }
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;


    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this[lib$es6$promise$$internal$$PROMISE_ID] = lib$es6$promise$$internal$$nextId();
      this._result = this._state = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        typeof resolver !== 'function' && lib$es6$promise$promise$$needsResolver();
        this instanceof lib$es6$promise$promise$$Promise ? lib$es6$promise$$internal$$initializePromise(this, resolver) : lib$es6$promise$promise$$needsNew();
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: lib$es6$promise$then$$default,

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;
    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!this.promise[lib$es6$promise$$internal$$PROMISE_ID]) {
        lib$es6$promise$$internal$$makePromise(this.promise);
      }

      if (lib$es6$promise$utils$$isArray(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._result = new Array(this.length);

        if (this.length === 0) {
          lib$es6$promise$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(this.promise, lib$es6$promise$enumerator$$validationError());
      }
    }

    function lib$es6$promise$enumerator$$validationError() {
      return new Error('Array Methods must be provided an Array');
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var input   = this._input;

      for (var i = 0; this._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      var resolve = c.resolve;

      if (resolve === lib$es6$promise$promise$resolve$$default) {
        var then = lib$es6$promise$$internal$$getThen(entry);

        if (then === lib$es6$promise$then$$default &&
            entry._state !== lib$es6$promise$$internal$$PENDING) {
          this._settledAt(entry._state, i, entry._result);
        } else if (typeof then !== 'function') {
          this._remaining--;
          this._result[i] = entry;
        } else if (c === lib$es6$promise$promise$$default) {
          var promise = new c(lib$es6$promise$$internal$$noop);
          lib$es6$promise$$internal$$handleMaybeThenable(promise, entry, then);
          this._willSettleAt(promise, i);
        } else {
          this._willSettleAt(new c(function(resolve) { resolve(entry); }), i);
        }
      } else {
        this._willSettleAt(resolve(entry), i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        this._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          this._result[i] = value;
        }
      }

      if (this._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, this._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":73}],5:[function(require,module,exports){
/**
* Create an event emitter with namespaces
* @name createNamespaceEmitter
* @example
* var emitter = require('./index')()
*
* emitter.on('*', function () {
*   console.log('all events emitted', this.event)
* })
*
* emitter.on('example', function () {
*   console.log('example event emitted')
* })
*/
module.exports = function createNamespaceEmitter () {
  var emitter = { _fns: {} }

  /**
  * Emit an event. Optionally namespace the event. Separate the namespace and event with a `:`
  * @name emit
  * @param {String} event – the name of the event, with optional namespace
  * @param {...*} data – data variables that will be passed as arguments to the event listener
  * @example
  * emitter.emit('example')
  * emitter.emit('demo:test')
  * emitter.emit('data', { example: true}, 'a string', 1)
  */
  emitter.emit = function emit (event) {
    var args = [].slice.call(arguments, 1)
    var namespaced = namespaces(event)
    if (this._fns[event]) emitAll(event, this._fns[event], args)
    if (namespaced) emitAll(event, namespaced, args)
  }

  /**
  * Create en event listener.
  * @name on
  * @param {String} event
  * @param {Function} fn
  * @example
  * emitter.on('example', function () {})
  * emitter.on('demo', function () {})
  */
  emitter.on = function on (event, fn) {
    if (typeof fn !== 'function') { throw new Error('callback required') }
    (this._fns[event] = this._fns[event] || []).push(fn)
  }

  /**
  * Create en event listener that fires once.
  * @name once
  * @param {String} event
  * @param {Function} fn
  * @example
  * emitter.once('example', function () {})
  * emitter.once('demo', function () {})
  */
  emitter.once = function once (event, fn) {
    function one () {
      fn.apply(this, arguments)
      emitter.off(event, one)
    }
    this.on(event, one)
  }

  /**
  * Stop listening to an event. Stop all listeners on an event by only passing the event name. Stop a single listener by passing that event handler as a callback.
  * You must be explicit about what will be unsubscribed: `emitter.off('demo')` will unsubscribe an `emitter.on('demo')` listener, 
  * `emitter.off('demo:example')` will unsubscribe an `emitter.on('demo:example')` listener
  * @name off
  * @param {String} event
  * @param {Function} [fn] – the specific handler
  * @example
  * emitter.off('example')
  * emitter.off('demo', function () {})
  */
  emitter.off = function off (event, fn) {
    var keep = []

    if (event && fn) {
      for (var i = 0; i < this._fns.length; i++) {
        if (this._fns[i] !== fn) {
          keep.push(this._fns[i])
        }
      }
    }

    keep.length ? this._fns[event] = keep : delete this._fns[event]
  }

  function namespaces (e) {
    var out = []
    var args = e.split(':')
    var fns = emitter._fns
    Object.keys(fns).forEach(function (key) {
      if (key === '*') out = out.concat(fns[key])
      if (args.length === 2 && args[0] === key) out = out.concat(fns[key])
    })
    return out
  }

  function emitAll (e, fns, args) {
    for (var i = 0; i < fns.length; i++) {
      if (!fns[i]) break
      fns[i].event = e
      fns[i].apply(fns[i], args)
    }
  }

  return emitter
}

},{}],6:[function(require,module,exports){
'use strict';
var numberIsNan = require('number-is-nan');

module.exports = function (num) {
	if (typeof num !== 'number' || numberIsNan(num)) {
		throw new TypeError('Expected a number, got ' + typeof num);
	}

	var exponent;
	var unit;
	var neg = num < 0;
	var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	if (neg) {
		num = -num;
	}

	if (num < 1) {
		return (neg ? '-' : '') + num + ' B';
	}

	exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1);
	num = Number((num / Math.pow(1000, exponent)).toFixed(2));
	unit = units[exponent];

	return (neg ? '-' : '') + num + ' ' + unit;
};

},{"number-is-nan":7}],7:[function(require,module,exports){
'use strict';
module.exports = Number.isNaN || function (x) {
	return x !== x;
};

},{}],8:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.encode = encode;
/* global: window */

var _window = window;
var btoa = _window.btoa;
function encode(data) {
  return btoa(unescape(encodeURIComponent(data)));
}

var isSupported = exports.isSupported = "btoa" in window;
},{}],9:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.newRequest = newRequest;
exports.resolveUrl = resolveUrl;

var _resolveUrl = require("resolve-url");

var _resolveUrl2 = _interopRequireDefault(_resolveUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function newRequest() {
  return new window.XMLHttpRequest();
} /* global window */


function resolveUrl(origin, link) {
  return (0, _resolveUrl2.default)(origin, link);
}
},{"resolve-url":17}],10:[function(require,module,exports){
// Generated by Babel
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSource = getSource;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FileSource = function () {
  function FileSource(file) {
    _classCallCheck(this, FileSource);

    this._file = file;
    this.size = file.size;
  }

  _createClass(FileSource, [{
    key: "slice",
    value: function slice(start, end) {
      return this._file.slice(start, end);
    }
  }, {
    key: "close",
    value: function close() {}
  }]);

  return FileSource;
}();

function getSource(input) {
  // Since we emulate the Blob type in our tests (not all target browsers
  // support it), we cannot use `instanceof` for testing whether the input value
  // can be handled. Instead, we simply check is the slice() function and the
  // size property are available.
  if (typeof input.slice === "function" && typeof input.size !== "undefined") {
    return new FileSource(input);
  }

  throw new Error("source object may only be an instance of File or Blob in this environment");
}
},{}],11:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setItem = setItem;
exports.getItem = getItem;
exports.removeItem = removeItem;
/* global window, localStorage */

var hasStorage = false;
try {
  hasStorage = "localStorage" in window;
  // Attempt to access localStorage
  localStorage.length;
} catch (e) {
  // If we try to access localStorage inside a sandboxed iframe, a SecurityError
  // is thrown.
  if (e.code === e.SECURITY_ERR) {
    hasStorage = false;
  } else {
    throw e;
  }
}

var canStoreURLs = exports.canStoreURLs = hasStorage;

function setItem(key, value) {
  if (!hasStorage) return;
  return localStorage.setItem(key, value);
}

function getItem(key) {
  if (!hasStorage) return;
  return localStorage.getItem(key);
}

function removeItem(key) {
  if (!hasStorage) return;
  return localStorage.removeItem(key);
}
},{}],12:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DetailedError = function (_Error) {
  _inherits(DetailedError, _Error);

  function DetailedError(error) {
    var causingErr = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
    var xhr = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

    _classCallCheck(this, DetailedError);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(DetailedError).call(this, error.message));

    _this.originalRequest = xhr;
    _this.causingError = causingErr;

    var message = error.message;
    if (causingErr != null) {
      message += ", caused by " + causingErr.toString();
    }
    if (xhr != null) {
      message += ", originated from request (response code: " + xhr.status + ", response text: " + xhr.responseText + ")";
    }
    _this.message = message;
    return _this;
  }

  return DetailedError;
}(Error);

exports.default = DetailedError;
},{}],13:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = fingerprint;
/**
 * Generate a fingerprint for a file which will be used the store the endpoint
 *
 * @param {File} file
 * @return {String}
 */
function fingerprint(file) {
  return ["tus", file.name, file.type, file.size, file.lastModified].join("-");
}
},{}],14:[function(require,module,exports){
// Generated by Babel
"use strict";

var _upload = require("./upload");

var _upload2 = _interopRequireDefault(_upload);

var _storage = require("./node/storage");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global window */
var defaultOptions = _upload2.default.defaultOptions;


if (typeof window !== "undefined") {
  // Browser environment using XMLHttpRequest
  var _window = window;
  var XMLHttpRequest = _window.XMLHttpRequest;
  var Blob = _window.Blob;


  var isSupported = XMLHttpRequest && Blob && typeof Blob.prototype.slice === "function";
} else {
  // Node.js environment using http module
  var isSupported = true;
}

// The usage of the commonjs exporting syntax instead of the new ECMAScript
// one is actually inteded and prevents weird behaviour if we are trying to
// import this module in another module using Babel.
module.exports = {
  Upload: _upload2.default,
  isSupported: isSupported,
  canStoreURLs: _storage.canStoreURLs,
  defaultOptions: defaultOptions
};
},{"./node/storage":11,"./upload":15}],15:[function(require,module,exports){
// Generated by Babel
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /* global window */


// We import the files used inside the Node environment which are rewritten
// for browsers using the rules defined in the package.json


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fingerprint = require("./fingerprint");

var _fingerprint2 = _interopRequireDefault(_fingerprint);

var _error = require("./error");

var _error2 = _interopRequireDefault(_error);

var _extend = require("extend");

var _extend2 = _interopRequireDefault(_extend);

var _request = require("./node/request");

var _source = require("./node/source");

var _base = require("./node/base64");

var Base64 = _interopRequireWildcard(_base);

var _storage = require("./node/storage");

var Storage = _interopRequireWildcard(_storage);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultOptions = {
  endpoint: "",
  fingerprint: _fingerprint2.default,
  resume: true,
  onProgress: null,
  onChunkComplete: null,
  onSuccess: null,
  onError: null,
  headers: {},
  chunkSize: Infinity,
  withCredentials: false,
  uploadUrl: null,
  uploadSize: null,
  overridePatchMethod: false,
  retryDelays: null
};

var Upload = function () {
  function Upload(file, options) {
    _classCallCheck(this, Upload);

    this.options = (0, _extend2.default)(true, {}, defaultOptions, options);

    // The underlying File/Blob object
    this.file = file;

    // The URL against which the file will be uploaded
    this.url = null;

    // The underlying XHR object for the current PATCH request
    this._xhr = null;

    // The fingerpinrt for the current file (set after start())
    this._fingerprint = null;

    // The offset used in the current PATCH request
    this._offset = null;

    // True if the current PATCH request has been aborted
    this._aborted = false;

    // The file's size in bytes
    this._size = null;

    // The Source object which will wrap around the given file and provides us
    // with a unified interface for getting its size and slice chunks from its
    // content allowing us to easily handle Files, Blobs, Buffers and Streams.
    this._source = null;

    // The current count of attempts which have been made. Null indicates none.
    this._retryAttempt = 0;

    // The timeout's ID which is used to delay the next retry
    this._retryTimeout = null;

    // The offset of the remote upload before the latest attempt was started.
    this._offsetBeforeRetry = 0;
  }

  _createClass(Upload, [{
    key: "start",
    value: function start() {
      var _this = this;

      var file = this.file;

      if (!file) {
        this._emitError(new Error("tus: no file or stream to upload provided"));
        return;
      }

      if (!this.options.endpoint) {
        this._emitError(new Error("tus: no endpoint provided"));
        return;
      }

      var source = this._source = (0, _source.getSource)(file, this.options.chunkSize);

      // Firstly, check if the caller has supplied a manual upload size or else
      // we will use the calculated size by the source object.
      if (this.options.uploadSize != null) {
        var size = +this.options.uploadSize;
        if (isNaN(size)) {
          throw new Error("tus: cannot convert `uploadSize` option into a number");
        }

        this._size = size;
      } else {
        var size = source.size;

        // The size property will be null if we cannot calculate the file's size,
        // for example if you handle a stream.
        if (size == null) {
          throw new Error("tus: cannot automatically derive upload's size from input and must be specified manually using the `uploadSize` option");
        }

        this._size = size;
      }

      var retryDelays = this.options.retryDelays;
      if (retryDelays != null) {
        if (Object.prototype.toString.call(retryDelays) !== "[object Array]") {
          throw new Error("tus: the `retryDelays` option must either be an array or null");
        } else {
          (function () {
            var errorCallback = _this.options.onError;
            _this.options.onError = function (err) {
              // Restore the original error callback which may have been set.
              _this.options.onError = errorCallback;

              // We will reset the attempt counter if
              // - we were already able to connect to the server (offset != null) and
              // - we were able to upload a small chunk of data to the server
              var shouldResetDelays = _this._offset != null && _this._offset > _this._offsetBeforeRetry;
              if (shouldResetDelays) {
                _this._retryAttempt = 0;
              }

              var isOnline = true;
              if (typeof window !== "undefined" && "navigator" in window && window.navigator.onLine === false) {
                isOnline = false;
              }

              // We only attempt a retry if
              // - we didn't exceed the maxium number of retries, yet, and
              // - this error was caused by a request or it's response and
              // - the browser does not indicate that we are offline
              var shouldRetry = _this._retryAttempt < retryDelays.length && err.originalRequest != null && isOnline;

              if (!shouldRetry) {
                _this._emitError(err);
                return;
              }

              var delay = retryDelays[_this._retryAttempt++];

              _this._offsetBeforeRetry = _this._offset;
              _this.options.uploadUrl = _this.url;

              _this._retryTimeout = setTimeout(function () {
                _this.start();
              }, delay);
            };
          })();
        }
      }

      // A URL has manually been specified, so we try to resume
      if (this.options.uploadUrl != null) {
        this.url = this.options.uploadUrl;
        this._resumeUpload();
        return;
      }

      // Try to find the endpoint for the file in the storage
      if (this.options.resume) {
        this._fingerprint = this.options.fingerprint(file);
        var resumedUrl = Storage.getItem(this._fingerprint);

        if (resumedUrl != null) {
          this.url = resumedUrl;
          this._resumeUpload();
          return;
        }
      }

      // An upload has not started for the file yet, so we start a new one
      this._createUpload();
    }
  }, {
    key: "abort",
    value: function abort() {
      if (this._xhr !== null) {
        this._xhr.abort();
        this._source.close();
        this._aborted = true;
      }

      if (this._retryTimeout != null) {
        clearTimeout(this._retryTimeout);
        this._retryTimeout = null;
      }
    }
  }, {
    key: "_emitXhrError",
    value: function _emitXhrError(xhr, err, causingErr) {
      this._emitError(new _error2.default(err, causingErr, xhr));
    }
  }, {
    key: "_emitError",
    value: function _emitError(err) {
      if (typeof this.options.onError === "function") {
        this.options.onError(err);
      } else {
        throw err;
      }
    }
  }, {
    key: "_emitSuccess",
    value: function _emitSuccess() {
      if (typeof this.options.onSuccess === "function") {
        this.options.onSuccess();
      }
    }

    /**
     * Publishes notification when data has been sent to the server. This
     * data may not have been accepted by the server yet.
     * @param  {number} bytesSent  Number of bytes sent to the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitProgress",
    value: function _emitProgress(bytesSent, bytesTotal) {
      if (typeof this.options.onProgress === "function") {
        this.options.onProgress(bytesSent, bytesTotal);
      }
    }

    /**
     * Publishes notification when a chunk of data has been sent to the server
     * and accepted by the server.
     * @param  {number} chunkSize  Size of the chunk that was accepted by the
     *                             server.
     * @param  {number} bytesAccepted Total number of bytes that have been
     *                                accepted by the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitChunkComplete",
    value: function _emitChunkComplete(chunkSize, bytesAccepted, bytesTotal) {
      if (typeof this.options.onChunkComplete === "function") {
        this.options.onChunkComplete(chunkSize, bytesAccepted, bytesTotal);
      }
    }

    /**
     * Set the headers used in the request and the withCredentials property
     * as defined in the options
     *
     * @param {XMLHttpRequest} xhr
     */

  }, {
    key: "_setupXHR",
    value: function _setupXHR(xhr) {
      xhr.setRequestHeader("Tus-Resumable", "1.0.0");
      var headers = this.options.headers;

      for (var name in headers) {
        xhr.setRequestHeader(name, headers[name]);
      }

      xhr.withCredentials = this.options.withCredentials;
    }

    /**
     * Create a new upload using the creation extension by sending a POST
     * request to the endpoint. After successful creation the file will be
     * uploaded
     *
     * @api private
     */

  }, {
    key: "_createUpload",
    value: function _createUpload() {
      var _this2 = this;

      var xhr = (0, _request.newRequest)();
      xhr.open("POST", this.options.endpoint, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this2._emitXhrError(xhr, new Error("tus: unexpected response while creating upload"));
          return;
        }

        _this2.url = (0, _request.resolveUrl)(_this2.options.endpoint, xhr.getResponseHeader("Location"));

        if (_this2.options.resume) {
          Storage.setItem(_this2._fingerprint, _this2.url);
        }

        _this2._offset = 0;
        _this2._startUpload();
      };

      xhr.onerror = function (err) {
        _this2._emitXhrError(xhr, new Error("tus: failed to create upload"), err);
      };

      this._setupXHR(xhr);
      xhr.setRequestHeader("Upload-Length", this._size);

      // Add metadata if values have been added
      var metadata = encodeMetadata(this.options.metadata);
      if (metadata !== "") {
        xhr.setRequestHeader("Upload-Metadata", metadata);
      }

      xhr.send(null);
    }

    /*
     * Try to resume an existing upload. First a HEAD request will be sent
     * to retrieve the offset. If the request fails a new upload will be
     * created. In the case of a successful response the file will be uploaded.
     *
     * @api private
     */

  }, {
    key: "_resumeUpload",
    value: function _resumeUpload() {
      var _this3 = this;

      var xhr = (0, _request.newRequest)();
      xhr.open("HEAD", this.url, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          if (_this3.options.resume) {
            // Remove stored fingerprint and corresponding endpoint,
            // since the file can not be found
            Storage.removeItem(_this3._fingerprint);
          }

          // Try to create a new upload
          _this3.url = null;
          _this3._createUpload();
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this3._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        var length = parseInt(xhr.getResponseHeader("Upload-Length"), 10);
        if (isNaN(length)) {
          _this3._emitXhrError(xhr, new Error("tus: invalid or missing length value"));
          return;
        }

        // Upload has already been completed and we do not need to send additional
        // data to the server
        if (offset === length) {
          _this3._emitProgress(length, length);
          _this3._emitSuccess();
          return;
        }

        _this3._offset = offset;
        _this3._startUpload();
      };

      xhr.onerror = function (err) {
        _this3._emitXhrError(xhr, new Error("tus: failed to resume upload"), err);
      };

      this._setupXHR(xhr);
      xhr.send(null);
    }

    /**
     * Start uploading the file using PATCH requests. The file will be divided
     * into chunks as specified in the chunkSize option. During the upload
     * the onProgress event handler may be invoked multiple times.
     *
     * @api private
     */

  }, {
    key: "_startUpload",
    value: function _startUpload() {
      var _this4 = this;

      var xhr = this._xhr = (0, _request.newRequest)();

      // Some browser and servers may not support the PATCH method. For those
      // cases, you can tell tus-js-client to use a POST request with the
      // X-HTTP-Method-Override header for simulating a PATCH request.
      if (this.options.overridePatchMethod) {
        xhr.open("POST", this.url, true);
        xhr.setRequestHeader("X-HTTP-Method-Override", "PATCH");
      } else {
        xhr.open("PATCH", this.url, true);
      }

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this4._emitXhrError(xhr, new Error("tus: unexpected response while uploading chunk"));
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this4._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        _this4._emitProgress(offset, _this4._size);
        _this4._emitChunkComplete(offset - _this4._offset, offset, _this4._size);

        _this4._offset = offset;

        if (offset == _this4._size) {
          // Yay, finally done :)
          _this4._emitSuccess();
          _this4._source.close();
          return;
        }

        _this4._startUpload();
      };

      xhr.onerror = function (err) {
        // Don't emit an error if the upload was aborted manually
        if (_this4._aborted) {
          return;
        }

        _this4._emitXhrError(xhr, new Error("tus: failed to upload chunk at offset " + _this4._offset), err);
      };

      // Test support for progress events before attaching an event listener
      if ("upload" in xhr) {
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) {
            return;
          }

          _this4._emitProgress(start + e.loaded, _this4._size);
        };
      }

      this._setupXHR(xhr);

      xhr.setRequestHeader("Upload-Offset", this._offset);
      xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

      var start = this._offset;
      var end = this._offset + this.options.chunkSize;

      // The specified chunkSize may be Infinity or the calcluated end position
      // may exceed the file's size. In both cases, we limit the end position to
      // the input's total size for simpler calculations and correctness.
      if (end === Infinity || end > this._size) {
        end = this._size;
      }

      xhr.send(this._source.slice(start, end));
    }
  }]);

  return Upload;
}();

function encodeMetadata(metadata) {
  if (!Base64.isSupported) {
    return "";
  }

  var encoded = [];

  for (var key in metadata) {
    encoded.push(key + " " + Base64.encode(metadata[key]));
  }

  return encoded.join(",");
}

Upload.defaultOptions = defaultOptions;

exports.default = Upload;
},{"./error":12,"./fingerprint":13,"./node/base64":8,"./node/request":9,"./node/source":10,"./node/storage":11,"extend":16}],16:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],17:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

void (function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(factory)
  } else if (typeof exports === "object") {
    module.exports = factory()
  } else {
    root.resolveUrl = factory()
  }
}(this, function() {

  function resolveUrl(/* ...urls */) {
    var numUrls = arguments.length

    if (numUrls === 0) {
      throw new Error("resolveUrl requires at least one argument; got none.")
    }

    var base = document.createElement("base")
    base.href = arguments[0]

    if (numUrls === 1) {
      return base.href
    }

    var head = document.getElementsByTagName("head")[0]
    head.insertBefore(base, head.firstChild)

    var a = document.createElement("a")
    var resolved

    for (var index = 1; index < numUrls; index++) {
      a.href = arguments[index]
      resolved = a.href
      base.href = resolved
    }

    head.removeChild(base)

    return resolved
  }

  return resolveUrl

}));

},{}],18:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],19:[function(require,module,exports){
var bel = require('bel') // turns template tag into DOM elements
var morphdom = require('morphdom') // efficiently diffs + morphs two DOM elements
var defaultEvents = require('./update-events.js') // default events to be copied when dom elements update

module.exports = bel

// TODO move this + defaultEvents to a new module once we receive more feedback
module.exports.update = function (fromNode, toNode, opts) {
  if (!opts) opts = {}
  if (opts.events !== false) {
    if (!opts.onBeforeElUpdated) opts.onBeforeElUpdated = copier
  }

  return morphdom(fromNode, toNode, opts)

  // morphdom only copies attributes. we decided we also wanted to copy events
  // that can be set via attributes
  function copier (f, t) {
    // copy events:
    var events = opts.events || defaultEvents
    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      if (t[ev]) { // if new element has a whitelisted attribute
        f[ev] = t[ev] // update existing element
      } else if (f[ev]) { // if existing element has it and new one doesnt
        f[ev] = undefined // remove it from existing element
      }
    }
    // copy values for form elements
    if ((f.nodeName === 'INPUT' && f.type !== 'file') || f.nodeName === 'SELECT') {
      if (t.getAttribute('value') === null) t.value = f.value
    } else if (f.nodeName === 'TEXTAREA') {
      if (t.getAttribute('value') === null) f.value = t.value
    }
  }
}

},{"./update-events.js":27,"bel":20,"morphdom":26}],20:[function(require,module,exports){
var document = require('global/document')
var hyperx = require('hyperx')
var onload = require('on-load')

var SVGNS = 'http://www.w3.org/2000/svg'
var XLINKNS = 'http://www.w3.org/1999/xlink'

var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  selected: 1,
  willvalidate: 1
}
var SVG_TAGS = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

function belCreateElement (tag, props, children) {
  var el

  // If an svg tag, it needs a namespace
  if (SVG_TAGS.indexOf(tag) !== -1) {
    props.namespace = SVGNS
  }

  // If we are using a namespace
  var ns = false
  if (props.namespace) {
    ns = props.namespace
    delete props.namespace
  }

  // Create the element
  if (ns) {
    el = document.createElementNS(ns, tag)
  } else {
    el = document.createElement(tag)
  }

  // If adding onload events
  if (props.onload || props.onunload) {
    var load = props.onload || function () {}
    var unload = props.onunload || function () {}
    onload(el, function belOnload () {
      load(el)
    }, function belOnunload () {
      unload(el)
    },
    // We have to use non-standard `caller` to find who invokes `belCreateElement`
    belCreateElement.caller.caller.caller)
    delete props.onload
    delete props.onunload
  }

  // Create the properties
  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      var key = p.toLowerCase()
      var val = props[p]
      // Normalize className
      if (key === 'classname') {
        key = 'class'
        p = 'class'
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (p === 'htmlFor') {
        p = 'for'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key
        else if (val === 'false') continue
      }
      // If a property prefers being set directly vs setAttribute
      if (key.slice(0, 2) === 'on') {
        el[p] = val
      } else {
        if (ns) {
          if (p === 'xlink:href') {
            el.setAttributeNS(XLINKNS, p, val)
          } else {
            el.setAttributeNS(null, p, val)
          }
        } else {
          el.setAttribute(p, val)
        }
      }
    }
  }

  function appendChild (childs) {
    if (!Array.isArray(childs)) return
    for (var i = 0; i < childs.length; i++) {
      var node = childs[i]
      if (Array.isArray(node)) {
        appendChild(node)
        continue
      }

      if (typeof node === 'number' ||
        typeof node === 'boolean' ||
        node instanceof Date ||
        node instanceof RegExp) {
        node = node.toString()
      }

      if (typeof node === 'string') {
        if (el.lastChild && el.lastChild.nodeName === '#text') {
          el.lastChild.nodeValue += node
          continue
        }
        node = document.createTextNode(node)
      }

      if (node && node.nodeType) {
        el.appendChild(node)
      }
    }
  }
  appendChild(children)

  return el
}

module.exports = hyperx(belCreateElement)
module.exports.createElement = belCreateElement

},{"global/document":21,"hyperx":23,"on-load":25}],21:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":72}],22:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],23:[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property')

var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4
var ATTR_KEY = 5, ATTR_KEY_W = 6
var ATTR_VALUE_W = 7, ATTR_VALUE = 8
var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10
var ATTR_EQ = 11, ATTR_BREAK = 12

module.exports = function (h, opts) {
  h = attrToProp(h)
  if (!opts) opts = {}
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b)
  }

  return function (strings) {
    var state = TEXT, reg = ''
    var arglen = arguments.length
    var parts = []

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i+1]
        var p = parse(strings[i])
        var xstate = state
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
        if (xstate === ATTR) xstate = ATTR_KEY
        p.push([ VAR, xstate, arg ])
        parts.push.apply(parts, p)
      } else parts.push.apply(parts, parse(strings[i]))
    }

    var tree = [null,{},[]]
    var stack = [[tree,-1]]
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length-1][0]
      var p = parts[i], s = p[0]
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length-1][1]
        if (stack.length > 1) {
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === OPEN) {
        var c = [p[1],{},[]]
        cur[2].push(c)
        stack.push([c,cur[2].length-1])
      } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
        var key = ''
        var copyKey
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1])
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey]
                }
              }
            } else {
              key = concat(key, parts[i][2])
            }
          } else break
        }
        if (parts[i][0] === ATTR_EQ) i++
        var j = i
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
            else cur[1][key] = concat(cur[1][key], parts[i][1])
          } else if (parts[i][0] === VAR
          && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
            else cur[1][key] = concat(cur[1][key], parts[i][2])
          } else {
            if (key.length && !cur[1][key] && i === j
            && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase()
            }
            break
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length-1][1]
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = ''
        else if (!p[2]) p[2] = concat('', p[2])
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2])
        } else {
          cur[2].push(p[2])
        }
      } else if (s === TEXT) {
        cur[2].push(p[1])
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s)
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift()
    }

    if (tree[2].length > 2
    || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
      throw new Error(
        'multiple root elements must be wrapped in an enclosing tag'
      )
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
    && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
    }
    return tree[2][0]

    function parse (str) {
      var res = []
      if (state === ATTR_VALUE_W) state = ATTR
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i)
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg])
          reg = ''
          state = OPEN
        } else if (c === '>' && !quot(state)) {
          if (state === OPEN) {
            res.push([OPEN,reg])
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY,reg])
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE,reg])
          }
          res.push([CLOSE])
          reg = ''
          state = TEXT
        } else if (state === TEXT) {
          reg += c
        } else if (state === OPEN && /\s/.test(c)) {
          res.push([OPEN, reg])
          reg = ''
          state = ATTR
        } else if (state === OPEN) {
          reg += c
        } else if (state === ATTR && /[\w-]/.test(c)) {
          state = ATTR_KEY
          reg = c
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY,reg])
          res.push([ATTR_BREAK])
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY,reg])
          reg = ''
          state = ATTR_KEY_W
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY,reg],[ATTR_EQ])
          reg = ''
          state = ATTR_VALUE_W
        } else if (state === ATTR_KEY) {
          reg += c
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ])
          state = ATTR_VALUE_W
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK])
          if (/[\w-]/.test(c)) {
            reg += c
            state = ATTR_KEY
          } else state = ATTR
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE
          i--
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
        || state === ATTR_VALUE_DQ) {
          reg += c
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT,reg])
        reg = ''
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY,reg])
        reg = ''
      }
      return res
    }
  }

  function strfn (x) {
    if (typeof x === 'function') return x
    else if (typeof x === 'string') return x
    else if (x && typeof x === 'object') return x
    else return concat('', x)
  }
}

function quot (state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
}

var hasOwn = Object.prototype.hasOwnProperty
function has (obj, key) { return hasOwn.call(obj, key) }

var closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$')
function selfClosing (tag) { return closeRE.test(tag) }

},{"hyperscript-attribute-to-property":24}],24:[function(require,module,exports){
module.exports = attributeToProperty

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
}

function attributeToProperty (h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr]
        delete attrs[attr]
      }
    }
    return h(tagName, attrs, children)
  }
}

},{}],25:[function(require,module,exports){
/* global MutationObserver */
var document = require('global/document')
var window = require('global/window')
var watch = Object.create(null)
var KEY_ID = 'onloadid' + (new Date() % 9e6).toString(36)
var KEY_ATTR = 'data-' + KEY_ID
var INDEX = 0

if (window && window.MutationObserver) {
  var observer = new MutationObserver(function (mutations) {
    if (Object.keys(watch).length < 1) return
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === KEY_ATTR) {
        eachAttr(mutations[i], turnon, turnoff)
        continue
      }
      eachMutation(mutations[i].removedNodes, turnoff)
      eachMutation(mutations[i].addedNodes, turnon)
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [KEY_ATTR]
  })
}

module.exports = function onload (el, on, off, caller) {
  on = on || function () {}
  off = off || function () {}
  el.setAttribute(KEY_ATTR, 'o' + INDEX)
  watch['o' + INDEX] = [on, off, 0, caller || onload.caller]
  INDEX += 1
  return el
}

function turnon (index, el) {
  if (watch[index][0] && watch[index][2] === 0) {
    watch[index][0](el)
    watch[index][2] = 1
  }
}

function turnoff (index, el) {
  if (watch[index][1] && watch[index][2] === 1) {
    watch[index][1](el)
    watch[index][2] = 0
  }
}

function eachAttr (mutation, on, off) {
  var newValue = mutation.target.getAttribute(KEY_ATTR)
  if (sameOrigin(mutation.oldValue, newValue)) {
    watch[newValue] = watch[mutation.oldValue]
    return
  }
  if (watch[mutation.oldValue]) {
    off(mutation.oldValue, mutation.target)
  }
  if (watch[newValue]) {
    on(newValue, mutation.target)
  }
}

function sameOrigin (oldValue, newValue) {
  if (!oldValue || !newValue) return false
  return watch[oldValue][3] === watch[newValue][3]
}

function eachMutation (nodes, fn) {
  var keys = Object.keys(watch)
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(KEY_ATTR)) {
      var onloadid = nodes[i].getAttribute(KEY_ATTR)
      keys.forEach(function (k) {
        if (onloadid === k) {
          fn(k, nodes[i])
        }
      })
    }
    if (nodes[i].childNodes.length > 0) {
      eachMutation(nodes[i].childNodes, fn)
    }
  }
}

},{"global/document":21,"global/window":22}],26:[function(require,module,exports){
'use strict';
// Create a range object for efficently rendering strings to elements.
var range;

var doc = typeof document !== 'undefined' && document;

var testEl = doc ?
    doc.body || doc.createElement('div') :
    {};

var NS_XHTML = 'http://www.w3.org/1999/xhtml';

var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;

// Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
// (IE7+ support) <=IE7 does not support el.hasAttribute(name)
var hasAttributeNS;

if (testEl.hasAttributeNS) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttributeNS(namespaceURI, name);
    };
} else if (testEl.hasAttribute) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttribute(name);
    };
} else {
    hasAttributeNS = function(el, namespaceURI, name) {
        return !!el.getAttributeNode(name);
    };
}

function toElement(str) {
    if (!range && doc.createRange) {
        range = doc.createRange();
        range.selectNode(doc.body);
    }

    var fragment;
    if (range && range.createContextualFragment) {
        fragment = range.createContextualFragment(str);
    } else {
        fragment = doc.createElement('body');
        fragment.innerHTML = str;
    }
    return fragment.childNodes[0];
}

function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
        fromEl[name] = toEl[name];
        if (fromEl[name]) {
            fromEl.setAttribute(name, '');
        } else {
            fromEl.removeAttribute(name, '');
        }
    }
}

var specialElHandlers = {
    /**
     * Needed for IE. Apparently IE doesn't think that "selected" is an
     * attribute when reading over the attributes using selectEl.attributes
     */
    OPTION: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'selected');
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'checked');
        syncBooleanAttrProp(fromEl, toEl, 'disabled');

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value');
        }
    },

    TEXTAREA: function(fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        if (fromEl.firstChild) {
            fromEl.firstChild.nodeValue = newValue;
        }
    }
};

function noop() {}

/**
 * Returns true if two node's names are the same.
 *
 * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
 *       nodeName and different namespace URIs.
 *
 * @param {Element} a
 * @param {Element} b The target element
 * @return {boolean}
 */
function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;

    if (fromNodeName === toNodeName) {
        return true;
    }

    if (toEl.actualize &&
        fromNodeName.charCodeAt(0) < 91 && /* from tag name is upper case */
        toNodeName.charCodeAt(0) > 90 /* target tag name is lower case */) {
        // If the target element is a virtual DOM node then we may need to normalize the tag name
        // before comparing. Normal HTML elements that are in the "http://www.w3.org/1999/xhtml"
        // are converted to upper case
        return fromNodeName === toNodeName.toUpperCase();
    } else {
        return false;
    }
}

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ?
        doc.createElement(name) :
        doc.createElementNS(namespaceURI, name);
}

/**
 * Loop over all of the attributes on the target node and make sure the original
 * DOM node has the same attributes. If an attribute found on the original node
 * is not on the new node then remove it from the original node.
 *
 * @param  {Element} fromNode
 * @param  {Element} toNode
 */
function morphAttrs(fromNode, toNode) {
    var attrs = toNode.attributes;
    var i;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    if (toNode.assignAttributes) {
        toNode.assignAttributes(fromNode);
    } else {
        for (i = attrs.length - 1; i >= 0; --i) {
            attr = attrs[i];
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;
            attrValue = attr.value;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;
                fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
                }
            } else {
                fromValue = fromNode.getAttribute(attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttribute(attrName, attrValue);
                }
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    attrs = fromNode.attributes;

    for (i = attrs.length - 1; i >= 0; --i) {
        attr = attrs[i];
        if (attr.specified !== false) {
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;

                if (!hasAttributeNS(toNode, attrNamespaceURI, attrName)) {
                    fromNode.removeAttributeNS(attrNamespaceURI, attrName);
                }
            } else {
                if (!hasAttributeNS(toNode, null, attrName)) {
                    fromNode.removeAttribute(attrName);
                }
            }
        }
    }
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function defaultGetNodeKey(node) {
    return node.id;
}

function morphdom(fromNode, toNode, options) {
    if (!options) {
        options = {};
    }

    if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
            var toNodeHtml = toNode;
            toNode = doc.createElement('html');
            toNode.innerHTML = toNodeHtml;
        } else {
            toNode = toElement(toNode);
        }
    }

    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
    var childrenOnly = options.childrenOnly === true;

    // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
    var fromNodesLookup = {};
    var keyedRemovalList;

    function addKeyedRemoval(key) {
        if (keyedRemovalList) {
            keyedRemovalList.push(key);
        } else {
            keyedRemovalList = [key];
        }
    }

    function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {

                var key = undefined;

                if (skipKeyedNodes && (key = getNodeKey(curChild))) {
                    // If we are skipping keyed nodes then we add the key
                    // to a list so that it can be handled at the very end.
                    addKeyedRemoval(key);
                } else {
                    // Only report the node as discarded if it is not keyed. We do this because
                    // at the end we loop through all keyed elements that were unmatched
                    // and then discard them in one final pass.
                    onNodeDiscarded(curChild);
                    if (curChild.firstChild) {
                        walkDiscardedChildNodes(curChild, skipKeyedNodes);
                    }
                }

                curChild = curChild.nextSibling;
            }
        }
    }

    /**
     * Removes a DOM node out of the original DOM
     *
     * @param  {Node} node The node to remove
     * @param  {Node} parentNode The nodes parent
     * @param  {Boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
     * @return {undefined}
     */
    function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
            return;
        }

        if (parentNode) {
            parentNode.removeChild(node);
        }

        onNodeDiscarded(node);
        walkDiscardedChildNodes(node, skipKeyedNodes);
    }

    // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
    // function indexTree(root) {
    //     var treeWalker = document.createTreeWalker(
    //         root,
    //         NodeFilter.SHOW_ELEMENT);
    //
    //     var el;
    //     while((el = treeWalker.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
    //
    // function indexTree(node) {
    //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
    //     var el;
    //     while((el = nodeIterator.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {
                var key = getNodeKey(curChild);
                if (key) {
                    fromNodesLookup[key] = curChild;
                }

                // Walk recursively
                indexTree(curChild);

                curChild = curChild.nextSibling;
            }
        }
    }

    indexTree(fromNode);

    function handleNodeAdded(el) {
        onNodeAdded(el);

        var curChild = el.firstChild;
        while (curChild) {
            var nextSibling = curChild.nextSibling;

            var key = getNodeKey(curChild);
            if (key) {
                var unmatchedFromEl = fromNodesLookup[key];
                if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
                    curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
                    morphEl(unmatchedFromEl, curChild);
                }
            }

            handleNodeAdded(curChild);
            curChild = nextSibling;
        }
    }

    function morphEl(fromEl, toEl, childrenOnly) {
        var toElKey = getNodeKey(toEl);
        var curFromNodeKey;

        if (toElKey) {
            // If an element with an ID is being morphed then it is will be in the final
            // DOM so clear it out of the saved elements collection
            delete fromNodesLookup[toElKey];
        }

        if (toNode.isSameNode && toNode.isSameNode(fromNode)) {
            return;
        }

        if (!childrenOnly) {
            if (onBeforeElUpdated(fromEl, toEl) === false) {
                return;
            }

            morphAttrs(fromEl, toEl);
            onElUpdated(fromEl);

            if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return;
            }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
            var curToNodeChild = toEl.firstChild;
            var curFromNodeChild = fromEl.firstChild;
            var curToNodeKey;

            var fromNextSibling;
            var toNextSibling;
            var matchingFromEl;

            outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling;
                curToNodeKey = getNodeKey(curToNodeChild);

                while (curFromNodeChild) {
                    fromNextSibling = curFromNodeChild.nextSibling;

                    if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    curFromNodeKey = getNodeKey(curFromNodeChild);

                    var curFromNodeType = curFromNodeChild.nodeType;

                    var isCompatible = undefined;

                    if (curFromNodeType === curToNodeChild.nodeType) {
                        if (curFromNodeType === ELEMENT_NODE) {
                            // Both nodes being compared are Element nodes

                            if (curToNodeKey) {
                                // The target node has a key so we want to match it up with the correct element
                                // in the original DOM tree
                                if (curToNodeKey !== curFromNodeKey) {
                                    // The current element in the original DOM tree does not have a matching key so
                                    // let's check our lookup to see if there is a matching element in the original
                                    // DOM tree
                                    if ((matchingFromEl = fromNodesLookup[curToNodeKey])) {
                                        if (curFromNodeChild.nextSibling === matchingFromEl) {
                                            // Special case for single element removals. To avoid removing the original
                                            // DOM node out of the tree (since that can break CSS transitions, etc.),
                                            // we will instead discard the current node and wait until the next
                                            // iteration to properly match up the keyed target element with its matching
                                            // element in the original tree
                                            isCompatible = false;
                                        } else {
                                            // We found a matching keyed element somewhere in the original DOM tree.
                                            // Let's moving the original DOM node into the current position and morph
                                            // it.

                                            // NOTE: We use insertBefore instead of replaceChild because we want to go through
                                            // the `removeNode()` function for the node that is being discarded so that
                                            // all lifecycle hooks are correctly invoked
                                            fromEl.insertBefore(matchingFromEl, curFromNodeChild);

                                            if (curFromNodeKey) {
                                                // Since the node is keyed it might be matched up later so we defer
                                                // the actual removal to later
                                                addKeyedRemoval(curFromNodeKey);
                                            } else {
                                                // NOTE: we skip nested keyed nodes from being removed since there is
                                                //       still a chance they will be matched up later
                                                removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);

                                            }
                                            fromNextSibling = curFromNodeChild.nextSibling;
                                            curFromNodeChild = matchingFromEl;
                                        }
                                    } else {
                                        // The nodes are not compatible since the "to" node has a key and there
                                        // is no matching keyed node in the source tree
                                        isCompatible = false;
                                    }
                                }
                            } else if (curFromNodeKey) {
                                // The original has a key
                                isCompatible = false;
                            }

                            isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
                            if (isCompatible) {
                                // We found compatible DOM elements so transform
                                // the current "from" node to match the current
                                // target DOM node.
                                morphEl(curFromNodeChild, curToNodeChild);
                            }

                        } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                            // Both nodes being compared are Text or Comment nodes
                            isCompatible = true;
                            // Simply update nodeValue on the original node to
                            // change the text value
                            curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                        }
                    }

                    if (isCompatible) {
                        // Advance both the "to" child and the "from" child since we found a match
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    // No compatible match so remove the old node from the DOM and continue trying to find a
                    // match in the original DOM. However, we only do this if the from node is not keyed
                    // since it is possible that a keyed node might match up with a node somewhere else in the
                    // target tree and we don't want to discard it just yet since it still might find a
                    // home in the final DOM tree. After everything is done we will remove any keyed nodes
                    // that didn't find a home
                    if (curFromNodeKey) {
                        // Since the node is keyed it might be matched up later so we defer
                        // the actual removal to later
                        addKeyedRemoval(curFromNodeKey);
                    } else {
                        // NOTE: we skip nested keyed nodes from being removed since there is
                        //       still a chance they will be matched up later
                        removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                    }

                    curFromNodeChild = fromNextSibling;
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to" node
                // to the end
                if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
                    fromEl.appendChild(matchingFromEl);
                    morphEl(matchingFromEl, curToNodeChild);
                } else {
                    var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
                    if (onBeforeNodeAddedResult !== false) {
                        if (onBeforeNodeAddedResult) {
                            curToNodeChild = onBeforeNodeAddedResult;
                        }

                        if (curToNodeChild.actualize) {
                            curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
                        }
                        fromEl.appendChild(curToNodeChild);
                        handleNodeAdded(curToNodeChild);
                    }
                }

                curToNodeChild = toNextSibling;
                curFromNodeChild = fromNextSibling;
            }

            // We have processed all of the "to nodes". If curFromNodeChild is
            // non-null then we still have some from nodes left over that need
            // to be removed
            while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling;
                if ((curFromNodeKey = getNodeKey(curFromNodeChild))) {
                    // Since the node is keyed it might be matched up later so we defer
                    // the actual removal to later
                    addKeyedRemoval(curFromNodeKey);
                } else {
                    // NOTE: we skip nested keyed nodes from being removed since there is
                    //       still a chance they will be matched up later
                    removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                }
                curFromNodeChild = fromNextSibling;
            }
        }

        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
            specialElHandler(fromEl, toEl);
        }
    } // END: morphEl(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
            if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                    onNodeDiscarded(fromNode);
                    morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
                }
            } else {
                // Going from an element node to a text node
                morphedNode = toNode;
            }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // Text or comment node
            if (toNodeType === morphedNodeType) {
                morphedNode.nodeValue = toNode.nodeValue;
                return morphedNode;
            } else {
                // Text node to something else
                morphedNode = toNode;
            }
        }
    }

    if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode);
    } else {
        morphEl(morphedNode, toNode, childrenOnly);

        // We now need to loop over any keyed nodes that might need to be
        // removed. We only do the removal if we know that the keyed node
        // never found a match. When a keyed node is matched up we remove
        // it out of fromNodesLookup and we use fromNodesLookup to determine
        // if a keyed node has been matched up or not
        if (keyedRemovalList) {
            for (var i=0, len=keyedRemovalList.length; i<len; i++) {
                var elToRemove = fromNodesLookup[keyedRemovalList[i]];
                if (elToRemove) {
                    removeNode(elToRemove, elToRemove.parentNode, false);
                }
            }
        }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode.actualize) {
            morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
        }
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
}

module.exports = morphdom;

},{}],27:[function(require,module,exports){
module.exports = [
  // attribute events (can be set with attributes)
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'ondragstart',
  'ondrag',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondrop',
  'ondragend',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onunload',
  'onabort',
  'onerror',
  'onresize',
  'onscroll',
  'onselect',
  'onchange',
  'onsubmit',
  'onreset',
  'onfocus',
  'onblur',
  'oninput',
  // other common events
  'oncontextmenu',
  'onfocusin',
  'onfocusout'
]

},{}],28:[function(require,module,exports){
module.exports = function yoyoifyAppendChild (el, childs) {
  for (var i = 0; i < childs.length; i++) {
    var node = childs[i]
    if (Array.isArray(node)) {
      yoyoifyAppendChild(el, node)
      continue
    }
    if (typeof node === 'number' ||
      typeof node === 'boolean' ||
      node instanceof Date ||
      node instanceof RegExp) {
      node = node.toString()
    }
    if (typeof node === 'string') {
      if (el.lastChild && el.lastChild.nodeName === '#text') {
        el.lastChild.nodeValue += node
        continue
      }
      node = document.createTextNode(node)
    }
    if (node && node.nodeType) {
      el.appendChild(node)
    }
  }
}

},{}],29:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"dup":25,"global/document":30,"global/window":31}],30:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":72}],31:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],32:[function(require,module,exports){
(function (global){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = require('../core/Utils');
var Translator = require('../core/Translator');
var ee = require('namespace-emitter');
var UppySocket = require('./UppySocket');
// const en_US = require('../locales/en_US')
// import deepFreeze from 'deep-freeze-strict'

/**
 * Main Uppy core
 *
 * @param {object} opts general options, like locales, to show modal or not to show
 */

var Uppy = function () {
  function Uppy(opts) {
    _classCallCheck(this, Uppy);

    // set default options
    var defaultOptions = {
      // load English as the default locale
      // locale: en_US,
      autoProceed: true,
      debug: false
    };

    // Merge default options with the ones set by user
    this.opts = _extends({}, defaultOptions, opts);

    // // Dictates in what order different plugin types are ran:
    // this.types = [ 'presetter', 'orchestrator', 'progressindicator',
    //                 'acquirer', 'modifier', 'uploader', 'presenter', 'debugger']

    // Container for different types of plugins
    this.plugins = {};

    this.translator = new Translator({ locale: this.opts.locale });
    this.i18n = this.translator.translate.bind(this.translator);
    this.getState = this.getState.bind(this);
    this.updateMeta = this.updateMeta.bind(this);
    this.initSocket = this.initSocket.bind(this);
    this.log = this.log.bind(this);
    this.addFile = this.addFile.bind(this);

    this.bus = this.emitter = ee();
    this.on = this.bus.on.bind(this.bus);
    this.emit = this.bus.emit.bind(this.bus);

    this.state = {
      files: {},
      capabilities: {
        resumableUploads: false
      },
      totalProgress: 0
    };

    // for debugging and testing
    if (this.opts.debug) {
      global.UppyState = this.state;
      global.uppyLog = '';
      global.UppyAddFile = this.addFile.bind(this);
      global._Uppy = this;
    }
  }

  /**
   * Iterate on all plugins and run `update` on them. Called each time state changes
   *
   */


  Uppy.prototype.updateAll = function updateAll(state) {
    var _this = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this.plugins[pluginType].forEach(function (plugin) {
        plugin.update(state);
      });
    });
  };

  /**
   * Updates state
   *
   * @param {newState} object
   */


  Uppy.prototype.setState = function setState(stateUpdate) {
    var newState = _extends({}, this.state, stateUpdate);
    this.emit('core:state-update', this.state, newState, stateUpdate);

    this.state = newState;
    this.updateAll(this.state);
  };

  /**
   * Returns current state
   *
   */


  Uppy.prototype.getState = function getState() {
    // use deepFreeze for debugging
    // return deepFreeze(this.state)
    return this.state;
  };

  Uppy.prototype.updateMeta = function updateMeta(data, fileID) {
    var updatedFiles = _extends({}, this.getState().files);
    var newMeta = _extends({}, updatedFiles[fileID].meta, data);
    updatedFiles[fileID] = _extends({}, updatedFiles[fileID], {
      meta: newMeta
    });
    this.setState({ files: updatedFiles });
  };

  Uppy.prototype.addFile = function addFile(file) {
    var updatedFiles = _extends({}, this.state.files);

    var fileName = file.name || 'noname';
    var fileType = Utils.getFileType(file) ? Utils.getFileType(file).split('/') : ['', ''];
    var fileTypeGeneral = fileType[0];
    var fileTypeSpecific = fileType[1];
    var fileExtension = Utils.getFileNameAndExtension(fileName)[1];
    var isRemote = file.isRemote || false;

    var fileID = Utils.generateFileID(fileName);

    var newFile = {
      source: file.source || '',
      id: fileID,
      name: fileName,
      extension: fileExtension || '',
      meta: {
        name: fileName
      },
      type: {
        general: fileTypeGeneral,
        specific: fileTypeSpecific
      },
      data: file.data,
      progress: {
        percentage: 0,
        uploadComplete: false,
        uploadStarted: false
      },
      size: file.data.size || 'N/A',
      isRemote: isRemote,
      remote: file.remote || ''
    };

    updatedFiles[fileID] = newFile;
    this.setState({ files: updatedFiles });

    this.bus.emit('file-added', fileID);
    this.log('Added file: ' + fileName + ', ' + fileID);

    if (fileTypeGeneral === 'image' && !isRemote) {
      this.addThumbnail(newFile.id);
    }

    if (this.opts.autoProceed) {
      this.bus.emit('core:upload');
    }
  };

  Uppy.prototype.removeFile = function removeFile(fileID) {
    var updatedFiles = _extends({}, this.getState().files);
    delete updatedFiles[fileID];
    this.setState({ files: updatedFiles });
    this.log('Removed file: ' + fileID);
  };

  Uppy.prototype.addThumbnail = function addThumbnail(fileID) {
    var _this2 = this;

    var file = this.getState().files[fileID];

    Utils.readFile(file.data).then(function (imgDataURI) {
      return Utils.createImageThumbnail(imgDataURI, 200);
    }).then(function (thumbnail) {
      var updatedFiles = _extends({}, _this2.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], {
        preview: thumbnail
      });
      updatedFiles[fileID] = updatedFile;
      _this2.setState({ files: updatedFiles });
    });
  };

  Uppy.prototype.startUpload = function startUpload() {
    this.emit('core:upload');
  };

  Uppy.prototype.calculateProgress = function calculateProgress(data) {
    var fileID = data.id;
    var updatedFiles = _extends({}, this.getState().files);
    if (!updatedFiles[fileID]) {
      console.error('Trying to set progress for a file that’s not with us anymore: ', fileID);
      return;
    }

    var updatedFile = _extends({}, updatedFiles[fileID], _extends({}, {
      progress: _extends({}, updatedFiles[fileID].progress, {
        bytesUploaded: data.bytesUploaded,
        bytesTotal: data.bytesTotal,
        percentage: Math.round((data.bytesUploaded / data.bytesTotal * 100).toFixed(2))
      })
    }));
    updatedFiles[data.id] = updatedFile;

    // calculate total progress, using the number of files currently uploading,
    // multiplied by 100 and the summ of individual progress of each file
    var inProgress = Object.keys(updatedFiles).filter(function (file) {
      return updatedFiles[file].progress.uploadStarted;
    });
    var progressMax = inProgress.length * 100;
    var progressAll = 0;
    inProgress.forEach(function (file) {
      progressAll = progressAll + updatedFiles[file].progress.percentage;
    });

    var totalProgress = Math.round((progressAll * 100 / progressMax).toFixed(2));

    // if (totalProgress === 100) {
    //   const completeFiles = Object.keys(updatedFiles).filter((file) => {
    //     // this should be `uploadComplete`
    //     return updatedFiles[file].progress.percentage === 100
    //   })
    //   this.emit('core:success', completeFiles.length)
    // }

    this.setState({
      totalProgress: totalProgress,
      files: updatedFiles
    });
  };

  /**
   * Registers listeners for all global actions, like:
   * `file-add`, `file-remove`, `upload-progress`, `reset`
   *
   */


  Uppy.prototype.actions = function actions() {
    var _this3 = this;

    // this.bus.on('*', (payload) => {
    //   console.log('emitted: ', this.event)
    //   console.log('with payload: ', payload)
    // })

    // const bus = this.bus

    this.on('core:file-add', function (data) {
      _this3.addFile(data);
    });

    // `remove-file` removes a file from `state.files`, for example when
    // a user decides not to upload particular file and clicks a button to remove it
    this.on('core:file-remove', function (fileID) {
      _this3.removeFile(fileID);
    });

    this.on('core:cancel-all', function () {
      var files = _this3.getState().files;
      Object.keys(files).forEach(function (file) {
        _this3.removeFile(files[file].id);
      });
    });

    this.on('core:upload-started', function (fileID, upload) {
      var updatedFiles = _extends({}, _this3.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], _extends({}, {
        progress: _extends({}, updatedFiles[fileID].progress, {
          uploadStarted: Date.now()
        })
      }));
      updatedFiles[fileID] = updatedFile;

      _this3.setState({ files: updatedFiles });
    });

    // const throttledCalculateProgress = throttle(1000, (data) => this.calculateProgress(data))

    this.on('core:upload-progress', function (data) {
      _this3.calculateProgress(data);
      // throttledCalculateProgress(data)
    });

    this.on('core:upload-success', function (fileID, uploadURL) {
      var updatedFiles = _extends({}, _this3.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], {
        progress: _extends({}, updatedFiles[fileID].progress, {
          uploadComplete: true
        }),
        uploadURL: uploadURL
      });
      updatedFiles[fileID] = updatedFile;

      // console.log(this.getState().totalProgress)

      if (_this3.getState().totalProgress === 100) {
        var completeFiles = Object.keys(updatedFiles).filter(function (file) {
          // this should be `uploadComplete`
          return updatedFiles[file].progress.uploadComplete;
        });
        _this3.emit('core:success', completeFiles.length);
      }

      _this3.setState({
        files: updatedFiles
      });
    });

    this.on('core:update-meta', function (data, fileID) {
      _this3.updateMeta(data, fileID);
    });

    // show informer if offline
    if (typeof window !== 'undefined') {
      window.addEventListener('online', function () {
        return _this3.isOnline(true);
      });
      window.addEventListener('offline', function () {
        return _this3.isOnline(false);
      });
      setTimeout(function () {
        return _this3.isOnline();
      }, 3000);
    }
  };

  Uppy.prototype.isOnline = function isOnline(status) {
    var online = status || window.navigator.onLine;
    if (!online) {
      this.emit('is-offline');
      this.emit('informer', 'No internet connection', 'error', 0);
      this.wasOffline = true;
    } else {
      this.emit('is-online');
      if (this.wasOffline) {
        this.emit('informer', 'Connected!', 'success', 3000);
        this.wasOffline = false;
      }
    }
  };

  /**
   * Registers a plugin with Core
   *
   * @param {Class} Plugin object
   * @param {Object} options object that will be passed to Plugin later
   * @return {Object} self for chaining
   */


  Uppy.prototype.use = function use(Plugin, opts) {
    // Prepare props to pass to plugins
    // const props = {
    //   getState: this.getState.bind(this),
    //   setState: this.setState.bind(this),
    //   updateMeta: this.updateMeta.bind(this),
    //   addFile: this.addFile.bind(this),
    //   i18n: this.i18n.bind(this),
    //   bus: this.ee,
    //   log: this.log.bind(this)
    // }

    // Instantiate
    var plugin = new Plugin(this, opts);
    var pluginName = plugin.id;
    this.plugins[plugin.type] = this.plugins[plugin.type] || [];

    if (!pluginName) {
      throw new Error('Your plugin must have a name');
    }

    if (!plugin.type) {
      throw new Error('Your plugin must have a type');
    }

    var existsPluginAlready = this.getPlugin(pluginName);
    if (existsPluginAlready) {
      var msg = 'Already found a plugin named \'' + existsPluginAlready.name + '\'.\n        Tried to use: \'' + pluginName + '\'.\n        Uppy is currently limited to running one of every plugin.\n        Share your use case with us over at\n        https://github.com/transloadit/uppy/issues/\n        if you want us to reconsider.';
      throw new Error(msg);
    }

    this.plugins[plugin.type].push(plugin);
    plugin.install();

    return this;
  };

  /**
   * Find one Plugin by name
   *
   * @param string name description
   */


  Uppy.prototype.getPlugin = function getPlugin(name) {
    var foundPlugin = false;
    this.iteratePlugins(function (plugin) {
      var pluginName = plugin.id;
      if (pluginName === name) {
        foundPlugin = plugin;
        return false;
      }
    });
    return foundPlugin;
  };

  /**
   * Iterate through all `use`d plugins
   *
   * @param function method description
   */


  Uppy.prototype.iteratePlugins = function iteratePlugins(method) {
    var _this4 = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this4.plugins[pluginType].forEach(method);
    });
  };

  /**
   * Logs stuff to console, only if `debug` is set to true. Silent in production.
   *
   * @return {String|Object} to log
   */


  Uppy.prototype.log = function log(msg, type) {
    if (!this.opts.debug) {
      return;
    }
    if (msg === '' + msg) {
      console.log('LOG: ' + msg);
    } else {
      console.dir(msg);
    }

    if (type === 'error') {
      console.error('LOG: ' + msg);
    }

    global.uppyLog = global.uppyLog + '\n' + 'DEBUG LOG: ' + msg;
  };

  Uppy.prototype.initSocket = function initSocket(opts) {
    if (!this.socket) {
      this.socket = new UppySocket(opts);
    }

    return this.socket;
  };

  // installAll () {
  //   Object.keys(this.plugins).forEach((pluginType) => {
  //     this.plugins[pluginType].forEach((plugin) => {
  //       plugin.install(this)
  //     })
  //   })
  // }

  /**
   * Initializes actions, installs all plugins (by iterating on them and calling `install`), sets options
   *
   */


  Uppy.prototype.run = function run() {
    this.log('Core is run, initializing actions...');

    this.actions();

    // Forse set `autoProceed` option to false if there are multiple selector Plugins active
    // if (this.plugins.acquirer && this.plugins.acquirer.length > 1) {
    //   this.opts.autoProceed = false
    // }

    // Install all plugins
    // this.installAll()

    return;
  };

  return Uppy;
}();

// module.exports = function (opts) {
//   if (!(this instanceof Uppy)) {
//     return new Uppy(opts)
//   }
// }

module.exports = function (opts) {
  if (!(this instanceof Uppy)) {
    return new Uppy(opts);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../core/Translator":33,"../core/Utils":35,"./UppySocket":34,"namespace-emitter":5}],33:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Translates strings with interpolation & pluralization support.
 * Extensible with custom dictionaries and pluralization functions.
 *
 * Borrows heavily from and inspired by Polyglot https://github.com/airbnb/polyglot.js,
 * basically a stripped-down version of it. Differences: pluralization functions are not hardcoded
 * and can be easily added among with dictionaries, nested objects are used for pluralization
 * as opposed to `||||` delimeter
 *
 * Usage example: `translator.translate('files_chosen', {smart_count: 3})`
 *
 * @param {object} opts
 */
module.exports = function () {
  function Translator(opts) {
    _classCallCheck(this, Translator);

    var defaultOptions = {
      locale: {
        strings: {},
        pluralize: function pluralize(n) {
          if (n === 1) {
            return 0;
          }
          return 1;
        }
      }
    };

    this.opts = _extends({}, defaultOptions, opts);
    this.locale = _extends({}, defaultOptions.locale, opts.locale);

    console.log(this.opts.locale);

    // this.locale.pluralize = this.locale ? this.locale.pluralize : defaultPluralize
    // this.locale.strings = Object.assign({}, en_US.strings, this.opts.locale.strings)
  }

  /**
   * Takes a string with placeholder variables like `%{smart_count} file selected`
   * and replaces it with values from options `{smart_count: 5}`
   *
   * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
   * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
   *
   * @param {string} phrase that needs interpolation, with placeholders
   * @param {object} options with values that will be used to replace placeholders
   * @return {string} interpolated
   */


  Translator.prototype.interpolate = function interpolate(phrase, options) {
    var replace = String.prototype.replace;
    var dollarRegex = /\$/g;
    var dollarBillsYall = '$$$$';

    for (var arg in options) {
      if (arg !== '_' && options.hasOwnProperty(arg)) {
        // Ensure replacement value is escaped to prevent special $-prefixed
        // regex replace tokens. the "$$$$" is needed because each "$" needs to
        // be escaped with "$" itself, and we need two in the resulting output.
        var replacement = options[arg];
        if (typeof replacement === 'string') {
          replacement = replace.call(options[arg], dollarRegex, dollarBillsYall);
        }
        // We create a new `RegExp` each time instead of using a more-efficient
        // string replace so that the same argument can be replaced multiple times
        // in the same phrase.
        phrase = replace.call(phrase, new RegExp('%\\{' + arg + '\\}', 'g'), replacement);
      }
    }
    return phrase;
  };

  /**
   * Public translate method
   *
   * @param {string} key
   * @param {object} options with values that will be used later to replace placeholders in string
   * @return {string} translated (and interpolated)
   */


  Translator.prototype.translate = function translate(key, options) {
    if (options && options.smart_count) {
      var plural = this.locale.pluralize(options.smart_count);
      return this.interpolate(this.opts.locale.strings[key][plural], options);
    }

    return this.interpolate(this.opts.locale.strings[key], options);
  };

  return Translator;
}();

},{}],34:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ee = require('namespace-emitter');

module.exports = function () {
  function UppySocket(opts) {
    var _this = this;

    _classCallCheck(this, UppySocket);

    this.queued = [];
    this.isOpen = false;
    this.socket = new WebSocket(opts.target);
    this.emitter = ee();

    this.socket.onopen = function (e) {
      console.log('socket connection successfully opened.');
      _this.isOpen = true;

      while (_this.queued.length > 0 && _this.isOpen) {
        var first = _this.queued[0];
        _this.send(first.action, first.payload);
        _this.queued = _this.queued.slice(1);
      }
    };

    this.socket.onclose = function (e) {
      _this.isOpen = false;
    };

    this._handleMessage = this._handleMessage.bind(this);

    this.socket.onmessage = this._handleMessage;

    this.close = this.close.bind(this);
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.send = this.send.bind(this);
  }

  UppySocket.prototype.close = function close() {
    return this.socket.close();
  };

  UppySocket.prototype.send = function send(action, payload) {
    // attach uuid

    if (!this.isOpen) {
      this.queued.push({ action: action, payload: payload });
      return;
    }

    this.socket.send(JSON.stringify({
      action: action,
      payload: payload
    }));
  };

  UppySocket.prototype.on = function on(action, handler) {
    console.log(action);
    this.emitter.on(action, handler);
  };

  UppySocket.prototype.emit = function emit(action, payload) {
    console.log(action);
    this.emitter.emit(action, payload);
  };

  UppySocket.prototype.once = function once(action, handler) {
    this.emitter.once(action, handler);
  };

  UppySocket.prototype._handleMessage = function _handleMessage(e) {
    try {
      var message = JSON.parse(e.data);
      console.log(message);
      this.emit(message.action, message.payload);
    } catch (err) {
      console.log(err);
    }
  };

  return UppySocket;
}();

},{"namespace-emitter":5}],35:[function(require,module,exports){
'use strict';

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

// import mime from 'mime-types'
// import pica from 'pica'

/**
 * A collection of small utility functions that help with dom manipulation, adding listeners,
 * promises and other good things.
 *
 * @module Utils
 */

/**
 * Shallow flatten nested arrays.
 */
function flatten(arr) {
  return [].concat.apply([], arr);
}

function isTouchDevice() {
  return 'ontouchstart' in window || // works on most browsers
  navigator.maxTouchPoints; // works on IE10/11 and Surface
}

/**
 * Shorter and fast way to select a single node in the DOM
 * @param   { String } selector - unique dom selector
 * @param   { Object } ctx - DOM node where the target of our search will is located
 * @returns { Object } dom node found
 */
function $(selector, ctx) {
  return (ctx || document).querySelector(selector);
}

/**
 * Shorter and fast way to select multiple nodes in the DOM
 * @param   { String|Array } selector - DOM selector or nodes list
 * @param   { Object } ctx - DOM node where the targets of our search will is located
 * @returns { Object } dom nodes found
 */
function $$(selector, ctx) {
  var els;
  if (typeof selector === 'string') {
    els = (ctx || document).querySelectorAll(selector);
  } else {
    els = selector;
    return Array.prototype.slice.call(els);
  }
}

function truncateString(str, length) {
  if (str.length > length) {
    return str.substr(0, length / 2) + '...' + str.substr(str.length - length / 4, str.length);
  }
  return str;

  // more precise version if needed
  // http://stackoverflow.com/a/831583
}

function secondsToTime(rawSeconds) {
  var hours = Math.floor(rawSeconds / 3600) % 24;
  var minutes = Math.floor(rawSeconds / 60) % 60;
  var seconds = Math.floor(rawSeconds % 60);

  return { hours: hours, minutes: minutes, seconds: seconds };
}

/**
 * Partition array by a grouping function.
 * @param  {[type]} array      Input array
 * @param  {[type]} groupingFn Grouping function
 * @return {[type]}            Array of arrays
 */
function groupBy(array, groupingFn) {
  return array.reduce(function (result, item) {
    var key = groupingFn(item);
    var xs = result.get(key) || [];
    xs.push(item);
    result.set(key, xs);
    return result;
  }, new Map());
}

/**
 * Tests if every array element passes predicate
 * @param  {Array}  array       Input array
 * @param  {Object} predicateFn Predicate
 * @return {bool}               Every element pass
 */
function every(array, predicateFn) {
  return array.reduce(function (result, item) {
    if (!result) {
      return false;
    }

    return predicateFn(item);
  }, true);
}

/**
 * Converts list into array
*/
function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

/**
 * Takes a fileName and turns it into fileID, by converting to lowercase,
 * removing extra characters and adding unix timestamp
 *
 * @param {String} fileName
 *
 */
function generateFileID(fileName) {
  var fileID = fileName.toLowerCase();
  fileID = fileID.replace(/[^A-Z0-9]/ig, '');
  fileID = fileID + Date.now();
  return fileID;
}

function extend() {
  for (var _len = arguments.length, objs = Array(_len), _key = 0; _key < _len; _key++) {
    objs[_key] = arguments[_key];
  }

  return Object.assign.apply(this, [{}].concat(objs));
}

/**
 * Takes function or class, returns its name.
 * Because IE doesn’t support `constructor.name`.
 * https://gist.github.com/dfkaye/6384439, http://stackoverflow.com/a/15714445
 *
 * @param {Object} fn — function
 *
 */
// function getFnName (fn) {
//   var f = typeof fn === 'function'
//   var s = f && ((fn.name && ['', fn.name]) || fn.toString().match(/function ([^\(]+)/))
//   return (!f && 'not a function') || (s && s[1] || 'anonymous')
// }

function getProportionalImageHeight(img, newWidth) {
  var aspect = img.width / img.height;
  var newHeight = Math.round(newWidth / aspect);
  return newHeight;
}

function getFileType(file) {
  if (file.type) {
    return file.type;
  }
  return '';
  // return mime.lookup(file.name)
}

// returns [fileName, fileExt]
function getFileNameAndExtension(fullFileName) {
  var re = /(?:\.([^.]+))?$/;
  var fileExt = re.exec(fullFileName)[1];
  var fileName = fullFileName.replace('.' + fileExt, '');
  return [fileName, fileExt];
}

/**
 * Reads file as data URI from file object,
 * the one you get from input[type=file] or drag & drop.
 *
 * @param {Object} file object
 * @return {Promise} dataURL of the file
 *
 */
function readFile(fileObj) {
  return new _Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.addEventListener('load', function (ev) {
      return resolve(ev.target.result);
    });
    reader.readAsDataURL(fileObj);

    // function workerScript () {
    //   self.addEventListener('message', (e) => {
    //     const file = e.data.file
    //     try {
    //       const reader = new FileReaderSync()
    //       postMessage({
    //         file: reader.readAsDataURL(file)
    //       })
    //     } catch (err) {
    //       console.log(err)
    //     }
    //   })
    // }
    //
    // const worker = makeWorker(workerScript)
    // worker.postMessage({file: fileObj})
    // worker.addEventListener('message', (e) => {
    //   const fileDataURL = e.data.file
    //   console.log('FILE _ DATA _ URL')
    //   return resolve(fileDataURL)
    // })
  });
}

/**
 * Resizes an image to specified width and proportional height, using canvas
 * See https://davidwalsh.name/resize-image-canvas,
 * http://babalan.com/resizing-images-with-javascript/
 * @TODO see if we need https://github.com/stomita/ios-imagefile-megapixel for iOS
 *
 * @param {String} Data URI of the original image
 * @param {String} width of the resulting image
 * @return {String} Data URI of the resized image
 */
function createImageThumbnail(imgDataURI, newWidth) {
  return new _Promise(function (resolve, reject) {
    var img = new Image();
    img.addEventListener('load', function () {
      var newImageWidth = newWidth;
      var newImageHeight = getProportionalImageHeight(img, newImageWidth);

      // create an off-screen canvas
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      // set its dimension to target size
      canvas.width = newImageWidth;
      canvas.height = newImageHeight;

      // draw source image into the off-screen canvas:
      // ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, newImageWidth, newImageHeight);

      // pica.resizeCanvas(img, canvas, (err) => {
      //   if (err) console.log(err)
      //   const thumbnail = canvas.toDataURL('image/png')
      //   return resolve(thumbnail)
      // })

      // encode image to data-uri with base64 version of compressed image
      // canvas.toDataURL('image/jpeg', quality);  // quality = [0.0, 1.0]
      var thumbnail = canvas.toDataURL('image/png');
      return resolve(thumbnail);
    });
    img.src = imgDataURI;
  });
}

function dataURItoBlob(dataURI, opts, toFile) {
  // get the base64 data
  var data = dataURI.split(',')[1];

  // user may provide mime type, if not get it from data URI
  var mimeType = opts.mimeType || dataURI.split(',')[0].split(':')[1].split(';')[0];

  // default to plain/text if data URI has no mimeType
  if (mimeType == null) {
    mimeType = 'plain/text';
  }

  var binary = atob(data);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }

  // Convert to a File?
  if (toFile) {
    return new File([new Uint8Array(array)], opts.name || '', { type: mimeType });
  }

  return new Blob([new Uint8Array(array)], { type: mimeType });
}

function dataURItoFile(dataURI, opts) {
  return dataURItoBlob(dataURI, opts, true);
}

/**
 * Copies text to clipboard by creating an almost invisible textarea,
 * adding text there, then running execCommand('copy').
 * Falls back to prompt() when the easy way fails (hello, Safari!)
 * From http://stackoverflow.com/a/30810322
 *
 * @param {String} textToCopy
 * @param {String} fallbackString
 * @return {Promise}
 */
function copyToClipboard(textToCopy, fallbackString) {
  fallbackString = fallbackString || 'Copy the URL below';

  return new _Promise(function (resolve, reject) {
    var textArea = document.createElement('textarea');
    textArea.setAttribute('style', {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '2em',
      height: '2em',
      padding: 0,
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent'
    });

    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();

    var magicCopyFailed = function magicCopyFailed(err) {
      document.body.removeChild(textArea);
      window.prompt(fallbackString, textToCopy);
      return reject('Oops, unable to copy displayed fallback prompt: ' + err);
    };

    try {
      var successful = document.execCommand('copy');
      if (!successful) {
        return magicCopyFailed('copy command unavailable');
      }
      document.body.removeChild(textArea);
      return resolve();
    } catch (err) {
      document.body.removeChild(textArea);
      return magicCopyFailed(err);
    }
  });
}

// function createInlineWorker (workerFunction) {
//   let code = workerFunction.toString()
//   code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'))
//
//   const blob = new Blob([code], {type: 'application/javascript'})
//   const worker = new Worker(URL.createObjectURL(blob))
//
//   return worker
// }

// function makeWorker (script) {
//   var URL = window.URL || window.webkitURL
//   var Blob = window.Blob
//   var Worker = window.Worker
//
//   if (!URL || !Blob || !Worker || !script) {
//     return null
//   }
//
//   let code = script.toString()
//   code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'))
//
//   var blob = new Blob([code])
//   var worker = new Worker(URL.createObjectURL(blob))
//   return worker
// }

function getSpeed(fileProgress) {
  if (!fileProgress.bytesUploaded) return 0;

  var timeElapsed = new Date() - fileProgress.uploadStarted;
  var uploadSpeed = fileProgress.bytesUploaded / (timeElapsed / 1000);
  return uploadSpeed;
}

function getETA(fileProgress) {
  if (!fileProgress.bytesUploaded) return 0;

  var uploadSpeed = getSpeed(fileProgress);
  var bytesRemaining = fileProgress.bytesTotal - fileProgress.bytesUploaded;
  var secondsRemaining = Math.round(bytesRemaining / uploadSpeed * 10) / 10;

  return secondsRemaining;
}

function prettyETA(seconds) {
  var time = secondsToTime(seconds);

  // Only display hours and minutes if they are greater than 0 but always
  // display minutes if hours is being displayed
  // Display a leading zero if the there is a preceding unit: 1m 05s, but 5s
  var hoursStr = time.hours ? time.hours + 'h ' : '';
  var minutesVal = time.hours ? ('0' + time.minutes).substr(-2) : time.minutes;
  var minutesStr = minutesVal ? minutesVal + 'm ' : '';
  var secondsVal = minutesVal ? ('0' + time.seconds).substr(-2) : time.seconds;
  var secondsStr = secondsVal + 's';

  return '' + hoursStr + minutesStr + secondsStr;
}

// function makeCachingFunction () {
//   let cachedEl = null
//   let lastUpdate = Date.now()
//
//   return function cacheElement (el, time) {
//     if (Date.now() - lastUpdate < time) {
//       return cachedEl
//     }
//
//     cachedEl = el
//     lastUpdate = Date.now()
//
//     return el
//   }
// }

module.exports = {
  generateFileID: generateFileID,
  toArray: toArray,
  every: every,
  flatten: flatten,
  groupBy: groupBy,
  $: $,
  $$: $$,
  extend: extend,
  readFile: readFile,
  createImageThumbnail: createImageThumbnail,
  getProportionalImageHeight: getProportionalImageHeight,
  isTouchDevice: isTouchDevice,
  getFileNameAndExtension: getFileNameAndExtension,
  truncateString: truncateString,
  getFileType: getFileType,
  secondsToTime: secondsToTime,
  dataURItoBlob: dataURItoBlob,
  dataURItoFile: dataURItoFile,
  getSpeed: getSpeed,
  getETA: getETA,
  // makeWorker,
  // makeCachingFunction,
  copyToClipboard: copyToClipboard,
  prettyETA: prettyETA
};

},{"es6-promise":4}],36:[function(require,module,exports){
'use strict';

var Core = require('./Core');
module.exports = Core;

},{"./Core":32}],37:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
  var demoLink = props.demo ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("a");
    bel0["onclick"] = arguments[0];
    ac(bel0, ["Proceed with Demo Account"]);
    return bel0;
  }(props.handleDemoAuth) : null;
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "UppyProvider-authenticate");
    var bel0 = document.createElement("h1");
    ac(bel0, ["You need to authenticate with ", arguments[0], " before selecting files."]);
    var bel1 = document.createElement("a");
    bel1.setAttribute("href", arguments[1]);
    ac(bel1, ["Authenticate"]);
    ac(bel2, ["\n      ", bel0, "\n      ", bel1, "\n      ", arguments[2], "\n    "]);
    return bel2;
  }(props.pluginName, props.link, demoLink);
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],38:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel1 = document.createElement("div");
        var bel0 = document.createElement("span");
        ac(bel0, ["\n        Something went wrong.  Probably our fault. ", arguments[0], "\n      "]);
        ac(bel1, ["\n      ", bel0, "\n    "]);
        return bel1;
    }(props.error);
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],39:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AuthView = require('./AuthView');
var Browser = require('./new/Browser');
var ErrorView = require('./Error');

/**
 * Class to easily generate generic views for plugins
 *
 * This class expects the plugin using to have the following attributes
 *
 * stateId {String} object key of which the plugin state is stored
 *
 * This class also expects the plugin instance using it to have the following
 * accessor methods.
 * Each method takes the item whose property is to be accessed
 * as a param
 *
 * isFolder
 *    @return {Boolean} for if the item is a folder or not
 * getItemData
 *    @return {Object} that is format ready for uppy upload/download
 * getItemIcon
 *    @return {Object} html instance of the item's icon
 * getItemSubList
 *    @return {Array} sub-items in the item. e.g a folder may contain sub-items
 * getItemName
 *    @return {String} display friendly name of the item
 * getMimeType
 *    @return {String} mime type of the item
 * getItemId
 *    @return {String} unique id of the item
 * getItemRequestPath
 *    @return {String} unique request path of the item when making calls to uppy server
 * getItemModifiedDate
 *    @return {object} or {String} date of when last the item was modified
 */
module.exports = function () {
  /**
   * @param {object} instance of the plugin
   */
  function View(plugin) {
    _classCallCheck(this, View);

    this.plugin = plugin;
    this.Provider = plugin[plugin.id];

    // Logic
    this.addFile = this.addFile.bind(this);
    this.filterItems = this.filterItems.bind(this);
    this.filterQuery = this.filterQuery.bind(this);
    this.getFolder = this.getFolder.bind(this);
    this.getNextFolder = this.getNextFolder.bind(this);
    this.handleRowClick = this.handleRowClick.bind(this);
    this.logout = this.logout.bind(this);
    this.handleDemoAuth = this.handleDemoAuth.bind(this);
    this.sortByTitle = this.sortByTitle.bind(this);
    this.sortByDate = this.sortByDate.bind(this);
    this.isActiveRow = this.isActiveRow.bind(this);

    // Visual
    this.render = this.render.bind(this);
  }

  /**
   * Little shorthand to update the state with the plugin's state
   */


  View.prototype.updateState = function updateState(newState) {
    var _plugin$core$setState;

    var stateId = this.plugin.stateId;
    var state = this.plugin.core.state;


    this.plugin.core.setState((_plugin$core$setState = {}, _plugin$core$setState[stateId] = _extends({}, state[stateId], newState), _plugin$core$setState));
  };

  /**
   * Based on folder ID, fetch a new folder and update it to state
   * @param  {String} id Folder id
   * @return {Promise}   Folders/files in folder
   */


  View.prototype.getFolder = function getFolder(id) {
    var _this = this;

    return this.Provider.list(id).then(function (res) {
      var folders = [];
      var files = [];
      var updatedDirectories = void 0;

      var state = _this.plugin.core.getState()[_this.plugin.stateId];
      var index = state.directories.findIndex(function (dir) {
        return id === dir.id;
      });

      if (index !== -1) {
        updatedDirectories = state.directories.slice(0, index + 1);
      } else {
        updatedDirectories = state.directories.concat([{ id: id, title: _this.plugin.getItemName(res) }]);
      }

      _this.plugin.getItemSubList(res).forEach(function (item) {
        if (_this.plugin.isFolder(item)) {
          folders.push(item);
        } else {
          files.push(item);
        }
      });

      var data = { folders: folders, files: files, directories: updatedDirectories };
      _this.updateState(data);

      return data;
    }).catch(function (err) {
      return err;
    });
  };

  /**
   * Fetches new folder
   * @param  {Object} Folder
   * @param  {String} title Folder title
   */


  View.prototype.getNextFolder = function getNextFolder(folder) {
    var id = this.plugin.getItemRequestPath(folder);
    this.getFolder(id);
  };

  View.prototype.addFile = function addFile(file) {
    var tagFile = {
      source: this.plugin.id,
      data: this.plugin.getItemData(file),
      name: this.plugin.getItemName(file),
      type: this.plugin.getMimeType(file),
      isRemote: true,
      body: {
        fileId: this.plugin.getItemId(file)
      },
      remote: {
        host: this.plugin.opts.host,
        url: this.plugin.opts.host + '/' + this.Provider.id + '/get/' + this.plugin.getItemRequestPath(file),
        body: {
          fileId: this.plugin.getItemId(file)
        }
      }
    };
    console.log('adding file');
    this.plugin.core.emitter.emit('core:file-add', tagFile);
  };

  /**
   * Removes session token on client side.
   */


  View.prototype.logout = function logout() {
    var _this2 = this;

    this.Provider.logout(location.href).then(function (res) {
      return res.json();
    }).then(function (res) {
      if (res.ok) {
        var newState = {
          authenticated: false,
          files: [],
          folders: [],
          directories: []
        };
        _this2.updateState(newState);
      }
    });
  };

  /**
   * Used to set active file/folder.
   * @param  {Object} file   Active file/folder
   */


  View.prototype.handleRowClick = function handleRowClick(file) {
    var state = this.plugin.core.getState()[this.plugin.stateId];
    var newState = _extends({}, state, {
      activeRow: this.plugin.getItemId(file)
    });

    this.updateState(newState);
  };

  View.prototype.filterQuery = function filterQuery(e) {
    var state = this.plugin.core.getState()[this.plugin.stateId];
    this.updateState(_extends({}, state, {
      filterInput: e.target.value
    }));
  };

  View.prototype.filterItems = function filterItems(items) {
    var _this3 = this;

    var state = this.plugin.core.getState()[this.plugin.stateId];
    return items.filter(function (folder) {
      return _this3.plugin.getItemName(folder).toLowerCase().indexOf(state.filterInput.toLowerCase()) !== -1;
    });
  };

  View.prototype.sortByTitle = function sortByTitle() {
    var _this4 = this;

    var state = _extends({}, this.plugin.core.getState()[this.plugin.stateId]);
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      if (sorting === 'titleDescending') {
        return _this4.plugin.getItemName(fileB).localeCompare(_this4.plugin.getItemName(fileA));
      }
      return _this4.plugin.getItemName(fileA).localeCompare(_this4.plugin.getItemName(fileB));
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      if (sorting === 'titleDescending') {
        return _this4.plugin.getItemName(folderB).localeCompare(_this4.plugin.getItemName(folderA));
      }
      return _this4.plugin.getItemName(folderA).localeCompare(_this4.plugin.getItemName(folderB));
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'titleDescending' ? 'titleAscending' : 'titleDescending'
    }));
  };

  View.prototype.sortByDate = function sortByDate() {
    var _this5 = this;

    var state = _extends({}, this.plugin.core.getState()[this.plugin.stateId]);
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      var a = new Date(_this5.plugin.getItemModifiedDate(fileA));
      var b = new Date(_this5.plugin.getItemModifiedDate(fileB));

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }
      return a > b ? 1 : a < b ? -1 : 0;
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      var a = new Date(_this5.plugin.getItemModifiedDate(folderA));
      var b = new Date(_this5.plugin.getItemModifiedDate(folderB));

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'dateDescending' ? 'dateAscending' : 'dateDescending'
    }));
  };

  View.prototype.isActiveRow = function isActiveRow(file) {
    return this.plugin.core.getState()[this.plugin.stateId].activeRow === this.plugin.getItemId(file);
  };

  View.prototype.handleDemoAuth = function handleDemoAuth() {
    var state = this.plugin.core.getState()[this.plugin.stateId];
    this.updateState({}, state, {
      authenticated: true
    });
  };

  View.prototype.render = function render(state) {
    var _state$plugin$stateId = state[this.plugin.stateId];
    var authenticated = _state$plugin$stateId.authenticated;
    var error = _state$plugin$stateId.error;


    if (error) {
      return ErrorView({ error: error });
    }

    if (!authenticated) {
      var authState = btoa(JSON.stringify({
        redirect: location.href.split('#')[0]
      }));

      var link = this.plugin.opts.host + '/connect/' + this.Provider.authProvider + '?state=' + authState;

      return AuthView({
        pluginName: this.plugin.title,
        link: link,
        demo: this.plugin.opts.demo,
        handleDemoAuth: this.handleDemoAuth
      });
    }

    var browserProps = _extends({}, state[this.plugin.stateId], {
      getNextFolder: this.getNextFolder,
      getFolder: this.getFolder,
      addFile: this.addFile,
      filterItems: this.filterItems,
      filterQuery: this.filterQuery,
      handleRowClick: this.handleRowClick,
      sortByTitle: this.sortByTitle,
      sortByDate: this.sortByDate,
      logout: this.logout,
      demo: this.plugin.opts.demo,
      isActiveRow: this.isActiveRow,
      getItemName: this.plugin.getItemName,
      getItemIcon: this.plugin.getItemIcon
    });

    return Browser(browserProps);
  };

  return View;
}();

},{"./AuthView":37,"./Error":38,"./new/Browser":42}],40:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel1 = document.createElement("li");
        var bel0 = document.createElement("button");
        bel0["onclick"] = arguments[0];
        ac(bel0, [arguments[1]]);
        ac(bel1, ["\n      ", bel0, "\n    "]);
        return bel1;
    }(props.getFolder, props.title);
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],41:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var Breadcrumb = require('./Breadcrumb');

module.exports = function (props) {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("ul");
    bel0.setAttribute("class", "UppyProvider-breadcrumbs");
    ac(bel0, ["\n      ", arguments[0], "\n    "]);
    return bel0;
  }(props.directories.map(function (directory) {
    return Breadcrumb({
      getFolder: function getFolder() {
        return props.getFolder(directory.id);
      },
      title: directory.title
    });
  }));
};

},{"./Breadcrumb":40,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],42:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var Breadcrumbs = require('./Breadcrumbs');
var Table = require('./Table');

module.exports = function (props) {
  var filteredFolders = props.folders;
  var filteredFiles = props.files;

  if (props.filterInput !== '') {
    filteredFolders = props.filterItems(props.folders);
    filteredFiles = props.filterItems(props.files);
  }

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel5 = document.createElement("div");
    bel5.setAttribute("class", "Browser");
    var bel1 = document.createElement("header");
    var bel0 = document.createElement("input");
    bel0.setAttribute("type", "text");
    bel0.setAttribute("placeholder", "Search Drive");
    bel0["onkeyup"] = arguments[0];
    bel0.setAttribute("value", arguments[1]);
    bel0.setAttribute("class", "Browser-search");
    ac(bel1, ["\n        ", bel0, "\n      "]);
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "Browser-subHeader");
    ac(bel2, ["\n        ", arguments[2], "\n      "]);
    var bel4 = document.createElement("div");
    bel4.setAttribute("class", "Browser-body");
    var bel3 = document.createElement("main");
    bel3.setAttribute("class", "Browser-content");
    ac(bel3, ["\n          ", arguments[3], "\n        "]);
    ac(bel4, ["\n        ", bel3, "\n      "]);
    ac(bel5, ["\n      ", bel1, "\n      ", bel2, "\n      ", bel4, "\n    "]);
    return bel5;
  }(props.filterQuery, props.filterInput, Breadcrumbs({
    getFolder: props.getFolder,
    directories: props.directories
  }), Table({
    columns: [{
      name: 'Name',
      key: 'title'
    }],
    folders: filteredFolders,
    files: filteredFiles,
    activeRow: props.isActiveRow,
    sortByTitle: props.sortByTitle,
    sortByDate: props.sortByDate,
    handleRowClick: props.handleRowClick,
    handleFileDoubleClick: props.addFile,
    handleFolderDoubleClick: props.getNextFolder,
    getItemName: props.getItemName,
    getItemIcon: props.getItemIcon
  }));
};

},{"./Breadcrumbs":41,"./Table":43,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],43:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var Row = require('./TableRow');

module.exports = function (props) {
  var headers = props.columns.map(function (column) {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel0 = document.createElement("th");
      bel0["onclick"] = arguments[0];
      bel0.setAttribute("class", "BrowserTable-headerColumn BrowserTable-column");
      ac(bel0, ["\n        ", arguments[1], "\n      "]);
      return bel0;
    }(props.sortByTitle, column.name);
  });

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel3 = document.createElement("table");
    bel3.setAttribute("class", "BrowserTable");
    var bel1 = document.createElement("thead");
    bel1.setAttribute("class", "BrowserTable-header");
    var bel0 = document.createElement("tr");
    ac(bel0, ["\n          ", arguments[0], "\n        "]);
    ac(bel1, ["\n        ", bel0, "\n      "]);
    var bel2 = document.createElement("tbody");
    ac(bel2, ["\n        ", arguments[1], "\n        ", arguments[2], "\n      "]);
    ac(bel3, ["\n      ", bel1, "\n      ", bel2, "\n    "]);
    return bel3;
  }(headers, props.folders.map(function (folder) {
    return Row({
      title: props.getItemName(folder),
      active: props.activeRow(folder),
      getItemIcon: function getItemIcon() {
        return props.getItemIcon(folder);
      },
      handleClick: function handleClick() {
        return props.handleRowClick(folder);
      },
      handleDoubleClick: function handleDoubleClick() {
        return props.handleFolderDoubleClick(folder);
      },
      columns: props.columns
    });
  }), props.files.map(function (file) {
    return Row({
      title: props.getItemName(file),
      active: props.activeRow(file),
      getItemIcon: function getItemIcon() {
        return props.getItemIcon(file);
      },
      handleClick: function handleClick() {
        return props.handleRowClick(file);
      },
      handleDoubleClick: function handleDoubleClick() {
        return props.handleFileDoubleClick(file);
      },
      columns: props.columns
    });
  }));
};

},{"./TableRow":45,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],44:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel0 = document.createElement("td");
        bel0.setAttribute("class", "BrowserTable-rowColumn BrowserTable-column");
        ac(bel0, ["\n      ", arguments[0], " ", arguments[1], "\n    "]);
        return bel0;
    }(props.getItemIcon(), props.value);
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],45:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var Column = require('./TableColumn');

module.exports = function (props) {
  var classes = props.active ? 'BrowserTable-row is-active' : 'BrowserTable-row';
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("tr");
    bel0["onclick"] = arguments[0];
    bel0["ondblclick"] = arguments[1];
    bel0.setAttribute("class", arguments[2]);
    ac(bel0, ["\n      ", arguments[3], "\n    "]);
    return bel0;
  }(props.handleClick, props.handleDoubleClick, classes, Column({
    getItemIcon: props.getItemIcon,
    value: props.title
  }));
};

},{"./TableColumn":44,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],46:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElement("span");
    var bel0 = document.createElement("button");
    bel0.setAttribute("type", "button");
    bel0["onclick"] = arguments[0];
    bel0.setAttribute("class", "UppyDashboard-browse");
    ac(bel0, [arguments[1]]);
    var bel1 = document.createElement("input");
    bel1.setAttribute("type", "file");
    bel1.setAttribute("name", "files[]");
    bel1.setAttribute("multiple", "true");
    bel1["onchange"] = arguments[2];
    bel1.setAttribute("class", "UppyDashboard-input");
    ac(bel2, ["\n      ", arguments[3], "\n      ", bel0, "\n      ", bel1, "\n    "]);
    return bel2;
  }(function (ev) {
    var input = document.querySelector(props.container + ' .UppyDashboard-input');
    input.click();
  }, props.i18n('browse'), props.handleInputChange, props.acquirers.length === 0 ? props.i18n('dropPaste') : props.i18n('dropPasteImport'));
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],47:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var FileList = require('./FileList');
var Tabs = require('./Tabs');
var FileCard = require('./FileCard');
var UploadBtn = require('./UploadBtn');
var StatusBar = require('./StatusBar');

var _require = require('../../core/Utils');

var isTouchDevice = _require.isTouchDevice;
var toArray = _require.toArray;

var _require2 = require('./icons');

var closeIcon = _require2.closeIcon;

// http://dev.edenspiekermann.com/2016/02/11/introducing-accessible-modal-dialog

module.exports = function Dashboard(props) {
  var handleInputChange = function handleInputChange(ev) {
    ev.preventDefault();
    var files = toArray(ev.target.files);

    files.forEach(function (file) {
      props.addFile({
        source: props.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  // @TODO Exprimental, work in progress
  // no names, weird API, Chrome-only http://stackoverflow.com/a/22940020
  var handlePaste = function handlePaste(ev) {
    ev.preventDefault();

    var files = toArray(ev.clipboardData.items);
    files.forEach(function (file) {
      if (file.kind !== 'file') return;

      var blob = file.getAsFile();
      props.log('File pasted');
      props.addFile({
        source: props.id,
        name: file.name,
        type: file.type,
        data: blob
      });
    });
  };

  var dashboardSize = props.inline ? 'width: ' + props.maxWidth + 'px; height: ' + props.maxHeight + 'px;' : '';

  return function () {
    var onload = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/node_modules/on-load/index.js');
    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel11 = document.createElement("div");
    var args = arguments;
    onload(bel11, function bel_onload() {
      args[18](bel11);
    }, function bel_onunload() {}, "o0");
    bel11.setAttribute("aria-hidden", arguments[19]);
    bel11.setAttribute("aria-label", arguments[20]);
    bel11.setAttribute("role", "dialog");
    bel11["onpaste"] = arguments[21];
    bel11.setAttribute("class", "Uppy UppyTheme--default UppyDashboard\n                          " + arguments[22] + "\n                          " + arguments[23] + "\n                          " + arguments[24] + "\n                          " + arguments[25]);
    var bel0 = document.createElement("button");
    bel0.setAttribute("aria-label", arguments[0]);
    bel0.setAttribute("title", arguments[1]);
    bel0["onclick"] = arguments[2];
    bel0.setAttribute("class", "UppyDashboard-close");
    ac(bel0, [arguments[3]]);
    var bel1 = document.createElement("div");
    bel1["onclick"] = arguments[4];
    bel1.setAttribute("class", "UppyDashboard-overlay");
    ac(bel1, ["\n    "]);
    var bel10 = document.createElement("div");
    bel10.setAttribute("tabindex", "0");
    bel10.setAttribute("style", arguments[17]);
    bel10.setAttribute("class", "UppyDashboard-inner");
    var bel9 = document.createElement("div");
    bel9.setAttribute("class", "UppyDashboard-innerWrap");
    var bel3 = document.createElement("div");
    bel3.setAttribute("class", "UppyDashboard-filesContainer");
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "UppyDashboard-actions");
    ac(bel2, ["\n            ", arguments[5], "\n          "]);
    ac(bel3, ["\n\n          ", arguments[6], "\n\n          ", bel2, "\n\n        "]);
    var bel7 = document.createElement("div");
    bel7.setAttribute("role", "tabpanel");
    bel7.setAttribute("aria-hidden", arguments[11]);
    bel7.setAttribute("class", "UppyDashboardContent-panel");
    var bel6 = document.createElement("div");
    bel6.setAttribute("class", "UppyDashboardContent-bar");
    var bel4 = document.createElement("h2");
    bel4.setAttribute("class", "UppyDashboardContent-title");
    ac(bel4, ["\n              ", arguments[7], " ", arguments[8], "\n            "]);
    var bel5 = document.createElement("button");
    bel5["onclick"] = arguments[9];
    bel5.setAttribute("class", "UppyDashboardContent-back");
    ac(bel5, [arguments[10]]);
    ac(bel6, ["\n            ", bel4, "\n            ", bel5, "\n          "]);
    ac(bel7, ["\n          ", bel6, "\n          ", arguments[12], "\n        "]);
    var bel8 = document.createElement("div");
    bel8.setAttribute("class", "UppyDashboard-progressindicators");
    ac(bel8, ["\n          ", arguments[13], "\n\n          ", arguments[14], "\n        "]);
    ac(bel9, ["\n\n        ", arguments[15], "\n\n        ", arguments[16], "\n\n        ", bel3, "\n\n        ", bel7, "\n\n        ", bel8, "\n\n      "]);
    ac(bel10, ["\n      ", bel9, "\n    "]);
    ac(bel11, ["\n\n    ", bel0, "\n\n    ", bel1, "\n\n    ", bel10, "\n  "]);
    return bel11;
  }(props.i18n('closeModal'), props.i18n('closeModal'), props.hideModal, closeIcon(), props.hideModal, !props.autoProceed && props.newFiles.length > 0 ? UploadBtn({
    i18n: props.i18n,
    startUpload: props.startUpload,
    newFileCount: props.newFiles.length
  }) : null, FileList({
    acquirers: props.acquirers,
    files: props.files,
    handleInputChange: handleInputChange,
    container: props.container,
    showFileCard: props.showFileCard,
    showProgressDetails: props.showProgressDetails,
    totalProgress: props.totalProgress,
    totalFileCount: props.totalFileCount,
    info: props.info,
    i18n: props.i18n,
    log: props.log,
    removeFile: props.removeFile,
    pauseAll: props.pauseAll,
    resumeAll: props.resumeAll,
    pauseUpload: props.pauseUpload,
    startUpload: props.startUpload,
    cancelUpload: props.cancelUpload,
    resumableUploads: props.resumableUploads,
    isWide: props.isWide
  }), props.i18n('importFrom'), props.activePanel ? props.activePanel.name : null, props.hideAllPanels, props.i18n('done'), props.activePanel ? 'false' : 'true', props.activePanel ? props.activePanel.render(props.state) : '', StatusBar({
    totalProgress: props.totalProgress,
    totalFileCount: props.totalFileCount,
    uploadStartedFiles: props.uploadStartedFiles,
    isAllComplete: props.isAllComplete,
    isAllPaused: props.isAllPaused,
    isUploadStarted: props.isUploadStarted,
    pauseAll: props.pauseAll,
    resumeAll: props.resumeAll,
    cancelAll: props.cancelAll,
    complete: props.completeFiles.length,
    inProgress: props.inProgress,
    totalSpeed: props.totalSpeed,
    totalETA: props.totalETA,
    startUpload: props.startUpload,
    newFileCount: props.newFiles.length,
    i18n: props.i18n,
    resumableUploads: props.resumableUploads
  }), props.progressindicators.map(function (target) {
    return target.render(props.state);
  }), Tabs({
    files: props.files,
    handleInputChange: handleInputChange,
    acquirers: props.acquirers,
    container: props.container,
    panelSelectorPrefix: props.panelSelectorPrefix,
    showPanel: props.showPanel,
    i18n: props.i18n
  }), FileCard({
    files: props.files,
    fileCardFor: props.fileCardFor,
    done: props.fileCardDone,
    metaFields: props.metaFields,
    log: props.log,
    i18n: props.i18n
  }), dashboardSize, function () {
    return props.updateDashboardElWidth();
  }, props.inline ? 'false' : props.modal.isHidden, !props.inline ? props.i18n('dashboardWindowTitle') : props.i18n('dashboardTitle'), handlePaste, isTouchDevice() ? 'Uppy--isTouchDevice' : '', props.semiTransparent ? 'UppyDashboard--semiTransparent' : '', !props.inline ? 'UppyDashboard--modal' : '', props.isWide ? 'UppyDashboard--wide' : '');
};

},{"../../core/Utils":35,"./FileCard":48,"./FileList":51,"./StatusBar":52,"./Tabs":53,"./UploadBtn":54,"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/node_modules/on-load/index.js":29,"yo-yo":19}],48:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

var _require = require('./icons');

var iconText = _require.iconText;
var iconFile = _require.iconFile;
var iconAudio = _require.iconAudio;
var checkIcon = _require.checkIcon;


function getIconByMime(fileTypeGeneral) {
  switch (fileTypeGeneral) {
    case 'text':
      return iconText();
    case 'audio':
      return iconAudio();
    default:
      return iconFile();
  }
}

module.exports = function fileCard(props) {
  var file = props.fileCardFor ? props.files[props.fileCardFor] : false;
  var meta = {};

  function tempStoreMeta(ev) {
    var value = ev.target.value;
    var name = ev.target.attributes.name.value;
    meta[name] = value;
  }

  function renderMetaFields(file) {
    var metaFields = props.metaFields || [];
    return metaFields.map(function (field) {
      return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel2 = document.createElement("fieldset");
        bel2.setAttribute("class", "UppyDashboardFileCard-fieldset");
        var bel0 = document.createElement("label");
        bel0.setAttribute("class", "UppyDashboardFileCard-label");
        ac(bel0, [arguments[0]]);
        var bel1 = document.createElement("input");
        bel1.setAttribute("name", arguments[1]);
        bel1.setAttribute("type", "text");
        bel1.setAttribute("value", arguments[2]);
        bel1.setAttribute("placeholder", arguments[3]);
        bel1["onkeyup"] = arguments[4];
        bel1.setAttribute("class", "UppyDashboardFileCard-input");
        ac(bel2, ["\n        ", bel0, "\n        ", bel1]);
        return bel2;
      }(field.name, field.id, file.meta[field.id], field.placeholder || '', tempStoreMeta);
    });
  }

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel6 = document.createElement("div");
    bel6.setAttribute("aria-hidden", arguments[4]);
    bel6.setAttribute("class", "UppyDashboardFileCard");
    var bel3 = document.createElement("div");
    bel3.setAttribute("class", "UppyDashboardContent-bar");
    var bel1 = document.createElement("h2");
    bel1.setAttribute("class", "UppyDashboardContent-title");
    var bel0 = document.createElement("span");
    bel0.setAttribute("class", "UppyDashboardContent-titleFile");
    ac(bel0, [arguments[0]]);
    ac(bel1, ["Editing ", bel0]);
    var bel2 = document.createElement("button");
    bel2.setAttribute("title", "Finish editing file");
    bel2["onclick"] = arguments[1];
    bel2.setAttribute("class", "UppyDashboardContent-back");
    ac(bel2, ["Done"]);
    ac(bel3, ["\n      ", bel1, "\n      ", bel2, "\n    "]);
    var bel5 = document.createElement("div");
    bel5.setAttribute("class", "UppyDashboard-actions");
    var bel4 = document.createElement("button");
    bel4.setAttribute("type", "button");
    bel4.setAttribute("title", "Finish editing file");
    bel4["onclick"] = arguments[2];
    bel4.setAttribute("class", "UppyButton--circular UppyButton--blue UppyDashboardFileCard-done");
    ac(bel4, [arguments[3]]);
    ac(bel5, ["\n      ", bel4, "\n    "]);
    ac(bel6, ["\n    ", bel3, "\n    ", arguments[5], "\n    ", bel5, "\n    "]);
    return bel6;
  }(file.meta ? file.meta.name : file.name, function () {
    return props.done(meta, file.id);
  }, function () {
    return props.done(meta, file.id);
  }, checkIcon(), !props.fileCardFor, props.fileCardFor ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel5 = document.createElement("div");
    bel5.setAttribute("class", "UppyDashboardFileCard-inner");
    var bel0 = document.createElement("div");
    bel0.setAttribute("class", "UppyDashboardFileCard-preview");
    ac(bel0, ["\n            ", arguments[0], "\n          "]);
    var bel4 = document.createElement("div");
    bel4.setAttribute("class", "UppyDashboardFileCard-info");
    var bel3 = document.createElement("fieldset");
    bel3.setAttribute("class", "UppyDashboardFileCard-fieldset");
    var bel1 = document.createElement("label");
    bel1.setAttribute("class", "UppyDashboardFileCard-label");
    ac(bel1, ["Name"]);
    var bel2 = document.createElement("input");
    bel2.setAttribute("name", "name");
    bel2.setAttribute("type", "text");
    bel2.setAttribute("value", arguments[1]);
    bel2["onkeyup"] = arguments[2];
    bel2.setAttribute("class", "UppyDashboardFileCard-input");
    ac(bel3, ["\n              ", bel1, "\n              ", bel2, "\n            "]);
    ac(bel4, ["\n            ", bel3, "\n            ", arguments[3], "\n          "]);
    ac(bel5, ["\n          ", bel0, "\n          ", bel4, "\n        "]);
    return bel5;
  }(file.preview ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("img");
    bel0.setAttribute("alt", arguments[0]);
    bel0.setAttribute("src", arguments[1]);
    return bel0;
  }(file.name, file.preview) : function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("div");
    bel0.setAttribute("class", "UppyDashboardItem-previewIcon");
    ac(bel0, [arguments[0]]);
    return bel0;
  }(getIconByMime(file.type.general)), file.meta.name, tempStoreMeta, renderMetaFields(file)) : null);
};

},{"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],49:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

var _require = require('../../core/Utils');

var getETA = _require.getETA;
var getSpeed = _require.getSpeed;
var prettyETA = _require.prettyETA;
var getFileNameAndExtension = _require.getFileNameAndExtension;
var truncateString = _require.truncateString;
var copyToClipboard = _require.copyToClipboard;

var prettyBytes = require('pretty-bytes');
var FileItemProgress = require('./FileItemProgress');

var _require2 = require('./icons');

var iconText = _require2.iconText;
var iconFile = _require2.iconFile;
var iconAudio = _require2.iconAudio;
var iconEdit = _require2.iconEdit;
var iconCopy = _require2.iconCopy;


function getIconByMime(fileTypeGeneral) {
  switch (fileTypeGeneral) {
    case 'text':
      return iconText();
    case 'audio':
      return iconAudio();
    default:
      return iconFile();
  }
}

module.exports = function fileItem(props) {
  var file = props.file;

  var isUploaded = file.progress.uploadComplete;
  var uploadInProgressOrComplete = file.progress.uploadStarted;
  var uploadInProgress = file.progress.uploadStarted && !file.progress.uploadComplete;
  var isPaused = file.isPaused || false;

  var fileName = getFileNameAndExtension(file.meta.name)[0];
  var truncatedFileName = props.isWide ? truncateString(fileName, 15) : fileName;

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel8 = document.createElement("li");
    bel8.setAttribute("id", "uppy_" + arguments[11]);
    bel8.setAttribute("title", arguments[12]);
    bel8.setAttribute("class", "UppyDashboardItem\n                        " + arguments[13] + "\n                        " + arguments[14] + "\n                        " + arguments[15] + "\n                        " + arguments[16]);
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "UppyDashboardItem-preview");
    var bel1 = document.createElement("div");
    bel1.setAttribute("class", "UppyDashboardItem-progress");
    var bel0 = document.createElement("button");
    bel0.setAttribute("title", arguments[0]);
    bel0["onclick"] = arguments[1];
    bel0.setAttribute("class", "UppyDashboardItem-progressBtn");
    ac(bel0, ["\n            ", arguments[2], "\n          "]);
    ac(bel1, ["\n          ", bel0, "\n          ", arguments[3], "\n        "]);
    ac(bel2, ["\n        ", arguments[4], "\n        ", bel1, "\n      "]);
    var bel6 = document.createElement("div");
    bel6.setAttribute("class", "UppyDashboardItem-info");
    var bel3 = document.createElement("h4");
    bel3.setAttribute("title", arguments[5]);
    bel3.setAttribute("class", "UppyDashboardItem-name");
    ac(bel3, ["\n        ", arguments[6], "\n      "]);
    var bel5 = document.createElement("div");
    bel5.setAttribute("class", "UppyDashboardItem-status");
    var bel4 = document.createElement("span");
    bel4.setAttribute("class", "UppyDashboardItem-statusSize");
    ac(bel4, [arguments[7]]);
    ac(bel5, ["\n        ", bel4, "\n      "]);
    ac(bel6, ["\n      ", bel3, "\n      ", bel5, "\n      ", arguments[8], "\n      ", arguments[9], "\n    "]);
    var bel7 = document.createElement("div");
    bel7.setAttribute("class", "UppyDashboardItem-action");
    ac(bel7, ["\n      ", arguments[10], "\n    "]);
    ac(bel8, ["\n      ", bel2, "\n    ", bel6, "\n    ", bel7, "\n  "]);
    return bel8;
  }(isUploaded ? 'upload complete' : props.resumableUploads ? file.isPaused ? 'resume upload' : 'pause upload' : 'cancel upload', function (ev) {
    if (isUploaded) return;
    if (props.resumableUploads) {
      props.pauseUpload(file.id);
    } else {
      props.cancelUpload(file.id);
    }
  }, FileItemProgress({
    progress: file.progress.percentage,
    fileID: file.id
  }), props.showProgressDetails ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("div");
    bel0.setAttribute("title", arguments[0]);
    bel0.setAttribute("aria-label", arguments[1]);
    bel0.setAttribute("class", "UppyDashboardItem-progressInfo");
    ac(bel0, ["\n                ", arguments[2], "\n              "]);
    return bel0;
  }(props.i18n('fileProgress'), props.i18n('fileProgress'), !file.isPaused && !isUploaded ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("span");
    ac(bel0, [arguments[0], " ・ ↑ ", arguments[1], "/s"]);
    return bel0;
  }(prettyETA(getETA(file.progress)), prettyBytes(getSpeed(file.progress))) : null) : null, file.preview ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("img");
    bel0.setAttribute("alt", arguments[0]);
    bel0.setAttribute("src", arguments[1]);
    return bel0;
  }(file.name, file.preview) : function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("div");
    bel0.setAttribute("class", "UppyDashboardItem-previewIcon");
    ac(bel0, ["\n              ", arguments[0], "\n            "]);
    return bel0;
  }(getIconByMime(file.type.general)), fileName, file.uploadURL ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("a");
    bel0.setAttribute("href", arguments[0]);
    bel0.setAttribute("target", "_blank");
    ac(bel0, ["\n              ", arguments[1], "\n            "]);
    return bel0;
  }(file.uploadURL, file.extension ? truncatedFileName + '.' + file.extension : truncatedFileName) : file.extension ? truncatedFileName + '.' + file.extension : truncatedFileName, file.data.size ? prettyBytes(file.data.size) : '?', !uploadInProgressOrComplete ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("button");
    bel0.setAttribute("aria-label", "Edit file");
    bel0.setAttribute("title", "Edit file");
    bel0["onclick"] = arguments[0];
    bel0.setAttribute("class", "UppyDashboardItem-edit");
    ac(bel0, ["\n                        ", arguments[1]]);
    return bel0;
  }(function (e) {
    return props.showFileCard(file.id);
  }, iconEdit()) : null, file.uploadURL ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("button");
    bel0.setAttribute("aria-label", "Copy link");
    bel0.setAttribute("title", "Copy link");
    bel0["onclick"] = arguments[0];
    bel0.setAttribute("class", "UppyDashboardItem-copyLink");
    ac(bel0, [arguments[1]]);
    return bel0;
  }(function () {
    copyToClipboard(file.uploadURL, props.i18n('copyLinkToClipboardFallback')).then(function () {
      props.log('Link copied to clipboard.');
      props.info(props.i18n('copyLinkToClipboardSuccess'), 'info', 3000);
    }).catch(props.log);
  }, iconCopy()) : null, !isUploaded ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel3 = document.createElement("button");
    bel3.setAttribute("aria-label", "Remove file");
    bel3.setAttribute("title", "Remove file");
    bel3["onclick"] = arguments[0];
    bel3.setAttribute("class", "UppyDashboardItem-remove");
    var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel2.setAttributeNS(null, "width", "22");
    bel2.setAttributeNS(null, "height", "21");
    bel2.setAttributeNS(null, "viewBox", "0 0 18 17");
    bel2.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    bel0.setAttributeNS(null, "fill", "#424242");
    bel0.setAttributeNS(null, "cx", "8.62");
    bel0.setAttributeNS(null, "cy", "8.383");
    bel0.setAttributeNS(null, "rx", "8.62");
    bel0.setAttributeNS(null, "ry", "8.383");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel1.setAttributeNS(null, "stroke", "#FFF");
    bel1.setAttributeNS(null, "fill", "#FFF");
    bel1.setAttributeNS(null, "d", "M11 6.147L10.85 6 8.5 8.284 6.15 6 6 6.147 8.35 8.43 6 10.717l.15.146L8.5 8.578l2.35 2.284.15-.146L8.65 8.43z");
    ac(bel2, ["\n                   ", bel0, "\n                   ", bel1, "\n                 "]);
    ac(bel3, ["\n                 ", bel2, "\n               "]);
    return bel3;
  }(function () {
    return props.removeFile(file.id);
  }) : null, file.id, file.meta.name, uploadInProgress ? 'is-inprogress' : '', isUploaded ? 'is-complete' : '', isPaused ? 'is-paused' : '', props.resumableUploads ? 'is-resumable' : '');
};

},{"../../core/Utils":35,"./FileItemProgress":50,"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"pretty-bytes":6,"yo-yo":19}],50:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

// http://codepen.io/Harkko/pen/rVxvNM
// https://gist.github.com/eswak/ad4ea57bcd5ff7aa5d42

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel9 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        bel9.setAttributeNS(null, "width", "70");
        bel9.setAttributeNS(null, "height", "70");
        bel9.setAttributeNS(null, "viewBox", "0 0 36 36");
        bel9.setAttributeNS(null, "class", "UppyIcon UppyIcon-progressCircle");
        var bel2 = document.createElement("g");
        bel2.setAttribute("class", "progress-group");
        var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bel0.setAttributeNS(null, "r", "15");
        bel0.setAttributeNS(null, "cx", "18");
        bel0.setAttributeNS(null, "cy", "18");
        bel0.setAttributeNS(null, "stroke-width", "2");
        bel0.setAttributeNS(null, "fill", "none");
        bel0.setAttributeNS(null, "class", "bg");
        var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bel1.setAttributeNS(null, "r", "15");
        bel1.setAttributeNS(null, "cx", "18");
        bel1.setAttributeNS(null, "cy", "18");
        bel1.setAttributeNS(null, "transform", "rotate(-90, 18, 18)");
        bel1.setAttributeNS(null, "stroke-width", "2");
        bel1.setAttributeNS(null, "fill", "none");
        bel1.setAttributeNS(null, "stroke-dasharray", "100");
        bel1.setAttributeNS(null, "stroke-dashoffset", arguments[0]);
        bel1.setAttributeNS(null, "class", "progress");
        ac(bel2, ["\n        ", bel0, "\n        ", bel1, "\n      "]);
        var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        bel3.setAttributeNS(null, "transform", "translate(3, 3)");
        bel3.setAttributeNS(null, "points", "12 20 12 10 20 15");
        bel3.setAttributeNS(null, "class", "play");
        var bel6 = document.createElement("g");
        bel6.setAttribute("transform", "translate(14.5, 13)");
        bel6.setAttribute("class", "pause");
        var bel4 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bel4.setAttributeNS(null, "x", "0");
        bel4.setAttributeNS(null, "y", "0");
        bel4.setAttributeNS(null, "width", "2");
        bel4.setAttributeNS(null, "height", "10");
        bel4.setAttributeNS(null, "rx", "0");
        var bel5 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bel5.setAttributeNS(null, "x", "5");
        bel5.setAttributeNS(null, "y", "0");
        bel5.setAttributeNS(null, "width", "2");
        bel5.setAttributeNS(null, "height", "10");
        bel5.setAttributeNS(null, "rx", "0");
        ac(bel6, ["\n        ", bel4, "\n        ", bel5, "\n      "]);
        var bel7 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        bel7.setAttributeNS(null, "transform", "translate(2, 3)");
        bel7.setAttributeNS(null, "points", "14 22.5 7 15.2457065 8.99985857 13.1732815 14 18.3547104 22.9729883 9 25 11.1005634");
        bel7.setAttributeNS(null, "class", "check");
        var bel8 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        bel8.setAttributeNS(null, "transform", "translate(2, 2)");
        bel8.setAttributeNS(null, "points", "19.8856516 11.0625 16 14.9481516 12.1019737 11.0625 11.0625 12.1143484 14.9481516 16 11.0625 19.8980263 12.1019737 20.9375 16 17.0518484 19.8856516 20.9375 20.9375 19.8980263 17.0518484 16 20.9375 12");
        bel8.setAttributeNS(null, "class", "cancel");
        ac(bel9, ["\n      ", bel2, "\n      ", bel3, "\n      ", bel6, "\n      ", bel7, "\n      ", bel8]);
        return bel9;
    }(100 - props.progress);
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],51:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var FileItem = require('./FileItem');
var ActionBrowseTagline = require('./ActionBrowseTagline');

var _require = require('./icons');

var dashboardBgIcon = _require.dashboardBgIcon;


module.exports = function (props) {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("ul");
    bel0.setAttribute("class", "UppyDashboard-files\n                         " + arguments[0]);
    ac(bel0, ["\n      ", arguments[1], "\n      ", arguments[2], "\n    "]);
    return bel0;
  }(props.totalFileCount === 0 ? 'UppyDashboard-files--noFiles' : '', props.totalFileCount === 0 ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "UppyDashboard-bgIcon");
    var bel0 = document.createElement("h3");
    bel0.setAttribute("class", "UppyDashboard-dropFilesTitle");
    ac(bel0, ["\n            ", arguments[0], "\n          "]);
    var bel1 = document.createElement("input");
    bel1.setAttribute("type", "file");
    bel1.setAttribute("name", "files[]");
    bel1.setAttribute("multiple", "true");
    bel1["onchange"] = arguments[1];
    bel1.setAttribute("class", "UppyDashboard-input");
    ac(bel2, ["\n          ", arguments[2], "\n          ", bel0, "\n          ", bel1, "\n         "]);
    return bel2;
  }(ActionBrowseTagline({
    acquirers: props.acquirers,
    container: props.container,
    handleInputChange: props.handleInputChange,
    i18n: props.i18n
  }), props.handleInputChange, dashboardBgIcon()) : null, Object.keys(props.files).map(function (fileID) {
    return FileItem({
      file: props.files[fileID],
      showFileCard: props.showFileCard,
      showProgressDetails: props.showProgressDetails,
      info: props.info,
      log: props.log,
      i18n: props.i18n,
      removeFile: props.removeFile,
      pauseUpload: props.pauseUpload,
      cancelUpload: props.cancelUpload,
      resumableUploads: props.resumableUploads
    });
  }));
};

},{"./ActionBrowseTagline":46,"./FileItem":49,"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],52:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
  props = props || {};

  var isHidden = props.totalFileCount === 0 || !props.isUploadStarted;

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElement("div");
    bel2.setAttribute("aria-hidden", arguments[3]);
    bel2.setAttribute("class", "UppyDashboard-statusBar\n                " + arguments[4]);
    var bel0 = document.createElement("div");
    bel0.setAttribute("style", "width: " + arguments[0] + "%");
    bel0.setAttribute("class", "UppyDashboard-statusBarProgress");
    var bel1 = document.createElement("div");
    bel1.setAttribute("class", "UppyDashboard-statusBarContent");
    ac(bel1, ["\n        ", arguments[1], "\n        ", arguments[2], "\n      "]);
    ac(bel2, ["\n\n      ", bel0, "\n      ", bel1, "\n    "]);
    return bel2;
  }(props.totalProgress, props.isUploadStarted && !props.isAllComplete ? !props.isAllPaused ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("span");
    ac(bel0, [arguments[0], " Uploading... ", arguments[1], "%・", arguments[2], " / ", arguments[3], "・", arguments[4], "・↑ ", arguments[5], "/s"]);
    return bel0;
  }(pauseResumeButtons(props), props.totalProgress || 0, props.complete, props.inProgress, props.totalETA, props.totalSpeed) : function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("span");
    ac(bel0, [arguments[0], " Paused・", arguments[1], "%"]);
    return bel0;
  }(pauseResumeButtons(props), props.totalProgress) : null, props.isAllComplete ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElement("span");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "18");
    bel1.setAttributeNS(null, "height", "17");
    bel1.setAttributeNS(null, "viewBox", "0 0 23 17");
    bel1.setAttributeNS(null, "class", "UppyDashboard-statusBarAction UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M8.944 17L0 7.865l2.555-2.61 6.39 6.525L20.41 0 23 2.645z");
    ac(bel1, ["\n              ", bel0, "\n            "]);
    ac(bel2, [bel1, "Upload complete・", arguments[0], "%"]);
    return bel2;
  }(props.totalProgress) : null, isHidden, props.isAllComplete ? 'is-complete' : '');
};

var pauseResumeButtons = function pauseResumeButtons(props) {
  console.log(props.resumableUploads);
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel0 = document.createElement("button");
    bel0.setAttribute("type", "button");
    bel0["onclick"] = arguments[0];
    bel0.setAttribute("class", "UppyDashboard-statusBarAction");
    ac(bel0, ["\n    ", arguments[1], "\n  "]);
    return bel0;
  }(function () {
    return togglePauseResume(props);
  }, props.resumableUploads ? props.isAllPaused ? function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "15");
    bel1.setAttributeNS(null, "height", "17");
    bel1.setAttributeNS(null, "viewBox", "0 0 11 13");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M1.26 12.534a.67.67 0 0 1-.674.012.67.67 0 0 1-.336-.583v-11C.25.724.38.5.586.382a.658.658 0 0 1 .673.012l9.165 5.5a.66.66 0 0 1 .325.57.66.66 0 0 1-.325.573l-9.166 5.5z");
    ac(bel1, ["\n          ", bel0, "\n        "]);
    return bel1;
  }() : function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "16");
    bel1.setAttributeNS(null, "height", "17");
    bel1.setAttributeNS(null, "viewBox", "0 0 12 13");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M4.888.81v11.38c0 .446-.324.81-.722.81H2.722C2.324 13 2 12.636 2 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81zM9.888.81v11.38c0 .446-.324.81-.722.81H7.722C7.324 13 7 12.636 7 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81z");
    ac(bel1, ["\n          ", bel0, "\n        "]);
    return bel1;
  }() : function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "16px");
    bel1.setAttributeNS(null, "height", "16px");
    bel1.setAttributeNS(null, "viewBox", "0 0 19 19");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z");
    ac(bel1, ["\n        ", bel0, "\n      "]);
    return bel1;
  }());
};

var togglePauseResume = function togglePauseResume(props) {
  if (props.isAllComplete) return;

  if (!props.resumableUploads) {
    return props.cancelAll();
  }

  if (props.isAllPaused) {
    return props.resumeAll();
  }

  return props.pauseAll();
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],53:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var ActionBrowseTagline = require('./ActionBrowseTagline');

var _require = require('./icons');

var localIcon = _require.localIcon;


module.exports = function (props) {
  var isHidden = Object.keys(props.files).length === 0;

  if (props.acquirers.length === 0) {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel1 = document.createElement("div");
      bel1.setAttribute("aria-hidden", arguments[1]);
      bel1.setAttribute("class", "UppyDashboardTabs");
      var bel0 = document.createElement("h3");
      bel0.setAttribute("class", "UppyDashboardTabs-title");
      ac(bel0, ["\n        ", arguments[0], "\n        "]);
      ac(bel1, ["\n        ", bel0, "\n      "]);
      return bel1;
    }(ActionBrowseTagline({
      acquirers: props.acquirers,
      container: props.container,
      handleInputChange: props.handleInputChange,
      i18n: props.i18n
    }), isHidden);
  }

  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel6 = document.createElement("div");
    bel6.setAttribute("class", "UppyDashboardTabs");
    var bel5 = document.createElement("nav");
    var bel4 = document.createElement("ul");
    bel4.setAttribute("role", "tablist");
    bel4.setAttribute("class", "UppyDashboardTabs-list");
    var bel3 = document.createElement("li");
    bel3.setAttribute("class", "UppyDashboardTab");
    var bel1 = document.createElement("button");
    bel1.setAttribute("type", "button");
    bel1.setAttribute("role", "tab");
    bel1.setAttribute("tabindex", "0");
    bel1["onclick"] = arguments[1];
    bel1.setAttribute("class", "UppyDashboardTab-btn UppyDashboard-focus");
    var bel0 = document.createElement("h5");
    bel0.setAttribute("class", "UppyDashboardTab-name");
    ac(bel0, [arguments[0]]);
    ac(bel1, ["\n            ", arguments[2], "\n            ", bel0, "\n          "]);
    var bel2 = document.createElement("input");
    bel2.setAttribute("type", "file");
    bel2.setAttribute("name", "files[]");
    bel2.setAttribute("multiple", "true");
    bel2["onchange"] = arguments[3];
    bel2.setAttribute("class", "UppyDashboard-input");
    ac(bel3, ["\n          ", bel1, "\n          ", bel2, "\n        "]);
    ac(bel4, ["\n        ", bel3, "\n        ", arguments[4], "\n      "]);
    ac(bel5, ["\n      ", bel4, "\n    "]);
    ac(bel6, ["\n    ", bel5, "\n  "]);
    return bel6;
  }(props.i18n('localDisk'), function (ev) {
    var input = document.querySelector(props.container + ' .UppyDashboard-input');
    input.click();
  }, localIcon(), props.handleInputChange, props.acquirers.map(function (target) {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel2 = document.createElement("li");
      bel2.setAttribute("class", "UppyDashboardTab");
      var bel1 = document.createElement("button");
      bel1.setAttribute("role", "tab");
      bel1.setAttribute("tabindex", "0");
      bel1.setAttribute("aria-controls", "UppyDashboardContent-panel--" + arguments[1]);
      bel1.setAttribute("aria-selected", arguments[2]);
      bel1["onclick"] = arguments[3];
      bel1.setAttribute("class", "UppyDashboardTab-btn");
      var bel0 = document.createElement("h5");
      bel0.setAttribute("class", "UppyDashboardTab-name");
      ac(bel0, [arguments[0]]);
      ac(bel1, ["\n              ", arguments[4], "\n              ", bel0, "\n            "]);
      ac(bel2, ["\n            ", bel1, "\n          "]);
      return bel2;
    }(target.name, target.id, target.isHidden ? 'false' : 'true', function () {
      return props.showPanel(target.id);
    }, target.icon);
  }));
};

},{"./ActionBrowseTagline":46,"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],54:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

var _require = require('./icons');

var uploadIcon = _require.uploadIcon;


module.exports = function (props) {
    props = props || {};

    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel1 = document.createElement("button");
        bel1.setAttribute("type", "button");
        bel1.setAttribute("title", arguments[3]);
        bel1.setAttribute("aria-label", arguments[4]);
        bel1["onclick"] = arguments[5];
        bel1.setAttribute("class", "UppyButton--circular\n                   UppyButton--blue\n                   UppyDashboard-upload");
        var bel0 = document.createElement("sup");
        bel0.setAttribute("title", arguments[0]);
        bel0.setAttribute("aria-label", arguments[1]);
        bel0.setAttribute("class", "UppyDashboard-uploadCount");
        ac(bel0, ["\n                  ", arguments[2]]);
        ac(bel1, ["\n            ", arguments[6], "\n            ", bel0, "\n    "]);
        return bel1;
    }(props.i18n('numberOfSelectedFiles'), props.i18n('numberOfSelectedFiles'), props.newFileCount, props.i18n('uploadAllNewFiles'), props.i18n('uploadAllNewFiles'), props.startUpload, uploadIcon());
};

},{"./icons":55,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],55:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

// https://css-tricks.com/creating-svg-icon-system-react/

function defaultTabIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "30");
    bel1.setAttributeNS(null, "height", "30");
    bel1.setAttributeNS(null, "viewBox", "0 0 30 30");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M15 30c8.284 0 15-6.716 15-15 0-8.284-6.716-15-15-15C6.716 0 0 6.716 0 15c0 8.284 6.716 15 15 15zm4.258-12.676v6.846h-8.426v-6.846H5.204l9.82-12.364 9.82 12.364H19.26z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function iconCopy() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel2.setAttributeNS(null, "width", "51");
    bel2.setAttributeNS(null, "height", "51");
    bel2.setAttributeNS(null, "viewBox", "0 0 51 51");
    bel2.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M17.21 45.765a5.394 5.394 0 0 1-7.62 0l-4.12-4.122a5.393 5.393 0 0 1 0-7.618l6.774-6.775-2.404-2.404-6.775 6.776c-3.424 3.427-3.424 9 0 12.426l4.12 4.123a8.766 8.766 0 0 0 6.216 2.57c2.25 0 4.5-.858 6.214-2.57l13.55-13.552a8.72 8.72 0 0 0 2.575-6.213 8.73 8.73 0 0 0-2.575-6.213l-4.123-4.12-2.404 2.404 4.123 4.12a5.352 5.352 0 0 1 1.58 3.81c0 1.438-.562 2.79-1.58 3.808l-13.55 13.55z");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel1.setAttributeNS(null, "d", "M44.256 2.858A8.728 8.728 0 0 0 38.043.283h-.002a8.73 8.73 0 0 0-6.212 2.574l-13.55 13.55a8.725 8.725 0 0 0-2.575 6.214 8.73 8.73 0 0 0 2.574 6.216l4.12 4.12 2.405-2.403-4.12-4.12a5.357 5.357 0 0 1-1.58-3.812c0-1.437.562-2.79 1.58-3.808l13.55-13.55a5.348 5.348 0 0 1 3.81-1.58c1.44 0 2.792.562 3.81 1.58l4.12 4.12c2.1 2.1 2.1 5.518 0 7.617L39.2 23.775l2.404 2.404 6.775-6.777c3.426-3.427 3.426-9 0-12.426l-4.12-4.12z");
    ac(bel2, ["\n    ", bel0, "\n    ", bel1, "\n  "]);
    return bel2;
  }();
}

function iconResume() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "25");
    bel1.setAttributeNS(null, "height", "25");
    bel1.setAttributeNS(null, "viewBox", "0 0 44 44");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    bel0.setAttributeNS(null, "transform", "translate(6, 5.5)");
    bel0.setAttributeNS(null, "points", "13 21.6666667 13 11 21 16.3333333");
    bel0.setAttributeNS(null, "class", "play");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function iconPause() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel3.setAttributeNS(null, "width", "25px");
    bel3.setAttributeNS(null, "height", "25px");
    bel3.setAttributeNS(null, "viewBox", "0 0 44 44");
    bel3.setAttributeNS(null, "class", "UppyIcon");
    var bel2 = document.createElement("g");
    bel2.setAttribute("transform", "translate(18, 17)");
    bel2.setAttribute("class", "pause");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bel0.setAttributeNS(null, "x", "0");
    bel0.setAttributeNS(null, "y", "0");
    bel0.setAttributeNS(null, "width", "2");
    bel0.setAttributeNS(null, "height", "10");
    bel0.setAttributeNS(null, "rx", "0");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bel1.setAttributeNS(null, "x", "6");
    bel1.setAttributeNS(null, "y", "0");
    bel1.setAttributeNS(null, "width", "2");
    bel1.setAttributeNS(null, "height", "10");
    bel1.setAttributeNS(null, "rx", "0");
    ac(bel2, ["\n      ", bel0, "\n      ", bel1, "\n    "]);
    ac(bel3, ["\n    ", bel2, "\n  "]);
    return bel3;
  }();
}

function iconEdit() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "28");
    bel1.setAttributeNS(null, "height", "28");
    bel1.setAttributeNS(null, "viewBox", "0 0 28 28");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M25.436 2.566a7.98 7.98 0 0 0-2.078-1.51C22.638.703 21.906.5 21.198.5a3 3 0 0 0-1.023.17 2.436 2.436 0 0 0-.893.562L2.292 18.217.5 27.5l9.28-1.796 16.99-16.99c.255-.254.444-.56.562-.888a3 3 0 0 0 .17-1.023c0-.708-.205-1.44-.555-2.16a8 8 0 0 0-1.51-2.077zM9.01 24.252l-4.313.834c0-.03.008-.06.012-.09.007-.944-.74-1.715-1.67-1.723-.04 0-.078.007-.118.01l.83-4.29L17.72 5.024l5.264 5.264L9.01 24.252zm16.84-16.96a.818.818 0 0 1-.194.31l-1.57 1.57-5.26-5.26 1.57-1.57a.82.82 0 0 1 .31-.194 1.45 1.45 0 0 1 .492-.074c.397 0 .917.126 1.468.397.55.27 1.13.678 1.656 1.21.53.53.94 1.11 1.208 1.655.272.55.397 1.07.393 1.468.004.193-.027.358-.074.488z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function localIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel2.setAttributeNS(null, "width", "27");
    bel2.setAttributeNS(null, "height", "25");
    bel2.setAttributeNS(null, "viewBox", "0 0 27 25");
    bel2.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M5.586 9.288a.313.313 0 0 0 .282.176h4.84v3.922c0 1.514 1.25 2.24 2.792 2.24 1.54 0 2.79-.726 2.79-2.24V9.464h4.84c.122 0 .23-.068.284-.176a.304.304 0 0 0-.046-.324L13.735.106a.316.316 0 0 0-.472 0l-7.63 8.857a.302.302 0 0 0-.047.325z");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel1.setAttributeNS(null, "d", "M24.3 5.093c-.218-.76-.54-1.187-1.208-1.187h-4.856l1.018 1.18h3.948l2.043 11.038h-7.193v2.728H9.114v-2.725h-7.36l2.66-11.04h3.33l1.018-1.18H3.907c-.668 0-1.06.46-1.21 1.186L0 16.456v7.062C0 24.338.676 25 1.51 25h23.98c.833 0 1.51-.663 1.51-1.482v-7.062L24.3 5.093z");
    ac(bel2, ["\n    ", bel0, "\n    ", bel1, "\n  "]);
    return bel2;
  }();
}

function closeIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "14px");
    bel1.setAttributeNS(null, "height", "14px");
    bel1.setAttributeNS(null, "viewBox", "0 0 19 19");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function pluginIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel2.setAttributeNS(null, "width", "16px");
    bel2.setAttributeNS(null, "height", "16px");
    bel2.setAttributeNS(null, "viewBox", "0 0 32 30");
    bel2.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M6.6209894,11.1451162 C6.6823051,11.2751669 6.81374248,11.3572188 6.95463813,11.3572188 L12.6925482,11.3572188 L12.6925482,16.0630427 C12.6925482,17.880509 14.1726048,18.75 16.0000083,18.75 C17.8261072,18.75 19.3074684,17.8801847 19.3074684,16.0630427 L19.3074684,11.3572188 L25.0437478,11.3572188 C25.1875787,11.3572188 25.3164069,11.2751669 25.3790272,11.1451162 C25.4370814,11.0173358 25.4171865,10.8642587 25.3252129,10.7562615 L16.278212,0.127131837 C16.2093949,0.0463771751 16.1069846,0 15.9996822,0 C15.8910751,0 15.7886648,0.0463771751 15.718217,0.127131837 L6.6761083,10.7559371 C6.58250402,10.8642587 6.56293518,11.0173358 6.6209894,11.1451162 L6.6209894,11.1451162 Z");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel1.setAttributeNS(null, "d", "M28.8008722,6.11142645 C28.5417891,5.19831555 28.1583331,4.6875 27.3684848,4.6875 L21.6124454,4.6875 L22.8190234,6.10307874 L27.4986725,6.10307874 L29.9195817,19.3486449 L21.3943891,19.3502502 L21.3943891,22.622552 L10.8023461,22.622552 L10.8023461,19.3524977 L2.07815702,19.3534609 L5.22979699,6.10307874 L9.17871529,6.10307874 L10.3840011,4.6875 L4.6308691,4.6875 C3.83940559,4.6875 3.37421888,5.2390909 3.19815864,6.11142645 L0,19.7470874 L0,28.2212959 C0,29.2043992 0.801477937,30 1.78870751,30 L30.2096773,30 C31.198199,30 32,29.2043992 32,28.2212959 L32,19.7470874 L28.8008722,6.11142645 L28.8008722,6.11142645 Z");
    ac(bel2, ["\n      ", bel0, "\n      ", bel1, "\n    "]);
    return bel2;
  }();
}

function checkIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "13px");
    bel1.setAttributeNS(null, "height", "9px");
    bel1.setAttributeNS(null, "viewBox", "0 0 13 9");
    bel1.setAttributeNS(null, "class", "UppyIcon UppyIcon-check");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    bel0.setAttributeNS(null, "points", "5 7.293 1.354 3.647 0.646 4.354 5 8.707 12.354 1.354 11.646 0.647");
    ac(bel1, ["\n    ", bel0]);
    return bel1;
  }();
}

function iconAudio() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "34");
    bel1.setAttributeNS(null, "height", "91");
    bel1.setAttributeNS(null, "viewBox", "0 0 34 91");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M22.366 43.134V29.33c5.892-6.588 10.986-14.507 10.986-22.183 0-4.114-2.986-7.1-7.1-7.1-3.914 0-7.1 3.186-7.1 7.1v20.936a92.562 92.562 0 0 1-5.728 5.677l-.384.348C4.643 41.762.428 45.604.428 54.802c0 8.866 7.214 16.08 16.08 16.08.902 0 1.784-.074 2.644-.216v11.26c0 2.702-2.198 4.9-4.9 4.9a4.855 4.855 0 0 1-2.95-1.015c2.364-.24 4.222-2.218 4.222-4.643a4.698 4.698 0 0 0-4.692-4.692 4.738 4.738 0 0 0-4.213 2.628c-.923 1.874-.56 4.386.277 6.228a7.82 7.82 0 0 0 .9 1.502 8.178 8.178 0 0 0 4.23 2.896c.723.207 1.474.31 2.226.31 4.474 0 8.113-3.64 8.113-8.113V69.78c5.98-2.345 10.225-8.176 10.225-14.977 0-5.975-4.464-10.876-10.224-11.67zm0-35.987a3.89 3.89 0 0 1 3.887-3.885c1.933 0 3.885 1.202 3.885 3.885 0 4.95-2.702 10.862-7.772 17.204V7.148zM16.51 67.67c-7.096 0-12.867-5.77-12.867-12.867 0-7.78 3.385-10.865 11.563-18.32l.384-.35c1.166-1.064 2.365-2.2 3.562-3.402v10.404c-5.758.793-10.223 5.695-10.223 11.67 0 3.935 1.948 7.603 5.212 9.81a1.605 1.605 0 1 0 1.8-2.66 8.622 8.622 0 0 1-3.8-7.15c0-4.2 3.025-7.7 7.01-8.456v21.05c-.853.178-1.736.272-2.642.272zm5.856-1.412v-19.91c3.985.756 7.01 4.253 7.01 8.455 0 4.987-2.85 9.32-7.01 11.455z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function iconFile() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "44");
    bel1.setAttributeNS(null, "height", "58");
    bel1.setAttributeNS(null, "viewBox", "0 0 44 58");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M27.437.517a1 1 0 0 0-.094.03H4.25C2.037.548.217 2.368.217 4.58v48.405c0 2.212 1.82 4.03 4.03 4.03H39.03c2.21 0 4.03-1.818 4.03-4.03V15.61a1 1 0 0 0-.03-.28 1 1 0 0 0 0-.093 1 1 0 0 0-.03-.032 1 1 0 0 0 0-.03 1 1 0 0 0-.032-.063 1 1 0 0 0-.03-.063 1 1 0 0 0-.032 0 1 1 0 0 0-.03-.063 1 1 0 0 0-.032-.03 1 1 0 0 0-.03-.063 1 1 0 0 0-.063-.062l-14.593-14a1 1 0 0 0-.062-.062A1 1 0 0 0 28 .708a1 1 0 0 0-.374-.157 1 1 0 0 0-.156 0 1 1 0 0 0-.03-.03l-.003-.003zM4.25 2.547h22.218v9.97c0 2.21 1.82 4.03 4.03 4.03h10.564v36.438a2.02 2.02 0 0 1-2.032 2.032H4.25c-1.13 0-2.032-.9-2.032-2.032V4.58c0-1.13.902-2.032 2.03-2.032zm24.218 1.345l10.375 9.937.75.718H30.5c-1.13 0-2.032-.9-2.032-2.03V3.89z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function iconText() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "50");
    bel1.setAttributeNS(null, "height", "63");
    bel1.setAttributeNS(null, "viewBox", "0 0 50 63");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M0 .5v15.617h6.25l1.7-5.1a6.242 6.242 0 0 1 5.933-4.267h8V50.5c0 3.45-2.8 6.25-6.25 6.25H12.5V63h25v-6.25h-3.133c-3.45 0-6.25-2.8-6.25-6.25V6.75h8a6.257 6.257 0 0 1 5.933 4.267l1.7 5.1H50V.5H0z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

function uploadIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel2.setAttributeNS(null, "width", "37");
    bel2.setAttributeNS(null, "height", "33");
    bel2.setAttributeNS(null, "viewBox", "0 0 37 33");
    bel2.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M29.107 24.5c4.07 0 7.393-3.355 7.393-7.442 0-3.994-3.105-7.307-7.012-7.502l.468.415C29.02 4.52 24.34.5 18.886.5c-4.348 0-8.27 2.522-10.138 6.506l.446-.288C4.394 6.782.5 10.758.5 15.608c0 4.924 3.906 8.892 8.76 8.892h4.872c.635 0 1.095-.467 1.095-1.104 0-.636-.46-1.103-1.095-1.103H9.26c-3.644 0-6.63-3.035-6.63-6.744 0-3.71 2.926-6.685 6.57-6.685h.964l.14-.28.177-.362c1.477-3.4 4.744-5.576 8.347-5.576 4.58 0 8.45 3.452 9.01 8.072l.06.536.05.446h1.101c2.87 0 5.204 2.37 5.204 5.295s-2.333 5.296-5.204 5.296h-6.062c-.634 0-1.094.467-1.094 1.103 0 .637.46 1.104 1.094 1.104h6.12z");
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel1.setAttributeNS(null, "d", "M23.196 18.92l-4.828-5.258-.366-.4-.368.398-4.828 5.196a1.13 1.13 0 0 0 0 1.546c.428.46 1.11.46 1.537 0l3.45-3.71-.868-.34v15.03c0 .64.445 1.118 1.075 1.118.63 0 1.075-.48 1.075-1.12V16.35l-.867.34 3.45 3.712a1 1 0 0 0 .767.345 1 1 0 0 0 .77-.345c.416-.33.416-1.036 0-1.485v.003z");
    ac(bel2, ["\n    ", bel0, "\n    ", bel1, "\n  "]);
    return bel2;
  }();
}

function dashboardBgIcon() {
  return function () {

    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bel1.setAttributeNS(null, "width", "48");
    bel1.setAttributeNS(null, "height", "69");
    bel1.setAttributeNS(null, "viewBox", "0 0 48 69");
    bel1.setAttributeNS(null, "class", "UppyIcon");
    var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bel0.setAttributeNS(null, "d", "M.5 1.5h5zM10.5 1.5h5zM20.5 1.5h5zM30.504 1.5h5zM45.5 11.5v5zM45.5 21.5v5zM45.5 31.5v5zM45.5 41.502v5zM45.5 51.502v5zM45.5 61.5v5zM45.5 66.502h-4.998zM35.503 66.502h-5zM25.5 66.502h-5zM15.5 66.502h-5zM5.5 66.502h-5zM.5 66.502v-5zM.5 56.502v-5zM.5 46.503V41.5zM.5 36.5v-5zM.5 26.5v-5zM.5 16.5v-5zM.5 6.5V1.498zM44.807 11H36V2.195z");
    ac(bel1, ["\n    ", bel0, "\n  "]);
    return bel1;
  }();
}

module.exports = {
  defaultTabIcon: defaultTabIcon,
  iconCopy: iconCopy,
  iconResume: iconResume,
  iconPause: iconPause,
  iconEdit: iconEdit,
  localIcon: localIcon,
  closeIcon: closeIcon,
  pluginIcon: pluginIcon,
  checkIcon: checkIcon,
  iconAudio: iconAudio,
  iconFile: iconFile,
  iconText: iconText,
  uploadIcon: uploadIcon,
  dashboardBgIcon: dashboardBgIcon
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],56:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Plugin = require('../Plugin');
var Translator = require('../../core/Translator');
var dragDrop = require('drag-drop');
var Dashboard = require('./Dashboard');

var _require = require('../../core/Utils');

var getSpeed = _require.getSpeed;

var _require2 = require('../../core/Utils');

var getETA = _require2.getETA;

var _require3 = require('../../core/Utils');

var prettyETA = _require3.prettyETA;

var prettyBytes = require('pretty-bytes');

var _require4 = require('./icons');

var defaultTabIcon = _require4.defaultTabIcon;

/**
 * Modal Dialog & Dashboard
 */

module.exports = function (_Plugin) {
  _inherits(DashboardUI, _Plugin);

  function DashboardUI(core, opts) {
    _classCallCheck(this, DashboardUI);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'DashboardUI';
    _this.title = 'Dashboard UI';
    _this.type = 'orchestrator';

    var defaultLocale = {
      strings: {
        selectToUpload: 'Select files to upload',
        closeModal: 'Close Modal',
        upload: 'Upload',
        importFrom: 'Import files from',
        dashboardWindowTitle: 'Uppy Dashboard Window (Press escape to close)',
        dashboardTitle: 'Uppy Dashboard',
        copyLinkToClipboardSuccess: 'Link copied to clipboard.',
        copyLinkToClipboardFallback: 'Copy the URL below',
        done: 'Done',
        localDisk: 'Local Disk',
        dropPasteImport: 'Drop files here, paste, import from one of the locations above or',
        dropPaste: 'Drop files here, paste or',
        browse: 'browse',
        fileProgress: 'File progress: upload speed and ETA',
        numberOfSelectedFiles: 'Number of selected files',
        uploadAllNewFiles: 'Upload all new files'
      }
    };

    // set default options
    var defaultOptions = {
      target: 'body',
      inline: false,
      width: 750,
      height: 550,
      semiTransparent: false,
      defaultTabIcon: defaultTabIcon(),
      showProgressDetails: true,
      locale: defaultLocale
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.locale = _extends({}, defaultLocale, _this.opts.locale);
    _this.locale.strings = _extends({}, defaultLocale.strings, _this.opts.locale.strings);

    _this.translator = new Translator({ locale: _this.locale });
    _this.containerWidth = _this.translator.translate.bind(_this.translator);

    _this.hideModal = _this.hideModal.bind(_this);
    _this.showModal = _this.showModal.bind(_this);

    _this.addTarget = _this.addTarget.bind(_this);
    _this.actions = _this.actions.bind(_this);
    _this.hideAllPanels = _this.hideAllPanels.bind(_this);
    _this.showPanel = _this.showPanel.bind(_this);
    _this.initEvents = _this.initEvents.bind(_this);
    _this.handleDrop = _this.handleDrop.bind(_this);
    _this.pauseAll = _this.pauseAll.bind(_this);
    _this.resumeAll = _this.resumeAll.bind(_this);
    _this.cancelAll = _this.cancelAll.bind(_this);
    _this.updateDashboardElWidth = _this.updateDashboardElWidth.bind(_this);
    _this.render = _this.render.bind(_this);
    _this.install = _this.install.bind(_this);
    return _this;
  }

  DashboardUI.prototype.addTarget = function addTarget(plugin) {
    var callerPluginId = plugin.constructor.name;
    var callerPluginName = plugin.title || callerPluginId;
    var callerPluginIcon = plugin.icon || this.opts.defaultTabIcon;
    var callerPluginType = plugin.type;

    if (callerPluginType !== 'acquirer' && callerPluginType !== 'progressindicator' && callerPluginType !== 'presenter') {
      var msg = 'Error: Modal can only be used by plugins of types: acquirer, progressindicator, presenter';
      this.core.log(msg);
      return;
    }

    var target = {
      id: callerPluginId,
      name: callerPluginName,
      icon: callerPluginIcon,
      type: callerPluginType,
      focus: plugin.focus,
      render: plugin.render,
      isHidden: true
    };

    var modal = this.core.getState().modal;
    var newTargets = modal.targets.slice();
    newTargets.push(target);

    this.core.setState({
      modal: _extends({}, modal, {
        targets: newTargets
      })
    });

    return this.opts.target;
  };

  DashboardUI.prototype.hideAllPanels = function hideAllPanels() {
    var modal = this.core.getState().modal;

    this.core.setState({ modal: _extends({}, modal, {
        activePanel: false
      }) });
  };

  DashboardUI.prototype.showPanel = function showPanel(id) {
    var modal = this.core.getState().modal;

    var activePanel = modal.targets.filter(function (target) {
      return target.type === 'acquirer' && target.id === id;
    })[0];

    this.core.setState({ modal: _extends({}, modal, {
        activePanel: activePanel
      }) });
  };

  DashboardUI.prototype.hideModal = function hideModal() {
    var modal = this.core.getState().modal;

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: true
      })
    });

    document.body.classList.remove('is-UppyDashboard-open');
  };

  DashboardUI.prototype.showModal = function showModal() {
    var modal = this.core.getState().modal;

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: false
      })
    });

    // add class to body that sets position fixed
    document.body.classList.add('is-UppyDashboard-open');
    // focus on modal inner block
    document.querySelector('.UppyDashboard-inner').focus();

    this.updateDashboardElWidth();
  };

  DashboardUI.prototype.initEvents = function initEvents() {
    var _this2 = this;

    // const dashboardEl = document.querySelector(`${this.opts.target} .UppyDashboard`)

    // Modal open button
    var showModalTrigger = document.querySelector(this.opts.trigger);
    if (!this.opts.inline && showModalTrigger) {
      showModalTrigger.addEventListener('click', this.showModal);
    } else {
      this.core.log('Modal trigger wasn’t found');
    }

    // Close the Modal on esc key press
    document.body.addEventListener('keyup', function (event) {
      if (event.keyCode === 27) {
        _this2.hideModal();
      }
    });

    // Drag Drop
    dragDrop(this.el, function (files) {
      _this2.handleDrop(files);
    });
  };

  DashboardUI.prototype.actions = function actions() {
    var _this3 = this;

    var bus = this.core.bus;

    bus.on('core:file-add', function () {
      _this3.hideAllPanels();
    });

    bus.on('dashboard:file-card', function (fileId) {
      var modal = _this3.core.getState().modal;

      _this3.core.setState({
        modal: _extends({}, modal, {
          fileCardFor: fileId || false
        })
      });
    });

    window.addEventListener('resize', function (ev) {
      return _this3.updateDashboardElWidth();
    });

    // bus.on('core:success', (uploadedCount) => {
    //   bus.emit(
    //     'informer',
    //     `${this.core.i18n('files', {'smart_count': uploadedCount})} successfully uploaded, Sir!`,
    //     'info',
    //     6000
    //   )
    // })
  };

  DashboardUI.prototype.updateDashboardElWidth = function updateDashboardElWidth() {
    var dashboardEl = document.querySelector('.UppyDashboard-inner');

    var modal = this.core.getState().modal;
    this.core.setState({
      modal: _extends({}, modal, {
        containerWidth: dashboardEl.offsetWidth
      })
    });
  };

  DashboardUI.prototype.handleDrop = function handleDrop(files) {
    var _this4 = this;

    this.core.log('All right, someone dropped something...');

    files.forEach(function (file) {
      _this4.core.bus.emit('core:file-add', {
        source: _this4.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  DashboardUI.prototype.cancelAll = function cancelAll() {
    this.core.bus.emit('core:cancel-all');
  };

  DashboardUI.prototype.pauseAll = function pauseAll() {
    this.core.bus.emit('core:pause-all');
  };

  DashboardUI.prototype.resumeAll = function resumeAll() {
    this.core.bus.emit('core:resume-all');
  };

  DashboardUI.prototype.getTotalSpeed = function getTotalSpeed(files) {
    var totalSpeed = 0;
    files.forEach(function (file) {
      totalSpeed = totalSpeed + getSpeed(file.progress);
    });
    return totalSpeed;
  };

  DashboardUI.prototype.getTotalETA = function getTotalETA(files) {
    var totalSeconds = 0;

    files.forEach(function (file) {
      totalSeconds = totalSeconds + getETA(file.progress);
    });

    return totalSeconds;
  };

  DashboardUI.prototype.render = function render(state) {
    var _this5 = this;

    var files = state.files;

    var newFiles = Object.keys(files).filter(function (file) {
      return !files[file].progress.uploadStarted;
    });
    var uploadStartedFiles = Object.keys(files).filter(function (file) {
      return files[file].progress.uploadStarted;
    });
    var completeFiles = Object.keys(files).filter(function (file) {
      return files[file].progress.uploadComplete;
    });
    var inProgressFiles = Object.keys(files).filter(function (file) {
      return !files[file].progress.uploadComplete && files[file].progress.uploadStarted && !files[file].isPaused;
    });

    var inProgressFilesArray = [];
    inProgressFiles.forEach(function (file) {
      inProgressFilesArray.push(files[file]);
    });

    var totalSpeed = prettyBytes(this.getTotalSpeed(inProgressFilesArray));
    var totalETA = prettyETA(this.getTotalETA(inProgressFilesArray));

    var isAllComplete = state.totalProgress === 100;
    var isAllPaused = inProgressFiles.length === 0 && !isAllComplete && uploadStartedFiles.length > 0;
    var isUploadStarted = uploadStartedFiles.length > 0;

    var acquirers = state.modal.targets.filter(function (target) {
      return target.type === 'acquirer';
    });

    var progressindicators = state.modal.targets.filter(function (target) {
      return target.type === 'progressindicator';
    });

    var addFile = function addFile(file) {
      _this5.core.emitter.emit('core:file-add', file);
    };

    var removeFile = function removeFile(fileID) {
      _this5.core.emitter.emit('core:file-remove', fileID);
    };

    var startUpload = function startUpload(ev) {
      _this5.core.emitter.emit('core:upload');
    };

    var pauseUpload = function pauseUpload(fileID) {
      _this5.core.emitter.emit('core:upload-pause', fileID);
    };

    var cancelUpload = function cancelUpload(fileID) {
      _this5.core.emitter.emit('core:upload-cancel', fileID);
      _this5.core.emitter.emit('core:file-remove', fileID);
    };

    var showFileCard = function showFileCard(fileID) {
      _this5.core.emitter.emit('dashboard:file-card', fileID);
    };

    var fileCardDone = function fileCardDone(meta, fileID) {
      _this5.core.emitter.emit('core:update-meta', meta, fileID);
      _this5.core.emitter.emit('dashboard:file-card');
    };

    var info = function info(text, type, duration) {
      _this5.core.emitter.emit('informer', text, type, duration);
    };

    var resumableUploads = this.core.getState().capabilities.resumableUploads || false;

    return Dashboard({
      state: state,
      modal: state.modal,
      newFiles: newFiles,
      files: files,
      totalFileCount: Object.keys(files).length,
      isUploadStarted: isUploadStarted,
      inProgress: uploadStartedFiles.length,
      completeFiles: completeFiles,
      inProgressFiles: inProgressFiles,
      totalSpeed: totalSpeed,
      totalETA: totalETA,
      totalProgress: state.totalProgress,
      isAllComplete: isAllComplete,
      isAllPaused: isAllPaused,
      acquirers: acquirers,
      activePanel: state.modal.activePanel,
      progressindicators: progressindicators,
      autoProceed: this.core.opts.autoProceed,
      id: this.id,
      container: this.opts.target,
      hideModal: this.hideModal,
      showProgressDetails: this.opts.showProgressDetails,
      inline: this.opts.inline,
      semiTransparent: this.opts.semiTransparent,
      onPaste: this.handlePaste,
      showPanel: this.showPanel,
      hideAllPanels: this.hideAllPanels,
      log: this.core.log,
      bus: this.core.emitter,
      i18n: this.containerWidth,
      pauseAll: this.pauseAll,
      resumeAll: this.resumeAll,
      cancelAll: this.cancelAll,
      addFile: addFile,
      removeFile: removeFile,
      info: info,
      metaFields: state.metaFields,
      resumableUploads: resumableUploads,
      startUpload: startUpload,
      pauseUpload: pauseUpload,
      cancelUpload: cancelUpload,
      fileCardFor: state.modal.fileCardFor,
      showFileCard: showFileCard,
      fileCardDone: fileCardDone,
      updateDashboardElWidth: this.updateDashboardElWidth,
      maxWidth: this.opts.maxWidth,
      maxHeight: this.opts.maxHeight,
      currentWidth: state.modal.containerWidth,
      isWide: state.modal.containerWidth > 400
    });
  };

  DashboardUI.prototype.install = function install() {
    // Set default state for Modal
    this.core.setState({ modal: {
        isHidden: true,
        showFileCard: false,
        activePanel: false,
        targets: []
      } });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this.initEvents();
    this.actions();
  };

  return DashboardUI;
}(Plugin);

},{"../../core/Translator":33,"../../core/Utils":35,"../Plugin":62,"./Dashboard":47,"./icons":55,"drag-drop":1,"pretty-bytes":6}],57:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = {
  folder: function folder() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel1.setAttributeNS(null, "style", "width:16px;margin-right:3px");
      bel1.setAttributeNS(null, "viewBox", "0 0 276.157 276.157");
      bel1.setAttributeNS(null, "class", "UppyIcon");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M273.08 101.378c-3.3-4.65-8.86-7.32-15.254-7.32h-24.34V67.59c0-10.2-8.3-18.5-18.5-18.5h-85.322c-3.63 0-9.295-2.875-11.436-5.805l-6.386-8.735c-4.982-6.814-15.104-11.954-23.546-11.954H58.73c-9.292 0-18.638 6.608-21.737 15.372l-2.033 5.752c-.958 2.71-4.72 5.37-7.596 5.37H18.5C8.3 49.09 0 57.39 0 67.59v167.07c0 .886.16 1.73.443 2.52.152 3.306 1.18 6.424 3.053 9.064 3.3 4.652 8.86 7.32 15.255 7.32h188.487c11.395 0 23.27-8.425 27.035-19.18l40.677-116.188c2.11-6.035 1.43-12.164-1.87-16.816zM18.5 64.088h8.864c9.295 0 18.64-6.607 21.738-15.37l2.032-5.75c.96-2.712 4.722-5.373 7.597-5.373h29.565c3.63 0 9.295 2.876 11.437 5.806l6.386 8.735c4.982 6.815 15.104 11.954 23.546 11.954h85.322c1.898 0 3.5 1.602 3.5 3.5v26.47H69.34c-11.395 0-23.27 8.423-27.035 19.178L15 191.23V67.59c0-1.898 1.603-3.5 3.5-3.5zm242.29 49.15l-40.676 116.188c-1.674 4.78-7.812 9.135-12.877 9.135H18.75c-1.447 0-2.576-.372-3.02-.997-.442-.625-.422-1.814.057-3.18l40.677-116.19c1.674-4.78 7.812-9.134 12.877-9.134h188.487c1.448 0 2.577.372 3.02.997.443.625.423 1.814-.056 3.18z");
      ac(bel1, ["\n      ", bel0, "\n  "]);
      return bel1;
    }();
  },
  music: function music() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel5 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel5.setAttributeNS(null, "width", "16.000000pt");
      bel5.setAttributeNS(null, "height", "16.000000pt");
      bel5.setAttributeNS(null, "viewBox", "0 0 48.000000 48.000000");
      bel5.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
      bel5.setAttributeNS(null, "class", "UppyIcon");
      var bel4 = document.createElement("g");
      bel4.setAttribute("transform", "translate(0.000000,48.000000) scale(0.100000,-0.100000)");
      bel4.setAttribute("fill", "#525050");
      bel4.setAttribute("stroke", "none");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M209 473 c0 -5 0 -52 1 -106 1 -54 -2 -118 -6 -143 l-7 -46 -44 5\n    c-73 8 -133 -46 -133 -120 0 -17 -5 -35 -10 -38 -18 -11 0 -25 33 -24 30 1 30\n    1 7 8 -15 4 -20 10 -13 14 6 4 9 16 6 27 -9 34 7 70 40 90 17 11 39 20 47 20\n    8 0 -3 -9 -26 -19 -42 -19 -54 -36 -54 -75 0 -36 30 -56 84 -56 41 0 53 5 82\n    34 19 19 34 31 34 27 0 -4 -5 -12 -12 -19 -9 -9 -1 -12 39 -12 106 0 183 -21\n    121 -33 -17 -3 -14 -5 10 -6 25 -1 32 3 32 17 0 26 -20 42 -51 42 -39 0 -43\n    13 -10 38 56 41 76 124 45 185 -25 48 -72 105 -103 123 -15 9 -36 29 -47 45\n    -17 26 -63 41 -65 22z m56 -48 c16 -24 31 -42 34 -39 9 9 79 -69 74 -83 -3 -7\n    -2 -13 3 -12 18 3 25 -1 19 -12 -5 -7 -16 -2 -33 13 l-26 23 16 -25 c17 -27\n    29 -92 16 -84 -4 3 -8 -8 -8 -25 0 -16 4 -33 10 -36 5 -3 7 0 4 9 -3 9 3 20\n    15 28 13 8 21 24 22 43 1 18 3 23 6 12 3 -10 2 -29 -1 -43 -7 -26 -62 -94 -77\n    -94 -13 0 -11 17 4 32 21 19 4 88 -28 115 -14 13 -22 23 -16 23 5 0 21 -14 35\n    -31 14 -17 26 -25 26 -19 0 21 -60 72 -79 67 -16 -4 -17 -1 -8 34 6 24 14 36\n    21 32 6 -3 1 5 -11 18 -12 13 -22 29 -23 34 -1 6 -6 17 -12 25 -6 10 -7 -39\n    -4 -142 l6 -158 -26 10 c-33 13 -44 12 -21 -1 17 -10 24 -44 10 -52 -5 -3 -39\n    -8 -76 -12 -68 -7 -69 -7 -65 17 4 28 64 60 117 62 l36 1 0 157 c0 87 2 158 5\n    158 3 0 18 -20 35 -45z m15 -159 c0 -2 -7 -7 -16 -10 -8 -3 -12 -2 -9 4 6 10\n    25 14 25 6z m50 -92 c0 -13 -4 -26 -10 -29 -14 -9 -13 -48 2 -63 9 -9 6 -12\n    -15 -12 -22 0 -27 5 -27 24 0 14 -4 28 -10 31 -15 9 -13 102 3 108 18 7 57\n    -33 57 -59z m-139 -135 c-32 -26 -121 -25 -121 2 0 6 8 5 19 -1 26 -14 64 -13\n    55 1 -4 8 1 9 16 4 13 -4 20 -3 17 2 -3 5 4 10 16 10 22 2 22 2 -2 -18z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M330 345 c19 -19 36 -35 39 -35 3 0 -10 16 -29 35 -19 19 -36 35 -39\n    35 -3 0 10 -16 29 -35z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M349 123 c-13 -16 -12 -17 4 -4 16 13 21 21 13 21 -2 0 -10 -8 -17\n    -17z");
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel3.setAttributeNS(null, "d", "M243 13 c15 -2 39 -2 55 0 15 2 2 4 -28 4 -30 0 -43 -2 -27 -4z");
      ac(bel4, ["\n    ", bel0, "\n    ", bel1, "\n    ", bel2, "\n    ", bel3, "\n    "]);
      ac(bel5, ["\n    ", bel4, "\n    "]);
      return bel5;
    }();
  },
  page_white_picture: function page_white_picture() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel10 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel10.setAttributeNS(null, "width", "16.000000pt");
      bel10.setAttributeNS(null, "height", "16.000000pt");
      bel10.setAttributeNS(null, "viewBox", "0 0 48.000000 36.000000");
      bel10.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
      bel10.setAttributeNS(null, "class", "UppyIcon");
      var bel9 = document.createElement("g");
      bel9.setAttribute("transform", "translate(0.000000,36.000000) scale(0.100000,-0.100000)");
      bel9.setAttribute("fill", "#565555");
      bel9.setAttribute("stroke", "none");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M0 180 l0 -180 240 0 240 0 0 180 0 180 -240 0 -240 0 0 -180z m470\n    0 l0 -170 -230 0 -230 0 0 170 0 170 230 0 230 0 0 -170z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M40 185 l0 -135 200 0 200 0 0 135 0 135 -200 0 -200 0 0 -135z m390\n    59 l0 -65 -29 20 c-37 27 -45 26 -65 -4 -9 -14 -22 -25 -28 -25 -7 0 -24 -12\n    -39 -26 -26 -25 -28 -25 -53 -9 -17 11 -26 13 -26 6 0 -7 -4 -9 -10 -6 -5 3\n    -22 -2 -37 -12 l-28 -18 20 27 c11 15 26 25 33 23 6 -2 12 -1 12 4 0 10 -37\n    21 -65 20 -14 -1 -12 -3 7 -8 l28 -6 -50 -55 -49 -55 0 126 1 126 189 1 189 2\n    0 -66z m-16 -73 c11 -12 14 -21 8 -21 -6 0 -13 4 -17 10 -3 5 -12 7 -19 4 -8\n    -3 -16 2 -19 13 -3 11 -4 7 -4 -9 1 -19 6 -25 18 -23 19 4 46 -21 35 -32 -4\n    -4 -11 -1 -16 7 -6 8 -10 10 -10 4 0 -6 7 -17 15 -24 24 -20 11 -24 -76 -27\n    -69 -1 -83 1 -97 18 -9 10 -20 19 -25 19 -5 0 -4 -6 2 -14 14 -17 -5 -26 -55\n    -26 -36 0 -46 16 -17 27 10 4 22 13 27 22 8 13 10 12 17 -4 7 -17 8 -18 8 -2\n    1 23 11 22 55 -8 33 -22 35 -23 26 -5 -9 16 -8 20 5 20 8 0 15 5 15 11 0 5 -4\n    7 -10 4 -5 -3 -10 -4 -10 -1 0 4 59 36 67 36 2 0 1 -10 -2 -21 -5 -15 -4 -19\n    5 -14 6 4 9 17 6 28 -12 49 27 53 68 8z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M100 296 c0 -2 7 -7 16 -10 8 -3 12 -2 9 4 -6 10 -25 14 -25 6z");
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel3.setAttributeNS(null, "d", "M243 293 c9 -2 23 -2 30 0 6 3 -1 5 -18 5 -16 0 -22 -2 -12 -5z");
      var bel4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel4.setAttributeNS(null, "d", "M65 280 c-3 -5 -2 -10 4 -10 5 0 13 5 16 10 3 6 2 10 -4 10 -5 0 -13\n    -4 -16 -10z");
      var bel5 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel5.setAttributeNS(null, "d", "M155 270 c-3 -6 1 -7 9 -4 18 7 21 14 7 14 -6 0 -13 -4 -16 -10z");
      var bel6 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel6.setAttributeNS(null, "d", "M233 252 c-13 -2 -23 -8 -23 -13 0 -7 -12 -8 -30 -4 -22 5 -30 3 -30\n    -7 0 -10 -2 -10 -9 1 -5 8 -19 12 -35 9 -14 -3 -27 -1 -30 4 -2 5 -4 4 -3 -3\n    2 -6 6 -10 10 -10 3 0 20 -4 37 -9 18 -5 32 -5 36 1 3 6 13 8 21 5 13 -5 113\n    21 113 30 0 3 -19 2 -57 -4z");
      var bel7 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel7.setAttributeNS(null, "d", "M275 220 c-13 -6 -15 -9 -5 -9 8 0 22 4 30 9 18 12 2 12 -25 0z");
      var bel8 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel8.setAttributeNS(null, "d", "M132 23 c59 -2 158 -2 220 0 62 1 14 3 -107 3 -121 0 -172 -2 -113\n    -3z");
      ac(bel9, ["\n    ", bel0, "\n    ", bel1, "\n    ", bel2, "\n    ", bel3, "\n    ", bel4, "\n    ", bel5, "\n    ", bel6, "\n    ", bel7, "\n    ", bel8, "\n    "]);
      ac(bel10, ["\n    ", bel9, "\n    "]);
      return bel10;
    }();
  },
  word: function word() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel8 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel8.setAttributeNS(null, "width", "16.000000pt");
      bel8.setAttributeNS(null, "height", "16.000000pt");
      bel8.setAttributeNS(null, "viewBox", "0 0 48.000000 48.000000");
      bel8.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
      bel8.setAttributeNS(null, "class", "UppyIcon");
      var bel7 = document.createElement("g");
      bel7.setAttribute("transform", "translate(0.000000,48.000000) scale(0.100000,-0.100000)");
      bel7.setAttribute("fill", "#423d3d");
      bel7.setAttribute("stroke", "none");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M0 466 c0 -15 87 -26 213 -26 l77 0 0 -140 0 -140 -77 0 c-105 0\n    -213 -11 -213 -21 0 -5 15 -9 34 -9 25 0 33 -4 33 -17 0 -74 4 -113 13 -113 6\n    0 10 32 10 75 l0 75 105 0 105 0 0 150 0 150 -105 0 c-87 0 -105 3 -105 15 0\n    11 -12 15 -45 15 -31 0 -45 -4 -45 -14z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M123 468 c-2 -5 50 -8 116 -8 l121 0 0 -50 c0 -46 -2 -50 -23 -50\n    -14 0 -24 -6 -24 -15 0 -8 4 -15 9 -15 4 0 8 -20 8 -45 0 -25 -4 -45 -8 -45\n    -5 0 -9 -7 -9 -15 0 -9 10 -15 24 -15 22 0 23 3 23 75 l0 75 50 0 50 0 0 -170\n    0 -170 -175 0 -175 0 -2 63 c-2 59 -2 60 -5 13 -3 -27 -2 -60 2 -73 l5 -23\n    183 2 182 3 2 216 c3 275 19 254 -194 254 -85 0 -157 -3 -160 -7z m337 -85 c0\n    -2 -18 -3 -39 -3 -39 0 -39 0 -43 45 l-3 44 42 -41 c24 -23 43 -43 43 -45z\n    m-19 50 c19 -22 23 -29 9 -18 -36 30 -50 43 -50 49 0 11 6 6 41 -31z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M4 300 c0 -74 1 -105 3 -67 2 37 2 97 0 135 -2 37 -3 6 -3 -68z");
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel3.setAttributeNS(null, "d", "M20 300 l0 -131 128 3 127 3 3 128 3 127 -131 0 -130 0 0 -130z m250\n    100 c0 -16 -7 -20 -33 -20 -31 0 -34 -2 -34 -31 0 -28 2 -30 13 -14 8 10 11\n    22 8 26 -3 5 1 9 9 9 11 0 9 -12 -12 -50 -14 -27 -32 -50 -39 -50 -15 0 -31\n    38 -26 63 2 10 -1 15 -8 11 -6 -4 -9 -1 -6 6 2 8 10 16 16 18 8 2 12 -10 12\n    -38 0 -38 2 -41 16 -29 9 7 12 15 7 16 -5 2 -7 17 -5 33 4 26 1 30 -20 30 -17\n    0 -29 -9 -39 -27 -20 -41 -22 -50 -6 -30 14 17 15 16 20 -5 4 -13 2 -40 -2\n    -60 -9 -37 -8 -38 20 -38 26 0 33 8 64 70 19 39 37 70 40 70 3 0 5 -40 5 -90\n    l0 -90 -120 0 -120 0 0 120 0 120 120 0 c113 0 120 -1 120 -20z");
      var bel4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel4.setAttributeNS(null, "d", "M40 371 c0 -6 5 -13 10 -16 6 -3 10 -35 10 -71 0 -57 2 -64 20 -64\n    13 0 27 14 40 40 25 49 25 63 0 30 -19 -25 -39 -23 -24 2 5 7 7 23 6 35 -2 11\n    2 24 7 28 23 13 9 25 -29 25 -22 0 -40 -4 -40 -9z m53 -9 c-6 -4 -13 -28 -15\n    -52 l-3 -45 -5 53 c-5 47 -3 52 15 52 13 0 16 -3 8 -8z");
      var bel5 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel5.setAttributeNS(null, "d", "M313 165 c0 -9 10 -15 24 -15 14 0 23 6 23 15 0 9 -9 15 -23 15 -14\n    0 -24 -6 -24 -15z");
      var bel6 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel6.setAttributeNS(null, "d", "M180 105 c0 -12 17 -15 90 -15 73 0 90 3 90 15 0 12 -17 15 -90 15\n    -73 0 -90 -3 -90 -15z");
      ac(bel7, ["\n    ", bel0, "\n    ", bel1, "\n    ", bel2, "\n    ", bel3, "\n    ", bel4, "\n    ", bel5, "\n    ", bel6, "\n    "]);
      ac(bel8, ["\n    ", bel7, "\n    "]);
      return bel8;
    }();
  },
  powerpoint: function powerpoint() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel19 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel19.setAttributeNS(null, "width", "16.000000pt");
      bel19.setAttributeNS(null, "height", "16.000000pt");
      bel19.setAttributeNS(null, "viewBox", "0 0 16.000000 16.000000");
      bel19.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
      bel19.setAttributeNS(null, "class", "UppyIcon");
      var bel18 = document.createElement("g");
      bel18.setAttribute("transform", "translate(0.000000,144.000000) scale(0.100000,-0.100000)");
      bel18.setAttribute("fill", "#494747");
      bel18.setAttribute("stroke", "none");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M0 1390 l0 -50 93 0 c50 0 109 -3 130 -6 l37 -7 0 57 0 56 -130 0\n    -130 0 0 -50z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M870 1425 c0 -8 -12 -18 -27 -22 l-28 -6 30 -9 c17 -5 75 -10 130\n    -12 86 -2 100 -5 99 -19 0 -10 -1 -80 -2 -157 l-2 -140 -65 0 c-60 0 -80 -9\n    -55 -25 8 -5 7 -11 -1 -21 -17 -20 2 -25 112 -27 l94 -2 0 40 0 40 100 5 c55\n    3 104 3 108 -1 8 -6 11 -1008 4 -1016 -2 -2 -236 -4 -520 -6 -283 -1 -519 -5\n    -523 -9 -4 -4 -1 -14 6 -23 11 -13 82 -15 561 -15 l549 0 0 570 c0 543 -1 570\n    -18 570 -10 0 -56 39 -103 86 -46 47 -93 90 -104 95 -11 6 22 -31 73 -82 50\n    -50 92 -95 92 -99 0 -14 -23 -16 -136 -12 l-111 4 -6 124 c-6 119 -7 126 -32\n    145 -14 12 -23 25 -20 30 4 5 -38 9 -99 9 -87 0 -106 -3 -106 -15z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M1190 1429 c0 -14 225 -239 239 -239 7 0 11 30 11 85 0 77 -2 85 -19\n    85 -21 0 -61 44 -61 66 0 11 -20 14 -85 14 -55 0 -85 -4 -85 -11z");
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel3.setAttributeNS(null, "d", "M281 1331 c-24 -16 7 -23 127 -31 100 -6 107 -7 47 -9 -38 -1 -142\n    -8 -229 -14 l-160 -12 -7 -28 c-10 -37 -16 -683 -6 -693 4 -4 10 -4 15 0 4 4\n    8 166 9 359 l2 352 358 -3 358 -2 5 -353 c3 -193 2 -356 -2 -361 -3 -4 -136\n    -8 -295 -7 -290 2 -423 -4 -423 -20 0 -5 33 -9 73 -9 39 0 90 -3 111 -7 l39\n    -6 -45 -18 c-26 -10 -90 -20 -151 -25 l-107 -7 0 -38 c0 -35 3 -39 24 -39 36\n    0 126 -48 128 -68 1 -9 2 -40 3 -69 2 -29 6 -91 10 -138 l7 -85 44 0 44 0 0\n    219 0 220 311 1 c172 0 314 2 318 4 5 4 6 301 2 759 l-1 137 -297 0 c-164 0\n    -304 -4 -312 -9z");
      var bel4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel4.setAttributeNS(null, "d", "M2 880 c-1 -276 2 -378 10 -360 12 30 11 657 -2 710 -5 21 -8 -121\n    -8 -350z");
      var bel5 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel5.setAttributeNS(null, "d", "M145 1178 c-3 -8 -4 -141 -3 -298 l3 -285 295 0 295 0 0 295 0 295\n    -293 3 c-230 2 -294 0 -297 -10z m553 -27 c11 -6 13 -60 11 -260 -1 -139 -6\n    -254 -9 -256 -4 -3 -124 -6 -266 -7 l-259 -3 -3 255 c-1 140 0 260 3 267 3 10\n    62 13 257 13 139 0 259 -4 266 -9z");
      var bel6 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel6.setAttributeNS(null, "d", "M445 1090 l-210 -5 -3 -37 -3 -38 225 0 226 0 0 34 c0 18 -6 37 -12\n    42 -7 5 -107 7 -223 4z");
      var bel7 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel7.setAttributeNS(null, "d", "M295 940 c-3 -6 1 -12 9 -15 9 -3 23 -7 31 -10 10 -3 15 -18 15 -49\n    0 -25 3 -47 8 -49 15 -9 47 11 52 33 9 38 28 34 41 -8 10 -35 9 -43 -7 -66\n    -23 -31 -51 -34 -56 -4 -4 31 -26 34 -38 4 -5 -14 -12 -26 -16 -26 -4 0 -22\n    16 -41 36 -33 35 -34 40 -28 86 7 48 6 50 -16 46 -18 -2 -23 -9 -21 -23 2 -11\n    3 -49 3 -85 0 -72 6 -83 60 -111 57 -29 95 -25 144 15 37 31 46 34 83 29 40\n    -5 42 -5 42 21 0 24 -3 27 -27 24 -24 -3 -28 1 -31 25 -3 24 0 28 20 25 13 -2\n    23 2 23 7 0 6 -9 9 -20 8 -13 -2 -28 9 -44 32 -13 19 -31 35 -41 35 -10 0 -23\n    7 -30 15 -14 17 -105 21 -115 5z");
      var bel8 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel8.setAttributeNS(null, "d", "M522 919 c-28 -11 -20 -29 14 -29 14 0 24 6 24 14 0 21 -11 25 -38\n    15z");
      var bel9 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel9.setAttributeNS(null, "d", "M623 922 c-53 -5 -43 -32 12 -32 32 0 45 4 45 14 0 17 -16 22 -57 18z");
      var bel10 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel10.setAttributeNS(null, "d", "M597 854 c-13 -14 6 -24 44 -24 28 0 39 4 39 15 0 11 -11 15 -38 15\n    -21 0 -42 -3 -45 -6z");
      var bel11 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel11.setAttributeNS(null, "d", "M597 794 c-4 -4 -7 -18 -7 -31 0 -21 4 -23 46 -23 44 0 45 1 42 28\n    -3 23 -8 27 -38 30 -20 2 -39 0 -43 -4z");
      var bel12 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel12.setAttributeNS(null, "d", "M989 883 c-34 -4 -37 -6 -37 -37 0 -32 2 -34 45 -40 25 -3 72 -6 104\n    -6 l59 0 0 45 0 45 -67 -2 c-38 -1 -84 -3 -104 -5z");
      var bel13 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel13.setAttributeNS(null, "d", "M993 703 c-42 -4 -54 -15 -33 -28 8 -5 8 -11 0 -20 -16 -20 -3 -24\n    104 -31 l96 -7 0 47 0 46 -62 -2 c-35 -1 -82 -3 -105 -5z");
      var bel14 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel14.setAttributeNS(null, "d", "M1005 523 c-50 -6 -59 -12 -46 -26 8 -10 7 -17 -1 -25 -6 -6 -9 -14\n    -6 -17 3 -3 51 -8 107 -12 l101 -6 0 46 0 47 -62 -1 c-35 -1 -76 -4 -93 -6z");
      var bel15 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel15.setAttributeNS(null, "d", "M537 344 c-4 -4 -7 -25 -7 -46 l0 -38 46 0 45 0 -3 43 c-3 40 -4 42\n    -38 45 -20 2 -39 0 -43 -4z");
      var bel16 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel16.setAttributeNS(null, "d", "M714 341 c-2 -2 -4 -22 -4 -43 l0 -38 225 0 225 0 0 45 0 46 -221 -3\n    c-121 -2 -222 -5 -225 -7z");
      var bel17 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel17.setAttributeNS(null, "d", "M304 205 c0 -66 1 -92 3 -57 2 34 2 88 0 120 -2 31 -3 3 -3 -63z");
      ac(bel18, ["\n    ", bel0, "\n    ", bel1, "\n    ", bel2, "\n    ", bel3, "\n    ", bel4, "\n    ", bel5, "\n    ", bel6, "\n    ", bel7, "\n    ", bel8, "\n    ", bel9, "\n    ", bel10, "\n    ", bel11, "\n    ", bel12, "\n    ", bel13, "\n    ", bel14, "\n    ", bel15, "\n    ", bel16, "\n    ", bel17, "\n    "]);
      ac(bel19, ["\n    ", bel18, "\n    "]);
      return bel19;
    }();
  },
  page_white: function page_white() {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel6 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel6.setAttributeNS(null, "width", "16.000000pt");
      bel6.setAttributeNS(null, "height", "16.000000pt");
      bel6.setAttributeNS(null, "viewBox", "0 0 48.000000 48.000000");
      bel6.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
      bel6.setAttributeNS(null, "class", "UppyIcon");
      var bel5 = document.createElement("g");
      bel5.setAttribute("transform", "translate(0.000000,48.000000) scale(0.100000,-0.100000)");
      bel5.setAttribute("fill", "#000000");
      bel5.setAttribute("stroke", "none");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M20 240 c1 -202 3 -240 16 -240 12 0 14 38 14 240 0 208 -2 240 -15\n    240 -13 0 -15 -31 -15 -240z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M75 471 c-4 -8 32 -11 119 -11 l126 0 0 -50 0 -50 50 0 c28 0 50 5\n    50 10 0 6 -18 10 -40 10 l-40 0 0 42 0 42 43 -39 42 -40 -43 45 -42 45 -129 3\n    c-85 2 -131 0 -136 -7z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M398 437 l42 -43 0 -197 c0 -168 2 -197 15 -197 13 0 15 29 15 198\n    l0 198 -36 42 c-21 25 -44 42 -57 42 -18 0 -16 -6 21 -43z");
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel3.setAttributeNS(null, "d", "M92 353 l2 -88 3 78 4 77 89 0 89 0 8 -42 c8 -43 9 -43 55 -46 44 -3\n    47 -5 51 -35 4 -31 4 -31 5 6 l2 37 -50 0 -50 0 0 50 0 50 -105 0 -105 0 2\n    -87z");
      var bel4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel4.setAttributeNS(null, "d", "M75 10 c8 -13 332 -13 340 0 4 7 -55 10 -170 10 -115 0 -174 -3 -170\n    -10z");
      ac(bel5, ["\n    ", bel0, "\n    ", bel1, "\n    ", bel2, "\n    ", bel3, "\n    ", bel4, "\n    "]);
      ac(bel6, ["\n    ", bel5, "\n    "]);
      return bel6;
    }();
  }
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],58:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var html = require('yo-yo');
var Plugin = require('../Plugin');

var Provider = require('../../uppy-base/src/plugins/Provider');

var View = require('../../generic-provider-views/index');
var icons = require('./icons');

module.exports = function (_Plugin) {
  _inherits(Dropbox, _Plugin);

  function Dropbox(core, opts) {
    _classCallCheck(this, Dropbox);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'Dropbox';
    _this.title = 'Dropbox';
    _this.stateId = 'dropbox';
    _this.icon = function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel3 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel3.setAttributeNS(null, "width", "128");
      bel3.setAttributeNS(null, "height", "118");
      bel3.setAttributeNS(null, "viewBox", "0 0 128 118");
      bel3.setAttributeNS(null, "class", "UppyIcon");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M38.145.777L1.108 24.96l25.608 20.507 37.344-23.06z");
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel1.setAttributeNS(null, "d", "M1.108 65.975l37.037 24.183L64.06 68.525l-37.343-23.06zM64.06 68.525l25.917 21.633 37.036-24.183-25.61-20.51z");
      var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel2.setAttributeNS(null, "d", "M127.014 24.96L89.977.776 64.06 22.407l37.345 23.06zM64.136 73.18l-25.99 21.567-11.122-7.262v8.142l37.112 22.256 37.114-22.256v-8.142l-11.12 7.262z");
      ac(bel3, ["\n        ", bel0, "\n        ", bel1, "\n        ", bel2, "\n      "]);
      return bel3;
    }();

    // writing out the key explicitly for readability the key used to store
    // the provider instance must be equal to this.id.
    _this.Dropbox = new Provider({
      host: _this.opts.host,
      provider: 'dropbox'
    });

    _this.files = [];

    // Visual
    _this.render = _this.render.bind(_this);

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Dropbox.prototype.install = function install() {
    var _this2 = this;

    this.view = new View(this);
    // Set default state
    this.core.setState({
      // writing out the key explicitly for readability the key used to store
      // the plugin state must be equal to this.stateId.
      dropbox: {
        authenticated: false,
        files: [],
        folders: [],
        directories: [],
        activeRow: -1,
        filterInput: ''
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this[this.id].auth().then(function (authenticated) {
      _this2.view.updateState({ authenticated: authenticated });
      if (authenticated) {
        _this2.view.getFolder();
      }
    });

    return;
  };

  Dropbox.prototype.isFolder = function isFolder(item) {
    return item.is_dir;
  };

  Dropbox.prototype.getItemData = function getItemData(item) {
    return _extends({}, item, { size: item.bytes });
  };

  Dropbox.prototype.getItemIcon = function getItemIcon(item) {
    var icon = icons[item.icon];

    if (!icon) {
      if (item.icon.startsWith('folder')) {
        icon = icons['folder'];
      } else {
        icon = icons['page_white'];
      }
    }
    return icon();
  };

  Dropbox.prototype.getItemSubList = function getItemSubList(item) {
    return item.contents;
  };

  Dropbox.prototype.getItemName = function getItemName(item) {
    return item.path.length > 1 ? item.path.substring(1) : item.path;
  };

  Dropbox.prototype.getMimeType = function getMimeType(item) {
    return item.mime_type;
  };

  Dropbox.prototype.getItemId = function getItemId(item) {
    return item.rev;
  };

  Dropbox.prototype.getItemRequestPath = function getItemRequestPath(item) {
    return encodeURIComponent(this.getItemName(item));
  };

  Dropbox.prototype.getItemModifiedDate = function getItemModifiedDate(item) {
    return item.modified;
  };

  Dropbox.prototype.render = function render(state) {
    return this.view.render(state);
  };

  return Dropbox;
}(Plugin);

},{"../../generic-provider-views/index":39,"../../uppy-base/src/plugins/Provider":69,"../Plugin":62,"./icons":57,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],59:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var html = require('yo-yo');
var Plugin = require('../Plugin');

var Provider = require('../../uppy-base/src/plugins/Provider');

var View = require('../../generic-provider-views/index');

module.exports = function (_Plugin) {
  _inherits(Google, _Plugin);

  function Google(core, opts) {
    _classCallCheck(this, Google);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'GoogleDrive';
    _this.title = 'Google Drive';
    _this.stateId = 'googleDrive';
    _this.icon = function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bel1.setAttributeNS(null, "width", "28");
      bel1.setAttributeNS(null, "height", "28");
      bel1.setAttributeNS(null, "viewBox", "0 0 16 16");
      bel1.setAttributeNS(null, "class", "UppyIcon UppyModalTab-icon");
      var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bel0.setAttributeNS(null, "d", "M2.955 14.93l2.667-4.62H16l-2.667 4.62H2.955zm2.378-4.62l-2.666 4.62L0 10.31l5.19-8.99 2.666 4.62-2.523 4.37zm10.523-.25h-5.333l-5.19-8.99h5.334l5.19 8.99z");
      ac(bel1, ["\n        ", bel0, "\n      "]);
      return bel1;
    }();

    // writing out the key explicitly for readability the key used to store
    // the provider instance must be equal to this.id.
    _this.GoogleDrive = new Provider({
      host: _this.opts.host,
      provider: 'drive',
      authProvider: 'google'
    });

    _this.files = [];

    // Visual
    _this.render = _this.render.bind(_this);

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Google.prototype.install = function install() {
    var _this2 = this;

    this.view = new View(this);
    // Set default state for Google Drive
    this.core.setState({
      // writing out the key explicitly for readability the key used to store
      // the plugin state must be equal to this.stateId.
      googleDrive: {
        authenticated: false,
        files: [],
        folders: [],
        directories: [],
        activeRow: -1,
        filterInput: ''
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this[this.id].auth().then(function (authenticated) {
      _this2.view.updateState({ authenticated: authenticated });
      if (authenticated) {
        _this2.view.getFolder('root');
      }
    });

    return;
  };

  Google.prototype.isFolder = function isFolder(item) {
    return item.mimeType === 'application/vnd.google-apps.folder';
  };

  Google.prototype.getItemData = function getItemData(item) {
    return item;
  };

  Google.prototype.getItemIcon = function getItemIcon(item) {
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel0 = document.createElement("img");
      bel0.setAttribute("src", arguments[0]);
      return bel0;
    }(item.iconLink);
  };

  Google.prototype.getItemSubList = function getItemSubList(item) {
    return item.items;
  };

  Google.prototype.getItemName = function getItemName(item) {
    return item.title;
  };

  Google.prototype.getMimeType = function getMimeType(item) {
    return item.mimeType;
  };

  Google.prototype.getItemId = function getItemId(item) {
    return item.id;
  };

  Google.prototype.getItemRequestPath = function getItemRequestPath(item) {
    return this.getItemId(item);
  };

  Google.prototype.getItemModifiedDate = function getItemModifiedDate(item) {
    return item.modifiedByMeDate;
  };

  Google.prototype.render = function render(state) {
    return this.view.render(state);
  };

  return Google;
}(Plugin);

},{"../../generic-provider-views/index":39,"../../uppy-base/src/plugins/Provider":69,"../Plugin":62,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],60:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Plugin = require('./Plugin');
var html = require('yo-yo');

/**
 * Informer
 * Shows rad message bubbles
 * used like this: `bus.emit('informer', 'hello world', 'info', 5000)`
 * or for errors: `bus.emit('informer', 'Error uploading img.jpg', 'error', 5000)`
 *
 */
module.exports = function (_Plugin) {
  _inherits(Informer, _Plugin);

  function Informer(core, opts) {
    _classCallCheck(this, Informer);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'progressindicator';
    _this.id = 'Informer';
    _this.title = 'Informer';
    _this.timeoutID = undefined;

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Informer.prototype.showInformer = function showInformer(msg, type, duration) {
    var _this2 = this;

    this.core.setState({
      informer: {
        isHidden: false,
        msg: msg
      }
    });

    window.clearTimeout(this.timeoutID);
    if (duration === 0) {
      this.timeoutID = undefined;
      return;
    }

    // hide the informer after `duration` milliseconds
    this.timeoutID = setTimeout(function () {
      var newInformer = _extends({}, _this2.core.getState().informer, {
        isHidden: true
      });
      _this2.core.setState({
        informer: newInformer
      });
    }, duration);
  };

  Informer.prototype.hideInformer = function hideInformer() {
    var newInformer = _extends({}, this.core.getState().informer, {
      isHidden: true
    });
    this.core.setState({
      informer: newInformer
    });
  };

  Informer.prototype.render = function render(state) {
    var msg = state.informer.msg;
    var isHidden = state.informer.isHidden;

    // @TODO add aria-live for screen-readers
    return function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel1 = document.createElement("div");
      bel1.setAttribute("aria-hidden", arguments[1]);
      bel1.setAttribute("class", "UppyInformer");
      var bel0 = document.createElement("p");
      ac(bel0, [arguments[0]]);
      ac(bel1, ["\n      ", bel0, "\n    "]);
      return bel1;
    }(msg, isHidden);
  };

  Informer.prototype.install = function install() {
    var _this3 = this;

    // Set default state for Google Drive
    this.core.setState({
      informer: {
        isHidden: true,
        msg: ''
      }
    });

    var bus = this.core.bus;

    bus.on('informer', function (msg, type, duration) {
      _this3.showInformer(msg, type, duration);
    });

    bus.on('informer:hide', function () {
      _this3.hideInformer();
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  return Informer;
}(Plugin);

},{"./Plugin":62,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],61:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Plugin = require('./Plugin');

/**
 * Meta Data
 * Adds metadata fields to Uppy
 *
 */
module.exports = function (_Plugin) {
  _inherits(MetaData, _Plugin);

  function MetaData(core, opts) {
    _classCallCheck(this, MetaData);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'modifier';
    _this.id = 'MetaData';
    _this.title = 'Meta Data';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  MetaData.prototype.addInitialMeta = function addInitialMeta() {
    var _this2 = this;

    var metaFields = this.opts.fields;

    this.core.setState({
      metaFields: metaFields
    });

    this.core.emitter.on('file-added', function (fileID) {
      metaFields.forEach(function (item) {
        var obj = {};
        obj[item.id] = item.value;
        _this2.core.updateMeta(obj, fileID);
      });
    });
  };

  MetaData.prototype.install = function install() {
    this.addInitialMeta();
  };

  return MetaData;
}(Plugin);

},{"./Plugin":62}],62:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var yo = require('yo-yo');

/**
 * Boilerplate that all Plugins share - and should not be used
 * directly. It also shows which methods final plugins should implement/override,
 * this deciding on structure.
 *
 * @param {object} main Uppy core object
 * @param {object} object with plugin options
 * @return {array | string} files or success/fail message
 */
module.exports = function () {
  function Plugin(core, opts) {
    _classCallCheck(this, Plugin);

    this.core = core;
    this.opts = opts || {};
    this.type = 'none';

    // clear everything inside the target selector
    this.opts.replaceTargetContent === this.opts.replaceTargetContent || true;

    this.update = this.update.bind(this);
    this.mount = this.mount.bind(this);
    this.focus = this.focus.bind(this);
    this.install = this.install.bind(this);
  }

  Plugin.prototype.update = function update(state) {
    if (typeof this.el === 'undefined') {
      return;
    }

    var newEl = this.render(state);
    yo.update(this.el, newEl);

    // optimizes performance?
    // requestAnimationFrame(() => {
    //   const newEl = this.render(state)
    //   yo.update(this.el, newEl)
    // })
  };

  /**
   * Check if supplied `target` is a `string` or an `object`.
   * If it’s an object — target is a plugin, and we search `plugins`
   * for a plugin with same name and return its target.
   *
   * @param {String|Object} target
   *
   */


  Plugin.prototype.mount = function mount(target, plugin) {
    var callerPluginName = plugin.id;

    if (typeof target === 'string') {
      this.core.log('Installing ' + callerPluginName + ' to ' + target);

      // clear everything inside the target container
      if (this.opts.replaceTargetContent) {
        document.querySelector(target).innerHTML = '';
      }

      this.el = plugin.render(this.core.state);
      document.querySelector(target).appendChild(this.el);

      return target;
    } else {
      // TODO: is instantiating the plugin really the way to roll
      // just to get the plugin name?
      var Target = target;
      var targetPluginName = new Target().id;

      this.core.log('Installing ' + callerPluginName + ' to ' + targetPluginName);

      var targetPlugin = this.core.getPlugin(targetPluginName);
      var selectorTarget = targetPlugin.addTarget(plugin);

      return selectorTarget;
    }
  };

  Plugin.prototype.focus = function focus() {
    return;
  };

  Plugin.prototype.install = function install() {
    return;
  };

  return Plugin;
}();

},{"yo-yo":19}],63:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

var Plugin = require('./Plugin');
var tus = require('tus-js-client');
var UppySocket = require('../core/UppySocket');

/**
 * Tus resumable file uploader
 *
 */
module.exports = function (_Plugin) {
  _inherits(Tus10, _Plugin);

  function Tus10(core, opts) {
    _classCallCheck(this, Tus10);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'uploader';
    _this.id = 'Tus';
    _this.title = 'Tus';

    // set default options
    var defaultOptions = {
      resume: true,
      allowPause: true
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Tus10.prototype.pauseResume = function pauseResume(action, fileID) {
    var updatedFiles = _extends({}, this.core.getState().files);
    var inProgressUpdatedFiles = Object.keys(updatedFiles).filter(function (file) {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });

    switch (action) {
      case 'toggle':
        if (updatedFiles[fileID].uploadComplete) return;

        var wasPaused = updatedFiles[fileID].isPaused || false;
        var isPaused = !wasPaused;
        var updatedFile = void 0;
        if (wasPaused) {
          updatedFile = _extends({}, updatedFiles[fileID], {
            isPaused: false
          });
        } else {
          updatedFile = _extends({}, updatedFiles[fileID], {
            isPaused: true
          });
        }
        updatedFiles[fileID] = updatedFile;
        this.core.setState({ files: updatedFiles });
        return isPaused;
      case 'pauseAll':
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends({}, updatedFiles[file], {
            isPaused: true
          });
          updatedFiles[file] = updatedFile;
        });
        this.core.setState({ files: updatedFiles });
        return;
      case 'resumeAll':
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends({}, updatedFiles[file], {
            isPaused: false
          });
          updatedFiles[file] = updatedFile;
        });
        this.core.setState({ files: updatedFiles });
        return;
    }
  };

  /**
   * Create a new Tus upload
   *
   * @param {object} file for use with upload
   * @param {integer} current file in a queue
   * @param {integer} total number of files in a queue
   * @returns {Promise}
   */


  Tus10.prototype.upload = function upload(file, current, total) {
    var _this2 = this;

    this.core.log('uploading ' + current + ' of ' + total);

    // Create a new tus upload
    return new _Promise(function (resolve, reject) {
      var upload = new tus.Upload(file.data, {

        // TODO merge this.opts or this.opts.tus here
        metadata: file.meta,
        resume: _this2.opts.resume,
        endpoint: _this2.opts.endpoint,

        onError: function onError(err) {
          _this2.core.log(err);
          _this2.core.emitter.emit('core:upload-error', file.id);
          reject('Failed because: ' + err);
        },
        onProgress: function onProgress(bytesUploaded, bytesTotal) {
          // Dispatch progress event
          console.log(bytesUploaded, bytesTotal);
          _this2.core.emitter.emit('core:upload-progress', {
            uploader: _this2,
            id: file.id,
            bytesUploaded: bytesUploaded,
            bytesTotal: bytesTotal
          });
        },
        onSuccess: function onSuccess() {
          _this2.core.emitter.emit('core:upload-success', file.id, upload.url);

          _this2.core.log('Download ' + upload.file.name + ' from ' + upload.url);
          resolve(upload);
        }
      });

      _this2.core.emitter.on('core:file-remove', function (fileID) {
        if (fileID === file.id) {
          console.log('removing file: ', fileID);
          upload.abort();
          resolve('upload ' + fileID + ' was removed');
        }
      });

      _this2.core.emitter.on('core:upload-pause', function (fileID) {
        if (fileID === file.id) {
          var isPaused = _this2.pauseResume('toggle', fileID);
          isPaused ? upload.abort() : upload.start();
        }
      });

      _this2.core.emitter.on('core:pause-all', function () {
        var files = _this2.core.getState().files;
        if (!files[file.id]) return;
        upload.abort();
      });

      _this2.core.emitter.on('core:resume-all', function () {
        var files = _this2.core.getState().files;
        if (!files[file.id]) return;
        upload.start();
      });

      upload.start();
      _this2.core.emitter.emit('core:upload-started', file.id, upload);
    });
  };

  Tus10.prototype.uploadRemote = function uploadRemote(file, current, total) {
    var _this3 = this;

    return new _Promise(function (resolve, reject) {
      _this3.core.log(file.remote.url);
      fetch(file.remote.url, {
        method: 'post',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(_extends({}, file.remote.body, {
          endpoint: _this3.opts.endpoint,
          protocol: 'tus'
        }))
      }).then(function (res) {
        if (res.status < 200 && res.status > 300) {
          return reject(res.statusText);
        }

        _this3.core.emitter.emit('core:upload-started', file.id);

        res.json().then(function (data) {
          // get the host domain
          var regex = /^(?:https?:\/\/|\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^\/\n]+)/;
          var host = regex.exec(file.remote.host)[1];
          var socketProtocol = location.protocol === 'https:' ? 'wss' : 'ws';

          var token = data.token;
          var socket = new UppySocket({
            target: socketProtocol + ('://' + host + '/api/' + token)
          });

          socket.on('progress', function (progressData) {
            var progress = progressData.progress;
            var bytesUploaded = progressData.bytesUploaded;
            var bytesTotal = progressData.bytesTotal;


            if (progress) {
              _this3.core.log('Upload progress: ' + progress);
              console.log(file.id);

              _this3.core.emitter.emit('core:upload-progress', {
                uploader: _this3,
                id: file.id,
                bytesUploaded: bytesUploaded,
                bytesTotal: bytesTotal
              });

              if (progress === '100.00') {
                _this3.core.emitter.emit('core:upload-success', file.id);
                socket.close();
                return resolve();
              }
            }
          });
        });
      });
    });
  };

  Tus10.prototype.uploadFiles = function uploadFiles(files) {
    var _this4 = this;

    if (Object.keys(files).length === 0) {
      this.core.log('no files to upload!');
      return;
    }

    var uploaders = [];
    files.forEach(function (file, index) {
      var current = parseInt(index, 10) + 1;
      var total = files.length;

      if (!file.isRemote) {
        uploaders.push(_this4.upload(file, current, total));
      } else {
        uploaders.push(_this4.uploadRemote(file, current, total));
      }
    });

    return Promise.all(uploaders).then(function () {
      _this4.core.log('All files uploaded');
      return { uploadedCount: files.length };
    }).catch(function (err) {
      _this4.core.log('Upload error: ' + err);
    });
  };

  Tus10.prototype.selectForUpload = function selectForUpload(files) {
    // TODO: replace files[file].isRemote with some logic
    //
    // filter files that are now yet being uploaded / haven’t been uploaded
    // and remote too
    var filesForUpload = Object.keys(files).filter(function (file) {
      if (!files[file].progress.uploadStarted || files[file].isRemote) {
        return true;
      }
      return false;
    }).map(function (file) {
      return files[file];
    });

    this.uploadFiles(filesForUpload);
  };

  Tus10.prototype.actions = function actions() {
    var _this5 = this;

    this.core.emitter.on('core:pause-all', function () {
      _this5.pauseResume('pauseAll');
    });

    this.core.emitter.on('core:resume-all', function () {
      _this5.pauseResume('resumeAll');
    });

    this.core.emitter.on('core:upload', function () {
      _this5.core.log('Tus is uploading...');
      var files = _this5.core.getState().files;
      _this5.selectForUpload(files);
    });
  };

  Tus10.prototype.addResumableUploadsCapabilityFlag = function addResumableUploadsCapabilityFlag() {
    var newCapabilities = _extends({}, this.core.getState().capabilities);
    newCapabilities.resumableUploads = true;
    this.core.setState({
      capabilities: newCapabilities
    });
  };

  Tus10.prototype.install = function install() {
    this.addResumableUploadsCapabilityFlag();
    this.actions();
  };

  return Tus10;
}(Plugin);

},{"../core/UppySocket":34,"./Plugin":62,"es6-promise":4,"tus-js-client":14}],64:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        bel2.setAttributeNS(null, "width", "100");
        bel2.setAttributeNS(null, "height", "77");
        bel2.setAttributeNS(null, "viewBox", "0 0 100 77");
        bel2.setAttributeNS(null, "class", "UppyIcon");
        var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        bel0.setAttributeNS(null, "d", "M50 32c-7.168 0-13 5.832-13 13s5.832 13 13 13 13-5.832 13-13-5.832-13-13-13z");
        var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        bel1.setAttributeNS(null, "d", "M87 13H72c0-7.18-5.82-13-13-13H41c-7.18 0-13 5.82-13 13H13C5.82 13 0 18.82 0 26v38c0 7.18 5.82 13 13 13h74c7.18 0 13-5.82 13-13V26c0-7.18-5.82-13-13-13zM50 68c-12.683 0-23-10.318-23-23s10.317-23 23-23 23 10.318 23 23-10.317 23-23 23z");
        ac(bel2, ["\n    ", bel0, "\n    ", bel1, "\n  "]);
        return bel2;
    }();
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],65:[function(require,module,exports){
'use strict';

var html = require('yo-yo');
var CameraIcon = require('./CameraIcon');

module.exports = function (props) {
  var src = props.src || '';
  var video = void 0;

  if (props.useTheFlash) {
    video = props.getSWFHTML();
  } else {
    video = function () {

      var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
      var bel0 = document.createElement("video");
      bel0.setAttribute("autoplay", "autoplay");
      bel0.setAttribute("src", arguments[0]);
      bel0.setAttribute("class", "UppyWebcam-video");
      return bel0;
    }(src);
  }

  return function () {
    var onload = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/node_modules/on-load/index.js');
    var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
    var bel4 = document.createElement("div");
    var args = arguments;
    onload(bel4, function bel_onload() {
      args[3](bel4);
    }, function bel_onunload() {
      args[4](bel4);
    }, "o1");
    bel4.setAttribute("class", "UppyWebcam-container");
    var bel0 = document.createElement("div");
    bel0.setAttribute("class", "UppyWebcam-videoContainer");
    ac(bel0, ["\n        ", arguments[0], "\n      "]);
    var bel2 = document.createElement("div");
    bel2.setAttribute("class", "UppyWebcam-buttonContainer");
    var bel1 = document.createElement("button");
    bel1.setAttribute("type", "button");
    bel1.setAttribute("title", "Take a snapshot");
    bel1.setAttribute("aria-label", "Take a snapshot");
    bel1["onclick"] = arguments[1];
    bel1.setAttribute("class", "UppyButton--circular UppyButton--red UppyButton--sizeM UppyWebcam-stopRecordBtn");
    ac(bel1, ["\n          ", arguments[2], "\n        "]);
    ac(bel2, ["\n        ", bel1, "\n      "]);
    var bel3 = document.createElement("canvas");
    bel3.setAttribute("style", "display: none;");
    bel3.setAttribute("class", "UppyWebcam-canvas");
    ac(bel4, ["\n      ", bel0, "\n      ", bel2, "\n      ", bel3, "\n    "]);
    return bel4;
  }(video, props.onSnapshot, CameraIcon(), function (el) {
    props.onFocus();
    document.querySelector('.UppyWebcam-stopRecordBtn').focus();
  }, function (el) {
    props.onStop();
  });
};

},{"./CameraIcon":64,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/node_modules/on-load/index.js":29,"yo-yo":19}],66:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel2 = document.createElement("div");
        var bel0 = document.createElement("h1");
        ac(bel0, ["Please allow access to your camera"]);
        var bel1 = document.createElement("span");
        ac(bel1, ["You have been prompted to allow camera access from this site. In order to take pictures with your camera you must approve this request."]);
        ac(bel2, ["\n      ", bel0, "\n      ", bel1, "\n    "]);
        return bel2;
    }();
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],67:[function(require,module,exports){
'use strict';

var html = require('yo-yo');

module.exports = function (props) {
    return function () {

        var ac = require('/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js');
        var bel2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        bel2.setAttributeNS(null, "width", "18");
        bel2.setAttributeNS(null, "height", "21");
        bel2.setAttributeNS(null, "viewBox", "0 0 18 21");
        bel2.setAttributeNS(null, "class", "UppyIcon UppyModalTab-icon");
        var bel0 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        bel0.setAttributeNS(null, "d", "M14.8 16.9c1.9-1.7 3.2-4.1 3.2-6.9 0-5-4-9-9-9s-9 4-9 9c0 2.8 1.2 5.2 3.2 6.9C1.9 17.9.5 19.4 0 21h3c1-1.9 11-1.9 12 0h3c-.5-1.6-1.9-3.1-3.2-4.1zM9 4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z");
        var bel1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        bel1.setAttributeNS(null, "d", "M9 14c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zM8 8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1c0-.5.4-1 1-1z");
        ac(bel2, ["\n      ", bel0, "\n      ", bel1, "\n    "]);
        return bel2;
    }();
};

},{"/home/travis/build/transloadit/uppy/node_modules/yo-yoify/lib/appendChild.js":28,"yo-yo":19}],68:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Plugin = require('../Plugin');
var WebcamProvider = require('../../uppy-base/src/plugins/Webcam');

var _require = require('../../core/Utils');

var extend = _require.extend;

var WebcamIcon = require('./WebcamIcon');
var CameraScreen = require('./CameraScreen');
var PermissionsScreen = require('./PermissionsScreen');

/**
 * Webcam
 */
module.exports = function (_Plugin) {
  _inherits(Webcam, _Plugin);

  function Webcam(core, opts) {
    _classCallCheck(this, Webcam);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.userMedia = true;
    _this.protocol = location.protocol.match(/https/i) ? 'https' : 'http';
    _this.type = 'acquirer';
    _this.id = 'Webcam';
    _this.title = 'Webcam';
    _this.icon = WebcamIcon();

    // set default options
    var defaultOptions = {
      enableFlash: true
    };

    _this.params = {
      swfURL: 'webcam.swf',
      width: 400,
      height: 300,
      dest_width: 800, // size of captured image
      dest_height: 600, // these default to width/height
      image_format: 'jpeg', // image format (may be jpeg or png)
      jpeg_quality: 90, // jpeg image quality from 0 (worst) to 100 (best)
      enable_flash: true, // enable flash fallback,
      force_flash: false, // force flash mode,
      flip_horiz: false, // flip image horiz (mirror mode)
      fps: 30, // camera frames per second
      upload_name: 'webcam', // name of file in upload post data
      constraints: null, // custom user media constraints,
      flashNotDetectedText: 'ERROR: No Adobe Flash Player detected.  Webcam.js relies on Flash for browsers that do not support getUserMedia (like yours).',
      noInterfaceFoundText: 'No supported webcam interface found.',
      unfreeze_snap: true // Whether to unfreeze the camera after snap (defaults to true)
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.install = _this.install.bind(_this);
    _this.updateState = _this.updateState.bind(_this);

    _this.render = _this.render.bind(_this);

    // Camera controls
    _this.start = _this.start.bind(_this);
    _this.stop = _this.stop.bind(_this);
    _this.takeSnapshot = _this.takeSnapshot.bind(_this);

    _this.webcam = new WebcamProvider(_this.opts, _this.params);
    _this.webcamActive = false;
    return _this;
  }

  Webcam.prototype.start = function start() {
    var _this2 = this;

    this.webcamActive = true;

    this.webcam.start().then(function (stream) {
      _this2.stream = stream;
      _this2.updateState({
        // videoStream: stream,
        cameraReady: true
      });
    }).catch(function (err) {
      _this2.updateState({
        cameraError: err
      });
    });
  };

  Webcam.prototype.stop = function stop() {
    this.stream.getVideoTracks()[0].stop();
    this.webcamActive = false;
    this.stream = null;
    this.streamSrc = null;
  };

  Webcam.prototype.takeSnapshot = function takeSnapshot() {
    var opts = {
      name: 'webcam-' + Date.now() + '.jpg',
      mimeType: 'image/jpeg'
    };

    var video = document.querySelector('.UppyWebcam-video');

    var image = this.webcam.getImage(video, opts);

    var tagFile = {
      source: this.id,
      name: opts.name,
      data: image.data,
      type: opts.mimeType
    };

    this.core.emitter.emit('core:file-add', tagFile);
  };

  Webcam.prototype.render = function render(state) {
    if (!this.webcamActive) {
      this.start();
    }

    if (!state.webcam.cameraReady && !state.webcam.useTheFlash) {
      return PermissionsScreen(state.webcam);
    }

    if (!this.streamSrc) {
      this.streamSrc = this.stream ? URL.createObjectURL(this.stream) : null;
    }

    return CameraScreen(extend(state.webcam, {
      onSnapshot: this.takeSnapshot,
      onFocus: this.focus,
      onStop: this.stop,
      getSWFHTML: this.webcam.getSWFHTML,
      src: this.streamSrc
    }));
  };

  Webcam.prototype.focus = function focus() {
    var _this3 = this;

    setTimeout(function () {
      _this3.core.emitter.emit('informer', 'Smile!', 'info', 2000);
    }, 1000);
  };

  Webcam.prototype.install = function install() {
    this.webcam.init();
    this.core.setState({
      webcam: {
        cameraReady: false
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  /**
   * Little shorthand to update the state with my new state
   */


  Webcam.prototype.updateState = function updateState(newState) {
    var state = this.core.state;

    var webcam = _extends({}, state.webcam, newState);

    this.core.setState({ webcam: webcam });
  };

  return Webcam;
}(Plugin);

},{"../../core/Utils":35,"../../uppy-base/src/plugins/Webcam":70,"../Plugin":62,"./CameraScreen":65,"./PermissionsScreen":66,"./WebcamIcon":67}],69:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

require('whatwg-fetch');

var _getName = function _getName(id) {
  return id.split('-').map(function (s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }).join(' ');
};

module.exports = function () {
  function Provider(opts) {
    _classCallCheck(this, Provider);

    this.opts = opts;
    this.provider = opts.provider;
    this.id = this.provider;
    this.authProvider = opts.authProvider || this.provider;
    this.name = this.opts.name || _getName(this.id);
  }

  _createClass(Provider, [{
    key: 'auth',
    value: function auth() {
      return fetch(this.opts.host + '/' + this.id + '/auth', {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application.json'
        }
      }).then(function (res) {
        return res.json().then(function (payload) {
          return payload.authenticated;
        });
      });
    }
  }, {
    key: 'list',
    value: function list(directory) {
      return fetch(this.opts.host + '/' + this.id + '/list/' + (directory || ''), {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(function (res) {
        return res.json();
      });
    }
  }, {
    key: 'logout',
    value: function logout() {
      var redirect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : location.href;

      return fetch(this.opts.host + '/' + this.id + '/logout?redirect=' + redirect, {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
  }]);

  return Provider;
}();

},{"whatwg-fetch":18}],70:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var dataURItoFile = require('../utils/dataURItoFile');

/**
 * Webcam Plugin
 */
module.exports = function () {
  function Webcam() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, Webcam);

    this._userMedia;
    this.userMedia = true;
    this.protocol = location.protocol.match(/https/i) ? 'https' : 'http';

    // set default options
    var defaultOptions = {
      enableFlash: true
    };

    var defaultParams = {
      swfURL: 'webcam.swf',
      width: 400,
      height: 300,
      dest_width: 800, // size of captured image
      dest_height: 600, // these default to width/height
      image_format: 'jpeg', // image format (may be jpeg or png)
      jpeg_quality: 90, // jpeg image quality from 0 (worst) to 100 (best)
      enable_flash: true, // enable flash fallback,
      force_flash: false, // force flash mode,
      flip_horiz: false, // flip image horiz (mirror mode)
      fps: 30, // camera frames per second
      upload_name: 'webcam', // name of file in upload post data
      constraints: null, // custom user media constraints,
      flashNotDetectedText: 'ERROR: No Adobe Flash Player detected.  Webcam.js relies on Flash for browsers that do not support getUserMedia (like yours).',
      noInterfaceFoundText: 'No supported webcam interface found.',
      unfreeze_snap: true // Whether to unfreeze the camera after snap (defaults to true)
    };

    this.params = Object.assign({}, defaultParams, params);

    // merge default options with the ones set by user
    this.opts = Object.assign({}, defaultOptions, opts);

    // Camera controls
    this.start = this.start.bind(this);
    this.init = this.init.bind(this);
    this.stop = this.stop.bind(this);
    // this.startRecording = this.startRecording.bind(this)
    // this.stopRecording = this.stopRecording.bind(this)
    this.takeSnapshot = this.takeSnapshot.bind(this);
    this.getImage = this.getImage.bind(this);
    this.getSWFHTML = this.getSWFHTML.bind(this);
    this.detectFlash = this.detectFlash.bind(this);
    this.getUserMedia = this.getUserMedia.bind(this);
    this.getMediaDevices = this.getMediaDevices.bind(this);
  }

  /**
   * Checks for getUserMedia support
   */


  _createClass(Webcam, [{
    key: 'init',
    value: function init() {
      var _this = this;

      // initialize, check for getUserMedia support
      this.mediaDevices = this.getMediaDevices();

      this.userMedia = this.getUserMedia(this.mediaDevices);

      // Make sure media stream is closed when navigating away from page
      if (this.userMedia) {
        window.addEventListener('beforeunload', function (event) {
          _this.reset();
        });
      }

      return {
        mediaDevices: this.mediaDevices,
        userMedia: this.userMedia
      };
    }

    // Setup getUserMedia, with polyfill for older browsers
    // Adapted from: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

  }, {
    key: 'getMediaDevices',
    value: function getMediaDevices() {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices : navigator.mozGetUserMedia || navigator.webkitGetUserMedia ? {
        getUserMedia: function getUserMedia(opts) {
          return new Promise(function (resolve, reject) {
            (navigator.mozGetUserMedia || navigator.webkitGetUserMedia).call(navigator, opts, resolve, reject);
          });
        }
      } : null;
    }
  }, {
    key: 'getUserMedia',
    value: function getUserMedia(mediaDevices) {
      var userMedia = true;
      // Older versions of firefox (< 21) apparently claim support but user media does not actually work
      if (navigator.userAgent.match(/Firefox\D+(\d+)/)) {
        if (parseInt(RegExp.$1, 10) < 21) {
          return null;
        }
      }

      window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
      return userMedia && !!mediaDevices && !!window.URL;
    }
  }, {
    key: 'start',
    value: function start() {
      var _this2 = this;

      this.userMedia = this._userMedia === undefined ? this.userMedia : this._userMedia;
      return new Promise(function (resolve, reject) {
        if (_this2.userMedia) {
          // ask user for access to their camera
          _this2.mediaDevices.getUserMedia({
            audio: false,
            video: true
          }).then(function (stream) {
            return resolve(stream);
          }).catch(function (err) {
            return reject(err);
          });
        }
      });
    }

    /**
     * Detects if browser supports flash
     * Code snippet borrowed from: https://github.com/swfobject/swfobject
     *
     * @return {bool} flash supported
     */

  }, {
    key: 'detectFlash',
    value: function detectFlash() {
      var SHOCKWAVE_FLASH = 'Shockwave Flash';
      var SHOCKWAVE_FLASH_AX = 'ShockwaveFlash.ShockwaveFlash';
      var FLASH_MIME_TYPE = 'application/x-shockwave-flash';
      var win = window;
      var nav = navigator;
      var hasFlash = false;

      if (typeof nav.plugins !== 'undefined' && _typeof(nav.plugins[SHOCKWAVE_FLASH]) === 'object') {
        var desc = nav.plugins[SHOCKWAVE_FLASH].description;
        if (desc && typeof nav.mimeTypes !== 'undefined' && nav.mimeTypes[FLASH_MIME_TYPE] && nav.mimeTypes[FLASH_MIME_TYPE].enabledPlugin) {
          hasFlash = true;
        }
      } else if (typeof win.ActiveXObject !== 'undefined') {
        try {
          var ax = new win.ActiveXObject(SHOCKWAVE_FLASH_AX);
          if (ax) {
            var ver = ax.GetVariable('$version');
            if (ver) hasFlash = true;
          }
        } catch (e) {}
      }

      return hasFlash;
    }
  }, {
    key: 'reset',
    value: function reset() {
      // shutdown camera, reset to potentially attach again
      if (this.preview_active) this.unfreeze();

      if (this.userMedia) {
        if (this.stream) {
          if (this.stream.getVideoTracks) {
            // get video track to call stop on it
            var tracks = this.stream.getVideoTracks();
            if (tracks && tracks[0] && tracks[0].stop) tracks[0].stop();
          } else if (this.stream.stop) {
            // deprecated, may be removed in future
            this.stream.stop();
          }
        }
        delete this.stream;
        delete this.video;
      }

      if (this.userMedia !== true) {
        // call for turn off camera in flash
        this.getMovie()._releaseCamera();
      }
    }
  }, {
    key: 'getSWFHTML',
    value: function getSWFHTML() {
      // Return HTML for embedding flash based webcam capture movie
      var swfURL = this.params.swfURL;

      // make sure we aren't running locally (flash doesn't work)
      if (location.protocol.match(/file/)) {
        return '<h3 style="color:red">ERROR: the Webcam.js Flash fallback does not work from local disk.  Please run it from a web server.</h3>';
      }

      // make sure we have flash
      if (!this.detectFlash()) {
        return '<h3 style="color:red">No flash</h3>';
      }

      // set default swfURL if not explicitly set
      if (!swfURL) {
        // find our script tag, and use that base URL
        var base_url = '';
        var scpts = document.getElementsByTagName('script');
        for (var idx = 0, len = scpts.length; idx < len; idx++) {
          var src = scpts[idx].getAttribute('src');
          if (src && src.match(/\/webcam(\.min)?\.js/)) {
            base_url = src.replace(/\/webcam(\.min)?\.js.*$/, '');
            idx = len;
          }
        }
        if (base_url) swfURL = base_url + '/webcam.swf';else swfURL = 'webcam.swf';
      }

      // // if this is the user's first visit, set flashvar so flash privacy settings panel is shown first
      // if (window.localStorage && !localStorage.getItem('visited')) {
      //   // this.params.new_user = 1
      //   localStorage.setItem('visited', 1)
      // }
      // this.params.new_user = 1
      // construct flashvars string
      var flashvars = '';
      for (var key in this.params) {
        if (flashvars) flashvars += '&';
        flashvars += key + '=' + escape(this.params[key]);
      }

      // construct object/embed tag

      return '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" type="application/x-shockwave-flash" codebase="' + this.protocol + '://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,0,0" width="' + this.params.width + '" height="' + this.params.height + '" id="webcam_movie_obj" align="middle"><param name="wmode" value="opaque" /><param name="allowScriptAccess" value="always" /><param name="allowFullScreen" value="false" /><param name="movie" value="' + swfURL + '" /><param name="loop" value="false" /><param name="menu" value="false" /><param name="quality" value="best" /><param name="bgcolor" value="#ffffff" /><param name="flashvars" value="' + flashvars + '"/><embed id="webcam_movie_embed" src="' + swfURL + '" wmode="opaque" loop="false" menu="false" quality="best" bgcolor="#ffffff" width="' + this.params.width + '" height="' + this.params.height + '" name="webcam_movie_embed" align="middle" allowScriptAccess="always" allowFullScreen="false" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer" flashvars="' + flashvars + '"></embed></object>';
    }
  }, {
    key: 'getMovie',
    value: function getMovie() {
      // get reference to movie object/embed in DOM
      var movie = document.getElementById('webcam_movie_obj');
      if (!movie || !movie._snap) movie = document.getElementById('webcam_movie_embed');
      if (!movie) console.log('getMovie error');
      return movie;
    }

    /**
     * Stops the webcam capture and video playback.
     */

  }, {
    key: 'stop',
    value: function stop() {
      var video = this.video;
      var videoStream = this.videoStream;


      this.updateState({
        cameraReady: false
      });

      if (videoStream) {
        if (videoStream.stop) {
          videoStream.stop();
        } else if (videoStream.msStop) {
          videoStream.msStop();
        }

        videoStream.onended = null;
        videoStream = null;
      }

      if (video) {
        video.onerror = null;
        video.pause();

        if (video.mozSrcObject) {
          video.mozSrcObject = null;
        }

        video.src = '';
      }

      this.video = document.querySelector('.UppyWebcam-video');
      this.canvas = document.querySelector('.UppyWebcam-canvas');
    }
  }, {
    key: 'flashNotify',
    value: function flashNotify(type, msg) {
      // receive notification from flash about event
      switch (type) {
        case 'flashLoadComplete':
          // movie loaded successfully
          break;

        case 'cameraLive':
          // camera is live and ready to snap
          this.live = true;
          break;

        case 'error':
          // Flash error
          console.log('There was a flash error', msg);
          break;

        default:
          // catch-all event, just in case
          console.log('webcam flash_notify: ' + type + ': ' + msg);
          break;
      }
    }
  }, {
    key: 'configure',
    value: function configure(panel) {
      // open flash configuration panel -- specify tab name:
      // 'camera', 'privacy', 'default', 'localStorage', 'microphone', 'settingsManager'
      if (!panel) panel = 'camera';
      this.getMovie()._configure(panel);
    }

    /**
     * Takes a snapshot and displays it in a canvas.
     */

  }, {
    key: 'getImage',
    value: function getImage(video, opts) {
      var canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      var dataUrl = canvas.toDataURL(opts.mimeType);

      var file = dataURItoFile(dataUrl, {
        name: opts.name
      });

      return {
        dataUrl: dataUrl,
        data: file,
        type: opts.mimeType
      };
    }
  }, {
    key: 'takeSnapshot',
    value: function takeSnapshot(video, canvas) {
      var opts = {
        name: 'webcam-' + Date.now() + '.jpg',
        mimeType: 'image/jpeg'
      };

      var image = this.getImage(video, canvas, opts);

      var tagFile = {
        source: this.id,
        name: opts.name,
        data: image.data,
        type: opts.type
      };

      return tagFile;
    }
  }]);

  return Webcam;
}();

},{"../utils/dataURItoFile":71}],71:[function(require,module,exports){
'use strict';

function dataURItoBlob(dataURI, opts, toFile) {
  // get the base64 data
  var data = dataURI.split(',')[1];

  // user may provide mime type, if not get it from data URI
  var mimeType = opts.mimeType || dataURI.split(',')[0].split(':')[1].split(';')[0];

  // default to plain/text if data URI has no mimeType
  if (mimeType == null) {
    mimeType = 'plain/text';
  }

  var binary = atob(data);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }

  // Convert to a File?
  if (toFile) {
    return new File([new Uint8Array(array)], opts.name || '', { type: mimeType });
  }

  return new Blob([new Uint8Array(array)], { type: mimeType });
}

module.exports = function (dataURI, opts) {
  return dataURItoBlob(dataURI, opts, true);
};

},{}],72:[function(require,module,exports){

},{}],73:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],74:[function(require,module,exports){
'use strict';

var Uppy = require('../../../../src/core');
var Dashboard = require('../../../../src/plugins/Dashboard');
var GoogleDrive = require('../../../../src/plugins/GoogleDrive');
var Dropbox = require('../../../../src/plugins/Dropbox');
var Webcam = require('../../../../src/plugins/Webcam');
var Tus10 = require('../../../../src/plugins/Tus10');
var MetaData = require('../../../../src/plugins/MetaData');
var Informer = require('../../../../src/plugins/Informer');

var UPPY_SERVER = require('../env');

var PROTOCOL = location.protocol === 'https:' ? 'https' : 'http';
var TUS_ENDPOINT = PROTOCOL + '://master.tus.io/files/';

function uppyInit() {
  var opts = window.uppyOptions;
  var dashboardEl = document.querySelector('.UppyDashboard');
  if (dashboardEl) {
    var dashboardElParent = dashboardEl.parentNode;
    dashboardElParent.removeChild(dashboardEl);
  }

  var uppy = Uppy({ debug: true, autoProceed: opts.autoProceed });
  uppy.use(Dashboard, {
    trigger: '.UppyModalOpenerBtn',
    inline: opts.DashboardInline,
    target: opts.DashboardInline ? '.DashboardContainer' : 'body'
  });

  if (opts.GoogleDrive) {
    uppy.use(GoogleDrive, { target: Dashboard, host: UPPY_SERVER });
  }

  if (opts.Dropbox) {
    uppy.use(Dropbox, { target: Dashboard, host: UPPY_SERVER });
  }

  if (opts.Webcam) {
    uppy.use(Webcam, { target: Dashboard });
  }

  uppy.use(Tus10, { endpoint: TUS_ENDPOINT, resume: true });
  uppy.use(Informer, { target: Dashboard });
  uppy.use(MetaData, {
    fields: [{ id: 'resizeTo', name: 'Resize to', value: 1200, placeholder: 'specify future image size' }, { id: 'description', name: 'Description', value: 'none', placeholder: 'describe what the file is for' }]
  });
  uppy.run();

  uppy.on('core:success', function (fileCount) {
    console.log('Yo, uploaded: ' + fileCount);
  });
}

uppyInit();
window.uppyInit = uppyInit;

},{"../../../../src/core":36,"../../../../src/plugins/Dashboard":56,"../../../../src/plugins/Dropbox":58,"../../../../src/plugins/GoogleDrive":59,"../../../../src/plugins/Informer":60,"../../../../src/plugins/MetaData":61,"../../../../src/plugins/Tus10":63,"../../../../src/plugins/Webcam":68,"../env":75}],75:[function(require,module,exports){
'use strict';

var uppyServerEndpoint = 'http://localhost:3020';

if (location.hostname === 'uppy.io') {
  uppyServerEndpoint = '//server.uppy.io';
}

var UPPY_SERVER = uppyServerEndpoint;
module.exports = UPPY_SERVER;

},{}]},{},[74])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9ub2RlX21vZHVsZXMvZHJhZy1kcm9wL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RyYWctZHJvcC9ub2RlX21vZHVsZXMvZmxhdHRlbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kcmFnLWRyb3Avbm9kZV9tb2R1bGVzL3J1bi1wYXJhbGxlbC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2VzNi1wcm9taXNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL25hbWVzcGFjZS1lbWl0dGVyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZXR0eS1ieXRlcy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmV0dHktYnl0ZXMvbm9kZV9tb2R1bGVzL251bWJlci1pcy1uYW4vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Jyb3dzZXIvYmFzZTY0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9icm93c2VyL3JlcXVlc3QuanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Jyb3dzZXIvc291cmNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9icm93c2VyL3N0b3JhZ2UuanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Vycm9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9maW5nZXJwcmludC5qcyIsIi4uL25vZGVfbW9kdWxlcy90dXMtanMtY2xpZW50L2xpYi5lczUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L3VwbG9hZC5qcyIsIi4uL25vZGVfbW9kdWxlcy90dXMtanMtY2xpZW50L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9ub2RlX21vZHVsZXMvcmVzb2x2ZS11cmwvcmVzb2x2ZS11cmwuanMiLCIuLi9ub2RlX21vZHVsZXMvd2hhdHdnLWZldGNoL2ZldGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL2JlbC9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL2dsb2JhbC93aW5kb3cuanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL2JlbC9ub2RlX21vZHVsZXMvaHlwZXJ4L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL2h5cGVyeC9ub2RlX21vZHVsZXMvaHlwZXJzY3JpcHQtYXR0cmlidXRlLXRvLXByb3BlcnR5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL29uLWxvYWQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL21vcnBoZG9tL3NyYy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy95by15by91cGRhdGUtZXZlbnRzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcyIsIi4uL25vZGVfbW9kdWxlcy95by15b2lmeS9ub2RlX21vZHVsZXMvb24tbG9hZC9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L25vZGVfbW9kdWxlcy9vbi1sb2FkL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwiLi4vc3JjL2NvcmUvQ29yZS5qcyIsIi4uL3NyYy9jb3JlL1RyYW5zbGF0b3IuanMiLCIuLi9zcmMvY29yZS9VcHB5U29ja2V0LmpzIiwiLi4vc3JjL2NvcmUvVXRpbHMuanMiLCIuLi9zcmMvY29yZS9pbmRleC5qcyIsIi4uL3NyYy9nZW5lcmljLXByb3ZpZGVyLXZpZXdzL0F1dGhWaWV3LmpzIiwiLi4vc3JjL2dlbmVyaWMtcHJvdmlkZXItdmlld3MvRXJyb3IuanMiLCIuLi9zcmMvZ2VuZXJpYy1wcm92aWRlci12aWV3cy9pbmRleC5qcyIsIi4uL3NyYy9nZW5lcmljLXByb3ZpZGVyLXZpZXdzL25ldy9CcmVhZGNydW1iLmpzIiwiLi4vc3JjL2dlbmVyaWMtcHJvdmlkZXItdmlld3MvbmV3L0JyZWFkY3J1bWJzLmpzIiwiLi4vc3JjL2dlbmVyaWMtcHJvdmlkZXItdmlld3MvbmV3L0Jyb3dzZXIuanMiLCIuLi9zcmMvZ2VuZXJpYy1wcm92aWRlci12aWV3cy9uZXcvVGFibGUuanMiLCIuLi9zcmMvZ2VuZXJpYy1wcm92aWRlci12aWV3cy9uZXcvVGFibGVDb2x1bW4uanMiLCIuLi9zcmMvZ2VuZXJpYy1wcm92aWRlci12aWV3cy9uZXcvVGFibGVSb3cuanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvQWN0aW9uQnJvd3NlVGFnbGluZS5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9EYXNoYm9hcmQuanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvRmlsZUNhcmQuanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvRmlsZUl0ZW0uanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvRmlsZUl0ZW1Qcm9ncmVzcy5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9GaWxlTGlzdC5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9TdGF0dXNCYXIuanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvVGFicy5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9VcGxvYWRCdG4uanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvaWNvbnMuanMiLCIuLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQvaW5kZXguanMiLCIuLi9zcmMvcGx1Z2lucy9Ecm9wYm94L2ljb25zLmpzIiwiLi4vc3JjL3BsdWdpbnMvRHJvcGJveC9pbmRleC5qcyIsIi4uL3NyYy9wbHVnaW5zL0dvb2dsZURyaXZlL2luZGV4LmpzIiwiLi4vc3JjL3BsdWdpbnMvSW5mb3JtZXIuanMiLCIuLi9zcmMvcGx1Z2lucy9NZXRhRGF0YS5qcyIsIi4uL3NyYy9wbHVnaW5zL1BsdWdpbi5qcyIsIi4uL3NyYy9wbHVnaW5zL1R1czEwLmpzIiwiLi4vc3JjL3BsdWdpbnMvV2ViY2FtL0NhbWVyYUljb24uanMiLCIuLi9zcmMvcGx1Z2lucy9XZWJjYW0vQ2FtZXJhU2NyZWVuLmpzIiwiLi4vc3JjL3BsdWdpbnMvV2ViY2FtL1Blcm1pc3Npb25zU2NyZWVuLmpzIiwiLi4vc3JjL3BsdWdpbnMvV2ViY2FtL1dlYmNhbUljb24uanMiLCIuLi9zcmMvcGx1Z2lucy9XZWJjYW0vaW5kZXguanMiLCIuLi9zcmMvdXBweS1iYXNlL3NyYy9wbHVnaW5zL1Byb3ZpZGVyLmpzIiwiLi4vc3JjL3VwcHktYmFzZS9zcmMvcGx1Z2lucy9XZWJjYW0uanMiLCIuLi9zcmMvdXBweS1iYXNlL3NyYy91dGlscy9kYXRhVVJJdG9GaWxlLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJzcmMvZXhhbXBsZXMvZGFzaGJvYXJkL2FwcC5lczYiLCJzcmMvZXhhbXBsZXMvZW52LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy83QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM29CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcExBLElBQU0sT0FBTyxRQUFRLHNCQUFSLENBQWI7QUFDQSxJQUFNLFlBQVksUUFBUSxtQ0FBUixDQUFsQjtBQUNBLElBQU0sY0FBYyxRQUFRLHFDQUFSLENBQXBCO0FBQ0EsSUFBTSxVQUFVLFFBQVEsaUNBQVIsQ0FBaEI7QUFDQSxJQUFNLFNBQVMsUUFBUSxnQ0FBUixDQUFmO0FBQ0EsSUFBTSxRQUFRLFFBQVEsK0JBQVIsQ0FBZDtBQUNBLElBQU0sV0FBVyxRQUFRLGtDQUFSLENBQWpCO0FBQ0EsSUFBTSxXQUFXLFFBQVEsa0NBQVIsQ0FBakI7O0FBRUEsSUFBTSxjQUFjLFFBQVEsUUFBUixDQUFwQjs7QUFFQSxJQUFNLFdBQVcsU0FBUyxRQUFULEtBQXNCLFFBQXRCLEdBQWlDLE9BQWpDLEdBQTJDLE1BQTVEO0FBQ0EsSUFBTSxlQUFlLFdBQVcseUJBQWhDOztBQUVBLFNBQVMsUUFBVCxHQUFxQjtBQUNuQixNQUFNLE9BQU8sT0FBTyxXQUFwQjtBQUNBLE1BQU0sY0FBYyxTQUFTLGFBQVQsQ0FBdUIsZ0JBQXZCLENBQXBCO0FBQ0EsTUFBSSxXQUFKLEVBQWlCO0FBQ2YsUUFBTSxvQkFBb0IsWUFBWSxVQUF0QztBQUNBLHNCQUFrQixXQUFsQixDQUE4QixXQUE5QjtBQUNEOztBQUVELE1BQU0sT0FBTyxLQUFLLEVBQUMsT0FBTyxJQUFSLEVBQWMsYUFBYSxLQUFLLFdBQWhDLEVBQUwsQ0FBYjtBQUNBLE9BQUssR0FBTCxDQUFTLFNBQVQsRUFBb0I7QUFDbEIsYUFBUyxxQkFEUztBQUVsQixZQUFRLEtBQUssZUFGSztBQUdsQixZQUFRLEtBQUssZUFBTCxHQUF1QixxQkFBdkIsR0FBK0M7QUFIckMsR0FBcEI7O0FBTUEsTUFBSSxLQUFLLFdBQVQsRUFBc0I7QUFDcEIsU0FBSyxHQUFMLENBQVMsV0FBVCxFQUFzQixFQUFDLFFBQVEsU0FBVCxFQUFvQixNQUFNLFdBQTFCLEVBQXRCO0FBQ0Q7O0FBRUQsTUFBSSxLQUFLLE9BQVQsRUFBa0I7QUFDaEIsU0FBSyxHQUFMLENBQVMsT0FBVCxFQUFrQixFQUFDLFFBQVEsU0FBVCxFQUFvQixNQUFNLFdBQTFCLEVBQWxCO0FBQ0Q7O0FBRUQsTUFBSSxLQUFLLE1BQVQsRUFBaUI7QUFDZixTQUFLLEdBQUwsQ0FBUyxNQUFULEVBQWlCLEVBQUMsUUFBUSxTQUFULEVBQWpCO0FBQ0Q7O0FBRUQsT0FBSyxHQUFMLENBQVMsS0FBVCxFQUFnQixFQUFDLFVBQVUsWUFBWCxFQUF5QixRQUFRLElBQWpDLEVBQWhCO0FBQ0EsT0FBSyxHQUFMLENBQVMsUUFBVCxFQUFtQixFQUFDLFFBQVEsU0FBVCxFQUFuQjtBQUNBLE9BQUssR0FBTCxDQUFTLFFBQVQsRUFBbUI7QUFDakIsWUFBUSxDQUNOLEVBQUUsSUFBSSxVQUFOLEVBQWtCLE1BQU0sV0FBeEIsRUFBcUMsT0FBTyxJQUE1QyxFQUFrRCxhQUFhLDJCQUEvRCxFQURNLEVBRU4sRUFBRSxJQUFJLGFBQU4sRUFBcUIsTUFBTSxhQUEzQixFQUEwQyxPQUFPLE1BQWpELEVBQXlELGFBQWEsK0JBQXRFLEVBRk07QUFEUyxHQUFuQjtBQU1BLE9BQUssR0FBTDs7QUFFQSxPQUFLLEVBQUwsQ0FBUSxjQUFSLEVBQXdCLFVBQUMsU0FBRCxFQUFlO0FBQ3JDLFlBQVEsR0FBUixDQUFZLG1CQUFtQixTQUEvQjtBQUNELEdBRkQ7QUFHRDs7QUFFRDtBQUNBLE9BQU8sUUFBUCxHQUFrQixRQUFsQjs7Ozs7QUN6REEsSUFBSSxxQkFBcUIsdUJBQXpCOztBQUVBLElBQUksU0FBUyxRQUFULEtBQXNCLFNBQTFCLEVBQXFDO0FBQ25DLHVCQUFxQixrQkFBckI7QUFDRDs7QUFFRCxJQUFNLGNBQWMsa0JBQXBCO0FBQ0EsT0FBTyxPQUFQLEdBQWlCLFdBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZHJhZ0Ryb3BcblxudmFyIGZsYXR0ZW4gPSByZXF1aXJlKCdmbGF0dGVuJylcbnZhciBwYXJhbGxlbCA9IHJlcXVpcmUoJ3J1bi1wYXJhbGxlbCcpXG5cbmZ1bmN0aW9uIGRyYWdEcm9wIChlbGVtLCBsaXN0ZW5lcnMpIHtcbiAgaWYgKHR5cGVvZiBlbGVtID09PSAnc3RyaW5nJykge1xuICAgIGVsZW0gPSB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbGVtKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBsaXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBsaXN0ZW5lcnMgPSB7IG9uRHJvcDogbGlzdGVuZXJzIH1cbiAgfVxuXG4gIHZhciB0aW1lb3V0XG5cbiAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCBzdG9wRXZlbnQsIGZhbHNlKVxuICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25EcmFnT3ZlciwgZmFsc2UpXG4gIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgb25EcmFnTGVhdmUsIGZhbHNlKVxuICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBvbkRyb3AsIGZhbHNlKVxuXG4gIC8vIEZ1bmN0aW9uIHRvIHJlbW92ZSBkcmFnLWRyb3AgbGlzdGVuZXJzXG4gIHJldHVybiBmdW5jdGlvbiByZW1vdmUgKCkge1xuICAgIHJlbW92ZURyYWdDbGFzcygpXG4gICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCBzdG9wRXZlbnQsIGZhbHNlKVxuICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBvbkRyYWdPdmVyLCBmYWxzZSlcbiAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIG9uRHJhZ0xlYXZlLCBmYWxzZSlcbiAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBvbkRyb3AsIGZhbHNlKVxuICB9XG5cbiAgZnVuY3Rpb24gb25EcmFnT3ZlciAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBpZiAoZS5kYXRhVHJhbnNmZXIuaXRlbXMpIHtcbiAgICAgIC8vIE9ubHkgYWRkIFwiZHJhZ1wiIGNsYXNzIHdoZW4gYGl0ZW1zYCBjb250YWlucyBhIGZpbGVcbiAgICAgIHZhciBpdGVtcyA9IHRvQXJyYXkoZS5kYXRhVHJhbnNmZXIuaXRlbXMpLmZpbHRlcihmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5raW5kID09PSAnZmlsZSdcbiAgICAgIH0pXG4gICAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgICB9XG5cbiAgICBlbGVtLmNsYXNzTGlzdC5hZGQoJ2RyYWcnKVxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KVxuXG4gICAgaWYgKGxpc3RlbmVycy5vbkRyYWdPdmVyKSB7XG4gICAgICBsaXN0ZW5lcnMub25EcmFnT3ZlcihlKVxuICAgIH1cblxuICAgIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSdcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uRHJhZ0xlYXZlIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgaWYgKGxpc3RlbmVycy5vbkRyYWdMZWF2ZSkge1xuICAgICAgbGlzdGVuZXJzLm9uRHJhZ0xlYXZlKGUpXG4gICAgfVxuXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpXG4gICAgdGltZW91dCA9IHNldFRpbWVvdXQocmVtb3ZlRHJhZ0NsYXNzLCA1MClcblxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgZnVuY3Rpb24gb25Ecm9wIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgaWYgKGxpc3RlbmVycy5vbkRyYWdMZWF2ZSkge1xuICAgICAgbGlzdGVuZXJzLm9uRHJhZ0xlYXZlKGUpXG4gICAgfVxuXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpXG4gICAgcmVtb3ZlRHJhZ0NsYXNzKClcblxuICAgIHZhciBwb3MgPSB7XG4gICAgICB4OiBlLmNsaWVudFgsXG4gICAgICB5OiBlLmNsaWVudFlcbiAgICB9XG5cbiAgICBpZiAoZS5kYXRhVHJhbnNmZXIuaXRlbXMpIHtcbiAgICAgIC8vIEhhbmRsZSBkaXJlY3RvcmllcyBpbiBDaHJvbWUgdXNpbmcgdGhlIHByb3ByaWV0YXJ5IEZpbGVTeXN0ZW0gQVBJXG4gICAgICB2YXIgaXRlbXMgPSB0b0FycmF5KGUuZGF0YVRyYW5zZmVyLml0ZW1zKS5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0ua2luZCA9PT0gJ2ZpbGUnXG4gICAgICB9KVxuXG4gICAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAgICAgcGFyYWxsZWwoaXRlbXMubWFwKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICBwcm9jZXNzRW50cnkoaXRlbS53ZWJraXRHZXRBc0VudHJ5KCksIGNiKVxuICAgICAgICB9XG4gICAgICB9KSwgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAvLyBUaGlzIGNhdGNoZXMgcGVybWlzc2lvbiBlcnJvcnMgd2l0aCBmaWxlOi8vIGluIENocm9tZS4gVGhpcyBzaG91bGQgbmV2ZXJcbiAgICAgICAgLy8gdGhyb3cgaW4gcHJvZHVjdGlvbiBjb2RlLCBzbyB0aGUgdXNlciBkb2VzIG5vdCBuZWVkIHRvIHVzZSB0cnktY2F0Y2guXG4gICAgICAgIGlmIChlcnIpIHRocm93IGVyclxuICAgICAgICBpZiAobGlzdGVuZXJzLm9uRHJvcCkge1xuICAgICAgICAgIGxpc3RlbmVycy5vbkRyb3AoZmxhdHRlbihyZXN1bHRzKSwgcG9zKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZmlsZXMgPSB0b0FycmF5KGUuZGF0YVRyYW5zZmVyLmZpbGVzKVxuXG4gICAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAgICAgZmlsZXMuZm9yRWFjaChmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgICBmaWxlLmZ1bGxQYXRoID0gJy8nICsgZmlsZS5uYW1lXG4gICAgICB9KVxuXG4gICAgICBpZiAobGlzdGVuZXJzLm9uRHJvcCkge1xuICAgICAgICBsaXN0ZW5lcnMub25Ecm9wKGZpbGVzLCBwb3MpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVEcmFnQ2xhc3MgKCkge1xuICAgIGVsZW0uY2xhc3NMaXN0LnJlbW92ZSgnZHJhZycpXG4gIH1cbn1cblxuZnVuY3Rpb24gc3RvcEV2ZW50IChlKSB7XG4gIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIHJldHVybiBmYWxzZVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzRW50cnkgKGVudHJ5LCBjYikge1xuICB2YXIgZW50cmllcyA9IFtdXG5cbiAgaWYgKGVudHJ5LmlzRmlsZSkge1xuICAgIGVudHJ5LmZpbGUoZnVuY3Rpb24gKGZpbGUpIHtcbiAgICAgIGZpbGUuZnVsbFBhdGggPSBlbnRyeS5mdWxsUGF0aCAgLy8gcHJlc2VydmUgcGF0aGluZyBmb3IgY29uc3VtZXJcbiAgICAgIGNiKG51bGwsIGZpbGUpXG4gICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgY2IoZXJyKVxuICAgIH0pXG4gIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkpIHtcbiAgICB2YXIgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKClcbiAgICByZWFkRW50cmllcygpXG4gIH1cblxuICBmdW5jdGlvbiByZWFkRW50cmllcyAoKSB7XG4gICAgcmVhZGVyLnJlYWRFbnRyaWVzKGZ1bmN0aW9uIChlbnRyaWVzXykge1xuICAgICAgaWYgKGVudHJpZXNfLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZW50cmllcyA9IGVudHJpZXMuY29uY2F0KHRvQXJyYXkoZW50cmllc18pKVxuICAgICAgICByZWFkRW50cmllcygpIC8vIGNvbnRpbnVlIHJlYWRpbmcgZW50cmllcyB1bnRpbCBgcmVhZEVudHJpZXNgIHJldHVybnMgbm8gbW9yZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9uZUVudHJpZXMoKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBkb25lRW50cmllcyAoKSB7XG4gICAgcGFyYWxsZWwoZW50cmllcy5tYXAoZnVuY3Rpb24gKGVudHJ5KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHByb2Nlc3NFbnRyeShlbnRyeSwgY2IpXG4gICAgICB9XG4gICAgfSksIGNiKVxuICB9XG59XG5cbmZ1bmN0aW9uIHRvQXJyYXkgKGxpc3QpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGxpc3QgfHwgW10sIDApXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGZsYXR0ZW4obGlzdCwgZGVwdGgpIHtcbiAgZGVwdGggPSAodHlwZW9mIGRlcHRoID09ICdudW1iZXInKSA/IGRlcHRoIDogSW5maW5pdHk7XG5cbiAgaWYgKCFkZXB0aCkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGxpc3QpKSB7XG4gICAgICByZXR1cm4gbGlzdC5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gaTsgfSk7XG4gICAgfVxuICAgIHJldHVybiBsaXN0O1xuICB9XG5cbiAgcmV0dXJuIF9mbGF0dGVuKGxpc3QsIDEpO1xuXG4gIGZ1bmN0aW9uIF9mbGF0dGVuKGxpc3QsIGQpIHtcbiAgICByZXR1cm4gbGlzdC5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgaXRlbSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkgJiYgZCA8IGRlcHRoKSB7XG4gICAgICAgIHJldHVybiBhY2MuY29uY2F0KF9mbGF0dGVuKGl0ZW0sIGQgKyAxKSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoaXRlbSk7XG4gICAgICB9XG4gICAgfSwgW10pO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodGFza3MsIGNiKSB7XG4gIHZhciByZXN1bHRzLCBwZW5kaW5nLCBrZXlzXG4gIHZhciBpc1N5bmMgPSB0cnVlXG5cbiAgaWYgKEFycmF5LmlzQXJyYXkodGFza3MpKSB7XG4gICAgcmVzdWx0cyA9IFtdXG4gICAgcGVuZGluZyA9IHRhc2tzLmxlbmd0aFxuICB9IGVsc2Uge1xuICAgIGtleXMgPSBPYmplY3Qua2V5cyh0YXNrcylcbiAgICByZXN1bHRzID0ge31cbiAgICBwZW5kaW5nID0ga2V5cy5sZW5ndGhcbiAgfVxuXG4gIGZ1bmN0aW9uIGRvbmUgKGVycikge1xuICAgIGZ1bmN0aW9uIGVuZCAoKSB7XG4gICAgICBpZiAoY2IpIGNiKGVyciwgcmVzdWx0cylcbiAgICAgIGNiID0gbnVsbFxuICAgIH1cbiAgICBpZiAoaXNTeW5jKSBwcm9jZXNzLm5leHRUaWNrKGVuZClcbiAgICBlbHNlIGVuZCgpXG4gIH1cblxuICBmdW5jdGlvbiBlYWNoIChpLCBlcnIsIHJlc3VsdCkge1xuICAgIHJlc3VsdHNbaV0gPSByZXN1bHRcbiAgICBpZiAoLS1wZW5kaW5nID09PSAwIHx8IGVycikge1xuICAgICAgZG9uZShlcnIpXG4gICAgfVxuICB9XG5cbiAgaWYgKCFwZW5kaW5nKSB7XG4gICAgLy8gZW1wdHlcbiAgICBkb25lKG51bGwpXG4gIH0gZWxzZSBpZiAoa2V5cykge1xuICAgIC8vIG9iamVjdFxuICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICB0YXNrc1trZXldKGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkgeyBlYWNoKGtleSwgZXJyLCByZXN1bHQpIH0pXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICAvLyBhcnJheVxuICAgIHRhc2tzLmZvckVhY2goZnVuY3Rpb24gKHRhc2ssIGkpIHtcbiAgICAgIHRhc2soZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7IGVhY2goaSwgZXJyLCByZXN1bHQpIH0pXG4gICAgfSlcbiAgfVxuXG4gIGlzU3luYyA9IGZhbHNlXG59XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vamFrZWFyY2hpYmFsZC9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuICogQHZlcnNpb24gICAzLjIuMVxuICovXG5cbihmdW5jdGlvbigpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nIHx8ICh0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzTWF5YmVUaGVuYWJsZSh4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkgPSBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID0gMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbl0gPSBjYWxsYmFjaztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICsgMV0gPSBhcmc7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICs9IDI7XG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9PT0gMikge1xuICAgICAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbihsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyKHNjaGVkdWxlRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXAoYXNhcEZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGFzYXBGbjtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDogdW5kZWZpbmVkO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93IHx8IHt9O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc05vZGUgPSB0eXBlb2Ygc2VsZiA9PT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuICAgIC8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuICAgIC8vIG5vZGVcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKSB7XG4gICAgICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHZlcnR4XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gICAgICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHdlYiB3b3JrZXJcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2g7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgc2V0VGltZW91dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gsIDEpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbjsgaSs9Mikge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV07XG4gICAgICAgIHZhciBhcmcgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXTtcblxuICAgICAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgciA9IHJlcXVpcmU7XG4gICAgICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2g7XG4gICAgLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbiAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHRoZW4kJHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzO1xuXG4gICAgICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKGNoaWxkW2xpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBST01JU0VfSURdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbWFrZVByb21pc2UoY2hpbGQpO1xuICAgICAgfVxuXG4gICAgICB2YXIgc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG4gICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW3N0YXRlIC0gMV07XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcGFyZW50Ll9yZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjaGlsZDtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR0aGVuJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHRoZW4kJHRoZW47XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZShvYmplY3QpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQUk9NSVNFX0lEID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDE2KTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AoKSB7fVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgICA9IHZvaWQgMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEID0gMTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQgID0gMjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUiA9IG5ldyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc2VsZkZ1bGZpbGxtZW50KCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGNhbm5vdFJldHVybk93bigpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihwcm9taXNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUi5lcnJvciA9IGVycm9yO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcik7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuKSB7XG4gICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgICAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgICAgIHZhciBlcnJvciA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeVRoZW4odGhlbiwgdGhlbmFibGUsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGlmICh0aGVuYWJsZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGlmIChzZWFsZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICAgICAgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4pIHtcbiAgICAgIGlmIChtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yID09PSBwcm9taXNlLmNvbnN0cnVjdG9yICYmXG4gICAgICAgICAgdGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJHRoZW4kJGRlZmF1bHQgJiZcbiAgICAgICAgICBjb25zdHJ1Y3Rvci5yZXNvbHZlID09PSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0KSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoZW4gPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSk7XG4gICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbih2YWx1ZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgICAgICBwcm9taXNlLl9vbmVycm9yKHByb21pc2UuX3Jlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuXG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gsIHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykgeyByZXR1cm47IH1cbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQ7XG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSByZWFzb247XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgICAgIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgICAgIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aCArIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xuXG4gICAgICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoKHByb21pc2UpIHtcbiAgICAgIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuICAgICAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgICAgdmFyIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKSB7XG4gICAgICB0aGlzLmVycm9yID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHZhciBoYXNDYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICAgICAgdmFsdWUsIGVycm9yLCBzdWNjZWVkZWQsIGZhaWxlZDtcblxuICAgICAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgICAgIHZhbHVlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIC8vIG5vb3BcbiAgICAgIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlcihmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSl7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaWQgPSAwO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5leHRJZCgpIHtcbiAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpZCsrO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG1ha2VQcm9taXNlKHByb21pc2UpIHtcbiAgICAgIHByb21pc2VbbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUFJPTUlTRV9JRF0gPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpZCsrO1xuICAgICAgcHJvbWlzZS5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gICAgICBwcm9taXNlLl9zdWJzY3JpYmVycyA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsKGVudHJpZXMpIHtcbiAgICAgIHJldHVybiBuZXcgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQodGhpcywgZW50cmllcykucHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2UoZW50cmllcykge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIGlmICghbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRyYWNlO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0KHJlYXNvbikge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdDtcblxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZTtcbiAgICAvKipcbiAgICAgIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgICAgIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gICAgICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgICAgIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBUZXJtaW5vbG9neVxuICAgICAgLS0tLS0tLS0tLS1cblxuICAgICAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgICAgIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgICAgIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgICAgIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAgICAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAgICAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICAgICAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgICAgIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgICAgIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gICAgICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgICAgIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgICAgIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICAgICAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICAgICAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICAgICAgQmFzaWMgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgYGBganNcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgLy8gb24gZmFpbHVyZVxuICAgICAgICByZWplY3QocmVhc29uKTtcbiAgICAgIH0pO1xuXG4gICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgICAgIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICAgICAgYGBganNcbiAgICAgIFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gICAgICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICAgICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAY2xhc3MgUHJvbWlzZVxuICAgICAgQHBhcmFtIHtmdW5jdGlvbn0gcmVzb2x2ZXJcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEBjb25zdHJ1Y3RvclxuICAgICovXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UocmVzb2x2ZXIpIHtcbiAgICAgIHRoaXNbbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUFJPTUlTRV9JRF0gPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRuZXh0SWQoKTtcbiAgICAgIHRoaXMuX3Jlc3VsdCA9IHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpO1xuICAgICAgICB0aGlzIGluc3RhbmNlb2YgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UgPyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcikgOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5hbGwgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmFjZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVzb2x2ZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVqZWN0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRTY2hlZHVsZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRBc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXA7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX2FzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcDtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgICAgIGNvbnN0cnVjdG9yOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIENoYWluaW5nXG4gICAgICAtLS0tLS0tLVxuXG4gICAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICAgIH0pO1xuXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgICB9KTtcbiAgICAgIGBgYFxuICAgICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQXNzaW1pbGF0aW9uXG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciByZXN1bHQ7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIGF1dGhvciwgYm9va3M7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuXG4gICAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG5cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcblxuICAgICAgfVxuXG4gICAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRBdXRob3IoKS5cbiAgICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAgIC8vIGZvdW5kIGJvb2tzXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCB0aGVuXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgdGhlbjogbGliJGVzNiRwcm9taXNlJHRoZW4kJGRlZmF1bHQsXG5cbiAgICAvKipcbiAgICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcbiAgICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICAgICAgfVxuXG4gICAgICAvLyBzeW5jaHJvbm91c1xuICAgICAgdHJ5IHtcbiAgICAgICAgZmluZEF1dGhvcigpO1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH1cblxuICAgICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIGNhdGNoXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgICAgIHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKCF0aGlzLnByb21pc2VbbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUFJPTUlTRV9JRF0pIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbWFrZVByb21pc2UodGhpcy5wcm9taXNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShpbnB1dCkpIHtcbiAgICAgICAgdGhpcy5faW5wdXQgICAgID0gaW5wdXQ7XG4gICAgICAgIHRoaXMubGVuZ3RoICAgICA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLmxlbmd0aCB8fCAwO1xuICAgICAgICAgIHRoaXMuX2VudW1lcmF0ZSgpO1xuICAgICAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHRoaXMucHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJHZhbGlkYXRpb25FcnJvcigpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkdmFsaWRhdGlvbkVycm9yKCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBsZW5ndGggID0gdGhpcy5sZW5ndGg7XG4gICAgICB2YXIgaW5wdXQgICA9IHRoaXMuX2lucHV0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgdGhpcy5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24oZW50cnksIGkpIHtcbiAgICAgIHZhciBjID0gdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvcjtcbiAgICAgIHZhciByZXNvbHZlID0gYy5yZXNvbHZlO1xuXG4gICAgICBpZiAocmVzb2x2ZSA9PT0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdCkge1xuICAgICAgICB2YXIgdGhlbiA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGdldFRoZW4oZW50cnkpO1xuXG4gICAgICAgIGlmICh0aGVuID09PSBsaWIkZXM2JHByb21pc2UkdGhlbiQkZGVmYXVsdCAmJlxuICAgICAgICAgICAgZW50cnkuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgICAgdGhpcy5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoZW4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aGlzLl9yZW1haW5pbmctLTtcbiAgICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICAgICAgfSBlbHNlIGlmIChjID09PSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCkge1xuICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IGMobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBlbnRyeSwgdGhlbik7XG4gICAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHByb21pc2UsIGkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChuZXcgYyhmdW5jdGlvbihyZXNvbHZlKSB7IHJlc29sdmUoZW50cnkpOyB9KSwgaSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChyZXNvbHZlKGVudHJ5KSwgaSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24oc3RhdGUsIGksIHZhbHVlKSB7XG4gICAgICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uKHByb21pc2UsIGkpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbCgpIHtcbiAgICAgIHZhciBsb2NhbDtcblxuICAgICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBnbG9iYWw7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gc2VsZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuICAgICAgaWYgKFAgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKSA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsb2NhbC5Qcm9taXNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQ7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2UgPSB7XG4gICAgICAnUHJvbWlzZSc6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0LFxuICAgICAgJ3BvbHlmaWxsJzogbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0XG4gICAgfTtcblxuICAgIC8qIGdsb2JhbCBkZWZpbmU6dHJ1ZSBtb2R1bGU6dHJ1ZSB3aW5kb3c6IHRydWUgKi9cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmVbJ2FtZCddKSB7XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlOyB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZVsnZXhwb3J0cyddKSB7XG4gICAgICBtb2R1bGVbJ2V4cG9ydHMnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXNbJ0VTNlByb21pc2UnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0KCk7XG59KS5jYWxsKHRoaXMpO1xuXG4iLCIvKipcbiogQ3JlYXRlIGFuIGV2ZW50IGVtaXR0ZXIgd2l0aCBuYW1lc3BhY2VzXG4qIEBuYW1lIGNyZWF0ZU5hbWVzcGFjZUVtaXR0ZXJcbiogQGV4YW1wbGVcbiogdmFyIGVtaXR0ZXIgPSByZXF1aXJlKCcuL2luZGV4JykoKVxuKlxuKiBlbWl0dGVyLm9uKCcqJywgZnVuY3Rpb24gKCkge1xuKiAgIGNvbnNvbGUubG9nKCdhbGwgZXZlbnRzIGVtaXR0ZWQnLCB0aGlzLmV2ZW50KVxuKiB9KVxuKlxuKiBlbWl0dGVyLm9uKCdleGFtcGxlJywgZnVuY3Rpb24gKCkge1xuKiAgIGNvbnNvbGUubG9nKCdleGFtcGxlIGV2ZW50IGVtaXR0ZWQnKVxuKiB9KVxuKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlTmFtZXNwYWNlRW1pdHRlciAoKSB7XG4gIHZhciBlbWl0dGVyID0geyBfZm5zOiB7fSB9XG5cbiAgLyoqXG4gICogRW1pdCBhbiBldmVudC4gT3B0aW9uYWxseSBuYW1lc3BhY2UgdGhlIGV2ZW50LiBTZXBhcmF0ZSB0aGUgbmFtZXNwYWNlIGFuZCBldmVudCB3aXRoIGEgYDpgXG4gICogQG5hbWUgZW1pdFxuICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCDigJMgdGhlIG5hbWUgb2YgdGhlIGV2ZW50LCB3aXRoIG9wdGlvbmFsIG5hbWVzcGFjZVxuICAqIEBwYXJhbSB7Li4uKn0gZGF0YSDigJMgZGF0YSB2YXJpYWJsZXMgdGhhdCB3aWxsIGJlIHBhc3NlZCBhcyBhcmd1bWVudHMgdG8gdGhlIGV2ZW50IGxpc3RlbmVyXG4gICogQGV4YW1wbGVcbiAgKiBlbWl0dGVyLmVtaXQoJ2V4YW1wbGUnKVxuICAqIGVtaXR0ZXIuZW1pdCgnZGVtbzp0ZXN0JylcbiAgKiBlbWl0dGVyLmVtaXQoJ2RhdGEnLCB7IGV4YW1wbGU6IHRydWV9LCAnYSBzdHJpbmcnLCAxKVxuICAqL1xuICBlbWl0dGVyLmVtaXQgPSBmdW5jdGlvbiBlbWl0IChldmVudCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgdmFyIG5hbWVzcGFjZWQgPSBuYW1lc3BhY2VzKGV2ZW50KVxuICAgIGlmICh0aGlzLl9mbnNbZXZlbnRdKSBlbWl0QWxsKGV2ZW50LCB0aGlzLl9mbnNbZXZlbnRdLCBhcmdzKVxuICAgIGlmIChuYW1lc3BhY2VkKSBlbWl0QWxsKGV2ZW50LCBuYW1lc3BhY2VkLCBhcmdzKVxuICB9XG5cbiAgLyoqXG4gICogQ3JlYXRlIGVuIGV2ZW50IGxpc3RlbmVyLlxuICAqIEBuYW1lIG9uXG4gICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgKiBAZXhhbXBsZVxuICAqIGVtaXR0ZXIub24oJ2V4YW1wbGUnLCBmdW5jdGlvbiAoKSB7fSlcbiAgKiBlbWl0dGVyLm9uKCdkZW1vJywgZnVuY3Rpb24gKCkge30pXG4gICovXG4gIGVtaXR0ZXIub24gPSBmdW5jdGlvbiBvbiAoZXZlbnQsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykgeyB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxiYWNrIHJlcXVpcmVkJykgfVxuICAgICh0aGlzLl9mbnNbZXZlbnRdID0gdGhpcy5fZm5zW2V2ZW50XSB8fCBbXSkucHVzaChmbilcbiAgfVxuXG4gIC8qKlxuICAqIENyZWF0ZSBlbiBldmVudCBsaXN0ZW5lciB0aGF0IGZpcmVzIG9uY2UuXG4gICogQG5hbWUgb25jZVxuICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICogQGV4YW1wbGVcbiAgKiBlbWl0dGVyLm9uY2UoJ2V4YW1wbGUnLCBmdW5jdGlvbiAoKSB7fSlcbiAgKiBlbWl0dGVyLm9uY2UoJ2RlbW8nLCBmdW5jdGlvbiAoKSB7fSlcbiAgKi9cbiAgZW1pdHRlci5vbmNlID0gZnVuY3Rpb24gb25jZSAoZXZlbnQsIGZuKSB7XG4gICAgZnVuY3Rpb24gb25lICgpIHtcbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICAgIGVtaXR0ZXIub2ZmKGV2ZW50LCBvbmUpXG4gICAgfVxuICAgIHRoaXMub24oZXZlbnQsIG9uZSlcbiAgfVxuXG4gIC8qKlxuICAqIFN0b3AgbGlzdGVuaW5nIHRvIGFuIGV2ZW50LiBTdG9wIGFsbCBsaXN0ZW5lcnMgb24gYW4gZXZlbnQgYnkgb25seSBwYXNzaW5nIHRoZSBldmVudCBuYW1lLiBTdG9wIGEgc2luZ2xlIGxpc3RlbmVyIGJ5IHBhc3NpbmcgdGhhdCBldmVudCBoYW5kbGVyIGFzIGEgY2FsbGJhY2suXG4gICogWW91IG11c3QgYmUgZXhwbGljaXQgYWJvdXQgd2hhdCB3aWxsIGJlIHVuc3Vic2NyaWJlZDogYGVtaXR0ZXIub2ZmKCdkZW1vJylgIHdpbGwgdW5zdWJzY3JpYmUgYW4gYGVtaXR0ZXIub24oJ2RlbW8nKWAgbGlzdGVuZXIsIFxuICAqIGBlbWl0dGVyLm9mZignZGVtbzpleGFtcGxlJylgIHdpbGwgdW5zdWJzY3JpYmUgYW4gYGVtaXR0ZXIub24oJ2RlbW86ZXhhbXBsZScpYCBsaXN0ZW5lclxuICAqIEBuYW1lIG9mZlxuICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAqIEBwYXJhbSB7RnVuY3Rpb259IFtmbl0g4oCTIHRoZSBzcGVjaWZpYyBoYW5kbGVyXG4gICogQGV4YW1wbGVcbiAgKiBlbWl0dGVyLm9mZignZXhhbXBsZScpXG4gICogZW1pdHRlci5vZmYoJ2RlbW8nLCBmdW5jdGlvbiAoKSB7fSlcbiAgKi9cbiAgZW1pdHRlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCBmbikge1xuICAgIHZhciBrZWVwID0gW11cblxuICAgIGlmIChldmVudCAmJiBmbikge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9mbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMuX2Zuc1tpXSAhPT0gZm4pIHtcbiAgICAgICAgICBrZWVwLnB1c2godGhpcy5fZm5zW2ldKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAga2VlcC5sZW5ndGggPyB0aGlzLl9mbnNbZXZlbnRdID0ga2VlcCA6IGRlbGV0ZSB0aGlzLl9mbnNbZXZlbnRdXG4gIH1cblxuICBmdW5jdGlvbiBuYW1lc3BhY2VzIChlKSB7XG4gICAgdmFyIG91dCA9IFtdXG4gICAgdmFyIGFyZ3MgPSBlLnNwbGl0KCc6JylcbiAgICB2YXIgZm5zID0gZW1pdHRlci5fZm5zXG4gICAgT2JqZWN0LmtleXMoZm5zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIGlmIChrZXkgPT09ICcqJykgb3V0ID0gb3V0LmNvbmNhdChmbnNba2V5XSlcbiAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMiAmJiBhcmdzWzBdID09PSBrZXkpIG91dCA9IG91dC5jb25jYXQoZm5zW2tleV0pXG4gICAgfSlcbiAgICByZXR1cm4gb3V0XG4gIH1cblxuICBmdW5jdGlvbiBlbWl0QWxsIChlLCBmbnMsIGFyZ3MpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFmbnNbaV0pIGJyZWFrXG4gICAgICBmbnNbaV0uZXZlbnQgPSBlXG4gICAgICBmbnNbaV0uYXBwbHkoZm5zW2ldLCBhcmdzKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlbWl0dGVyXG59XG4iLCIndXNlIHN0cmljdCc7XG52YXIgbnVtYmVySXNOYW4gPSByZXF1aXJlKCdudW1iZXItaXMtbmFuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG51bSkge1xuXHRpZiAodHlwZW9mIG51bSAhPT0gJ251bWJlcicgfHwgbnVtYmVySXNOYW4obnVtKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgbnVtYmVyLCBnb3QgJyArIHR5cGVvZiBudW0pO1xuXHR9XG5cblx0dmFyIGV4cG9uZW50O1xuXHR2YXIgdW5pdDtcblx0dmFyIG5lZyA9IG51bSA8IDA7XG5cdHZhciB1bml0cyA9IFsnQicsICdrQicsICdNQicsICdHQicsICdUQicsICdQQicsICdFQicsICdaQicsICdZQiddO1xuXG5cdGlmIChuZWcpIHtcblx0XHRudW0gPSAtbnVtO1xuXHR9XG5cblx0aWYgKG51bSA8IDEpIHtcblx0XHRyZXR1cm4gKG5lZyA/ICctJyA6ICcnKSArIG51bSArICcgQic7XG5cdH1cblxuXHRleHBvbmVudCA9IE1hdGgubWluKE1hdGguZmxvb3IoTWF0aC5sb2cobnVtKSAvIE1hdGgubG9nKDEwMDApKSwgdW5pdHMubGVuZ3RoIC0gMSk7XG5cdG51bSA9IE51bWJlcigobnVtIC8gTWF0aC5wb3coMTAwMCwgZXhwb25lbnQpKS50b0ZpeGVkKDIpKTtcblx0dW5pdCA9IHVuaXRzW2V4cG9uZW50XTtcblxuXHRyZXR1cm4gKG5lZyA/ICctJyA6ICcnKSArIG51bSArICcgJyArIHVuaXQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBOdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24gKHgpIHtcblx0cmV0dXJuIHggIT09IHg7XG59O1xuIiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuLyogZ2xvYmFsOiB3aW5kb3cgKi9cblxudmFyIF93aW5kb3cgPSB3aW5kb3c7XG52YXIgYnRvYSA9IF93aW5kb3cuYnRvYTtcbmZ1bmN0aW9uIGVuY29kZShkYXRhKSB7XG4gIHJldHVybiBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChkYXRhKSkpO1xufVxuXG52YXIgaXNTdXBwb3J0ZWQgPSBleHBvcnRzLmlzU3VwcG9ydGVkID0gXCJidG9hXCIgaW4gd2luZG93OyIsIi8vIEdlbmVyYXRlZCBieSBCYWJlbFxuXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLm5ld1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuZXhwb3J0cy5yZXNvbHZlVXJsID0gcmVzb2x2ZVVybDtcblxudmFyIF9yZXNvbHZlVXJsID0gcmVxdWlyZShcInJlc29sdmUtdXJsXCIpO1xuXG52YXIgX3Jlc29sdmVVcmwyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcmVzb2x2ZVVybCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIG5ld1JlcXVlc3QoKSB7XG4gIHJldHVybiBuZXcgd2luZG93LlhNTEh0dHBSZXF1ZXN0KCk7XG59IC8qIGdsb2JhbCB3aW5kb3cgKi9cblxuXG5mdW5jdGlvbiByZXNvbHZlVXJsKG9yaWdpbiwgbGluaykge1xuICByZXR1cm4gKDAsIF9yZXNvbHZlVXJsMi5kZWZhdWx0KShvcmlnaW4sIGxpbmspO1xufSIsIi8vIEdlbmVyYXRlZCBieSBCYWJlbFxuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KCk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmdldFNvdXJjZSA9IGdldFNvdXJjZTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxudmFyIEZpbGVTb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEZpbGVTb3VyY2UoZmlsZSkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBGaWxlU291cmNlKTtcblxuICAgIHRoaXMuX2ZpbGUgPSBmaWxlO1xuICAgIHRoaXMuc2l6ZSA9IGZpbGUuc2l6ZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhGaWxlU291cmNlLCBbe1xuICAgIGtleTogXCJzbGljZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzbGljZShzdGFydCwgZW5kKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlsZS5zbGljZShzdGFydCwgZW5kKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiY2xvc2VcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2xvc2UoKSB7fVxuICB9XSk7XG5cbiAgcmV0dXJuIEZpbGVTb3VyY2U7XG59KCk7XG5cbmZ1bmN0aW9uIGdldFNvdXJjZShpbnB1dCkge1xuICAvLyBTaW5jZSB3ZSBlbXVsYXRlIHRoZSBCbG9iIHR5cGUgaW4gb3VyIHRlc3RzIChub3QgYWxsIHRhcmdldCBicm93c2Vyc1xuICAvLyBzdXBwb3J0IGl0KSwgd2UgY2Fubm90IHVzZSBgaW5zdGFuY2VvZmAgZm9yIHRlc3Rpbmcgd2hldGhlciB0aGUgaW5wdXQgdmFsdWVcbiAgLy8gY2FuIGJlIGhhbmRsZWQuIEluc3RlYWQsIHdlIHNpbXBseSBjaGVjayBpcyB0aGUgc2xpY2UoKSBmdW5jdGlvbiBhbmQgdGhlXG4gIC8vIHNpemUgcHJvcGVydHkgYXJlIGF2YWlsYWJsZS5cbiAgaWYgKHR5cGVvZiBpbnB1dC5zbGljZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBpbnB1dC5zaXplICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgcmV0dXJuIG5ldyBGaWxlU291cmNlKGlucHV0KTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcInNvdXJjZSBvYmplY3QgbWF5IG9ubHkgYmUgYW4gaW5zdGFuY2Ugb2YgRmlsZSBvciBCbG9iIGluIHRoaXMgZW52aXJvbm1lbnRcIik7XG59IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuc2V0SXRlbSA9IHNldEl0ZW07XG5leHBvcnRzLmdldEl0ZW0gPSBnZXRJdGVtO1xuZXhwb3J0cy5yZW1vdmVJdGVtID0gcmVtb3ZlSXRlbTtcbi8qIGdsb2JhbCB3aW5kb3csIGxvY2FsU3RvcmFnZSAqL1xuXG52YXIgaGFzU3RvcmFnZSA9IGZhbHNlO1xudHJ5IHtcbiAgaGFzU3RvcmFnZSA9IFwibG9jYWxTdG9yYWdlXCIgaW4gd2luZG93O1xuICAvLyBBdHRlbXB0IHRvIGFjY2VzcyBsb2NhbFN0b3JhZ2VcbiAgbG9jYWxTdG9yYWdlLmxlbmd0aDtcbn0gY2F0Y2ggKGUpIHtcbiAgLy8gSWYgd2UgdHJ5IHRvIGFjY2VzcyBsb2NhbFN0b3JhZ2UgaW5zaWRlIGEgc2FuZGJveGVkIGlmcmFtZSwgYSBTZWN1cml0eUVycm9yXG4gIC8vIGlzIHRocm93bi5cbiAgaWYgKGUuY29kZSA9PT0gZS5TRUNVUklUWV9FUlIpIHtcbiAgICBoYXNTdG9yYWdlID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG52YXIgY2FuU3RvcmVVUkxzID0gZXhwb3J0cy5jYW5TdG9yZVVSTHMgPSBoYXNTdG9yYWdlO1xuXG5mdW5jdGlvbiBzZXRJdGVtKGtleSwgdmFsdWUpIHtcbiAgaWYgKCFoYXNTdG9yYWdlKSByZXR1cm47XG4gIHJldHVybiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZ2V0SXRlbShrZXkpIHtcbiAgaWYgKCFoYXNTdG9yYWdlKSByZXR1cm47XG4gIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVJdGVtKGtleSkge1xuICBpZiAoIWhhc1N0b3JhZ2UpIHJldHVybjtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG59IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuZnVuY3Rpb24gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4oc2VsZiwgY2FsbCkgeyBpZiAoIXNlbGYpIHsgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpOyB9IHJldHVybiBjYWxsICYmICh0eXBlb2YgY2FsbCA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgY2FsbCA9PT0gXCJmdW5jdGlvblwiKSA/IGNhbGwgOiBzZWxmOyB9XG5cbmZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09IFwiZnVuY3Rpb25cIiAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG52YXIgRGV0YWlsZWRFcnJvciA9IGZ1bmN0aW9uIChfRXJyb3IpIHtcbiAgX2luaGVyaXRzKERldGFpbGVkRXJyb3IsIF9FcnJvcik7XG5cbiAgZnVuY3Rpb24gRGV0YWlsZWRFcnJvcihlcnJvcikge1xuICAgIHZhciBjYXVzaW5nRXJyID0gYXJndW1lbnRzLmxlbmd0aCA8PSAxIHx8IGFyZ3VtZW50c1sxXSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGFyZ3VtZW50c1sxXTtcbiAgICB2YXIgeGhyID0gYXJndW1lbnRzLmxlbmd0aCA8PSAyIHx8IGFyZ3VtZW50c1syXSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGFyZ3VtZW50c1syXTtcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBEZXRhaWxlZEVycm9yKTtcblxuICAgIHZhciBfdGhpcyA9IF9wb3NzaWJsZUNvbnN0cnVjdG9yUmV0dXJuKHRoaXMsIE9iamVjdC5nZXRQcm90b3R5cGVPZihEZXRhaWxlZEVycm9yKS5jYWxsKHRoaXMsIGVycm9yLm1lc3NhZ2UpKTtcblxuICAgIF90aGlzLm9yaWdpbmFsUmVxdWVzdCA9IHhocjtcbiAgICBfdGhpcy5jYXVzaW5nRXJyb3IgPSBjYXVzaW5nRXJyO1xuXG4gICAgdmFyIG1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgIGlmIChjYXVzaW5nRXJyICE9IG51bGwpIHtcbiAgICAgIG1lc3NhZ2UgKz0gXCIsIGNhdXNlZCBieSBcIiArIGNhdXNpbmdFcnIudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgaWYgKHhociAhPSBudWxsKSB7XG4gICAgICBtZXNzYWdlICs9IFwiLCBvcmlnaW5hdGVkIGZyb20gcmVxdWVzdCAocmVzcG9uc2UgY29kZTogXCIgKyB4aHIuc3RhdHVzICsgXCIsIHJlc3BvbnNlIHRleHQ6IFwiICsgeGhyLnJlc3BvbnNlVGV4dCArIFwiKVwiO1xuICAgIH1cbiAgICBfdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICByZXR1cm4gX3RoaXM7XG4gIH1cblxuICByZXR1cm4gRGV0YWlsZWRFcnJvcjtcbn0oRXJyb3IpO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBEZXRhaWxlZEVycm9yOyIsIi8vIEdlbmVyYXRlZCBieSBCYWJlbFxuXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSBmaW5nZXJwcmludDtcbi8qKlxuICogR2VuZXJhdGUgYSBmaW5nZXJwcmludCBmb3IgYSBmaWxlIHdoaWNoIHdpbGwgYmUgdXNlZCB0aGUgc3RvcmUgdGhlIGVuZHBvaW50XG4gKlxuICogQHBhcmFtIHtGaWxlfSBmaWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGZpbmdlcnByaW50KGZpbGUpIHtcbiAgcmV0dXJuIFtcInR1c1wiLCBmaWxlLm5hbWUsIGZpbGUudHlwZSwgZmlsZS5zaXplLCBmaWxlLmxhc3RNb2RpZmllZF0uam9pbihcIi1cIik7XG59IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIF91cGxvYWQgPSByZXF1aXJlKFwiLi91cGxvYWRcIik7XG5cbnZhciBfdXBsb2FkMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3VwbG9hZCk7XG5cbnZhciBfc3RvcmFnZSA9IHJlcXVpcmUoXCIuL25vZGUvc3RvcmFnZVwiKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuLyogZ2xvYmFsIHdpbmRvdyAqL1xudmFyIGRlZmF1bHRPcHRpb25zID0gX3VwbG9hZDIuZGVmYXVsdC5kZWZhdWx0T3B0aW9ucztcblxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAvLyBCcm93c2VyIGVudmlyb25tZW50IHVzaW5nIFhNTEh0dHBSZXF1ZXN0XG4gIHZhciBfd2luZG93ID0gd2luZG93O1xuICB2YXIgWE1MSHR0cFJlcXVlc3QgPSBfd2luZG93LlhNTEh0dHBSZXF1ZXN0O1xuICB2YXIgQmxvYiA9IF93aW5kb3cuQmxvYjtcblxuXG4gIHZhciBpc1N1cHBvcnRlZCA9IFhNTEh0dHBSZXF1ZXN0ICYmIEJsb2IgJiYgdHlwZW9mIEJsb2IucHJvdG90eXBlLnNsaWNlID09PSBcImZ1bmN0aW9uXCI7XG59IGVsc2Uge1xuICAvLyBOb2RlLmpzIGVudmlyb25tZW50IHVzaW5nIGh0dHAgbW9kdWxlXG4gIHZhciBpc1N1cHBvcnRlZCA9IHRydWU7XG59XG5cbi8vIFRoZSB1c2FnZSBvZiB0aGUgY29tbW9uanMgZXhwb3J0aW5nIHN5bnRheCBpbnN0ZWFkIG9mIHRoZSBuZXcgRUNNQVNjcmlwdFxuLy8gb25lIGlzIGFjdHVhbGx5IGludGVkZWQgYW5kIHByZXZlbnRzIHdlaXJkIGJlaGF2aW91ciBpZiB3ZSBhcmUgdHJ5aW5nIHRvXG4vLyBpbXBvcnQgdGhpcyBtb2R1bGUgaW4gYW5vdGhlciBtb2R1bGUgdXNpbmcgQmFiZWwuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgVXBsb2FkOiBfdXBsb2FkMi5kZWZhdWx0LFxuICBpc1N1cHBvcnRlZDogaXNTdXBwb3J0ZWQsXG4gIGNhblN0b3JlVVJMczogX3N0b3JhZ2UuY2FuU3RvcmVVUkxzLFxuICBkZWZhdWx0T3B0aW9uczogZGVmYXVsdE9wdGlvbnNcbn07IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTsgLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG5cbi8vIFdlIGltcG9ydCB0aGUgZmlsZXMgdXNlZCBpbnNpZGUgdGhlIE5vZGUgZW52aXJvbm1lbnQgd2hpY2ggYXJlIHJld3JpdHRlblxuLy8gZm9yIGJyb3dzZXJzIHVzaW5nIHRoZSBydWxlcyBkZWZpbmVkIGluIHRoZSBwYWNrYWdlLmpzb25cblxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2ZpbmdlcnByaW50ID0gcmVxdWlyZShcIi4vZmluZ2VycHJpbnRcIik7XG5cbnZhciBfZmluZ2VycHJpbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZmluZ2VycHJpbnQpO1xuXG52YXIgX2Vycm9yID0gcmVxdWlyZShcIi4vZXJyb3JcIik7XG5cbnZhciBfZXJyb3IyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZXJyb3IpO1xuXG52YXIgX2V4dGVuZCA9IHJlcXVpcmUoXCJleHRlbmRcIik7XG5cbnZhciBfZXh0ZW5kMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2V4dGVuZCk7XG5cbnZhciBfcmVxdWVzdCA9IHJlcXVpcmUoXCIuL25vZGUvcmVxdWVzdFwiKTtcblxudmFyIF9zb3VyY2UgPSByZXF1aXJlKFwiLi9ub2RlL3NvdXJjZVwiKTtcblxudmFyIF9iYXNlID0gcmVxdWlyZShcIi4vbm9kZS9iYXNlNjRcIik7XG5cbnZhciBCYXNlNjQgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfYmFzZSk7XG5cbnZhciBfc3RvcmFnZSA9IHJlcXVpcmUoXCIuL25vZGUvc3RvcmFnZVwiKTtcblxudmFyIFN0b3JhZ2UgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfc3RvcmFnZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKG9iaikgeyBpZiAob2JqICYmIG9iai5fX2VzTW9kdWxlKSB7IHJldHVybiBvYmo7IH0gZWxzZSB7IHZhciBuZXdPYmogPSB7fTsgaWYgKG9iaiAhPSBudWxsKSB7IGZvciAodmFyIGtleSBpbiBvYmopIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIG5ld09ialtrZXldID0gb2JqW2tleV07IH0gfSBuZXdPYmouZGVmYXVsdCA9IG9iajsgcmV0dXJuIG5ld09iajsgfSB9XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9XG5cbnZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgZW5kcG9pbnQ6IFwiXCIsXG4gIGZpbmdlcnByaW50OiBfZmluZ2VycHJpbnQyLmRlZmF1bHQsXG4gIHJlc3VtZTogdHJ1ZSxcbiAgb25Qcm9ncmVzczogbnVsbCxcbiAgb25DaHVua0NvbXBsZXRlOiBudWxsLFxuICBvblN1Y2Nlc3M6IG51bGwsXG4gIG9uRXJyb3I6IG51bGwsXG4gIGhlYWRlcnM6IHt9LFxuICBjaHVua1NpemU6IEluZmluaXR5LFxuICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlLFxuICB1cGxvYWRVcmw6IG51bGwsXG4gIHVwbG9hZFNpemU6IG51bGwsXG4gIG92ZXJyaWRlUGF0Y2hNZXRob2Q6IGZhbHNlLFxuICByZXRyeURlbGF5czogbnVsbFxufTtcblxudmFyIFVwbG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gVXBsb2FkKGZpbGUsIG9wdGlvbnMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgVXBsb2FkKTtcblxuICAgIHRoaXMub3B0aW9ucyA9ICgwLCBfZXh0ZW5kMi5kZWZhdWx0KSh0cnVlLCB7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuXG4gICAgLy8gVGhlIHVuZGVybHlpbmcgRmlsZS9CbG9iIG9iamVjdFxuICAgIHRoaXMuZmlsZSA9IGZpbGU7XG5cbiAgICAvLyBUaGUgVVJMIGFnYWluc3Qgd2hpY2ggdGhlIGZpbGUgd2lsbCBiZSB1cGxvYWRlZFxuICAgIHRoaXMudXJsID0gbnVsbDtcblxuICAgIC8vIFRoZSB1bmRlcmx5aW5nIFhIUiBvYmplY3QgZm9yIHRoZSBjdXJyZW50IFBBVENIIHJlcXVlc3RcbiAgICB0aGlzLl94aHIgPSBudWxsO1xuXG4gICAgLy8gVGhlIGZpbmdlcnBpbnJ0IGZvciB0aGUgY3VycmVudCBmaWxlIChzZXQgYWZ0ZXIgc3RhcnQoKSlcbiAgICB0aGlzLl9maW5nZXJwcmludCA9IG51bGw7XG5cbiAgICAvLyBUaGUgb2Zmc2V0IHVzZWQgaW4gdGhlIGN1cnJlbnQgUEFUQ0ggcmVxdWVzdFxuICAgIHRoaXMuX29mZnNldCA9IG51bGw7XG5cbiAgICAvLyBUcnVlIGlmIHRoZSBjdXJyZW50IFBBVENIIHJlcXVlc3QgaGFzIGJlZW4gYWJvcnRlZFxuICAgIHRoaXMuX2Fib3J0ZWQgPSBmYWxzZTtcblxuICAgIC8vIFRoZSBmaWxlJ3Mgc2l6ZSBpbiBieXRlc1xuICAgIHRoaXMuX3NpemUgPSBudWxsO1xuXG4gICAgLy8gVGhlIFNvdXJjZSBvYmplY3Qgd2hpY2ggd2lsbCB3cmFwIGFyb3VuZCB0aGUgZ2l2ZW4gZmlsZSBhbmQgcHJvdmlkZXMgdXNcbiAgICAvLyB3aXRoIGEgdW5pZmllZCBpbnRlcmZhY2UgZm9yIGdldHRpbmcgaXRzIHNpemUgYW5kIHNsaWNlIGNodW5rcyBmcm9tIGl0c1xuICAgIC8vIGNvbnRlbnQgYWxsb3dpbmcgdXMgdG8gZWFzaWx5IGhhbmRsZSBGaWxlcywgQmxvYnMsIEJ1ZmZlcnMgYW5kIFN0cmVhbXMuXG4gICAgdGhpcy5fc291cmNlID0gbnVsbDtcblxuICAgIC8vIFRoZSBjdXJyZW50IGNvdW50IG9mIGF0dGVtcHRzIHdoaWNoIGhhdmUgYmVlbiBtYWRlLiBOdWxsIGluZGljYXRlcyBub25lLlxuICAgIHRoaXMuX3JldHJ5QXR0ZW1wdCA9IDA7XG5cbiAgICAvLyBUaGUgdGltZW91dCdzIElEIHdoaWNoIGlzIHVzZWQgdG8gZGVsYXkgdGhlIG5leHQgcmV0cnlcbiAgICB0aGlzLl9yZXRyeVRpbWVvdXQgPSBudWxsO1xuXG4gICAgLy8gVGhlIG9mZnNldCBvZiB0aGUgcmVtb3RlIHVwbG9hZCBiZWZvcmUgdGhlIGxhdGVzdCBhdHRlbXB0IHdhcyBzdGFydGVkLlxuICAgIHRoaXMuX29mZnNldEJlZm9yZVJldHJ5ID0gMDtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhVcGxvYWQsIFt7XG4gICAga2V5OiBcInN0YXJ0XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHN0YXJ0KCkge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgdmFyIGZpbGUgPSB0aGlzLmZpbGU7XG5cbiAgICAgIGlmICghZmlsZSkge1xuICAgICAgICB0aGlzLl9lbWl0RXJyb3IobmV3IEVycm9yKFwidHVzOiBubyBmaWxlIG9yIHN0cmVhbSB0byB1cGxvYWQgcHJvdmlkZWRcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5vcHRpb25zLmVuZHBvaW50KSB7XG4gICAgICAgIHRoaXMuX2VtaXRFcnJvcihuZXcgRXJyb3IoXCJ0dXM6IG5vIGVuZHBvaW50IHByb3ZpZGVkXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgc291cmNlID0gdGhpcy5fc291cmNlID0gKDAsIF9zb3VyY2UuZ2V0U291cmNlKShmaWxlLCB0aGlzLm9wdGlvbnMuY2h1bmtTaXplKTtcblxuICAgICAgLy8gRmlyc3RseSwgY2hlY2sgaWYgdGhlIGNhbGxlciBoYXMgc3VwcGxpZWQgYSBtYW51YWwgdXBsb2FkIHNpemUgb3IgZWxzZVxuICAgICAgLy8gd2Ugd2lsbCB1c2UgdGhlIGNhbGN1bGF0ZWQgc2l6ZSBieSB0aGUgc291cmNlIG9iamVjdC5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudXBsb2FkU2l6ZSAhPSBudWxsKSB7XG4gICAgICAgIHZhciBzaXplID0gK3RoaXMub3B0aW9ucy51cGxvYWRTaXplO1xuICAgICAgICBpZiAoaXNOYU4oc2l6ZSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0dXM6IGNhbm5vdCBjb252ZXJ0IGB1cGxvYWRTaXplYCBvcHRpb24gaW50byBhIG51bWJlclwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NpemUgPSBzaXplO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHNpemUgPSBzb3VyY2Uuc2l6ZTtcblxuICAgICAgICAvLyBUaGUgc2l6ZSBwcm9wZXJ0eSB3aWxsIGJlIG51bGwgaWYgd2UgY2Fubm90IGNhbGN1bGF0ZSB0aGUgZmlsZSdzIHNpemUsXG4gICAgICAgIC8vIGZvciBleGFtcGxlIGlmIHlvdSBoYW5kbGUgYSBzdHJlYW0uXG4gICAgICAgIGlmIChzaXplID09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0dXM6IGNhbm5vdCBhdXRvbWF0aWNhbGx5IGRlcml2ZSB1cGxvYWQncyBzaXplIGZyb20gaW5wdXQgYW5kIG11c3QgYmUgc3BlY2lmaWVkIG1hbnVhbGx5IHVzaW5nIHRoZSBgdXBsb2FkU2l6ZWAgb3B0aW9uXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgICB9XG5cbiAgICAgIHZhciByZXRyeURlbGF5cyA9IHRoaXMub3B0aW9ucy5yZXRyeURlbGF5cztcbiAgICAgIGlmIChyZXRyeURlbGF5cyAhPSBudWxsKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocmV0cnlEZWxheXMpICE9PSBcIltvYmplY3QgQXJyYXldXCIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0dXM6IHRoZSBgcmV0cnlEZWxheXNgIG9wdGlvbiBtdXN0IGVpdGhlciBiZSBhbiBhcnJheSBvciBudWxsXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3JDYWxsYmFjayA9IF90aGlzLm9wdGlvbnMub25FcnJvcjtcbiAgICAgICAgICAgIF90aGlzLm9wdGlvbnMub25FcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgLy8gUmVzdG9yZSB0aGUgb3JpZ2luYWwgZXJyb3IgY2FsbGJhY2sgd2hpY2ggbWF5IGhhdmUgYmVlbiBzZXQuXG4gICAgICAgICAgICAgIF90aGlzLm9wdGlvbnMub25FcnJvciA9IGVycm9yQ2FsbGJhY2s7XG5cbiAgICAgICAgICAgICAgLy8gV2Ugd2lsbCByZXNldCB0aGUgYXR0ZW1wdCBjb3VudGVyIGlmXG4gICAgICAgICAgICAgIC8vIC0gd2Ugd2VyZSBhbHJlYWR5IGFibGUgdG8gY29ubmVjdCB0byB0aGUgc2VydmVyIChvZmZzZXQgIT0gbnVsbCkgYW5kXG4gICAgICAgICAgICAgIC8vIC0gd2Ugd2VyZSBhYmxlIHRvIHVwbG9hZCBhIHNtYWxsIGNodW5rIG9mIGRhdGEgdG8gdGhlIHNlcnZlclxuICAgICAgICAgICAgICB2YXIgc2hvdWxkUmVzZXREZWxheXMgPSBfdGhpcy5fb2Zmc2V0ICE9IG51bGwgJiYgX3RoaXMuX29mZnNldCA+IF90aGlzLl9vZmZzZXRCZWZvcmVSZXRyeTtcbiAgICAgICAgICAgICAgaWYgKHNob3VsZFJlc2V0RGVsYXlzKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuX3JldHJ5QXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB2YXIgaXNPbmxpbmUgPSB0cnVlO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBcIm5hdmlnYXRvclwiIGluIHdpbmRvdyAmJiB3aW5kb3cubmF2aWdhdG9yLm9uTGluZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBpc09ubGluZSA9IGZhbHNlO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gV2Ugb25seSBhdHRlbXB0IGEgcmV0cnkgaWZcbiAgICAgICAgICAgICAgLy8gLSB3ZSBkaWRuJ3QgZXhjZWVkIHRoZSBtYXhpdW0gbnVtYmVyIG9mIHJldHJpZXMsIHlldCwgYW5kXG4gICAgICAgICAgICAgIC8vIC0gdGhpcyBlcnJvciB3YXMgY2F1c2VkIGJ5IGEgcmVxdWVzdCBvciBpdCdzIHJlc3BvbnNlIGFuZFxuICAgICAgICAgICAgICAvLyAtIHRoZSBicm93c2VyIGRvZXMgbm90IGluZGljYXRlIHRoYXQgd2UgYXJlIG9mZmxpbmVcbiAgICAgICAgICAgICAgdmFyIHNob3VsZFJldHJ5ID0gX3RoaXMuX3JldHJ5QXR0ZW1wdCA8IHJldHJ5RGVsYXlzLmxlbmd0aCAmJiBlcnIub3JpZ2luYWxSZXF1ZXN0ICE9IG51bGwgJiYgaXNPbmxpbmU7XG5cbiAgICAgICAgICAgICAgaWYgKCFzaG91bGRSZXRyeSkge1xuICAgICAgICAgICAgICAgIF90aGlzLl9lbWl0RXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB2YXIgZGVsYXkgPSByZXRyeURlbGF5c1tfdGhpcy5fcmV0cnlBdHRlbXB0KytdO1xuXG4gICAgICAgICAgICAgIF90aGlzLl9vZmZzZXRCZWZvcmVSZXRyeSA9IF90aGlzLl9vZmZzZXQ7XG4gICAgICAgICAgICAgIF90aGlzLm9wdGlvbnMudXBsb2FkVXJsID0gX3RoaXMudXJsO1xuXG4gICAgICAgICAgICAgIF90aGlzLl9yZXRyeVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5zdGFydCgpO1xuICAgICAgICAgICAgICB9LCBkZWxheSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQSBVUkwgaGFzIG1hbnVhbGx5IGJlZW4gc3BlY2lmaWVkLCBzbyB3ZSB0cnkgdG8gcmVzdW1lXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnVwbG9hZFVybCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMudXJsID0gdGhpcy5vcHRpb25zLnVwbG9hZFVybDtcbiAgICAgICAgdGhpcy5fcmVzdW1lVXBsb2FkKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIGVuZHBvaW50IGZvciB0aGUgZmlsZSBpbiB0aGUgc3RvcmFnZVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5yZXN1bWUpIHtcbiAgICAgICAgdGhpcy5fZmluZ2VycHJpbnQgPSB0aGlzLm9wdGlvbnMuZmluZ2VycHJpbnQoZmlsZSk7XG4gICAgICAgIHZhciByZXN1bWVkVXJsID0gU3RvcmFnZS5nZXRJdGVtKHRoaXMuX2ZpbmdlcnByaW50KTtcblxuICAgICAgICBpZiAocmVzdW1lZFVybCAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy51cmwgPSByZXN1bWVkVXJsO1xuICAgICAgICAgIHRoaXMuX3Jlc3VtZVVwbG9hZCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBbiB1cGxvYWQgaGFzIG5vdCBzdGFydGVkIGZvciB0aGUgZmlsZSB5ZXQsIHNvIHdlIHN0YXJ0IGEgbmV3IG9uZVxuICAgICAgdGhpcy5fY3JlYXRlVXBsb2FkKCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImFib3J0XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGFib3J0KCkge1xuICAgICAgaWYgKHRoaXMuX3hociAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLl94aHIuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5fc291cmNlLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuX2Fib3J0ZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcmV0cnlUaW1lb3V0ICE9IG51bGwpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3JldHJ5VGltZW91dCk7XG4gICAgICAgIHRoaXMuX3JldHJ5VGltZW91dCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIl9lbWl0WGhyRXJyb3JcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2VtaXRYaHJFcnJvcih4aHIsIGVyciwgY2F1c2luZ0Vycikge1xuICAgICAgdGhpcy5fZW1pdEVycm9yKG5ldyBfZXJyb3IyLmRlZmF1bHQoZXJyLCBjYXVzaW5nRXJyLCB4aHIpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRFcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdEVycm9yKGVycikge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub25FcnJvciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkVycm9yKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIl9lbWl0U3VjY2Vzc1wiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdFN1Y2Nlc3MoKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5vblN1Y2Nlc3MgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25TdWNjZXNzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHVibGlzaGVzIG5vdGlmaWNhdGlvbiB3aGVuIGRhdGEgaGFzIGJlZW4gc2VudCB0byB0aGUgc2VydmVyLiBUaGlzXG4gICAgICogZGF0YSBtYXkgbm90IGhhdmUgYmVlbiBhY2NlcHRlZCBieSB0aGUgc2VydmVyIHlldC5cbiAgICAgKiBAcGFyYW0gIHtudW1iZXJ9IGJ5dGVzU2VudCAgTnVtYmVyIG9mIGJ5dGVzIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgICAgKiBAcGFyYW0gIHtudW1iZXJ9IGJ5dGVzVG90YWwgVG90YWwgbnVtYmVyIG9mIGJ5dGVzIHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9lbWl0UHJvZ3Jlc3NcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2VtaXRQcm9ncmVzcyhieXRlc1NlbnQsIGJ5dGVzVG90YWwpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLm9uUHJvZ3Jlc3MgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25Qcm9ncmVzcyhieXRlc1NlbnQsIGJ5dGVzVG90YWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFB1Ymxpc2hlcyBub3RpZmljYXRpb24gd2hlbiBhIGNodW5rIG9mIGRhdGEgaGFzIGJlZW4gc2VudCB0byB0aGUgc2VydmVyXG4gICAgICogYW5kIGFjY2VwdGVkIGJ5IHRoZSBzZXJ2ZXIuXG4gICAgICogQHBhcmFtICB7bnVtYmVyfSBjaHVua1NpemUgIFNpemUgb2YgdGhlIGNodW5rIHRoYXQgd2FzIGFjY2VwdGVkIGJ5IHRoZVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuXG4gICAgICogQHBhcmFtICB7bnVtYmVyfSBieXRlc0FjY2VwdGVkIFRvdGFsIG51bWJlciBvZiBieXRlcyB0aGF0IGhhdmUgYmVlblxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRlZCBieSB0aGUgc2VydmVyLlxuICAgICAqIEBwYXJhbSAge251bWJlcn0gYnl0ZXNUb3RhbCBUb3RhbCBudW1iZXIgb2YgYnl0ZXMgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyLlxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRDaHVua0NvbXBsZXRlXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9lbWl0Q2h1bmtDb21wbGV0ZShjaHVua1NpemUsIGJ5dGVzQWNjZXB0ZWQsIGJ5dGVzVG90YWwpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLm9uQ2h1bmtDb21wbGV0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkNodW5rQ29tcGxldGUoY2h1bmtTaXplLCBieXRlc0FjY2VwdGVkLCBieXRlc1RvdGFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGhlYWRlcnMgdXNlZCBpbiB0aGUgcmVxdWVzdCBhbmQgdGhlIHdpdGhDcmVkZW50aWFscyBwcm9wZXJ0eVxuICAgICAqIGFzIGRlZmluZWQgaW4gdGhlIG9wdGlvbnNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhoclxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX3NldHVwWEhSXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9zZXR1cFhIUih4aHIpIHtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiVHVzLVJlc3VtYWJsZVwiLCBcIjEuMC4wXCIpO1xuICAgICAgdmFyIGhlYWRlcnMgPSB0aGlzLm9wdGlvbnMuaGVhZGVycztcblxuICAgICAgZm9yICh2YXIgbmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIGhlYWRlcnNbbmFtZV0pO1xuICAgICAgfVxuXG4gICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdGhpcy5vcHRpb25zLndpdGhDcmVkZW50aWFscztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgdXBsb2FkIHVzaW5nIHRoZSBjcmVhdGlvbiBleHRlbnNpb24gYnkgc2VuZGluZyBhIFBPU1RcbiAgICAgKiByZXF1ZXN0IHRvIHRoZSBlbmRwb2ludC4gQWZ0ZXIgc3VjY2Vzc2Z1bCBjcmVhdGlvbiB0aGUgZmlsZSB3aWxsIGJlXG4gICAgICogdXBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX2NyZWF0ZVVwbG9hZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfY3JlYXRlVXBsb2FkKCkge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIHZhciB4aHIgPSAoMCwgX3JlcXVlc3QubmV3UmVxdWVzdCkoKTtcbiAgICAgIHhoci5vcGVuKFwiUE9TVFwiLCB0aGlzLm9wdGlvbnMuZW5kcG9pbnQsIHRydWUpO1xuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSkge1xuICAgICAgICAgIF90aGlzMi5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiB1bmV4cGVjdGVkIHJlc3BvbnNlIHdoaWxlIGNyZWF0aW5nIHVwbG9hZFwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXMyLnVybCA9ICgwLCBfcmVxdWVzdC5yZXNvbHZlVXJsKShfdGhpczIub3B0aW9ucy5lbmRwb2ludCwgeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwiTG9jYXRpb25cIikpO1xuXG4gICAgICAgIGlmIChfdGhpczIub3B0aW9ucy5yZXN1bWUpIHtcbiAgICAgICAgICBTdG9yYWdlLnNldEl0ZW0oX3RoaXMyLl9maW5nZXJwcmludCwgX3RoaXMyLnVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczIuX29mZnNldCA9IDA7XG4gICAgICAgIF90aGlzMi5fc3RhcnRVcGxvYWQoKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICBfdGhpczIuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogZmFpbGVkIHRvIGNyZWF0ZSB1cGxvYWRcIiksIGVycik7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLl9zZXR1cFhIUih4aHIpO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJVcGxvYWQtTGVuZ3RoXCIsIHRoaXMuX3NpemUpO1xuXG4gICAgICAvLyBBZGQgbWV0YWRhdGEgaWYgdmFsdWVzIGhhdmUgYmVlbiBhZGRlZFxuICAgICAgdmFyIG1ldGFkYXRhID0gZW5jb2RlTWV0YWRhdGEodGhpcy5vcHRpb25zLm1ldGFkYXRhKTtcbiAgICAgIGlmIChtZXRhZGF0YSAhPT0gXCJcIikge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlVwbG9hZC1NZXRhZGF0YVwiLCBtZXRhZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogVHJ5IHRvIHJlc3VtZSBhbiBleGlzdGluZyB1cGxvYWQuIEZpcnN0IGEgSEVBRCByZXF1ZXN0IHdpbGwgYmUgc2VudFxuICAgICAqIHRvIHJldHJpZXZlIHRoZSBvZmZzZXQuIElmIHRoZSByZXF1ZXN0IGZhaWxzIGEgbmV3IHVwbG9hZCB3aWxsIGJlXG4gICAgICogY3JlYXRlZC4gSW4gdGhlIGNhc2Ugb2YgYSBzdWNjZXNzZnVsIHJlc3BvbnNlIHRoZSBmaWxlIHdpbGwgYmUgdXBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9yZXN1bWVVcGxvYWRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3Jlc3VtZVVwbG9hZCgpIHtcbiAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICB2YXIgeGhyID0gKDAsIF9yZXF1ZXN0Lm5ld1JlcXVlc3QpKCk7XG4gICAgICB4aHIub3BlbihcIkhFQURcIiwgdGhpcy51cmwsIHRydWUpO1xuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSkge1xuICAgICAgICAgIGlmIChfdGhpczMub3B0aW9ucy5yZXN1bWUpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBzdG9yZWQgZmluZ2VycHJpbnQgYW5kIGNvcnJlc3BvbmRpbmcgZW5kcG9pbnQsXG4gICAgICAgICAgICAvLyBzaW5jZSB0aGUgZmlsZSBjYW4gbm90IGJlIGZvdW5kXG4gICAgICAgICAgICBTdG9yYWdlLnJlbW92ZUl0ZW0oX3RoaXMzLl9maW5nZXJwcmludCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVHJ5IHRvIGNyZWF0ZSBhIG5ldyB1cGxvYWRcbiAgICAgICAgICBfdGhpczMudXJsID0gbnVsbDtcbiAgICAgICAgICBfdGhpczMuX2NyZWF0ZVVwbG9hZCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvZmZzZXQgPSBwYXJzZUludCh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoXCJVcGxvYWQtT2Zmc2V0XCIpLCAxMCk7XG4gICAgICAgIGlmIChpc05hTihvZmZzZXQpKSB7XG4gICAgICAgICAgX3RoaXMzLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IGludmFsaWQgb3IgbWlzc2luZyBvZmZzZXQgdmFsdWVcIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsZW5ndGggPSBwYXJzZUludCh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoXCJVcGxvYWQtTGVuZ3RoXCIpLCAxMCk7XG4gICAgICAgIGlmIChpc05hTihsZW5ndGgpKSB7XG4gICAgICAgICAgX3RoaXMzLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IGludmFsaWQgb3IgbWlzc2luZyBsZW5ndGggdmFsdWVcIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwbG9hZCBoYXMgYWxyZWFkeSBiZWVuIGNvbXBsZXRlZCBhbmQgd2UgZG8gbm90IG5lZWQgdG8gc2VuZCBhZGRpdGlvbmFsXG4gICAgICAgIC8vIGRhdGEgdG8gdGhlIHNlcnZlclxuICAgICAgICBpZiAob2Zmc2V0ID09PSBsZW5ndGgpIHtcbiAgICAgICAgICBfdGhpczMuX2VtaXRQcm9ncmVzcyhsZW5ndGgsIGxlbmd0aCk7XG4gICAgICAgICAgX3RoaXMzLl9lbWl0U3VjY2VzcygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzMy5fb2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgICBfdGhpczMuX3N0YXJ0VXBsb2FkKCk7XG4gICAgICB9O1xuXG4gICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgX3RoaXMzLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IGZhaWxlZCB0byByZXN1bWUgdXBsb2FkXCIpLCBlcnIpO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5fc2V0dXBYSFIoeGhyKTtcbiAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHVwbG9hZGluZyB0aGUgZmlsZSB1c2luZyBQQVRDSCByZXF1ZXN0cy4gVGhlIGZpbGUgd2lsbCBiZSBkaXZpZGVkXG4gICAgICogaW50byBjaHVua3MgYXMgc3BlY2lmaWVkIGluIHRoZSBjaHVua1NpemUgb3B0aW9uLiBEdXJpbmcgdGhlIHVwbG9hZFxuICAgICAqIHRoZSBvblByb2dyZXNzIGV2ZW50IGhhbmRsZXIgbWF5IGJlIGludm9rZWQgbXVsdGlwbGUgdGltZXMuXG4gICAgICpcbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiBcIl9zdGFydFVwbG9hZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc3RhcnRVcGxvYWQoKSB7XG4gICAgICB2YXIgX3RoaXM0ID0gdGhpcztcblxuICAgICAgdmFyIHhociA9IHRoaXMuX3hociA9ICgwLCBfcmVxdWVzdC5uZXdSZXF1ZXN0KSgpO1xuXG4gICAgICAvLyBTb21lIGJyb3dzZXIgYW5kIHNlcnZlcnMgbWF5IG5vdCBzdXBwb3J0IHRoZSBQQVRDSCBtZXRob2QuIEZvciB0aG9zZVxuICAgICAgLy8gY2FzZXMsIHlvdSBjYW4gdGVsbCB0dXMtanMtY2xpZW50IHRvIHVzZSBhIFBPU1QgcmVxdWVzdCB3aXRoIHRoZVxuICAgICAgLy8gWC1IVFRQLU1ldGhvZC1PdmVycmlkZSBoZWFkZXIgZm9yIHNpbXVsYXRpbmcgYSBQQVRDSCByZXF1ZXN0LlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vdmVycmlkZVBhdGNoTWV0aG9kKSB7XG4gICAgICAgIHhoci5vcGVuKFwiUE9TVFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiWC1IVFRQLU1ldGhvZC1PdmVycmlkZVwiLCBcIlBBVENIXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeGhyLm9wZW4oXCJQQVRDSFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApKSB7XG4gICAgICAgICAgX3RoaXM0Ll9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IHVuZXhwZWN0ZWQgcmVzcG9uc2Ugd2hpbGUgdXBsb2FkaW5nIGNodW5rXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb2Zmc2V0ID0gcGFyc2VJbnQoeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwiVXBsb2FkLU9mZnNldFwiKSwgMTApO1xuICAgICAgICBpZiAoaXNOYU4ob2Zmc2V0KSkge1xuICAgICAgICAgIF90aGlzNC5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBpbnZhbGlkIG9yIG1pc3Npbmcgb2Zmc2V0IHZhbHVlXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczQuX2VtaXRQcm9ncmVzcyhvZmZzZXQsIF90aGlzNC5fc2l6ZSk7XG4gICAgICAgIF90aGlzNC5fZW1pdENodW5rQ29tcGxldGUob2Zmc2V0IC0gX3RoaXM0Ll9vZmZzZXQsIG9mZnNldCwgX3RoaXM0Ll9zaXplKTtcblxuICAgICAgICBfdGhpczQuX29mZnNldCA9IG9mZnNldDtcblxuICAgICAgICBpZiAob2Zmc2V0ID09IF90aGlzNC5fc2l6ZSkge1xuICAgICAgICAgIC8vIFlheSwgZmluYWxseSBkb25lIDopXG4gICAgICAgICAgX3RoaXM0Ll9lbWl0U3VjY2VzcygpO1xuICAgICAgICAgIF90aGlzNC5fc291cmNlLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXM0Ll9zdGFydFVwbG9hZCgpO1xuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIC8vIERvbid0IGVtaXQgYW4gZXJyb3IgaWYgdGhlIHVwbG9hZCB3YXMgYWJvcnRlZCBtYW51YWxseVxuICAgICAgICBpZiAoX3RoaXM0Ll9hYm9ydGVkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXM0Ll9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IGZhaWxlZCB0byB1cGxvYWQgY2h1bmsgYXQgb2Zmc2V0IFwiICsgX3RoaXM0Ll9vZmZzZXQpLCBlcnIpO1xuICAgICAgfTtcblxuICAgICAgLy8gVGVzdCBzdXBwb3J0IGZvciBwcm9ncmVzcyBldmVudHMgYmVmb3JlIGF0dGFjaGluZyBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgaWYgKFwidXBsb2FkXCIgaW4geGhyKSB7XG4gICAgICAgIHhoci51cGxvYWQub25wcm9ncmVzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgaWYgKCFlLmxlbmd0aENvbXB1dGFibGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBfdGhpczQuX2VtaXRQcm9ncmVzcyhzdGFydCArIGUubG9hZGVkLCBfdGhpczQuX3NpemUpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zZXR1cFhIUih4aHIpO1xuXG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlVwbG9hZC1PZmZzZXRcIiwgdGhpcy5fb2Zmc2V0KTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vb2Zmc2V0K29jdGV0LXN0cmVhbVwiKTtcblxuICAgICAgdmFyIHN0YXJ0ID0gdGhpcy5fb2Zmc2V0O1xuICAgICAgdmFyIGVuZCA9IHRoaXMuX29mZnNldCArIHRoaXMub3B0aW9ucy5jaHVua1NpemU7XG5cbiAgICAgIC8vIFRoZSBzcGVjaWZpZWQgY2h1bmtTaXplIG1heSBiZSBJbmZpbml0eSBvciB0aGUgY2FsY2x1YXRlZCBlbmQgcG9zaXRpb25cbiAgICAgIC8vIG1heSBleGNlZWQgdGhlIGZpbGUncyBzaXplLiBJbiBib3RoIGNhc2VzLCB3ZSBsaW1pdCB0aGUgZW5kIHBvc2l0aW9uIHRvXG4gICAgICAvLyB0aGUgaW5wdXQncyB0b3RhbCBzaXplIGZvciBzaW1wbGVyIGNhbGN1bGF0aW9ucyBhbmQgY29ycmVjdG5lc3MuXG4gICAgICBpZiAoZW5kID09PSBJbmZpbml0eSB8fCBlbmQgPiB0aGlzLl9zaXplKSB7XG4gICAgICAgIGVuZCA9IHRoaXMuX3NpemU7XG4gICAgICB9XG5cbiAgICAgIHhoci5zZW5kKHRoaXMuX3NvdXJjZS5zbGljZShzdGFydCwgZW5kKSk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFVwbG9hZDtcbn0oKTtcblxuZnVuY3Rpb24gZW5jb2RlTWV0YWRhdGEobWV0YWRhdGEpIHtcbiAgaWYgKCFCYXNlNjQuaXNTdXBwb3J0ZWQpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIHZhciBlbmNvZGVkID0gW107XG5cbiAgZm9yICh2YXIga2V5IGluIG1ldGFkYXRhKSB7XG4gICAgZW5jb2RlZC5wdXNoKGtleSArIFwiIFwiICsgQmFzZTY0LmVuY29kZShtZXRhZGF0YVtrZXldKSk7XG4gIH1cblxuICByZXR1cm4gZW5jb2RlZC5qb2luKFwiLFwiKTtcbn1cblxuVXBsb2FkLmRlZmF1bHRPcHRpb25zID0gZGVmYXVsdE9wdGlvbnM7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IFVwbG9hZDsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiBpc0FycmF5KGFycikge1xuXHRpZiAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShhcnIpO1xuXHR9XG5cblx0cmV0dXJuIHRvU3RyLmNhbGwoYXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0aWYgKCFvYmogfHwgdG9TdHIuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNPd25Db25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG5cdHZhciBoYXNJc1Byb3RvdHlwZU9mID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcblx0Ly8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuXHRpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNPd25Db25zdHJ1Y3RvciAmJiAhaGFzSXNQcm90b3R5cGVPZikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7LyoqL31cblxuXHRyZXR1cm4gdHlwZW9mIGtleSA9PT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG5cdFx0aSA9IDEsXG5cdFx0bGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcblx0XHRkZWVwID0gZmFsc2U7XG5cblx0Ly8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuXHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKCh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGFyZ2V0ICE9PSAnZnVuY3Rpb24nKSB8fCB0YXJnZXQgPT0gbnVsbCkge1xuXHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbaV07XG5cdFx0Ly8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuXHRcdGlmIChvcHRpb25zICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ICE9PSBjb3B5KSB7XG5cdFx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBpc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRcdGlmIChjb3B5SXNBcnJheSkge1xuXHRcdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBpc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgY29weSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3Rcblx0cmV0dXJuIHRhcmdldDtcbn07XG5cbiIsIi8vIENvcHlyaWdodCAyMDE0IFNpbW9uIEx5ZGVsbFxyXG4vLyBYMTEgKOKAnE1JVOKAnSkgTGljZW5zZWQuIChTZWUgTElDRU5TRS4pXHJcblxyXG52b2lkIChmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XHJcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICBkZWZpbmUoZmFjdG9yeSlcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKVxyXG4gIH0gZWxzZSB7XHJcbiAgICByb290LnJlc29sdmVVcmwgPSBmYWN0b3J5KClcclxuICB9XHJcbn0odGhpcywgZnVuY3Rpb24oKSB7XHJcblxyXG4gIGZ1bmN0aW9uIHJlc29sdmVVcmwoLyogLi4udXJscyAqLykge1xyXG4gICAgdmFyIG51bVVybHMgPSBhcmd1bWVudHMubGVuZ3RoXHJcblxyXG4gICAgaWYgKG51bVVybHMgPT09IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVzb2x2ZVVybCByZXF1aXJlcyBhdCBsZWFzdCBvbmUgYXJndW1lbnQ7IGdvdCBub25lLlwiKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBiYXNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJhc2VcIilcclxuICAgIGJhc2UuaHJlZiA9IGFyZ3VtZW50c1swXVxyXG5cclxuICAgIGlmIChudW1VcmxzID09PSAxKSB7XHJcbiAgICAgIHJldHVybiBiYXNlLmhyZWZcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaGVhZFwiKVswXVxyXG4gICAgaGVhZC5pbnNlcnRCZWZvcmUoYmFzZSwgaGVhZC5maXJzdENoaWxkKVxyXG5cclxuICAgIHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIilcclxuICAgIHZhciByZXNvbHZlZFxyXG5cclxuICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBudW1VcmxzOyBpbmRleCsrKSB7XHJcbiAgICAgIGEuaHJlZiA9IGFyZ3VtZW50c1tpbmRleF1cclxuICAgICAgcmVzb2x2ZWQgPSBhLmhyZWZcclxuICAgICAgYmFzZS5ocmVmID0gcmVzb2x2ZWRcclxuICAgIH1cclxuXHJcbiAgICBoZWFkLnJlbW92ZUNoaWxkKGJhc2UpXHJcblxyXG4gICAgcmV0dXJuIHJlc29sdmVkXHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmVzb2x2ZVVybFxyXG5cclxufSkpO1xyXG4iLCIoZnVuY3Rpb24oc2VsZikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgaWYgKHNlbGYuZmV0Y2gpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHZhciBzdXBwb3J0ID0ge1xuICAgIHNlYXJjaFBhcmFtczogJ1VSTFNlYXJjaFBhcmFtcycgaW4gc2VsZixcbiAgICBpdGVyYWJsZTogJ1N5bWJvbCcgaW4gc2VsZiAmJiAnaXRlcmF0b3InIGluIFN5bWJvbCxcbiAgICBibG9iOiAnRmlsZVJlYWRlcicgaW4gc2VsZiAmJiAnQmxvYicgaW4gc2VsZiAmJiAoZnVuY3Rpb24oKSB7XG4gICAgICB0cnkge1xuICAgICAgICBuZXcgQmxvYigpXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSkoKSxcbiAgICBmb3JtRGF0YTogJ0Zvcm1EYXRhJyBpbiBzZWxmLFxuICAgIGFycmF5QnVmZmVyOiAnQXJyYXlCdWZmZXInIGluIHNlbGZcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU5hbWUobmFtZSkge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG5hbWUgPSBTdHJpbmcobmFtZSlcbiAgICB9XG4gICAgaWYgKC9bXmEtejAtOVxcLSMkJSYnKisuXFxeX2B8fl0vaS50ZXN0KG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZScpXG4gICAgfVxuICAgIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKClcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZVZhbHVlKHZhbHVlKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVcbiAgfVxuXG4gIC8vIEJ1aWxkIGEgZGVzdHJ1Y3RpdmUgaXRlcmF0b3IgZm9yIHRoZSB2YWx1ZSBsaXN0XG4gIGZ1bmN0aW9uIGl0ZXJhdG9yRm9yKGl0ZW1zKSB7XG4gICAgdmFyIGl0ZXJhdG9yID0ge1xuICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGl0ZW1zLnNoaWZ0KClcbiAgICAgICAgcmV0dXJuIHtkb25lOiB2YWx1ZSA9PT0gdW5kZWZpbmVkLCB2YWx1ZTogdmFsdWV9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICAgIGl0ZXJhdG9yW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZXJhdG9yXG4gIH1cblxuICBmdW5jdGlvbiBIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICB0aGlzLm1hcCA9IHt9XG5cbiAgICBpZiAoaGVhZGVycyBpbnN0YW5jZW9mIEhlYWRlcnMpIHtcbiAgICAgIGhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCB2YWx1ZSlcbiAgICAgIH0sIHRoaXMpXG5cbiAgICB9IGVsc2UgaWYgKGhlYWRlcnMpIHtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCBoZWFkZXJzW25hbWVdKVxuICAgICAgfSwgdGhpcylcbiAgICB9XG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gICAgdmFsdWUgPSBub3JtYWxpemVWYWx1ZSh2YWx1ZSlcbiAgICB2YXIgbGlzdCA9IHRoaXMubWFwW25hbWVdXG4gICAgaWYgKCFsaXN0KSB7XG4gICAgICBsaXN0ID0gW11cbiAgICAgIHRoaXMubWFwW25hbWVdID0gbGlzdFxuICAgIH1cbiAgICBsaXN0LnB1c2godmFsdWUpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZVsnZGVsZXRlJ10gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgZGVsZXRlIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIHZhbHVlcyA9IHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldXG4gICAgcmV0dXJuIHZhbHVlcyA/IHZhbHVlc1swXSA6IG51bGxcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmdldEFsbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV0gfHwgW11cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tYXAuaGFzT3duUHJvcGVydHkobm9ybWFsaXplTmFtZShuYW1lKSlcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV0gPSBbbm9ybWFsaXplVmFsdWUodmFsdWUpXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcy5tYXApLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgdGhpcy5tYXBbbmFtZV0uZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHZhbHVlLCBuYW1lLCB0aGlzKVxuICAgICAgfSwgdGhpcylcbiAgICB9LCB0aGlzKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2gobmFtZSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS52YWx1ZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkgeyBpdGVtcy5wdXNoKHZhbHVlKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmVudHJpZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkgeyBpdGVtcy5wdXNoKFtuYW1lLCB2YWx1ZV0pIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICBIZWFkZXJzLnByb3RvdHlwZVtTeW1ib2wuaXRlcmF0b3JdID0gSGVhZGVycy5wcm90b3R5cGUuZW50cmllc1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3VtZWQoYm9keSkge1xuICAgIGlmIChib2R5LmJvZHlVc2VkKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcignQWxyZWFkeSByZWFkJykpXG4gICAgfVxuICAgIGJvZHkuYm9keVVzZWQgPSB0cnVlXG4gIH1cblxuICBmdW5jdGlvbiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpXG4gICAgICB9XG4gICAgICByZWFkZXIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QocmVhZGVyLmVycm9yKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzQXJyYXlCdWZmZXIoYmxvYikge1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgcmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpXG4gICAgcmV0dXJuIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzVGV4dChibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICByZWFkZXIucmVhZEFzVGV4dChibG9iKVxuICAgIHJldHVybiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICB9XG5cbiAgZnVuY3Rpb24gQm9keSgpIHtcbiAgICB0aGlzLmJvZHlVc2VkID0gZmFsc2VcblxuICAgIHRoaXMuX2luaXRCb2R5ID0gZnVuY3Rpb24oYm9keSkge1xuICAgICAgdGhpcy5fYm9keUluaXQgPSBib2R5XG4gICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmJsb2IgJiYgQmxvYi5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5QmxvYiA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5mb3JtRGF0YSAmJiBGb3JtRGF0YS5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5Rm9ybURhdGEgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9IGJvZHkudG9TdHJpbmcoKVxuICAgICAgfSBlbHNlIGlmICghYm9keSkge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgQXJyYXlCdWZmZXIucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgLy8gT25seSBzdXBwb3J0IEFycmF5QnVmZmVycyBmb3IgUE9TVCBtZXRob2QuXG4gICAgICAgIC8vIFJlY2VpdmluZyBBcnJheUJ1ZmZlcnMgaGFwcGVucyB2aWEgQmxvYnMsIGluc3RlYWQuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIEJvZHlJbml0IHR5cGUnKVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuaGVhZGVycy5nZXQoJ2NvbnRlbnQtdHlwZScpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCAndGV4dC9wbGFpbjtjaGFyc2V0PVVURi04JylcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QmxvYiAmJiB0aGlzLl9ib2R5QmxvYi50eXBlKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgdGhpcy5fYm9keUJsb2IudHlwZSlcbiAgICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LnNlYXJjaFBhcmFtcyAmJiBVUkxTZWFyY2hQYXJhbXMucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuYmxvYikge1xuICAgICAgdGhpcy5ibG9iID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QmxvYilcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5Rm9ybURhdGEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCByZWFkIEZvcm1EYXRhIGJvZHkgYXMgYmxvYicpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbdGhpcy5fYm9keVRleHRdKSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmFycmF5QnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsb2IoKS50aGVuKHJlYWRCbG9iQXNBcnJheUJ1ZmZlcilcbiAgICAgIH1cblxuICAgICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgICAgcmV0dXJuIHJlYWRCbG9iQXNUZXh0KHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyB0ZXh0JylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgICByZXR1cm4gcmVqZWN0ZWQgPyByZWplY3RlZCA6IFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5VGV4dClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5mb3JtRGF0YSkge1xuICAgICAgdGhpcy5mb3JtRGF0YSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihkZWNvZGUpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5qc29uID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihKU09OLnBhcnNlKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvLyBIVFRQIG1ldGhvZHMgd2hvc2UgY2FwaXRhbGl6YXRpb24gc2hvdWxkIGJlIG5vcm1hbGl6ZWRcbiAgdmFyIG1ldGhvZHMgPSBbJ0RFTEVURScsICdHRVQnLCAnSEVBRCcsICdPUFRJT05TJywgJ1BPU1QnLCAnUFVUJ11cblxuICBmdW5jdGlvbiBub3JtYWxpemVNZXRob2QobWV0aG9kKSB7XG4gICAgdmFyIHVwY2FzZWQgPSBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgIHJldHVybiAobWV0aG9kcy5pbmRleE9mKHVwY2FzZWQpID4gLTEpID8gdXBjYXNlZCA6IG1ldGhvZFxuICB9XG5cbiAgZnVuY3Rpb24gUmVxdWVzdChpbnB1dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHlcbiAgICBpZiAoUmVxdWVzdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihpbnB1dCkpIHtcbiAgICAgIGlmIChpbnB1dC5ib2R5VXNlZCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKVxuICAgICAgfVxuICAgICAgdGhpcy51cmwgPSBpbnB1dC51cmxcbiAgICAgIHRoaXMuY3JlZGVudGlhbHMgPSBpbnB1dC5jcmVkZW50aWFsc1xuICAgICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMoaW5wdXQuaGVhZGVycylcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0aG9kID0gaW5wdXQubWV0aG9kXG4gICAgICB0aGlzLm1vZGUgPSBpbnB1dC5tb2RlXG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgYm9keSA9IGlucHV0Ll9ib2R5SW5pdFxuICAgICAgICBpbnB1dC5ib2R5VXNlZCA9IHRydWVcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cmwgPSBpbnB1dFxuICAgIH1cblxuICAgIHRoaXMuY3JlZGVudGlhbHMgPSBvcHRpb25zLmNyZWRlbnRpYWxzIHx8IHRoaXMuY3JlZGVudGlhbHMgfHwgJ29taXQnXG4gICAgaWYgKG9wdGlvbnMuaGVhZGVycyB8fCAhdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpXG4gICAgfVxuICAgIHRoaXMubWV0aG9kID0gbm9ybWFsaXplTWV0aG9kKG9wdGlvbnMubWV0aG9kIHx8IHRoaXMubWV0aG9kIHx8ICdHRVQnKVxuICAgIHRoaXMubW9kZSA9IG9wdGlvbnMubW9kZSB8fCB0aGlzLm1vZGUgfHwgbnVsbFxuICAgIHRoaXMucmVmZXJyZXIgPSBudWxsXG5cbiAgICBpZiAoKHRoaXMubWV0aG9kID09PSAnR0VUJyB8fCB0aGlzLm1ldGhvZCA9PT0gJ0hFQUQnKSAmJiBib2R5KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCb2R5IG5vdCBhbGxvd2VkIGZvciBHRVQgb3IgSEVBRCByZXF1ZXN0cycpXG4gICAgfVxuICAgIHRoaXMuX2luaXRCb2R5KGJvZHkpXG4gIH1cblxuICBSZXF1ZXN0LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdCh0aGlzKVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlKGJvZHkpIHtcbiAgICB2YXIgZm9ybSA9IG5ldyBGb3JtRGF0YSgpXG4gICAgYm9keS50cmltKCkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3JtXG4gIH1cblxuICBmdW5jdGlvbiBoZWFkZXJzKHhocikge1xuICAgIHZhciBoZWFkID0gbmV3IEhlYWRlcnMoKVxuICAgIHZhciBwYWlycyA9ICh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkgfHwgJycpLnRyaW0oKS5zcGxpdCgnXFxuJylcbiAgICBwYWlycy5mb3JFYWNoKGZ1bmN0aW9uKGhlYWRlcikge1xuICAgICAgdmFyIHNwbGl0ID0gaGVhZGVyLnRyaW0oKS5zcGxpdCgnOicpXG4gICAgICB2YXIga2V5ID0gc3BsaXQuc2hpZnQoKS50cmltKClcbiAgICAgIHZhciB2YWx1ZSA9IHNwbGl0LmpvaW4oJzonKS50cmltKClcbiAgICAgIGhlYWQuYXBwZW5kKGtleSwgdmFsdWUpXG4gICAgfSlcbiAgICByZXR1cm4gaGVhZFxuICB9XG5cbiAgQm9keS5jYWxsKFJlcXVlc3QucHJvdG90eXBlKVxuXG4gIGZ1bmN0aW9uIFJlc3BvbnNlKGJvZHlJbml0LCBvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0ge31cbiAgICB9XG5cbiAgICB0aGlzLnR5cGUgPSAnZGVmYXVsdCdcbiAgICB0aGlzLnN0YXR1cyA9IG9wdGlvbnMuc3RhdHVzXG4gICAgdGhpcy5vayA9IHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDMwMFxuICAgIHRoaXMuc3RhdHVzVGV4dCA9IG9wdGlvbnMuc3RhdHVzVGV4dFxuICAgIHRoaXMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyBpbnN0YW5jZW9mIEhlYWRlcnMgPyBvcHRpb25zLmhlYWRlcnMgOiBuZXcgSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpXG4gICAgdGhpcy51cmwgPSBvcHRpb25zLnVybCB8fCAnJ1xuICAgIHRoaXMuX2luaXRCb2R5KGJvZHlJbml0KVxuICB9XG5cbiAgQm9keS5jYWxsKFJlc3BvbnNlLnByb3RvdHlwZSlcblxuICBSZXNwb25zZS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHRoaXMuX2JvZHlJbml0LCB7XG4gICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgc3RhdHVzVGV4dDogdGhpcy5zdGF0dXNUZXh0LFxuICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnModGhpcy5oZWFkZXJzKSxcbiAgICAgIHVybDogdGhpcy51cmxcbiAgICB9KVxuICB9XG5cbiAgUmVzcG9uc2UuZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobnVsbCwge3N0YXR1czogMCwgc3RhdHVzVGV4dDogJyd9KVxuICAgIHJlc3BvbnNlLnR5cGUgPSAnZXJyb3InXG4gICAgcmV0dXJuIHJlc3BvbnNlXG4gIH1cblxuICB2YXIgcmVkaXJlY3RTdGF0dXNlcyA9IFszMDEsIDMwMiwgMzAzLCAzMDcsIDMwOF1cblxuICBSZXNwb25zZS5yZWRpcmVjdCA9IGZ1bmN0aW9uKHVybCwgc3RhdHVzKSB7XG4gICAgaWYgKHJlZGlyZWN0U3RhdHVzZXMuaW5kZXhPZihzdGF0dXMpID09PSAtMSkge1xuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgc3RhdHVzIGNvZGUnKVxuICAgIH1cblxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwge3N0YXR1czogc3RhdHVzLCBoZWFkZXJzOiB7bG9jYXRpb246IHVybH19KVxuICB9XG5cbiAgc2VsZi5IZWFkZXJzID0gSGVhZGVyc1xuICBzZWxmLlJlcXVlc3QgPSBSZXF1ZXN0XG4gIHNlbGYuUmVzcG9uc2UgPSBSZXNwb25zZVxuXG4gIHNlbGYuZmV0Y2ggPSBmdW5jdGlvbihpbnB1dCwgaW5pdCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHZhciByZXF1ZXN0XG4gICAgICBpZiAoUmVxdWVzdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihpbnB1dCkgJiYgIWluaXQpIHtcbiAgICAgICAgcmVxdWVzdCA9IGlucHV0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXF1ZXN0ID0gbmV3IFJlcXVlc3QoaW5wdXQsIGluaXQpXG4gICAgICB9XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gICAgICBmdW5jdGlvbiByZXNwb25zZVVSTCgpIHtcbiAgICAgICAgaWYgKCdyZXNwb25zZVVSTCcgaW4geGhyKSB7XG4gICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVVSTFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXZvaWQgc2VjdXJpdHkgd2FybmluZ3Mgb24gZ2V0UmVzcG9uc2VIZWFkZXIgd2hlbiBub3QgYWxsb3dlZCBieSBDT1JTXG4gICAgICAgIGlmICgvXlgtUmVxdWVzdC1VUkw6L20udGVzdCh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkpKSB7XG4gICAgICAgICAgcmV0dXJuIHhoci5nZXRSZXNwb25zZUhlYWRlcignWC1SZXF1ZXN0LVVSTCcpXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICBzdGF0dXM6IHhoci5zdGF0dXMsXG4gICAgICAgICAgc3RhdHVzVGV4dDogeGhyLnN0YXR1c1RleHQsXG4gICAgICAgICAgaGVhZGVyczogaGVhZGVycyh4aHIpLFxuICAgICAgICAgIHVybDogcmVzcG9uc2VVUkwoKVxuICAgICAgICB9XG4gICAgICAgIHZhciBib2R5ID0gJ3Jlc3BvbnNlJyBpbiB4aHIgPyB4aHIucmVzcG9uc2UgOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgIHJlc29sdmUobmV3IFJlc3BvbnNlKGJvZHksIG9wdGlvbnMpKVxuICAgICAgfVxuXG4gICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignTmV0d29yayByZXF1ZXN0IGZhaWxlZCcpKVxuICAgICAgfVxuXG4gICAgICB4aHIub250aW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCdOZXR3b3JrIHJlcXVlc3QgZmFpbGVkJykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vcGVuKHJlcXVlc3QubWV0aG9kLCByZXF1ZXN0LnVybCwgdHJ1ZSlcblxuICAgICAgaWYgKHJlcXVlc3QuY3JlZGVudGlhbHMgPT09ICdpbmNsdWRlJykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZVxuICAgICAgfVxuXG4gICAgICBpZiAoJ3Jlc3BvbnNlVHlwZScgaW4geGhyICYmIHN1cHBvcnQuYmxvYikge1xuICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InXG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QuaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKVxuICAgICAgfSlcblxuICAgICAgeGhyLnNlbmQodHlwZW9mIHJlcXVlc3QuX2JvZHlJbml0ID09PSAndW5kZWZpbmVkJyA/IG51bGwgOiByZXF1ZXN0Ll9ib2R5SW5pdClcbiAgICB9KVxuICB9XG4gIHNlbGYuZmV0Y2gucG9seWZpbGwgPSB0cnVlXG59KSh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgPyBzZWxmIDogdGhpcyk7XG4iLCJ2YXIgYmVsID0gcmVxdWlyZSgnYmVsJykgLy8gdHVybnMgdGVtcGxhdGUgdGFnIGludG8gRE9NIGVsZW1lbnRzXG52YXIgbW9ycGhkb20gPSByZXF1aXJlKCdtb3JwaGRvbScpIC8vIGVmZmljaWVudGx5IGRpZmZzICsgbW9ycGhzIHR3byBET00gZWxlbWVudHNcbnZhciBkZWZhdWx0RXZlbnRzID0gcmVxdWlyZSgnLi91cGRhdGUtZXZlbnRzLmpzJykgLy8gZGVmYXVsdCBldmVudHMgdG8gYmUgY29waWVkIHdoZW4gZG9tIGVsZW1lbnRzIHVwZGF0ZVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJlbFxuXG4vLyBUT0RPIG1vdmUgdGhpcyArIGRlZmF1bHRFdmVudHMgdG8gYSBuZXcgbW9kdWxlIG9uY2Ugd2UgcmVjZWl2ZSBtb3JlIGZlZWRiYWNrXG5tb2R1bGUuZXhwb3J0cy51cGRhdGUgPSBmdW5jdGlvbiAoZnJvbU5vZGUsIHRvTm9kZSwgb3B0cykge1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuICBpZiAob3B0cy5ldmVudHMgIT09IGZhbHNlKSB7XG4gICAgaWYgKCFvcHRzLm9uQmVmb3JlRWxVcGRhdGVkKSBvcHRzLm9uQmVmb3JlRWxVcGRhdGVkID0gY29waWVyXG4gIH1cblxuICByZXR1cm4gbW9ycGhkb20oZnJvbU5vZGUsIHRvTm9kZSwgb3B0cylcblxuICAvLyBtb3JwaGRvbSBvbmx5IGNvcGllcyBhdHRyaWJ1dGVzLiB3ZSBkZWNpZGVkIHdlIGFsc28gd2FudGVkIHRvIGNvcHkgZXZlbnRzXG4gIC8vIHRoYXQgY2FuIGJlIHNldCB2aWEgYXR0cmlidXRlc1xuICBmdW5jdGlvbiBjb3BpZXIgKGYsIHQpIHtcbiAgICAvLyBjb3B5IGV2ZW50czpcbiAgICB2YXIgZXZlbnRzID0gb3B0cy5ldmVudHMgfHwgZGVmYXVsdEV2ZW50c1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZXYgPSBldmVudHNbaV1cbiAgICAgIGlmICh0W2V2XSkgeyAvLyBpZiBuZXcgZWxlbWVudCBoYXMgYSB3aGl0ZWxpc3RlZCBhdHRyaWJ1dGVcbiAgICAgICAgZltldl0gPSB0W2V2XSAvLyB1cGRhdGUgZXhpc3RpbmcgZWxlbWVudFxuICAgICAgfSBlbHNlIGlmIChmW2V2XSkgeyAvLyBpZiBleGlzdGluZyBlbGVtZW50IGhhcyBpdCBhbmQgbmV3IG9uZSBkb2VzbnRcbiAgICAgICAgZltldl0gPSB1bmRlZmluZWQgLy8gcmVtb3ZlIGl0IGZyb20gZXhpc3RpbmcgZWxlbWVudFxuICAgICAgfVxuICAgIH1cbiAgICAvLyBjb3B5IHZhbHVlcyBmb3IgZm9ybSBlbGVtZW50c1xuICAgIGlmICgoZi5ub2RlTmFtZSA9PT0gJ0lOUFVUJyAmJiBmLnR5cGUgIT09ICdmaWxlJykgfHwgZi5ub2RlTmFtZSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgIGlmICh0LmdldEF0dHJpYnV0ZSgndmFsdWUnKSA9PT0gbnVsbCkgdC52YWx1ZSA9IGYudmFsdWVcbiAgICB9IGVsc2UgaWYgKGYubm9kZU5hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICAgIGlmICh0LmdldEF0dHJpYnV0ZSgndmFsdWUnKSA9PT0gbnVsbCkgZi52YWx1ZSA9IHQudmFsdWVcbiAgICB9XG4gIH1cbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoJ2dsb2JhbC9kb2N1bWVudCcpXHJcbnZhciBoeXBlcnggPSByZXF1aXJlKCdoeXBlcngnKVxyXG52YXIgb25sb2FkID0gcmVxdWlyZSgnb24tbG9hZCcpXHJcblxyXG52YXIgU1ZHTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXHJcbnZhciBYTElOS05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnXHJcblxyXG52YXIgQk9PTF9QUk9QUyA9IHtcclxuICBhdXRvZm9jdXM6IDEsXHJcbiAgY2hlY2tlZDogMSxcclxuICBkZWZhdWx0Y2hlY2tlZDogMSxcclxuICBkaXNhYmxlZDogMSxcclxuICBmb3Jtbm92YWxpZGF0ZTogMSxcclxuICBpbmRldGVybWluYXRlOiAxLFxyXG4gIHJlYWRvbmx5OiAxLFxyXG4gIHJlcXVpcmVkOiAxLFxyXG4gIHNlbGVjdGVkOiAxLFxyXG4gIHdpbGx2YWxpZGF0ZTogMVxyXG59XHJcbnZhciBTVkdfVEFHUyA9IFtcclxuICAnc3ZnJyxcclxuICAnYWx0R2x5cGgnLCAnYWx0R2x5cGhEZWYnLCAnYWx0R2x5cGhJdGVtJywgJ2FuaW1hdGUnLCAnYW5pbWF0ZUNvbG9yJyxcclxuICAnYW5pbWF0ZU1vdGlvbicsICdhbmltYXRlVHJhbnNmb3JtJywgJ2NpcmNsZScsICdjbGlwUGF0aCcsICdjb2xvci1wcm9maWxlJyxcclxuICAnY3Vyc29yJywgJ2RlZnMnLCAnZGVzYycsICdlbGxpcHNlJywgJ2ZlQmxlbmQnLCAnZmVDb2xvck1hdHJpeCcsXHJcbiAgJ2ZlQ29tcG9uZW50VHJhbnNmZXInLCAnZmVDb21wb3NpdGUnLCAnZmVDb252b2x2ZU1hdHJpeCcsICdmZURpZmZ1c2VMaWdodGluZycsXHJcbiAgJ2ZlRGlzcGxhY2VtZW50TWFwJywgJ2ZlRGlzdGFudExpZ2h0JywgJ2ZlRmxvb2QnLCAnZmVGdW5jQScsICdmZUZ1bmNCJyxcclxuICAnZmVGdW5jRycsICdmZUZ1bmNSJywgJ2ZlR2F1c3NpYW5CbHVyJywgJ2ZlSW1hZ2UnLCAnZmVNZXJnZScsICdmZU1lcmdlTm9kZScsXHJcbiAgJ2ZlTW9ycGhvbG9neScsICdmZU9mZnNldCcsICdmZVBvaW50TGlnaHQnLCAnZmVTcGVjdWxhckxpZ2h0aW5nJyxcclxuICAnZmVTcG90TGlnaHQnLCAnZmVUaWxlJywgJ2ZlVHVyYnVsZW5jZScsICdmaWx0ZXInLCAnZm9udCcsICdmb250LWZhY2UnLFxyXG4gICdmb250LWZhY2UtZm9ybWF0JywgJ2ZvbnQtZmFjZS1uYW1lJywgJ2ZvbnQtZmFjZS1zcmMnLCAnZm9udC1mYWNlLXVyaScsXHJcbiAgJ2ZvcmVpZ25PYmplY3QnLCAnZycsICdnbHlwaCcsICdnbHlwaFJlZicsICdoa2VybicsICdpbWFnZScsICdsaW5lJyxcclxuICAnbGluZWFyR3JhZGllbnQnLCAnbWFya2VyJywgJ21hc2snLCAnbWV0YWRhdGEnLCAnbWlzc2luZy1nbHlwaCcsICdtcGF0aCcsXHJcbiAgJ3BhdGgnLCAncGF0dGVybicsICdwb2x5Z29uJywgJ3BvbHlsaW5lJywgJ3JhZGlhbEdyYWRpZW50JywgJ3JlY3QnLFxyXG4gICdzZXQnLCAnc3RvcCcsICdzd2l0Y2gnLCAnc3ltYm9sJywgJ3RleHQnLCAndGV4dFBhdGgnLCAndGl0bGUnLCAndHJlZicsXHJcbiAgJ3RzcGFuJywgJ3VzZScsICd2aWV3JywgJ3ZrZXJuJ1xyXG5dXHJcblxyXG5mdW5jdGlvbiBiZWxDcmVhdGVFbGVtZW50ICh0YWcsIHByb3BzLCBjaGlsZHJlbikge1xyXG4gIHZhciBlbFxyXG5cclxuICAvLyBJZiBhbiBzdmcgdGFnLCBpdCBuZWVkcyBhIG5hbWVzcGFjZVxyXG4gIGlmIChTVkdfVEFHUy5pbmRleE9mKHRhZykgIT09IC0xKSB7XHJcbiAgICBwcm9wcy5uYW1lc3BhY2UgPSBTVkdOU1xyXG4gIH1cclxuXHJcbiAgLy8gSWYgd2UgYXJlIHVzaW5nIGEgbmFtZXNwYWNlXHJcbiAgdmFyIG5zID0gZmFsc2VcclxuICBpZiAocHJvcHMubmFtZXNwYWNlKSB7XHJcbiAgICBucyA9IHByb3BzLm5hbWVzcGFjZVxyXG4gICAgZGVsZXRlIHByb3BzLm5hbWVzcGFjZVxyXG4gIH1cclxuXHJcbiAgLy8gQ3JlYXRlIHRoZSBlbGVtZW50XHJcbiAgaWYgKG5zKSB7XHJcbiAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhucywgdGFnKVxyXG4gIH0gZWxzZSB7XHJcbiAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKVxyXG4gIH1cclxuXHJcbiAgLy8gSWYgYWRkaW5nIG9ubG9hZCBldmVudHNcclxuICBpZiAocHJvcHMub25sb2FkIHx8IHByb3BzLm9udW5sb2FkKSB7XHJcbiAgICB2YXIgbG9hZCA9IHByb3BzLm9ubG9hZCB8fCBmdW5jdGlvbiAoKSB7fVxyXG4gICAgdmFyIHVubG9hZCA9IHByb3BzLm9udW5sb2FkIHx8IGZ1bmN0aW9uICgpIHt9XHJcbiAgICBvbmxvYWQoZWwsIGZ1bmN0aW9uIGJlbE9ubG9hZCAoKSB7XHJcbiAgICAgIGxvYWQoZWwpXHJcbiAgICB9LCBmdW5jdGlvbiBiZWxPbnVubG9hZCAoKSB7XHJcbiAgICAgIHVubG9hZChlbClcclxuICAgIH0sXHJcbiAgICAvLyBXZSBoYXZlIHRvIHVzZSBub24tc3RhbmRhcmQgYGNhbGxlcmAgdG8gZmluZCB3aG8gaW52b2tlcyBgYmVsQ3JlYXRlRWxlbWVudGBcclxuICAgIGJlbENyZWF0ZUVsZW1lbnQuY2FsbGVyLmNhbGxlci5jYWxsZXIpXHJcbiAgICBkZWxldGUgcHJvcHMub25sb2FkXHJcbiAgICBkZWxldGUgcHJvcHMub251bmxvYWRcclxuICB9XHJcblxyXG4gIC8vIENyZWF0ZSB0aGUgcHJvcGVydGllc1xyXG4gIGZvciAodmFyIHAgaW4gcHJvcHMpIHtcclxuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eShwKSkge1xyXG4gICAgICB2YXIga2V5ID0gcC50b0xvd2VyQ2FzZSgpXHJcbiAgICAgIHZhciB2YWwgPSBwcm9wc1twXVxyXG4gICAgICAvLyBOb3JtYWxpemUgY2xhc3NOYW1lXHJcbiAgICAgIGlmIChrZXkgPT09ICdjbGFzc25hbWUnKSB7XHJcbiAgICAgICAga2V5ID0gJ2NsYXNzJ1xyXG4gICAgICAgIHAgPSAnY2xhc3MnXHJcbiAgICAgIH1cclxuICAgICAgLy8gVGhlIGZvciBhdHRyaWJ1dGUgZ2V0cyB0cmFuc2Zvcm1lZCB0byBodG1sRm9yLCBidXQgd2UganVzdCBzZXQgYXMgZm9yXHJcbiAgICAgIGlmIChwID09PSAnaHRtbEZvcicpIHtcclxuICAgICAgICBwID0gJ2ZvcidcclxuICAgICAgfVxyXG4gICAgICAvLyBJZiBhIHByb3BlcnR5IGlzIGJvb2xlYW4sIHNldCBpdHNlbGYgdG8gdGhlIGtleVxyXG4gICAgICBpZiAoQk9PTF9QUk9QU1trZXldKSB7XHJcbiAgICAgICAgaWYgKHZhbCA9PT0gJ3RydWUnKSB2YWwgPSBrZXlcclxuICAgICAgICBlbHNlIGlmICh2YWwgPT09ICdmYWxzZScpIGNvbnRpbnVlXHJcbiAgICAgIH1cclxuICAgICAgLy8gSWYgYSBwcm9wZXJ0eSBwcmVmZXJzIGJlaW5nIHNldCBkaXJlY3RseSB2cyBzZXRBdHRyaWJ1dGVcclxuICAgICAgaWYgKGtleS5zbGljZSgwLCAyKSA9PT0gJ29uJykge1xyXG4gICAgICAgIGVsW3BdID0gdmFsXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKG5zKSB7XHJcbiAgICAgICAgICBpZiAocCA9PT0gJ3hsaW5rOmhyZWYnKSB7XHJcbiAgICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKFhMSU5LTlMsIHAsIHZhbClcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKG51bGwsIHAsIHZhbClcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgZWwuc2V0QXR0cmlidXRlKHAsIHZhbClcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGFwcGVuZENoaWxkIChjaGlsZHMpIHtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShjaGlsZHMpKSByZXR1cm5cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHZhciBub2RlID0gY2hpbGRzW2ldXHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSB7XHJcbiAgICAgICAgYXBwZW5kQ2hpbGQobm9kZSlcclxuICAgICAgICBjb250aW51ZVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodHlwZW9mIG5vZGUgPT09ICdudW1iZXInIHx8XHJcbiAgICAgICAgdHlwZW9mIG5vZGUgPT09ICdib29sZWFuJyB8fFxyXG4gICAgICAgIG5vZGUgaW5zdGFuY2VvZiBEYXRlIHx8XHJcbiAgICAgICAgbm9kZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG4gICAgICAgIG5vZGUgPSBub2RlLnRvU3RyaW5nKClcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIGlmIChlbC5sYXN0Q2hpbGQgJiYgZWwubGFzdENoaWxkLm5vZGVOYW1lID09PSAnI3RleHQnKSB7XHJcbiAgICAgICAgICBlbC5sYXN0Q2hpbGQubm9kZVZhbHVlICs9IG5vZGVcclxuICAgICAgICAgIGNvbnRpbnVlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShub2RlKVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAobm9kZSAmJiBub2RlLm5vZGVUeXBlKSB7XHJcbiAgICAgICAgZWwuYXBwZW5kQ2hpbGQobm9kZSlcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICBhcHBlbmRDaGlsZChjaGlsZHJlbilcclxuXHJcbiAgcmV0dXJuIGVsXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaHlwZXJ4KGJlbENyZWF0ZUVsZW1lbnQpXHJcbm1vZHVsZS5leHBvcnRzLmNyZWF0ZUVsZW1lbnQgPSBiZWxDcmVhdGVFbGVtZW50XHJcbiIsInZhciB0b3BMZXZlbCA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDpcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHt9XG52YXIgbWluRG9jID0gcmVxdWlyZSgnbWluLWRvY3VtZW50Jyk7XG5cbmlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2N1bWVudDtcbn0gZWxzZSB7XG4gICAgdmFyIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXTtcblxuICAgIGlmICghZG9jY3kpIHtcbiAgICAgICAgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddID0gbWluRG9jO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jY3k7XG59XG4iLCJpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBnbG9iYWw7XG59IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiKXtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHNlbGY7XG59IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge307XG59XG4iLCJ2YXIgYXR0clRvUHJvcCA9IHJlcXVpcmUoJ2h5cGVyc2NyaXB0LWF0dHJpYnV0ZS10by1wcm9wZXJ0eScpXG5cbnZhciBWQVIgPSAwLCBURVhUID0gMSwgT1BFTiA9IDIsIENMT1NFID0gMywgQVRUUiA9IDRcbnZhciBBVFRSX0tFWSA9IDUsIEFUVFJfS0VZX1cgPSA2XG52YXIgQVRUUl9WQUxVRV9XID0gNywgQVRUUl9WQUxVRSA9IDhcbnZhciBBVFRSX1ZBTFVFX1NRID0gOSwgQVRUUl9WQUxVRV9EUSA9IDEwXG52YXIgQVRUUl9FUSA9IDExLCBBVFRSX0JSRUFLID0gMTJcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoaCwgb3B0cykge1xuICBoID0gYXR0clRvUHJvcChoKVxuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuICB2YXIgY29uY2F0ID0gb3B0cy5jb25jYXQgfHwgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICByZXR1cm4gU3RyaW5nKGEpICsgU3RyaW5nKGIpXG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gKHN0cmluZ3MpIHtcbiAgICB2YXIgc3RhdGUgPSBURVhULCByZWcgPSAnJ1xuICAgIHZhciBhcmdsZW4gPSBhcmd1bWVudHMubGVuZ3RoXG4gICAgdmFyIHBhcnRzID0gW11cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGkgPCBhcmdsZW4gLSAxKSB7XG4gICAgICAgIHZhciBhcmcgPSBhcmd1bWVudHNbaSsxXVxuICAgICAgICB2YXIgcCA9IHBhcnNlKHN0cmluZ3NbaV0pXG4gICAgICAgIHZhciB4c3RhdGUgPSBzdGF0ZVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRKSB4c3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFJfVkFMVUVfU1EpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XKSB4c3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFIpIHhzdGF0ZSA9IEFUVFJfS0VZXG4gICAgICAgIHAucHVzaChbIFZBUiwgeHN0YXRlLCBhcmcgXSlcbiAgICAgICAgcGFydHMucHVzaC5hcHBseShwYXJ0cywgcClcbiAgICAgIH0gZWxzZSBwYXJ0cy5wdXNoLmFwcGx5KHBhcnRzLCBwYXJzZShzdHJpbmdzW2ldKSlcbiAgICB9XG5cbiAgICB2YXIgdHJlZSA9IFtudWxsLHt9LFtdXVxuICAgIHZhciBzdGFjayA9IFtbdHJlZSwtMV1dXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1ciA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVswXVxuICAgICAgdmFyIHAgPSBwYXJ0c1tpXSwgcyA9IHBbMF1cbiAgICAgIGlmIChzID09PSBPUEVOICYmIC9eXFwvLy50ZXN0KHBbMV0pKSB7XG4gICAgICAgIHZhciBpeCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVsxXVxuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID4gMSkge1xuICAgICAgICAgIHN0YWNrLnBvcCgpXG4gICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoLTFdWzBdWzJdW2l4XSA9IGgoXG4gICAgICAgICAgICBjdXJbMF0sIGN1clsxXSwgY3VyWzJdLmxlbmd0aCA/IGN1clsyXSA6IHVuZGVmaW5lZFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzID09PSBPUEVOKSB7XG4gICAgICAgIHZhciBjID0gW3BbMV0se30sW11dXG4gICAgICAgIGN1clsyXS5wdXNoKGMpXG4gICAgICAgIHN0YWNrLnB1c2goW2MsY3VyWzJdLmxlbmd0aC0xXSlcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9LRVkgfHwgKHMgPT09IFZBUiAmJiBwWzFdID09PSBBVFRSX0tFWSkpIHtcbiAgICAgICAgdmFyIGtleSA9ICcnXG4gICAgICAgIHZhciBjb3B5S2V5XG4gICAgICAgIGZvciAoOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBrZXkgPSBjb25jYXQoa2V5LCBwYXJ0c1tpXVsxXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHBhcnRzW2ldWzBdID09PSBWQVIgJiYgcGFydHNbaV1bMV0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhcnRzW2ldWzJdID09PSAnb2JqZWN0JyAmJiAha2V5KSB7XG4gICAgICAgICAgICAgIGZvciAoY29weUtleSBpbiBwYXJ0c1tpXVsyXSkge1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0c1tpXVsyXS5oYXNPd25Qcm9wZXJ0eShjb3B5S2V5KSAmJiAhY3VyWzFdW2NvcHlLZXldKSB7XG4gICAgICAgICAgICAgICAgICBjdXJbMV1bY29weUtleV0gPSBwYXJ0c1tpXVsyXVtjb3B5S2V5XVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAga2V5ID0gY29uY2F0KGtleSwgcGFydHNbaV1bMl0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSBBVFRSX0VRKSBpKytcbiAgICAgICAgdmFyIGogPSBpXG4gICAgICAgIGZvciAoOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfVkFMVUUgfHwgcGFydHNbaV1bMF0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBpZiAoIWN1clsxXVtrZXldKSBjdXJbMV1ba2V5XSA9IHN0cmZuKHBhcnRzW2ldWzFdKVxuICAgICAgICAgICAgZWxzZSBjdXJbMV1ba2V5XSA9IGNvbmNhdChjdXJbMV1ba2V5XSwgcGFydHNbaV1bMV0pXG4gICAgICAgICAgfSBlbHNlIGlmIChwYXJ0c1tpXVswXSA9PT0gVkFSXG4gICAgICAgICAgJiYgKHBhcnRzW2ldWzFdID09PSBBVFRSX1ZBTFVFIHx8IHBhcnRzW2ldWzFdID09PSBBVFRSX0tFWSkpIHtcbiAgICAgICAgICAgIGlmICghY3VyWzFdW2tleV0pIGN1clsxXVtrZXldID0gc3RyZm4ocGFydHNbaV1bMl0pXG4gICAgICAgICAgICBlbHNlIGN1clsxXVtrZXldID0gY29uY2F0KGN1clsxXVtrZXldLCBwYXJ0c1tpXVsyXSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGtleS5sZW5ndGggJiYgIWN1clsxXVtrZXldICYmIGkgPT09IGpcbiAgICAgICAgICAgICYmIChwYXJ0c1tpXVswXSA9PT0gQ0xPU0UgfHwgcGFydHNbaV1bMF0gPT09IEFUVFJfQlJFQUspKSB7XG4gICAgICAgICAgICAgIC8vIGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2luZnJhc3RydWN0dXJlLmh0bWwjYm9vbGVhbi1hdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIC8vIGVtcHR5IHN0cmluZyBpcyBmYWxzeSwgbm90IHdlbGwgYmVoYXZlZCB2YWx1ZSBpbiBicm93c2VyXG4gICAgICAgICAgICAgIGN1clsxXVtrZXldID0ga2V5LnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIGN1clsxXVtwWzFdXSA9IHRydWVcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVkFSICYmIHBbMV0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIGN1clsxXVtwWzJdXSA9IHRydWVcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQ0xPU0UpIHtcbiAgICAgICAgaWYgKHNlbGZDbG9zaW5nKGN1clswXSkgJiYgc3RhY2subGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIGl4ID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzFdXG4gICAgICAgICAgc3RhY2sucG9wKClcbiAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGgtMV1bMF1bMl1baXhdID0gaChcbiAgICAgICAgICAgIGN1clswXSwgY3VyWzFdLCBjdXJbMl0ubGVuZ3RoID8gY3VyWzJdIDogdW5kZWZpbmVkXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IFZBUiAmJiBwWzFdID09PSBURVhUKSB7XG4gICAgICAgIGlmIChwWzJdID09PSB1bmRlZmluZWQgfHwgcFsyXSA9PT0gbnVsbCkgcFsyXSA9ICcnXG4gICAgICAgIGVsc2UgaWYgKCFwWzJdKSBwWzJdID0gY29uY2F0KCcnLCBwWzJdKVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwWzJdWzBdKSkge1xuICAgICAgICAgIGN1clsyXS5wdXNoLmFwcGx5KGN1clsyXSwgcFsyXSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJbMl0ucHVzaChwWzJdKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IFRFWFQpIHtcbiAgICAgICAgY3VyWzJdLnB1c2gocFsxXSlcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9FUSB8fCBzID09PSBBVFRSX0JSRUFLKSB7XG4gICAgICAgIC8vIG5vLW9wXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaGFuZGxlZDogJyArIHMpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRyZWVbMl0ubGVuZ3RoID4gMSAmJiAvXlxccyokLy50ZXN0KHRyZWVbMl1bMF0pKSB7XG4gICAgICB0cmVlWzJdLnNoaWZ0KClcbiAgICB9XG5cbiAgICBpZiAodHJlZVsyXS5sZW5ndGggPiAyXG4gICAgfHwgKHRyZWVbMl0ubGVuZ3RoID09PSAyICYmIC9cXFMvLnRlc3QodHJlZVsyXVsxXSkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdtdWx0aXBsZSByb290IGVsZW1lbnRzIG11c3QgYmUgd3JhcHBlZCBpbiBhbiBlbmNsb3NpbmcgdGFnJ1xuICAgICAgKVxuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0cmVlWzJdWzBdKSAmJiB0eXBlb2YgdHJlZVsyXVswXVswXSA9PT0gJ3N0cmluZydcbiAgICAmJiBBcnJheS5pc0FycmF5KHRyZWVbMl1bMF1bMl0pKSB7XG4gICAgICB0cmVlWzJdWzBdID0gaCh0cmVlWzJdWzBdWzBdLCB0cmVlWzJdWzBdWzFdLCB0cmVlWzJdWzBdWzJdKVxuICAgIH1cbiAgICByZXR1cm4gdHJlZVsyXVswXVxuXG4gICAgZnVuY3Rpb24gcGFyc2UgKHN0cikge1xuICAgICAgdmFyIHJlcyA9IFtdXG4gICAgICBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfVykgc3RhdGUgPSBBVFRSXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYyA9IHN0ci5jaGFyQXQoaSlcbiAgICAgICAgaWYgKHN0YXRlID09PSBURVhUICYmIGMgPT09ICc8Jykge1xuICAgICAgICAgIGlmIChyZWcubGVuZ3RoKSByZXMucHVzaChbVEVYVCwgcmVnXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gT1BFTlxuICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICc+JyAmJiAhcXVvdChzdGF0ZSkpIHtcbiAgICAgICAgICBpZiAoc3RhdGUgPT09IE9QRU4pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtPUEVOLHJlZ10pXG4gICAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnB1c2goW0NMT1NFXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gVEVYVFxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBURVhUKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gT1BFTiAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW09QRU4sIHJlZ10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gT1BFTikge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFIgJiYgL1tcXHctXS8udGVzdChjKSkge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9LRVlcbiAgICAgICAgICByZWcgPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFIgJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIGlmIChyZWcubGVuZ3RoKSByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9CUkVBS10pXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9LRVlfV1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSAmJiBjID09PSAnPScpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSxbQVRUUl9FUV0pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfV1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoKHN0YXRlID09PSBBVFRSX0tFWV9XIHx8IHN0YXRlID09PSBBVFRSKSAmJiBjID09PSAnPScpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9FUV0pXG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX1dcbiAgICAgICAgfSBlbHNlIGlmICgoc3RhdGUgPT09IEFUVFJfS0VZX1cgfHwgc3RhdGUgPT09IEFUVFIpICYmICEvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIGlmICgvW1xcdy1dLy50ZXN0KGMpKSB7XG4gICAgICAgICAgICByZWcgKz0gY1xuICAgICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWVxuICAgICAgICAgIH0gZWxzZSBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XICYmIGMgPT09ICdcIicpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfRFFcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XICYmIGMgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX1NRXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfRFEgJiYgYyA9PT0gJ1wiJykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10sW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfU1EgJiYgYyA9PT0gXCInXCIpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddLFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgIS9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgICBpLS1cbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSxbQVRUUl9CUkVBS10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUVxuICAgICAgICB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSkge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZSA9PT0gVEVYVCAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtURVhULHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfRFEgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXNcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzdHJmbiAoeCkge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHhcbiAgICBlbHNlIGlmICh0eXBlb2YgeCA9PT0gJ3N0cmluZycpIHJldHVybiB4XG4gICAgZWxzZSBpZiAoeCAmJiB0eXBlb2YgeCA9PT0gJ29iamVjdCcpIHJldHVybiB4XG4gICAgZWxzZSByZXR1cm4gY29uY2F0KCcnLCB4KVxuICB9XG59XG5cbmZ1bmN0aW9uIHF1b3QgKHN0YXRlKSB7XG4gIHJldHVybiBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUVxufVxuXG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuZnVuY3Rpb24gaGFzIChvYmosIGtleSkgeyByZXR1cm4gaGFzT3duLmNhbGwob2JqLCBrZXkpIH1cblxudmFyIGNsb3NlUkUgPSBSZWdFeHAoJ14oJyArIFtcbiAgJ2FyZWEnLCAnYmFzZScsICdiYXNlZm9udCcsICdiZ3NvdW5kJywgJ2JyJywgJ2NvbCcsICdjb21tYW5kJywgJ2VtYmVkJyxcbiAgJ2ZyYW1lJywgJ2hyJywgJ2ltZycsICdpbnB1dCcsICdpc2luZGV4JywgJ2tleWdlbicsICdsaW5rJywgJ21ldGEnLCAncGFyYW0nLFxuICAnc291cmNlJywgJ3RyYWNrJywgJ3dicicsXG4gIC8vIFNWRyBUQUdTXG4gICdhbmltYXRlJywgJ2FuaW1hdGVUcmFuc2Zvcm0nLCAnY2lyY2xlJywgJ2N1cnNvcicsICdkZXNjJywgJ2VsbGlwc2UnLFxuICAnZmVCbGVuZCcsICdmZUNvbG9yTWF0cml4JywgJ2ZlQ29tcG9zaXRlJyxcbiAgJ2ZlQ29udm9sdmVNYXRyaXgnLCAnZmVEaWZmdXNlTGlnaHRpbmcnLCAnZmVEaXNwbGFjZW1lbnRNYXAnLFxuICAnZmVEaXN0YW50TGlnaHQnLCAnZmVGbG9vZCcsICdmZUZ1bmNBJywgJ2ZlRnVuY0InLCAnZmVGdW5jRycsICdmZUZ1bmNSJyxcbiAgJ2ZlR2F1c3NpYW5CbHVyJywgJ2ZlSW1hZ2UnLCAnZmVNZXJnZU5vZGUnLCAnZmVNb3JwaG9sb2d5JyxcbiAgJ2ZlT2Zmc2V0JywgJ2ZlUG9pbnRMaWdodCcsICdmZVNwZWN1bGFyTGlnaHRpbmcnLCAnZmVTcG90TGlnaHQnLCAnZmVUaWxlJyxcbiAgJ2ZlVHVyYnVsZW5jZScsICdmb250LWZhY2UtZm9ybWF0JywgJ2ZvbnQtZmFjZS1uYW1lJywgJ2ZvbnQtZmFjZS11cmknLFxuICAnZ2x5cGgnLCAnZ2x5cGhSZWYnLCAnaGtlcm4nLCAnaW1hZ2UnLCAnbGluZScsICdtaXNzaW5nLWdseXBoJywgJ21wYXRoJyxcbiAgJ3BhdGgnLCAncG9seWdvbicsICdwb2x5bGluZScsICdyZWN0JywgJ3NldCcsICdzdG9wJywgJ3RyZWYnLCAndXNlJywgJ3ZpZXcnLFxuICAndmtlcm4nXG5dLmpvaW4oJ3wnKSArICcpKD86W1xcLiNdW2EtekEtWjAtOVxcdTAwN0YtXFx1RkZGRl86LV0rKSokJylcbmZ1bmN0aW9uIHNlbGZDbG9zaW5nICh0YWcpIHsgcmV0dXJuIGNsb3NlUkUudGVzdCh0YWcpIH1cbiIsIm1vZHVsZS5leHBvcnRzID0gYXR0cmlidXRlVG9Qcm9wZXJ0eVxuXG52YXIgdHJhbnNmb3JtID0ge1xuICAnY2xhc3MnOiAnY2xhc3NOYW1lJyxcbiAgJ2Zvcic6ICdodG1sRm9yJyxcbiAgJ2h0dHAtZXF1aXYnOiAnaHR0cEVxdWl2J1xufVxuXG5mdW5jdGlvbiBhdHRyaWJ1dGVUb1Byb3BlcnR5IChoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAodGFnTmFtZSwgYXR0cnMsIGNoaWxkcmVuKSB7XG4gICAgZm9yICh2YXIgYXR0ciBpbiBhdHRycykge1xuICAgICAgaWYgKGF0dHIgaW4gdHJhbnNmb3JtKSB7XG4gICAgICAgIGF0dHJzW3RyYW5zZm9ybVthdHRyXV0gPSBhdHRyc1thdHRyXVxuICAgICAgICBkZWxldGUgYXR0cnNbYXR0cl1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGgodGFnTmFtZSwgYXR0cnMsIGNoaWxkcmVuKVxuICB9XG59XG4iLCIvKiBnbG9iYWwgTXV0YXRpb25PYnNlcnZlciAqL1xudmFyIGRvY3VtZW50ID0gcmVxdWlyZSgnZ2xvYmFsL2RvY3VtZW50JylcbnZhciB3aW5kb3cgPSByZXF1aXJlKCdnbG9iYWwvd2luZG93JylcbnZhciB3YXRjaCA9IE9iamVjdC5jcmVhdGUobnVsbClcbnZhciBLRVlfSUQgPSAnb25sb2FkaWQnICsgKG5ldyBEYXRlKCkgJSA5ZTYpLnRvU3RyaW5nKDM2KVxudmFyIEtFWV9BVFRSID0gJ2RhdGEtJyArIEtFWV9JRFxudmFyIElOREVYID0gMFxuXG5pZiAod2luZG93ICYmIHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyKSB7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uIChtdXRhdGlvbnMpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMod2F0Y2gpLmxlbmd0aCA8IDEpIHJldHVyblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbXV0YXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobXV0YXRpb25zW2ldLmF0dHJpYnV0ZU5hbWUgPT09IEtFWV9BVFRSKSB7XG4gICAgICAgIGVhY2hBdHRyKG11dGF0aW9uc1tpXSwgdHVybm9uLCB0dXJub2ZmKVxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgZWFjaE11dGF0aW9uKG11dGF0aW9uc1tpXS5yZW1vdmVkTm9kZXMsIHR1cm5vZmYpXG4gICAgICBlYWNoTXV0YXRpb24obXV0YXRpb25zW2ldLmFkZGVkTm9kZXMsIHR1cm5vbilcbiAgICB9XG4gIH0pXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlT2xkVmFsdWU6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbS0VZX0FUVFJdXG4gIH0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gb25sb2FkIChlbCwgb24sIG9mZiwgY2FsbGVyKSB7XG4gIG9uID0gb24gfHwgZnVuY3Rpb24gKCkge31cbiAgb2ZmID0gb2ZmIHx8IGZ1bmN0aW9uICgpIHt9XG4gIGVsLnNldEF0dHJpYnV0ZShLRVlfQVRUUiwgJ28nICsgSU5ERVgpXG4gIHdhdGNoWydvJyArIElOREVYXSA9IFtvbiwgb2ZmLCAwLCBjYWxsZXIgfHwgb25sb2FkLmNhbGxlcl1cbiAgSU5ERVggKz0gMVxuICByZXR1cm4gZWxcbn1cblxuZnVuY3Rpb24gdHVybm9uIChpbmRleCwgZWwpIHtcbiAgaWYgKHdhdGNoW2luZGV4XVswXSAmJiB3YXRjaFtpbmRleF1bMl0gPT09IDApIHtcbiAgICB3YXRjaFtpbmRleF1bMF0oZWwpXG4gICAgd2F0Y2hbaW5kZXhdWzJdID0gMVxuICB9XG59XG5cbmZ1bmN0aW9uIHR1cm5vZmYgKGluZGV4LCBlbCkge1xuICBpZiAod2F0Y2hbaW5kZXhdWzFdICYmIHdhdGNoW2luZGV4XVsyXSA9PT0gMSkge1xuICAgIHdhdGNoW2luZGV4XVsxXShlbClcbiAgICB3YXRjaFtpbmRleF1bMl0gPSAwXG4gIH1cbn1cblxuZnVuY3Rpb24gZWFjaEF0dHIgKG11dGF0aW9uLCBvbiwgb2ZmKSB7XG4gIHZhciBuZXdWYWx1ZSA9IG11dGF0aW9uLnRhcmdldC5nZXRBdHRyaWJ1dGUoS0VZX0FUVFIpXG4gIGlmIChzYW1lT3JpZ2luKG11dGF0aW9uLm9sZFZhbHVlLCBuZXdWYWx1ZSkpIHtcbiAgICB3YXRjaFtuZXdWYWx1ZV0gPSB3YXRjaFttdXRhdGlvbi5vbGRWYWx1ZV1cbiAgICByZXR1cm5cbiAgfVxuICBpZiAod2F0Y2hbbXV0YXRpb24ub2xkVmFsdWVdKSB7XG4gICAgb2ZmKG11dGF0aW9uLm9sZFZhbHVlLCBtdXRhdGlvbi50YXJnZXQpXG4gIH1cbiAgaWYgKHdhdGNoW25ld1ZhbHVlXSkge1xuICAgIG9uKG5ld1ZhbHVlLCBtdXRhdGlvbi50YXJnZXQpXG4gIH1cbn1cblxuZnVuY3Rpb24gc2FtZU9yaWdpbiAob2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gIGlmICghb2xkVmFsdWUgfHwgIW5ld1ZhbHVlKSByZXR1cm4gZmFsc2VcbiAgcmV0dXJuIHdhdGNoW29sZFZhbHVlXVszXSA9PT0gd2F0Y2hbbmV3VmFsdWVdWzNdXG59XG5cbmZ1bmN0aW9uIGVhY2hNdXRhdGlvbiAobm9kZXMsIGZuKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMod2F0Y2gpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAobm9kZXNbaV0gJiYgbm9kZXNbaV0uZ2V0QXR0cmlidXRlICYmIG5vZGVzW2ldLmdldEF0dHJpYnV0ZShLRVlfQVRUUikpIHtcbiAgICAgIHZhciBvbmxvYWRpZCA9IG5vZGVzW2ldLmdldEF0dHJpYnV0ZShLRVlfQVRUUilcbiAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICBpZiAob25sb2FkaWQgPT09IGspIHtcbiAgICAgICAgICBmbihrLCBub2Rlc1tpXSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gICAgaWYgKG5vZGVzW2ldLmNoaWxkTm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgZWFjaE11dGF0aW9uKG5vZGVzW2ldLmNoaWxkTm9kZXMsIGZuKVxuICAgIH1cbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLy8gQ3JlYXRlIGEgcmFuZ2Ugb2JqZWN0IGZvciBlZmZpY2VudGx5IHJlbmRlcmluZyBzdHJpbmdzIHRvIGVsZW1lbnRzLlxudmFyIHJhbmdlO1xuXG52YXIgZG9jID0gdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudDtcblxudmFyIHRlc3RFbCA9IGRvYyA/XG4gICAgZG9jLmJvZHkgfHwgZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpIDpcbiAgICB7fTtcblxudmFyIE5TX1hIVE1MID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnO1xuXG52YXIgRUxFTUVOVF9OT0RFID0gMTtcbnZhciBURVhUX05PREUgPSAzO1xudmFyIENPTU1FTlRfTk9ERSA9IDg7XG5cbi8vIEZpeGVzIDxodHRwczovL2dpdGh1Yi5jb20vcGF0cmljay1zdGVlbGUtaWRlbS9tb3JwaGRvbS9pc3N1ZXMvMzI+XG4vLyAoSUU3KyBzdXBwb3J0KSA8PUlFNyBkb2VzIG5vdCBzdXBwb3J0IGVsLmhhc0F0dHJpYnV0ZShuYW1lKVxudmFyIGhhc0F0dHJpYnV0ZU5TO1xuXG5pZiAodGVzdEVsLmhhc0F0dHJpYnV0ZU5TKSB7XG4gICAgaGFzQXR0cmlidXRlTlMgPSBmdW5jdGlvbihlbCwgbmFtZXNwYWNlVVJJLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiBlbC5oYXNBdHRyaWJ1dGVOUyhuYW1lc3BhY2VVUkksIG5hbWUpO1xuICAgIH07XG59IGVsc2UgaWYgKHRlc3RFbC5oYXNBdHRyaWJ1dGUpIHtcbiAgICBoYXNBdHRyaWJ1dGVOUyA9IGZ1bmN0aW9uKGVsLCBuYW1lc3BhY2VVUkksIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGVsLmhhc0F0dHJpYnV0ZShuYW1lKTtcbiAgICB9O1xufSBlbHNlIHtcbiAgICBoYXNBdHRyaWJ1dGVOUyA9IGZ1bmN0aW9uKGVsLCBuYW1lc3BhY2VVUkksIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuICEhZWwuZ2V0QXR0cmlidXRlTm9kZShuYW1lKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB0b0VsZW1lbnQoc3RyKSB7XG4gICAgaWYgKCFyYW5nZSAmJiBkb2MuY3JlYXRlUmFuZ2UpIHtcbiAgICAgICAgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZShkb2MuYm9keSk7XG4gICAgfVxuXG4gICAgdmFyIGZyYWdtZW50O1xuICAgIGlmIChyYW5nZSAmJiByYW5nZS5jcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQpIHtcbiAgICAgICAgZnJhZ21lbnQgPSByYW5nZS5jcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQoc3RyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnbWVudCA9IGRvYy5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgIGZyYWdtZW50LmlubmVySFRNTCA9IHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50LmNoaWxkTm9kZXNbMF07XG59XG5cbmZ1bmN0aW9uIHN5bmNCb29sZWFuQXR0clByb3AoZnJvbUVsLCB0b0VsLCBuYW1lKSB7XG4gICAgaWYgKGZyb21FbFtuYW1lXSAhPT0gdG9FbFtuYW1lXSkge1xuICAgICAgICBmcm9tRWxbbmFtZV0gPSB0b0VsW25hbWVdO1xuICAgICAgICBpZiAoZnJvbUVsW25hbWVdKSB7XG4gICAgICAgICAgICBmcm9tRWwuc2V0QXR0cmlidXRlKG5hbWUsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyb21FbC5yZW1vdmVBdHRyaWJ1dGUobmFtZSwgJycpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG52YXIgc3BlY2lhbEVsSGFuZGxlcnMgPSB7XG4gICAgLyoqXG4gICAgICogTmVlZGVkIGZvciBJRS4gQXBwYXJlbnRseSBJRSBkb2Vzbid0IHRoaW5rIHRoYXQgXCJzZWxlY3RlZFwiIGlzIGFuXG4gICAgICogYXR0cmlidXRlIHdoZW4gcmVhZGluZyBvdmVyIHRoZSBhdHRyaWJ1dGVzIHVzaW5nIHNlbGVjdEVsLmF0dHJpYnV0ZXNcbiAgICAgKi9cbiAgICBPUFRJT046IGZ1bmN0aW9uKGZyb21FbCwgdG9FbCkge1xuICAgICAgICBzeW5jQm9vbGVhbkF0dHJQcm9wKGZyb21FbCwgdG9FbCwgJ3NlbGVjdGVkJyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBUaGUgXCJ2YWx1ZVwiIGF0dHJpYnV0ZSBpcyBzcGVjaWFsIGZvciB0aGUgPGlucHV0PiBlbGVtZW50IHNpbmNlIGl0IHNldHNcbiAgICAgKiB0aGUgaW5pdGlhbCB2YWx1ZS4gQ2hhbmdpbmcgdGhlIFwidmFsdWVcIiBhdHRyaWJ1dGUgd2l0aG91dCBjaGFuZ2luZyB0aGVcbiAgICAgKiBcInZhbHVlXCIgcHJvcGVydHkgd2lsbCBoYXZlIG5vIGVmZmVjdCBzaW5jZSBpdCBpcyBvbmx5IHVzZWQgdG8gdGhlIHNldCB0aGVcbiAgICAgKiBpbml0aWFsIHZhbHVlLiAgU2ltaWxhciBmb3IgdGhlIFwiY2hlY2tlZFwiIGF0dHJpYnV0ZSwgYW5kIFwiZGlzYWJsZWRcIi5cbiAgICAgKi9cbiAgICBJTlBVVDogZnVuY3Rpb24oZnJvbUVsLCB0b0VsKSB7XG4gICAgICAgIHN5bmNCb29sZWFuQXR0clByb3AoZnJvbUVsLCB0b0VsLCAnY2hlY2tlZCcpO1xuICAgICAgICBzeW5jQm9vbGVhbkF0dHJQcm9wKGZyb21FbCwgdG9FbCwgJ2Rpc2FibGVkJyk7XG5cbiAgICAgICAgaWYgKGZyb21FbC52YWx1ZSAhPT0gdG9FbC52YWx1ZSkge1xuICAgICAgICAgICAgZnJvbUVsLnZhbHVlID0gdG9FbC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGFzQXR0cmlidXRlTlModG9FbCwgbnVsbCwgJ3ZhbHVlJykpIHtcbiAgICAgICAgICAgIGZyb21FbC5yZW1vdmVBdHRyaWJ1dGUoJ3ZhbHVlJyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgVEVYVEFSRUE6IGZ1bmN0aW9uKGZyb21FbCwgdG9FbCkge1xuICAgICAgICB2YXIgbmV3VmFsdWUgPSB0b0VsLnZhbHVlO1xuICAgICAgICBpZiAoZnJvbUVsLnZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgZnJvbUVsLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnJvbUVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICAgIGZyb21FbC5maXJzdENoaWxkLm5vZGVWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHR3byBub2RlJ3MgbmFtZXMgYXJlIHRoZSBzYW1lLlxuICpcbiAqIE5PVEU6IFdlIGRvbid0IGJvdGhlciBjaGVja2luZyBgbmFtZXNwYWNlVVJJYCBiZWNhdXNlIHlvdSB3aWxsIG5ldmVyIGZpbmQgdHdvIEhUTUwgZWxlbWVudHMgd2l0aCB0aGUgc2FtZVxuICogICAgICAgbm9kZU5hbWUgYW5kIGRpZmZlcmVudCBuYW1lc3BhY2UgVVJJcy5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGFcbiAqIEBwYXJhbSB7RWxlbWVudH0gYiBUaGUgdGFyZ2V0IGVsZW1lbnRcbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGNvbXBhcmVOb2RlTmFtZXMoZnJvbUVsLCB0b0VsKSB7XG4gICAgdmFyIGZyb21Ob2RlTmFtZSA9IGZyb21FbC5ub2RlTmFtZTtcbiAgICB2YXIgdG9Ob2RlTmFtZSA9IHRvRWwubm9kZU5hbWU7XG5cbiAgICBpZiAoZnJvbU5vZGVOYW1lID09PSB0b05vZGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0b0VsLmFjdHVhbGl6ZSAmJlxuICAgICAgICBmcm9tTm9kZU5hbWUuY2hhckNvZGVBdCgwKSA8IDkxICYmIC8qIGZyb20gdGFnIG5hbWUgaXMgdXBwZXIgY2FzZSAqL1xuICAgICAgICB0b05vZGVOYW1lLmNoYXJDb2RlQXQoMCkgPiA5MCAvKiB0YXJnZXQgdGFnIG5hbWUgaXMgbG93ZXIgY2FzZSAqLykge1xuICAgICAgICAvLyBJZiB0aGUgdGFyZ2V0IGVsZW1lbnQgaXMgYSB2aXJ0dWFsIERPTSBub2RlIHRoZW4gd2UgbWF5IG5lZWQgdG8gbm9ybWFsaXplIHRoZSB0YWcgbmFtZVxuICAgICAgICAvLyBiZWZvcmUgY29tcGFyaW5nLiBOb3JtYWwgSFRNTCBlbGVtZW50cyB0aGF0IGFyZSBpbiB0aGUgXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sXCJcbiAgICAgICAgLy8gYXJlIGNvbnZlcnRlZCB0byB1cHBlciBjYXNlXG4gICAgICAgIHJldHVybiBmcm9tTm9kZU5hbWUgPT09IHRvTm9kZU5hbWUudG9VcHBlckNhc2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBlbGVtZW50LCBvcHRpb25hbGx5IHdpdGggYSBrbm93biBuYW1lc3BhY2UgVVJJLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIHRoZSBlbGVtZW50IG5hbWUsIGUuZy4gJ2Rpdicgb3IgJ3N2ZydcbiAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZXNwYWNlVVJJXSB0aGUgZWxlbWVudCdzIG5hbWVzcGFjZSBVUkksIGkuZS4gdGhlIHZhbHVlIG9mXG4gKiBpdHMgYHhtbG5zYCBhdHRyaWJ1dGUgb3IgaXRzIGluZmVycmVkIG5hbWVzcGFjZS5cbiAqXG4gKiBAcmV0dXJuIHtFbGVtZW50fVxuICovXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50TlMobmFtZSwgbmFtZXNwYWNlVVJJKSB7XG4gICAgcmV0dXJuICFuYW1lc3BhY2VVUkkgfHwgbmFtZXNwYWNlVVJJID09PSBOU19YSFRNTCA/XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50KG5hbWUpIDpcbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIG5hbWUpO1xufVxuXG4vKipcbiAqIExvb3Agb3ZlciBhbGwgb2YgdGhlIGF0dHJpYnV0ZXMgb24gdGhlIHRhcmdldCBub2RlIGFuZCBtYWtlIHN1cmUgdGhlIG9yaWdpbmFsXG4gKiBET00gbm9kZSBoYXMgdGhlIHNhbWUgYXR0cmlidXRlcy4gSWYgYW4gYXR0cmlidXRlIGZvdW5kIG9uIHRoZSBvcmlnaW5hbCBub2RlXG4gKiBpcyBub3Qgb24gdGhlIG5ldyBub2RlIHRoZW4gcmVtb3ZlIGl0IGZyb20gdGhlIG9yaWdpbmFsIG5vZGUuXG4gKlxuICogQHBhcmFtICB7RWxlbWVudH0gZnJvbU5vZGVcbiAqIEBwYXJhbSAge0VsZW1lbnR9IHRvTm9kZVxuICovXG5mdW5jdGlvbiBtb3JwaEF0dHJzKGZyb21Ob2RlLCB0b05vZGUpIHtcbiAgICB2YXIgYXR0cnMgPSB0b05vZGUuYXR0cmlidXRlcztcbiAgICB2YXIgaTtcbiAgICB2YXIgYXR0cjtcbiAgICB2YXIgYXR0ck5hbWU7XG4gICAgdmFyIGF0dHJOYW1lc3BhY2VVUkk7XG4gICAgdmFyIGF0dHJWYWx1ZTtcbiAgICB2YXIgZnJvbVZhbHVlO1xuXG4gICAgaWYgKHRvTm9kZS5hc3NpZ25BdHRyaWJ1dGVzKSB7XG4gICAgICAgIHRvTm9kZS5hc3NpZ25BdHRyaWJ1dGVzKGZyb21Ob2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSBhdHRycy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICAgICAgYXR0ciA9IGF0dHJzW2ldO1xuICAgICAgICAgICAgYXR0ck5hbWUgPSBhdHRyLm5hbWU7XG4gICAgICAgICAgICBhdHRyTmFtZXNwYWNlVVJJID0gYXR0ci5uYW1lc3BhY2VVUkk7XG4gICAgICAgICAgICBhdHRyVmFsdWUgPSBhdHRyLnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZVVSSSkge1xuICAgICAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5sb2NhbE5hbWUgfHwgYXR0ck5hbWU7XG4gICAgICAgICAgICAgICAgZnJvbVZhbHVlID0gZnJvbU5vZGUuZ2V0QXR0cmlidXRlTlMoYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21WYWx1ZSAhPT0gYXR0clZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Ob2RlLnNldEF0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lLCBhdHRyVmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJvbVZhbHVlID0gZnJvbU5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKTtcblxuICAgICAgICAgICAgICAgIGlmIChmcm9tVmFsdWUgIT09IGF0dHJWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmcm9tTm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGFueSBleHRyYSBhdHRyaWJ1dGVzIGZvdW5kIG9uIHRoZSBvcmlnaW5hbCBET00gZWxlbWVudCB0aGF0XG4gICAgLy8gd2VyZW4ndCBmb3VuZCBvbiB0aGUgdGFyZ2V0IGVsZW1lbnQuXG4gICAgYXR0cnMgPSBmcm9tTm9kZS5hdHRyaWJ1dGVzO1xuXG4gICAgZm9yIChpID0gYXR0cnMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgYXR0ciA9IGF0dHJzW2ldO1xuICAgICAgICBpZiAoYXR0ci5zcGVjaWZpZWQgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICBhdHRyTmFtZSA9IGF0dHIubmFtZTtcbiAgICAgICAgICAgIGF0dHJOYW1lc3BhY2VVUkkgPSBhdHRyLm5hbWVzcGFjZVVSSTtcblxuICAgICAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2VVUkkpIHtcbiAgICAgICAgICAgICAgICBhdHRyTmFtZSA9IGF0dHIubG9jYWxOYW1lIHx8IGF0dHJOYW1lO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFoYXNBdHRyaWJ1dGVOUyh0b05vZGUsIGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBmcm9tTm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhhdHRyTmFtZXNwYWNlVVJJLCBhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIWhhc0F0dHJpYnV0ZU5TKHRvTm9kZSwgbnVsbCwgYXR0ck5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIENvcGllcyB0aGUgY2hpbGRyZW4gb2Ygb25lIERPTSBlbGVtZW50IHRvIGFub3RoZXIgRE9NIGVsZW1lbnRcbiAqL1xuZnVuY3Rpb24gbW92ZUNoaWxkcmVuKGZyb21FbCwgdG9FbCkge1xuICAgIHZhciBjdXJDaGlsZCA9IGZyb21FbC5maXJzdENoaWxkO1xuICAgIHdoaWxlIChjdXJDaGlsZCkge1xuICAgICAgICB2YXIgbmV4dENoaWxkID0gY3VyQ2hpbGQubmV4dFNpYmxpbmc7XG4gICAgICAgIHRvRWwuYXBwZW5kQ2hpbGQoY3VyQ2hpbGQpO1xuICAgICAgICBjdXJDaGlsZCA9IG5leHRDaGlsZDtcbiAgICB9XG4gICAgcmV0dXJuIHRvRWw7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRHZXROb2RlS2V5KG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5pZDtcbn1cblxuZnVuY3Rpb24gbW9ycGhkb20oZnJvbU5vZGUsIHRvTm9kZSwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0b05vZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChmcm9tTm9kZS5ub2RlTmFtZSA9PT0gJyNkb2N1bWVudCcgfHwgZnJvbU5vZGUubm9kZU5hbWUgPT09ICdIVE1MJykge1xuICAgICAgICAgICAgdmFyIHRvTm9kZUh0bWwgPSB0b05vZGU7XG4gICAgICAgICAgICB0b05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnaHRtbCcpO1xuICAgICAgICAgICAgdG9Ob2RlLmlubmVySFRNTCA9IHRvTm9kZUh0bWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0b05vZGUgPSB0b0VsZW1lbnQodG9Ob2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBnZXROb2RlS2V5ID0gb3B0aW9ucy5nZXROb2RlS2V5IHx8IGRlZmF1bHRHZXROb2RlS2V5O1xuICAgIHZhciBvbkJlZm9yZU5vZGVBZGRlZCA9IG9wdGlvbnMub25CZWZvcmVOb2RlQWRkZWQgfHwgbm9vcDtcbiAgICB2YXIgb25Ob2RlQWRkZWQgPSBvcHRpb25zLm9uTm9kZUFkZGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uQmVmb3JlRWxVcGRhdGVkID0gb3B0aW9ucy5vbkJlZm9yZUVsVXBkYXRlZCB8fCBub29wO1xuICAgIHZhciBvbkVsVXBkYXRlZCA9IG9wdGlvbnMub25FbFVwZGF0ZWQgfHwgbm9vcDtcbiAgICB2YXIgb25CZWZvcmVOb2RlRGlzY2FyZGVkID0gb3B0aW9ucy5vbkJlZm9yZU5vZGVEaXNjYXJkZWQgfHwgbm9vcDtcbiAgICB2YXIgb25Ob2RlRGlzY2FyZGVkID0gb3B0aW9ucy5vbk5vZGVEaXNjYXJkZWQgfHwgbm9vcDtcbiAgICB2YXIgb25CZWZvcmVFbENoaWxkcmVuVXBkYXRlZCA9IG9wdGlvbnMub25CZWZvcmVFbENoaWxkcmVuVXBkYXRlZCB8fCBub29wO1xuICAgIHZhciBjaGlsZHJlbk9ubHkgPSBvcHRpb25zLmNoaWxkcmVuT25seSA9PT0gdHJ1ZTtcblxuICAgIC8vIFRoaXMgb2JqZWN0IGlzIHVzZWQgYXMgYSBsb29rdXAgdG8gcXVpY2tseSBmaW5kIGFsbCBrZXllZCBlbGVtZW50cyBpbiB0aGUgb3JpZ2luYWwgRE9NIHRyZWUuXG4gICAgdmFyIGZyb21Ob2Rlc0xvb2t1cCA9IHt9O1xuICAgIHZhciBrZXllZFJlbW92YWxMaXN0O1xuXG4gICAgZnVuY3Rpb24gYWRkS2V5ZWRSZW1vdmFsKGtleSkge1xuICAgICAgICBpZiAoa2V5ZWRSZW1vdmFsTGlzdCkge1xuICAgICAgICAgICAga2V5ZWRSZW1vdmFsTGlzdC5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBrZXllZFJlbW92YWxMaXN0ID0gW2tleV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3YWxrRGlzY2FyZGVkQ2hpbGROb2Rlcyhub2RlLCBza2lwS2V5ZWROb2Rlcykge1xuICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICB2YXIgY3VyQ2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB3aGlsZSAoY3VyQ2hpbGQpIHtcblxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2tpcEtleWVkTm9kZXMgJiYgKGtleSA9IGdldE5vZGVLZXkoY3VyQ2hpbGQpKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBJZiB3ZSBhcmUgc2tpcHBpbmcga2V5ZWQgbm9kZXMgdGhlbiB3ZSBhZGQgdGhlIGtleVxuICAgICAgICAgICAgICAgICAgICAvLyB0byBhIGxpc3Qgc28gdGhhdCBpdCBjYW4gYmUgaGFuZGxlZCBhdCB0aGUgdmVyeSBlbmQuXG4gICAgICAgICAgICAgICAgICAgIGFkZEtleWVkUmVtb3ZhbChrZXkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgcmVwb3J0IHRoZSBub2RlIGFzIGRpc2NhcmRlZCBpZiBpdCBpcyBub3Qga2V5ZWQuIFdlIGRvIHRoaXMgYmVjYXVzZVxuICAgICAgICAgICAgICAgICAgICAvLyBhdCB0aGUgZW5kIHdlIGxvb3AgdGhyb3VnaCBhbGwga2V5ZWQgZWxlbWVudHMgdGhhdCB3ZXJlIHVubWF0Y2hlZFxuICAgICAgICAgICAgICAgICAgICAvLyBhbmQgdGhlbiBkaXNjYXJkIHRoZW0gaW4gb25lIGZpbmFsIHBhc3MuXG4gICAgICAgICAgICAgICAgICAgIG9uTm9kZURpc2NhcmRlZChjdXJDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJDaGlsZC5maXJzdENoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YWxrRGlzY2FyZGVkQ2hpbGROb2RlcyhjdXJDaGlsZCwgc2tpcEtleWVkTm9kZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY3VyQ2hpbGQgPSBjdXJDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBET00gbm9kZSBvdXQgb2YgdGhlIG9yaWdpbmFsIERPTVxuICAgICAqXG4gICAgICogQHBhcmFtICB7Tm9kZX0gbm9kZSBUaGUgbm9kZSB0byByZW1vdmVcbiAgICAgKiBAcGFyYW0gIHtOb2RlfSBwYXJlbnROb2RlIFRoZSBub2RlcyBwYXJlbnRcbiAgICAgKiBAcGFyYW0gIHtCb29sZWFufSBza2lwS2V5ZWROb2RlcyBJZiB0cnVlIHRoZW4gZWxlbWVudHMgd2l0aCBrZXlzIHdpbGwgYmUgc2tpcHBlZCBhbmQgbm90IGRpc2NhcmRlZC5cbiAgICAgKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gICAgICovXG4gICAgZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlLCBwYXJlbnROb2RlLCBza2lwS2V5ZWROb2Rlcykge1xuICAgICAgICBpZiAob25CZWZvcmVOb2RlRGlzY2FyZGVkKG5vZGUpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBvbk5vZGVEaXNjYXJkZWQobm9kZSk7XG4gICAgICAgIHdhbGtEaXNjYXJkZWRDaGlsZE5vZGVzKG5vZGUsIHNraXBLZXllZE5vZGVzKTtcbiAgICB9XG5cbiAgICAvLyAvLyBUcmVlV2Fsa2VyIGltcGxlbWVudGF0aW9uIGlzIG5vIGZhc3RlciwgYnV0IGtlZXBpbmcgdGhpcyBhcm91bmQgaW4gY2FzZSB0aGlzIGNoYW5nZXMgaW4gdGhlIGZ1dHVyZVxuICAgIC8vIGZ1bmN0aW9uIGluZGV4VHJlZShyb290KSB7XG4gICAgLy8gICAgIHZhciB0cmVlV2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihcbiAgICAvLyAgICAgICAgIHJvb3QsXG4gICAgLy8gICAgICAgICBOb2RlRmlsdGVyLlNIT1dfRUxFTUVOVCk7XG4gICAgLy9cbiAgICAvLyAgICAgdmFyIGVsO1xuICAgIC8vICAgICB3aGlsZSgoZWwgPSB0cmVlV2Fsa2VyLm5leHROb2RlKCkpKSB7XG4gICAgLy8gICAgICAgICB2YXIga2V5ID0gZ2V0Tm9kZUtleShlbCk7XG4gICAgLy8gICAgICAgICBpZiAoa2V5KSB7XG4gICAgLy8gICAgICAgICAgICAgZnJvbU5vZGVzTG9va3VwW2tleV0gPSBlbDtcbiAgICAvLyAgICAgICAgIH1cbiAgICAvLyAgICAgfVxuICAgIC8vIH1cblxuICAgIC8vIC8vIE5vZGVJdGVyYXRvciBpbXBsZW1lbnRhdGlvbiBpcyBubyBmYXN0ZXIsIGJ1dCBrZWVwaW5nIHRoaXMgYXJvdW5kIGluIGNhc2UgdGhpcyBjaGFuZ2VzIGluIHRoZSBmdXR1cmVcbiAgICAvL1xuICAgIC8vIGZ1bmN0aW9uIGluZGV4VHJlZShub2RlKSB7XG4gICAgLy8gICAgIHZhciBub2RlSXRlcmF0b3IgPSBkb2N1bWVudC5jcmVhdGVOb2RlSXRlcmF0b3Iobm9kZSwgTm9kZUZpbHRlci5TSE9XX0VMRU1FTlQpO1xuICAgIC8vICAgICB2YXIgZWw7XG4gICAgLy8gICAgIHdoaWxlKChlbCA9IG5vZGVJdGVyYXRvci5uZXh0Tm9kZSgpKSkge1xuICAgIC8vICAgICAgICAgdmFyIGtleSA9IGdldE5vZGVLZXkoZWwpO1xuICAgIC8vICAgICAgICAgaWYgKGtleSkge1xuICAgIC8vICAgICAgICAgICAgIGZyb21Ob2Rlc0xvb2t1cFtrZXldID0gZWw7XG4gICAgLy8gICAgICAgICB9XG4gICAgLy8gICAgIH1cbiAgICAvLyB9XG5cbiAgICBmdW5jdGlvbiBpbmRleFRyZWUobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICB2YXIgY3VyQ2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB3aGlsZSAoY3VyQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZ2V0Tm9kZUtleShjdXJDaGlsZCk7XG4gICAgICAgICAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICBmcm9tTm9kZXNMb29rdXBba2V5XSA9IGN1ckNoaWxkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFdhbGsgcmVjdXJzaXZlbHlcbiAgICAgICAgICAgICAgICBpbmRleFRyZWUoY3VyQ2hpbGQpO1xuXG4gICAgICAgICAgICAgICAgY3VyQ2hpbGQgPSBjdXJDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluZGV4VHJlZShmcm9tTm9kZSk7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVOb2RlQWRkZWQoZWwpIHtcbiAgICAgICAgb25Ob2RlQWRkZWQoZWwpO1xuXG4gICAgICAgIHZhciBjdXJDaGlsZCA9IGVsLmZpcnN0Q2hpbGQ7XG4gICAgICAgIHdoaWxlIChjdXJDaGlsZCkge1xuICAgICAgICAgICAgdmFyIG5leHRTaWJsaW5nID0gY3VyQ2hpbGQubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgICAgIHZhciBrZXkgPSBnZXROb2RlS2V5KGN1ckNoaWxkKTtcbiAgICAgICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgdW5tYXRjaGVkRnJvbUVsID0gZnJvbU5vZGVzTG9va3VwW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKHVubWF0Y2hlZEZyb21FbCAmJiBjb21wYXJlTm9kZU5hbWVzKGN1ckNoaWxkLCB1bm1hdGNoZWRGcm9tRWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ckNoaWxkLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHVubWF0Y2hlZEZyb21FbCwgY3VyQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICBtb3JwaEVsKHVubWF0Y2hlZEZyb21FbCwgY3VyQ2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaGFuZGxlTm9kZUFkZGVkKGN1ckNoaWxkKTtcbiAgICAgICAgICAgIGN1ckNoaWxkID0gbmV4dFNpYmxpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb3JwaEVsKGZyb21FbCwgdG9FbCwgY2hpbGRyZW5Pbmx5KSB7XG4gICAgICAgIHZhciB0b0VsS2V5ID0gZ2V0Tm9kZUtleSh0b0VsKTtcbiAgICAgICAgdmFyIGN1ckZyb21Ob2RlS2V5O1xuXG4gICAgICAgIGlmICh0b0VsS2V5KSB7XG4gICAgICAgICAgICAvLyBJZiBhbiBlbGVtZW50IHdpdGggYW4gSUQgaXMgYmVpbmcgbW9ycGhlZCB0aGVuIGl0IGlzIHdpbGwgYmUgaW4gdGhlIGZpbmFsXG4gICAgICAgICAgICAvLyBET00gc28gY2xlYXIgaXQgb3V0IG9mIHRoZSBzYXZlZCBlbGVtZW50cyBjb2xsZWN0aW9uXG4gICAgICAgICAgICBkZWxldGUgZnJvbU5vZGVzTG9va3VwW3RvRWxLZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvTm9kZS5pc1NhbWVOb2RlICYmIHRvTm9kZS5pc1NhbWVOb2RlKGZyb21Ob2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaGlsZHJlbk9ubHkpIHtcbiAgICAgICAgICAgIGlmIChvbkJlZm9yZUVsVXBkYXRlZChmcm9tRWwsIHRvRWwpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbW9ycGhBdHRycyhmcm9tRWwsIHRvRWwpO1xuICAgICAgICAgICAgb25FbFVwZGF0ZWQoZnJvbUVsKTtcblxuICAgICAgICAgICAgaWYgKG9uQmVmb3JlRWxDaGlsZHJlblVwZGF0ZWQoZnJvbUVsLCB0b0VsKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnJvbUVsLm5vZGVOYW1lICE9PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgICAgICB2YXIgY3VyVG9Ob2RlQ2hpbGQgPSB0b0VsLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB2YXIgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21FbC5maXJzdENoaWxkO1xuICAgICAgICAgICAgdmFyIGN1clRvTm9kZUtleTtcblxuICAgICAgICAgICAgdmFyIGZyb21OZXh0U2libGluZztcbiAgICAgICAgICAgIHZhciB0b05leHRTaWJsaW5nO1xuICAgICAgICAgICAgdmFyIG1hdGNoaW5nRnJvbUVsO1xuXG4gICAgICAgICAgICBvdXRlcjogd2hpbGUgKGN1clRvTm9kZUNoaWxkKSB7XG4gICAgICAgICAgICAgICAgdG9OZXh0U2libGluZyA9IGN1clRvTm9kZUNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIGN1clRvTm9kZUtleSA9IGdldE5vZGVLZXkoY3VyVG9Ob2RlQ2hpbGQpO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGN1ckZyb21Ob2RlQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbU5leHRTaWJsaW5nID0gY3VyRnJvbU5vZGVDaGlsZC5uZXh0U2libGluZztcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VyVG9Ob2RlQ2hpbGQuaXNTYW1lTm9kZSAmJiBjdXJUb05vZGVDaGlsZC5pc1NhbWVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJGcm9tTm9kZUNoaWxkID0gZnJvbU5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjdXJGcm9tTm9kZUtleSA9IGdldE5vZGVLZXkoY3VyRnJvbU5vZGVDaGlsZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1ckZyb21Ob2RlVHlwZSA9IGN1ckZyb21Ob2RlQ2hpbGQubm9kZVR5cGU7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGlzQ29tcGF0aWJsZSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVUeXBlID09PSBjdXJUb05vZGVDaGlsZC5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1ckZyb21Ob2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBub2RlcyBiZWluZyBjb21wYXJlZCBhcmUgRWxlbWVudCBub2Rlc1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1clRvTm9kZUtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgdGFyZ2V0IG5vZGUgaGFzIGEga2V5IHNvIHdlIHdhbnQgdG8gbWF0Y2ggaXQgdXAgd2l0aCB0aGUgY29ycmVjdCBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluIHRoZSBvcmlnaW5hbCBET00gdHJlZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyVG9Ob2RlS2V5ICE9PSBjdXJGcm9tTm9kZUtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGN1cnJlbnQgZWxlbWVudCBpbiB0aGUgb3JpZ2luYWwgRE9NIHRyZWUgZG9lcyBub3QgaGF2ZSBhIG1hdGNoaW5nIGtleSBzb1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGV0J3MgY2hlY2sgb3VyIGxvb2t1cCB0byBzZWUgaWYgdGhlcmUgaXMgYSBtYXRjaGluZyBlbGVtZW50IGluIHRoZSBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRE9NIHRyZWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgobWF0Y2hpbmdGcm9tRWwgPSBmcm9tTm9kZXNMb29rdXBbY3VyVG9Ob2RlS2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVDaGlsZC5uZXh0U2libGluZyA9PT0gbWF0Y2hpbmdGcm9tRWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzaW5nbGUgZWxlbWVudCByZW1vdmFscy4gVG8gYXZvaWQgcmVtb3ZpbmcgdGhlIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERPTSBub2RlIG91dCBvZiB0aGUgdHJlZSAoc2luY2UgdGhhdCBjYW4gYnJlYWsgQ1NTIHRyYW5zaXRpb25zLCBldGMuKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2Ugd2lsbCBpbnN0ZWFkIGRpc2NhcmQgdGhlIGN1cnJlbnQgbm9kZSBhbmQgd2FpdCB1bnRpbCB0aGUgbmV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpdGVyYXRpb24gdG8gcHJvcGVybHkgbWF0Y2ggdXAgdGhlIGtleWVkIHRhcmdldCBlbGVtZW50IHdpdGggaXRzIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gdGhlIG9yaWdpbmFsIHRyZWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDb21wYXRpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgZm91bmQgYSBtYXRjaGluZyBrZXllZCBlbGVtZW50IHNvbWV3aGVyZSBpbiB0aGUgb3JpZ2luYWwgRE9NIHRyZWUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExldCdzIG1vdmluZyB0aGUgb3JpZ2luYWwgRE9NIG5vZGUgaW50byB0aGUgY3VycmVudCBwb3NpdGlvbiBhbmQgbW9ycGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXQuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTk9URTogV2UgdXNlIGluc2VydEJlZm9yZSBpbnN0ZWFkIG9mIHJlcGxhY2VDaGlsZCBiZWNhdXNlIHdlIHdhbnQgdG8gZ28gdGhyb3VnaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgYHJlbW92ZU5vZGUoKWAgZnVuY3Rpb24gZm9yIHRoZSBub2RlIHRoYXQgaXMgYmVpbmcgZGlzY2FyZGVkIHNvIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsIGxpZmVjeWNsZSBob29rcyBhcmUgY29ycmVjdGx5IGludm9rZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbUVsLmluc2VydEJlZm9yZShtYXRjaGluZ0Zyb21FbCwgY3VyRnJvbU5vZGVDaGlsZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1ckZyb21Ob2RlS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTaW5jZSB0aGUgbm9kZSBpcyBrZXllZCBpdCBtaWdodCBiZSBtYXRjaGVkIHVwIGxhdGVyIHNvIHdlIGRlZmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgYWN0dWFsIHJlbW92YWwgdG8gbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZEtleWVkUmVtb3ZhbChjdXJGcm9tTm9kZUtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB3ZSBza2lwIG5lc3RlZCBrZXllZCBub2RlcyBmcm9tIGJlaW5nIHJlbW92ZWQgc2luY2UgdGhlcmUgaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgIHN0aWxsIGEgY2hhbmNlIHRoZXkgd2lsbCBiZSBtYXRjaGVkIHVwIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQsIGZyb21FbCwgdHJ1ZSAvKiBza2lwIGtleWVkIG5vZGVzICovKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21OZXh0U2libGluZyA9IGN1ckZyb21Ob2RlQ2hpbGQubmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBtYXRjaGluZ0Zyb21FbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBub2RlcyBhcmUgbm90IGNvbXBhdGlibGUgc2luY2UgdGhlIFwidG9cIiBub2RlIGhhcyBhIGtleSBhbmQgdGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyBubyBtYXRjaGluZyBrZXllZCBub2RlIGluIHRoZSBzb3VyY2UgdHJlZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzQ29tcGF0aWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdXJGcm9tTm9kZUtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgb3JpZ2luYWwgaGFzIGEga2V5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzQ29tcGF0aWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzQ29tcGF0aWJsZSA9IGlzQ29tcGF0aWJsZSAhPT0gZmFsc2UgJiYgY29tcGFyZU5vZGVOYW1lcyhjdXJGcm9tTm9kZUNoaWxkLCBjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ29tcGF0aWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBmb3VuZCBjb21wYXRpYmxlIERPTSBlbGVtZW50cyBzbyB0cmFuc2Zvcm1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGN1cnJlbnQgXCJmcm9tXCIgbm9kZSB0byBtYXRjaCB0aGUgY3VycmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0YXJnZXQgRE9NIG5vZGUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vcnBoRWwoY3VyRnJvbU5vZGVDaGlsZCwgY3VyVG9Ob2RlQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdXJGcm9tTm9kZVR5cGUgPT09IFRFWFRfTk9ERSB8fCBjdXJGcm9tTm9kZVR5cGUgPT0gQ09NTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBub2RlcyBiZWluZyBjb21wYXJlZCBhcmUgVGV4dCBvciBDb21tZW50IG5vZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDb21wYXRpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTaW1wbHkgdXBkYXRlIG5vZGVWYWx1ZSBvbiB0aGUgb3JpZ2luYWwgbm9kZSB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoYW5nZSB0aGUgdGV4dCB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQubm9kZVZhbHVlID0gY3VyVG9Ob2RlQ2hpbGQubm9kZVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ29tcGF0aWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWR2YW5jZSBib3RoIHRoZSBcInRvXCIgY2hpbGQgYW5kIHRoZSBcImZyb21cIiBjaGlsZCBzaW5jZSB3ZSBmb3VuZCBhIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJGcm9tTm9kZUNoaWxkID0gZnJvbU5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBObyBjb21wYXRpYmxlIG1hdGNoIHNvIHJlbW92ZSB0aGUgb2xkIG5vZGUgZnJvbSB0aGUgRE9NIGFuZCBjb250aW51ZSB0cnlpbmcgdG8gZmluZCBhXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hdGNoIGluIHRoZSBvcmlnaW5hbCBET00uIEhvd2V2ZXIsIHdlIG9ubHkgZG8gdGhpcyBpZiB0aGUgZnJvbSBub2RlIGlzIG5vdCBrZXllZFxuICAgICAgICAgICAgICAgICAgICAvLyBzaW5jZSBpdCBpcyBwb3NzaWJsZSB0aGF0IGEga2V5ZWQgbm9kZSBtaWdodCBtYXRjaCB1cCB3aXRoIGEgbm9kZSBzb21ld2hlcmUgZWxzZSBpbiB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gdGFyZ2V0IHRyZWUgYW5kIHdlIGRvbid0IHdhbnQgdG8gZGlzY2FyZCBpdCBqdXN0IHlldCBzaW5jZSBpdCBzdGlsbCBtaWdodCBmaW5kIGFcbiAgICAgICAgICAgICAgICAgICAgLy8gaG9tZSBpbiB0aGUgZmluYWwgRE9NIHRyZWUuIEFmdGVyIGV2ZXJ5dGhpbmcgaXMgZG9uZSB3ZSB3aWxsIHJlbW92ZSBhbnkga2V5ZWQgbm9kZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhhdCBkaWRuJ3QgZmluZCBhIGhvbWVcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1ckZyb21Ob2RlS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTaW5jZSB0aGUgbm9kZSBpcyBrZXllZCBpdCBtaWdodCBiZSBtYXRjaGVkIHVwIGxhdGVyIHNvIHdlIGRlZmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgYWN0dWFsIHJlbW92YWwgdG8gbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZEtleWVkUmVtb3ZhbChjdXJGcm9tTm9kZUtleSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB3ZSBza2lwIG5lc3RlZCBrZXllZCBub2RlcyBmcm9tIGJlaW5nIHJlbW92ZWQgc2luY2UgdGhlcmUgaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgIHN0aWxsIGEgY2hhbmNlIHRoZXkgd2lsbCBiZSBtYXRjaGVkIHVwIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQsIGZyb21FbCwgdHJ1ZSAvKiBza2lwIGtleWVkIG5vZGVzICovKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgZ290IHRoaXMgZmFyIHRoZW4gd2UgZGlkIG5vdCBmaW5kIGEgY2FuZGlkYXRlIG1hdGNoIGZvclxuICAgICAgICAgICAgICAgIC8vIG91ciBcInRvIG5vZGVcIiBhbmQgd2UgZXhoYXVzdGVkIGFsbCBvZiB0aGUgY2hpbGRyZW4gXCJmcm9tXCJcbiAgICAgICAgICAgICAgICAvLyBub2Rlcy4gVGhlcmVmb3JlLCB3ZSB3aWxsIGp1c3QgYXBwZW5kIHRoZSBjdXJyZW50IFwidG9cIiBub2RlXG4gICAgICAgICAgICAgICAgLy8gdG8gdGhlIGVuZFxuICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVLZXkgJiYgKG1hdGNoaW5nRnJvbUVsID0gZnJvbU5vZGVzTG9va3VwW2N1clRvTm9kZUtleV0pICYmIGNvbXBhcmVOb2RlTmFtZXMobWF0Y2hpbmdGcm9tRWwsIGN1clRvTm9kZUNoaWxkKSkge1xuICAgICAgICAgICAgICAgICAgICBmcm9tRWwuYXBwZW5kQ2hpbGQobWF0Y2hpbmdGcm9tRWwpO1xuICAgICAgICAgICAgICAgICAgICBtb3JwaEVsKG1hdGNoaW5nRnJvbUVsLCBjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9uQmVmb3JlTm9kZUFkZGVkUmVzdWx0ID0gb25CZWZvcmVOb2RlQWRkZWQoY3VyVG9Ob2RlQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAob25CZWZvcmVOb2RlQWRkZWRSZXN1bHQgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob25CZWZvcmVOb2RlQWRkZWRSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IG9uQmVmb3JlTm9kZUFkZGVkUmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyVG9Ob2RlQ2hpbGQuYWN0dWFsaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyVG9Ob2RlQ2hpbGQgPSBjdXJUb05vZGVDaGlsZC5hY3R1YWxpemUoZnJvbUVsLm93bmVyRG9jdW1lbnQgfHwgZG9jKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb21FbC5hcHBlbmRDaGlsZChjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVOb2RlQWRkZWQoY3VyVG9Ob2RlQ2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY3VyVG9Ob2RlQ2hpbGQgPSB0b05leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdlIGhhdmUgcHJvY2Vzc2VkIGFsbCBvZiB0aGUgXCJ0byBub2Rlc1wiLiBJZiBjdXJGcm9tTm9kZUNoaWxkIGlzXG4gICAgICAgICAgICAvLyBub24tbnVsbCB0aGVuIHdlIHN0aWxsIGhhdmUgc29tZSBmcm9tIG5vZGVzIGxlZnQgb3ZlciB0aGF0IG5lZWRcbiAgICAgICAgICAgIC8vIHRvIGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHdoaWxlIChjdXJGcm9tTm9kZUNoaWxkKSB7XG4gICAgICAgICAgICAgICAgZnJvbU5leHRTaWJsaW5nID0gY3VyRnJvbU5vZGVDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgICAgICBpZiAoKGN1ckZyb21Ob2RlS2V5ID0gZ2V0Tm9kZUtleShjdXJGcm9tTm9kZUNoaWxkKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2luY2UgdGhlIG5vZGUgaXMga2V5ZWQgaXQgbWlnaHQgYmUgbWF0Y2hlZCB1cCBsYXRlciBzbyB3ZSBkZWZlclxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgYWN0dWFsIHJlbW92YWwgdG8gbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgYWRkS2V5ZWRSZW1vdmFsKGN1ckZyb21Ob2RlS2V5KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB3ZSBza2lwIG5lc3RlZCBrZXllZCBub2RlcyBmcm9tIGJlaW5nIHJlbW92ZWQgc2luY2UgdGhlcmUgaXNcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgc3RpbGwgYSBjaGFuY2UgdGhleSB3aWxsIGJlIG1hdGNoZWQgdXAgbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlTm9kZShjdXJGcm9tTm9kZUNoaWxkLCBmcm9tRWwsIHRydWUgLyogc2tpcCBrZXllZCBub2RlcyAqLyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3BlY2lhbEVsSGFuZGxlciA9IHNwZWNpYWxFbEhhbmRsZXJzW2Zyb21FbC5ub2RlTmFtZV07XG4gICAgICAgIGlmIChzcGVjaWFsRWxIYW5kbGVyKSB7XG4gICAgICAgICAgICBzcGVjaWFsRWxIYW5kbGVyKGZyb21FbCwgdG9FbCk7XG4gICAgICAgIH1cbiAgICB9IC8vIEVORDogbW9ycGhFbCguLi4pXG5cbiAgICB2YXIgbW9ycGhlZE5vZGUgPSBmcm9tTm9kZTtcbiAgICB2YXIgbW9ycGhlZE5vZGVUeXBlID0gbW9ycGhlZE5vZGUubm9kZVR5cGU7XG4gICAgdmFyIHRvTm9kZVR5cGUgPSB0b05vZGUubm9kZVR5cGU7XG5cbiAgICBpZiAoIWNoaWxkcmVuT25seSkge1xuICAgICAgICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlcmUgd2UgYXJlIGdpdmVuIHR3byBET00gbm9kZXMgdGhhdCBhcmUgbm90XG4gICAgICAgIC8vIGNvbXBhdGlibGUgKGUuZy4gPGRpdj4gLS0+IDxzcGFuPiBvciA8ZGl2PiAtLT4gVEVYVClcbiAgICAgICAgaWYgKG1vcnBoZWROb2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICBpZiAodG9Ob2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wYXJlTm9kZU5hbWVzKGZyb21Ob2RlLCB0b05vZGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG9uTm9kZURpc2NhcmRlZChmcm9tTm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlID0gbW92ZUNoaWxkcmVuKGZyb21Ob2RlLCBjcmVhdGVFbGVtZW50TlModG9Ob2RlLm5vZGVOYW1lLCB0b05vZGUubmFtZXNwYWNlVVJJKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBHb2luZyBmcm9tIGFuIGVsZW1lbnQgbm9kZSB0byBhIHRleHQgbm9kZVxuICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlID0gdG9Ob2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1vcnBoZWROb2RlVHlwZSA9PT0gVEVYVF9OT0RFIHx8IG1vcnBoZWROb2RlVHlwZSA9PT0gQ09NTUVOVF9OT0RFKSB7IC8vIFRleHQgb3IgY29tbWVudCBub2RlXG4gICAgICAgICAgICBpZiAodG9Ob2RlVHlwZSA9PT0gbW9ycGhlZE5vZGVUeXBlKSB7XG4gICAgICAgICAgICAgICAgbW9ycGhlZE5vZGUubm9kZVZhbHVlID0gdG9Ob2RlLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9ycGhlZE5vZGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFRleHQgbm9kZSB0byBzb21ldGhpbmcgZWxzZVxuICAgICAgICAgICAgICAgIG1vcnBoZWROb2RlID0gdG9Ob2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1vcnBoZWROb2RlID09PSB0b05vZGUpIHtcbiAgICAgICAgLy8gVGhlIFwidG8gbm9kZVwiIHdhcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBcImZyb20gbm9kZVwiIHNvIHdlIGhhZCB0b1xuICAgICAgICAvLyB0b3NzIG91dCB0aGUgXCJmcm9tIG5vZGVcIiBhbmQgdXNlIHRoZSBcInRvIG5vZGVcIlxuICAgICAgICBvbk5vZGVEaXNjYXJkZWQoZnJvbU5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1vcnBoRWwobW9ycGhlZE5vZGUsIHRvTm9kZSwgY2hpbGRyZW5Pbmx5KTtcblxuICAgICAgICAvLyBXZSBub3cgbmVlZCB0byBsb29wIG92ZXIgYW55IGtleWVkIG5vZGVzIHRoYXQgbWlnaHQgbmVlZCB0byBiZVxuICAgICAgICAvLyByZW1vdmVkLiBXZSBvbmx5IGRvIHRoZSByZW1vdmFsIGlmIHdlIGtub3cgdGhhdCB0aGUga2V5ZWQgbm9kZVxuICAgICAgICAvLyBuZXZlciBmb3VuZCBhIG1hdGNoLiBXaGVuIGEga2V5ZWQgbm9kZSBpcyBtYXRjaGVkIHVwIHdlIHJlbW92ZVxuICAgICAgICAvLyBpdCBvdXQgb2YgZnJvbU5vZGVzTG9va3VwIGFuZCB3ZSB1c2UgZnJvbU5vZGVzTG9va3VwIHRvIGRldGVybWluZVxuICAgICAgICAvLyBpZiBhIGtleWVkIG5vZGUgaGFzIGJlZW4gbWF0Y2hlZCB1cCBvciBub3RcbiAgICAgICAgaWYgKGtleWVkUmVtb3ZhbExpc3QpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MCwgbGVuPWtleWVkUmVtb3ZhbExpc3QubGVuZ3RoOyBpPGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVsVG9SZW1vdmUgPSBmcm9tTm9kZXNMb29rdXBba2V5ZWRSZW1vdmFsTGlzdFtpXV07XG4gICAgICAgICAgICAgICAgaWYgKGVsVG9SZW1vdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlTm9kZShlbFRvUmVtb3ZlLCBlbFRvUmVtb3ZlLnBhcmVudE5vZGUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWNoaWxkcmVuT25seSAmJiBtb3JwaGVkTm9kZSAhPT0gZnJvbU5vZGUgJiYgZnJvbU5vZGUucGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAobW9ycGhlZE5vZGUuYWN0dWFsaXplKSB7XG4gICAgICAgICAgICBtb3JwaGVkTm9kZSA9IG1vcnBoZWROb2RlLmFjdHVhbGl6ZShmcm9tTm9kZS5vd25lckRvY3VtZW50IHx8IGRvYyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgd2UgaGFkIHRvIHN3YXAgb3V0IHRoZSBmcm9tIG5vZGUgd2l0aCBhIG5ldyBub2RlIGJlY2F1c2UgdGhlIG9sZFxuICAgICAgICAvLyBub2RlIHdhcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSB0YXJnZXQgbm9kZSB0aGVuIHdlIG5lZWQgdG9cbiAgICAgICAgLy8gcmVwbGFjZSB0aGUgb2xkIERPTSBub2RlIGluIHRoZSBvcmlnaW5hbCBET00gdHJlZS4gVGhpcyBpcyBvbmx5XG4gICAgICAgIC8vIHBvc3NpYmxlIGlmIHRoZSBvcmlnaW5hbCBET00gbm9kZSB3YXMgcGFydCBvZiBhIERPTSB0cmVlIHdoaWNoXG4gICAgICAgIC8vIHdlIGtub3cgaXMgdGhlIGNhc2UgaWYgaXQgaGFzIGEgcGFyZW50IG5vZGUuXG4gICAgICAgIGZyb21Ob2RlLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG1vcnBoZWROb2RlLCBmcm9tTm9kZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vcnBoZWROb2RlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1vcnBoZG9tO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gIC8vIGF0dHJpYnV0ZSBldmVudHMgKGNhbiBiZSBzZXQgd2l0aCBhdHRyaWJ1dGVzKVxuICAnb25jbGljaycsXG4gICdvbmRibGNsaWNrJyxcbiAgJ29ubW91c2Vkb3duJyxcbiAgJ29ubW91c2V1cCcsXG4gICdvbm1vdXNlb3ZlcicsXG4gICdvbm1vdXNlbW92ZScsXG4gICdvbm1vdXNlb3V0JyxcbiAgJ29uZHJhZ3N0YXJ0JyxcbiAgJ29uZHJhZycsXG4gICdvbmRyYWdlbnRlcicsXG4gICdvbmRyYWdsZWF2ZScsXG4gICdvbmRyYWdvdmVyJyxcbiAgJ29uZHJvcCcsXG4gICdvbmRyYWdlbmQnLFxuICAnb25rZXlkb3duJyxcbiAgJ29ua2V5cHJlc3MnLFxuICAnb25rZXl1cCcsXG4gICdvbnVubG9hZCcsXG4gICdvbmFib3J0JyxcbiAgJ29uZXJyb3InLFxuICAnb25yZXNpemUnLFxuICAnb25zY3JvbGwnLFxuICAnb25zZWxlY3QnLFxuICAnb25jaGFuZ2UnLFxuICAnb25zdWJtaXQnLFxuICAnb25yZXNldCcsXG4gICdvbmZvY3VzJyxcbiAgJ29uYmx1cicsXG4gICdvbmlucHV0JyxcbiAgLy8gb3RoZXIgY29tbW9uIGV2ZW50c1xuICAnb25jb250ZXh0bWVudScsXG4gICdvbmZvY3VzaW4nLFxuICAnb25mb2N1c291dCdcbl1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24geW95b2lmeUFwcGVuZENoaWxkIChlbCwgY2hpbGRzKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBjaGlsZHNbaV1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShub2RlKSkge1xuICAgICAgeW95b2lmeUFwcGVuZENoaWxkKGVsLCBub2RlKVxuICAgICAgY29udGludWVcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBub2RlID09PSAnbnVtYmVyJyB8fFxuICAgICAgdHlwZW9mIG5vZGUgPT09ICdib29sZWFuJyB8fFxuICAgICAgbm9kZSBpbnN0YW5jZW9mIERhdGUgfHxcbiAgICAgIG5vZGUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIG5vZGUgPSBub2RlLnRvU3RyaW5nKClcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuICAgICAgaWYgKGVsLmxhc3RDaGlsZCAmJiBlbC5sYXN0Q2hpbGQubm9kZU5hbWUgPT09ICcjdGV4dCcpIHtcbiAgICAgICAgZWwubGFzdENoaWxkLm5vZGVWYWx1ZSArPSBub2RlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobm9kZSlcbiAgICB9XG4gICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSkge1xuICAgICAgZWwuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG4gIH1cbn1cbiIsInZhciB0b3BMZXZlbCA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDpcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHt9XG52YXIgbWluRG9jID0gcmVxdWlyZSgnbWluLWRvY3VtZW50Jyk7XG5cbmlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2N1bWVudDtcbn0gZWxzZSB7XG4gICAgdmFyIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXTtcblxuICAgIGlmICghZG9jY3kpIHtcbiAgICAgICAgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddID0gbWluRG9jO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jY3k7XG59XG4iLCJpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBnbG9iYWw7XG59IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiKXtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHNlbGY7XG59IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge307XG59XG4iLCJjb25zdCBVdGlscyA9IHJlcXVpcmUoJy4uL2NvcmUvVXRpbHMnKVxuY29uc3QgVHJhbnNsYXRvciA9IHJlcXVpcmUoJy4uL2NvcmUvVHJhbnNsYXRvcicpXG5jb25zdCBlZSA9IHJlcXVpcmUoJ25hbWVzcGFjZS1lbWl0dGVyJylcbmNvbnN0IFVwcHlTb2NrZXQgPSByZXF1aXJlKCcuL1VwcHlTb2NrZXQnKVxuLy8gY29uc3QgZW5fVVMgPSByZXF1aXJlKCcuLi9sb2NhbGVzL2VuX1VTJylcbi8vIGltcG9ydCBkZWVwRnJlZXplIGZyb20gJ2RlZXAtZnJlZXplLXN0cmljdCdcblxuLyoqXG4gKiBNYWluIFVwcHkgY29yZVxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRzIGdlbmVyYWwgb3B0aW9ucywgbGlrZSBsb2NhbGVzLCB0byBzaG93IG1vZGFsIG9yIG5vdCB0byBzaG93XG4gKi9cbmNsYXNzIFVwcHkge1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIC8vIGxvYWQgRW5nbGlzaCBhcyB0aGUgZGVmYXVsdCBsb2NhbGVcbiAgICAgIC8vIGxvY2FsZTogZW5fVVMsXG4gICAgICBhdXRvUHJvY2VlZDogdHJ1ZSxcbiAgICAgIGRlYnVnOiBmYWxzZVxuICAgIH1cblxuICAgIC8vIE1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICAvLyAvLyBEaWN0YXRlcyBpbiB3aGF0IG9yZGVyIGRpZmZlcmVudCBwbHVnaW4gdHlwZXMgYXJlIHJhbjpcbiAgICAvLyB0aGlzLnR5cGVzID0gWyAncHJlc2V0dGVyJywgJ29yY2hlc3RyYXRvcicsICdwcm9ncmVzc2luZGljYXRvcicsXG4gICAgLy8gICAgICAgICAgICAgICAgICdhY3F1aXJlcicsICdtb2RpZmllcicsICd1cGxvYWRlcicsICdwcmVzZW50ZXInLCAnZGVidWdnZXInXVxuXG4gICAgLy8gQ29udGFpbmVyIGZvciBkaWZmZXJlbnQgdHlwZXMgb2YgcGx1Z2luc1xuICAgIHRoaXMucGx1Z2lucyA9IHt9XG5cbiAgICB0aGlzLnRyYW5zbGF0b3IgPSBuZXcgVHJhbnNsYXRvcih7bG9jYWxlOiB0aGlzLm9wdHMubG9jYWxlfSlcbiAgICB0aGlzLmkxOG4gPSB0aGlzLnRyYW5zbGF0b3IudHJhbnNsYXRlLmJpbmQodGhpcy50cmFuc2xhdG9yKVxuICAgIHRoaXMuZ2V0U3RhdGUgPSB0aGlzLmdldFN0YXRlLmJpbmQodGhpcylcbiAgICB0aGlzLnVwZGF0ZU1ldGEgPSB0aGlzLnVwZGF0ZU1ldGEuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5pdFNvY2tldCA9IHRoaXMuaW5pdFNvY2tldC5iaW5kKHRoaXMpXG4gICAgdGhpcy5sb2cgPSB0aGlzLmxvZy5iaW5kKHRoaXMpXG4gICAgdGhpcy5hZGRGaWxlID0gdGhpcy5hZGRGaWxlLmJpbmQodGhpcylcblxuICAgIHRoaXMuYnVzID0gdGhpcy5lbWl0dGVyID0gZWUoKVxuICAgIHRoaXMub24gPSB0aGlzLmJ1cy5vbi5iaW5kKHRoaXMuYnVzKVxuICAgIHRoaXMuZW1pdCA9IHRoaXMuYnVzLmVtaXQuYmluZCh0aGlzLmJ1cylcblxuICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICBmaWxlczoge30sXG4gICAgICBjYXBhYmlsaXRpZXM6IHtcbiAgICAgICAgcmVzdW1hYmxlVXBsb2FkczogZmFsc2VcbiAgICAgIH0sXG4gICAgICB0b3RhbFByb2dyZXNzOiAwXG4gICAgfVxuXG4gICAgLy8gZm9yIGRlYnVnZ2luZyBhbmQgdGVzdGluZ1xuICAgIGlmICh0aGlzLm9wdHMuZGVidWcpIHtcbiAgICAgIGdsb2JhbC5VcHB5U3RhdGUgPSB0aGlzLnN0YXRlXG4gICAgICBnbG9iYWwudXBweUxvZyA9ICcnXG4gICAgICBnbG9iYWwuVXBweUFkZEZpbGUgPSB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKVxuICAgICAgZ2xvYmFsLl9VcHB5ID0gdGhpc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlIG9uIGFsbCBwbHVnaW5zIGFuZCBydW4gYHVwZGF0ZWAgb24gdGhlbS4gQ2FsbGVkIGVhY2ggdGltZSBzdGF0ZSBjaGFuZ2VzXG4gICAqXG4gICAqL1xuICB1cGRhdGVBbGwgKHN0YXRlKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaCgocGx1Z2luKSA9PiB7XG4gICAgICAgIHBsdWdpbi51cGRhdGUoc3RhdGUpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyBzdGF0ZVxuICAgKlxuICAgKiBAcGFyYW0ge25ld1N0YXRlfSBvYmplY3RcbiAgICovXG4gIHNldFN0YXRlIChzdGF0ZVVwZGF0ZSkge1xuICAgIGNvbnN0IG5ld1N0YXRlID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZSwgc3RhdGVVcGRhdGUpXG4gICAgdGhpcy5lbWl0KCdjb3JlOnN0YXRlLXVwZGF0ZScsIHRoaXMuc3RhdGUsIG5ld1N0YXRlLCBzdGF0ZVVwZGF0ZSlcblxuICAgIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZVxuICAgIHRoaXMudXBkYXRlQWxsKHRoaXMuc3RhdGUpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBjdXJyZW50IHN0YXRlXG4gICAqXG4gICAqL1xuICBnZXRTdGF0ZSAoKSB7XG4gICAgLy8gdXNlIGRlZXBGcmVlemUgZm9yIGRlYnVnZ2luZ1xuICAgIC8vIHJldHVybiBkZWVwRnJlZXplKHRoaXMuc3RhdGUpXG4gICAgcmV0dXJuIHRoaXMuc3RhdGVcbiAgfVxuXG4gIHVwZGF0ZU1ldGEgKGRhdGEsIGZpbGVJRCkge1xuICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICBjb25zdCBuZXdNZXRhID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0ubWV0YSwgZGF0YSlcbiAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlSURdLCB7XG4gICAgICBtZXRhOiBuZXdNZXRhXG4gICAgfSlcbiAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgfVxuXG4gIGFkZEZpbGUgKGZpbGUpIHtcbiAgICBjb25zdCB1cGRhdGVkRmlsZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLmZpbGVzKVxuXG4gICAgY29uc3QgZmlsZU5hbWUgPSBmaWxlLm5hbWUgfHwgJ25vbmFtZSdcbiAgICBjb25zdCBmaWxlVHlwZSA9IFV0aWxzLmdldEZpbGVUeXBlKGZpbGUpID8gVXRpbHMuZ2V0RmlsZVR5cGUoZmlsZSkuc3BsaXQoJy8nKSA6IFsnJywgJyddXG4gICAgY29uc3QgZmlsZVR5cGVHZW5lcmFsID0gZmlsZVR5cGVbMF1cbiAgICBjb25zdCBmaWxlVHlwZVNwZWNpZmljID0gZmlsZVR5cGVbMV1cbiAgICBjb25zdCBmaWxlRXh0ZW5zaW9uID0gVXRpbHMuZ2V0RmlsZU5hbWVBbmRFeHRlbnNpb24oZmlsZU5hbWUpWzFdXG4gICAgY29uc3QgaXNSZW1vdGUgPSBmaWxlLmlzUmVtb3RlIHx8IGZhbHNlXG5cbiAgICBjb25zdCBmaWxlSUQgPSBVdGlscy5nZW5lcmF0ZUZpbGVJRChmaWxlTmFtZSlcblxuICAgIGNvbnN0IG5ld0ZpbGUgPSB7XG4gICAgICBzb3VyY2U6IGZpbGUuc291cmNlIHx8ICcnLFxuICAgICAgaWQ6IGZpbGVJRCxcbiAgICAgIG5hbWU6IGZpbGVOYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBmaWxlRXh0ZW5zaW9uIHx8ICcnLFxuICAgICAgbWV0YToge1xuICAgICAgICBuYW1lOiBmaWxlTmFtZVxuICAgICAgfSxcbiAgICAgIHR5cGU6IHtcbiAgICAgICAgZ2VuZXJhbDogZmlsZVR5cGVHZW5lcmFsLFxuICAgICAgICBzcGVjaWZpYzogZmlsZVR5cGVTcGVjaWZpY1xuICAgICAgfSxcbiAgICAgIGRhdGE6IGZpbGUuZGF0YSxcbiAgICAgIHByb2dyZXNzOiB7XG4gICAgICAgIHBlcmNlbnRhZ2U6IDAsXG4gICAgICAgIHVwbG9hZENvbXBsZXRlOiBmYWxzZSxcbiAgICAgICAgdXBsb2FkU3RhcnRlZDogZmFsc2VcbiAgICAgIH0sXG4gICAgICBzaXplOiBmaWxlLmRhdGEuc2l6ZSB8fCAnTi9BJyxcbiAgICAgIGlzUmVtb3RlOiBpc1JlbW90ZSxcbiAgICAgIHJlbW90ZTogZmlsZS5yZW1vdGUgfHwgJydcbiAgICB9XG5cbiAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IG5ld0ZpbGVcbiAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcblxuICAgIHRoaXMuYnVzLmVtaXQoJ2ZpbGUtYWRkZWQnLCBmaWxlSUQpXG4gICAgdGhpcy5sb2coYEFkZGVkIGZpbGU6ICR7ZmlsZU5hbWV9LCAke2ZpbGVJRH1gKVxuXG4gICAgaWYgKGZpbGVUeXBlR2VuZXJhbCA9PT0gJ2ltYWdlJyAmJiAhaXNSZW1vdGUpIHtcbiAgICAgIHRoaXMuYWRkVGh1bWJuYWlsKG5ld0ZpbGUuaWQpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0cy5hdXRvUHJvY2VlZCkge1xuICAgICAgdGhpcy5idXMuZW1pdCgnY29yZTp1cGxvYWQnKVxuICAgIH1cbiAgfVxuXG4gIHJlbW92ZUZpbGUgKGZpbGVJRCkge1xuICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICBkZWxldGUgdXBkYXRlZEZpbGVzW2ZpbGVJRF1cbiAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICB0aGlzLmxvZyhgUmVtb3ZlZCBmaWxlOiAke2ZpbGVJRH1gKVxuICB9XG5cbiAgYWRkVGh1bWJuYWlsIChmaWxlSUQpIHtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5nZXRTdGF0ZSgpLmZpbGVzW2ZpbGVJRF1cblxuICAgIFV0aWxzLnJlYWRGaWxlKGZpbGUuZGF0YSlcbiAgICAgIC50aGVuKChpbWdEYXRhVVJJKSA9PiBVdGlscy5jcmVhdGVJbWFnZVRodW1ibmFpbChpbWdEYXRhVVJJLCAyMDApKVxuICAgICAgLnRoZW4oKHRodW1ibmFpbCkgPT4ge1xuICAgICAgICBjb25zdCB1cGRhdGVkRmlsZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmdldFN0YXRlKCkuZmlsZXMpXG4gICAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sIHtcbiAgICAgICAgICBwcmV2aWV3OiB0aHVtYm5haWxcbiAgICAgICAgfSlcbiAgICAgICAgdXBkYXRlZEZpbGVzW2ZpbGVJRF0gPSB1cGRhdGVkRmlsZVxuICAgICAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgIH0pXG4gIH1cblxuICBzdGFydFVwbG9hZCAoKSB7XG4gICAgdGhpcy5lbWl0KCdjb3JlOnVwbG9hZCcpXG4gIH1cblxuICBjYWxjdWxhdGVQcm9ncmVzcyAoZGF0YSkge1xuICAgIGNvbnN0IGZpbGVJRCA9IGRhdGEuaWRcbiAgICBjb25zdCB1cGRhdGVkRmlsZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmdldFN0YXRlKCkuZmlsZXMpXG4gICAgaWYgKCF1cGRhdGVkRmlsZXNbZmlsZUlEXSkge1xuICAgICAgY29uc29sZS5lcnJvcignVHJ5aW5nIHRvIHNldCBwcm9ncmVzcyBmb3IgYSBmaWxlIHRoYXTigJlzIG5vdCB3aXRoIHVzIGFueW1vcmU6ICcsIGZpbGVJRClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sXG4gICAgICBPYmplY3QuYXNzaWduKHt9LCB7XG4gICAgICAgIHByb2dyZXNzOiBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXS5wcm9ncmVzcywge1xuICAgICAgICAgIGJ5dGVzVXBsb2FkZWQ6IGRhdGEuYnl0ZXNVcGxvYWRlZCxcbiAgICAgICAgICBieXRlc1RvdGFsOiBkYXRhLmJ5dGVzVG90YWwsXG4gICAgICAgICAgcGVyY2VudGFnZTogTWF0aC5yb3VuZCgoZGF0YS5ieXRlc1VwbG9hZGVkIC8gZGF0YS5ieXRlc1RvdGFsICogMTAwKS50b0ZpeGVkKDIpKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICkpXG4gICAgdXBkYXRlZEZpbGVzW2RhdGEuaWRdID0gdXBkYXRlZEZpbGVcblxuICAgIC8vIGNhbGN1bGF0ZSB0b3RhbCBwcm9ncmVzcywgdXNpbmcgdGhlIG51bWJlciBvZiBmaWxlcyBjdXJyZW50bHkgdXBsb2FkaW5nLFxuICAgIC8vIG11bHRpcGxpZWQgYnkgMTAwIGFuZCB0aGUgc3VtbSBvZiBpbmRpdmlkdWFsIHByb2dyZXNzIG9mIGVhY2ggZmlsZVxuICAgIGNvbnN0IGluUHJvZ3Jlc3MgPSBPYmplY3Qua2V5cyh1cGRhdGVkRmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gICAgfSlcbiAgICBjb25zdCBwcm9ncmVzc01heCA9IGluUHJvZ3Jlc3MubGVuZ3RoICogMTAwXG4gICAgbGV0IHByb2dyZXNzQWxsID0gMFxuICAgIGluUHJvZ3Jlc3MuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgcHJvZ3Jlc3NBbGwgPSBwcm9ncmVzc0FsbCArIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy5wZXJjZW50YWdlXG4gICAgfSlcblxuICAgIGNvbnN0IHRvdGFsUHJvZ3Jlc3MgPSBNYXRoLnJvdW5kKChwcm9ncmVzc0FsbCAqIDEwMCAvIHByb2dyZXNzTWF4KS50b0ZpeGVkKDIpKVxuXG4gICAgLy8gaWYgKHRvdGFsUHJvZ3Jlc3MgPT09IDEwMCkge1xuICAgIC8vICAgY29uc3QgY29tcGxldGVGaWxlcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgLy8gICAgIC8vIHRoaXMgc2hvdWxkIGJlIGB1cGxvYWRDb21wbGV0ZWBcbiAgICAvLyAgICAgcmV0dXJuIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy5wZXJjZW50YWdlID09PSAxMDBcbiAgICAvLyAgIH0pXG4gICAgLy8gICB0aGlzLmVtaXQoJ2NvcmU6c3VjY2VzcycsIGNvbXBsZXRlRmlsZXMubGVuZ3RoKVxuICAgIC8vIH1cblxuICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgdG90YWxQcm9ncmVzczogdG90YWxQcm9ncmVzcyxcbiAgICAgIGZpbGVzOiB1cGRhdGVkRmlsZXNcbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBsaXN0ZW5lcnMgZm9yIGFsbCBnbG9iYWwgYWN0aW9ucywgbGlrZTpcbiAgICogYGZpbGUtYWRkYCwgYGZpbGUtcmVtb3ZlYCwgYHVwbG9hZC1wcm9ncmVzc2AsIGByZXNldGBcbiAgICpcbiAgICovXG4gIGFjdGlvbnMgKCkge1xuICAgIC8vIHRoaXMuYnVzLm9uKCcqJywgKHBheWxvYWQpID0+IHtcbiAgICAvLyAgIGNvbnNvbGUubG9nKCdlbWl0dGVkOiAnLCB0aGlzLmV2ZW50KVxuICAgIC8vICAgY29uc29sZS5sb2coJ3dpdGggcGF5bG9hZDogJywgcGF5bG9hZClcbiAgICAvLyB9KVxuXG4gICAgLy8gY29uc3QgYnVzID0gdGhpcy5idXNcblxuICAgIHRoaXMub24oJ2NvcmU6ZmlsZS1hZGQnLCAoZGF0YSkgPT4ge1xuICAgICAgdGhpcy5hZGRGaWxlKGRhdGEpXG4gICAgfSlcblxuICAgIC8vIGByZW1vdmUtZmlsZWAgcmVtb3ZlcyBhIGZpbGUgZnJvbSBgc3RhdGUuZmlsZXNgLCBmb3IgZXhhbXBsZSB3aGVuXG4gICAgLy8gYSB1c2VyIGRlY2lkZXMgbm90IHRvIHVwbG9hZCBwYXJ0aWN1bGFyIGZpbGUgYW5kIGNsaWNrcyBhIGJ1dHRvbiB0byByZW1vdmUgaXRcbiAgICB0aGlzLm9uKCdjb3JlOmZpbGUtcmVtb3ZlJywgKGZpbGVJRCkgPT4ge1xuICAgICAgdGhpcy5yZW1vdmVGaWxlKGZpbGVJRClcbiAgICB9KVxuXG4gICAgdGhpcy5vbignY29yZTpjYW5jZWwtYWxsJywgKCkgPT4ge1xuICAgICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldFN0YXRlKCkuZmlsZXNcbiAgICAgIE9iamVjdC5rZXlzKGZpbGVzKS5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICAgIHRoaXMucmVtb3ZlRmlsZShmaWxlc1tmaWxlXS5pZClcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHRoaXMub24oJ2NvcmU6dXBsb2FkLXN0YXJ0ZWQnLCAoZmlsZUlELCB1cGxvYWQpID0+IHtcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sXG4gICAgICAgIE9iamVjdC5hc3NpZ24oe30sIHtcbiAgICAgICAgICBwcm9ncmVzczogT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0ucHJvZ3Jlc3MsIHtcbiAgICAgICAgICAgIHVwbG9hZFN0YXJ0ZWQ6IERhdGUubm93KClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICApKVxuICAgICAgdXBkYXRlZEZpbGVzW2ZpbGVJRF0gPSB1cGRhdGVkRmlsZVxuXG4gICAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICB9KVxuXG4gICAgLy8gY29uc3QgdGhyb3R0bGVkQ2FsY3VsYXRlUHJvZ3Jlc3MgPSB0aHJvdHRsZSgxMDAwLCAoZGF0YSkgPT4gdGhpcy5jYWxjdWxhdGVQcm9ncmVzcyhkYXRhKSlcblxuICAgIHRoaXMub24oJ2NvcmU6dXBsb2FkLXByb2dyZXNzJywgKGRhdGEpID0+IHtcbiAgICAgIHRoaXMuY2FsY3VsYXRlUHJvZ3Jlc3MoZGF0YSlcbiAgICAgIC8vIHRocm90dGxlZENhbGN1bGF0ZVByb2dyZXNzKGRhdGEpXG4gICAgfSlcblxuICAgIHRoaXMub24oJ2NvcmU6dXBsb2FkLXN1Y2Nlc3MnLCAoZmlsZUlELCB1cGxvYWRVUkwpID0+IHtcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sIHtcbiAgICAgICAgcHJvZ3Jlc3M6IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlSURdLnByb2dyZXNzLCB7XG4gICAgICAgICAgdXBsb2FkQ29tcGxldGU6IHRydWVcbiAgICAgICAgfSksXG4gICAgICAgIHVwbG9hZFVSTDogdXBsb2FkVVJMXG4gICAgICB9KVxuICAgICAgdXBkYXRlZEZpbGVzW2ZpbGVJRF0gPSB1cGRhdGVkRmlsZVxuXG4gICAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmdldFN0YXRlKCkudG90YWxQcm9ncmVzcylcblxuICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKS50b3RhbFByb2dyZXNzID09PSAxMDApIHtcbiAgICAgICAgY29uc3QgY29tcGxldGVGaWxlcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICAgICAgLy8gdGhpcyBzaG91bGQgYmUgYHVwbG9hZENvbXBsZXRlYFxuICAgICAgICAgIHJldHVybiB1cGRhdGVkRmlsZXNbZmlsZV0ucHJvZ3Jlc3MudXBsb2FkQ29tcGxldGVcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5lbWl0KCdjb3JlOnN1Y2Nlc3MnLCBjb21wbGV0ZUZpbGVzLmxlbmd0aClcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgIGZpbGVzOiB1cGRhdGVkRmlsZXNcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHRoaXMub24oJ2NvcmU6dXBkYXRlLW1ldGEnLCAoZGF0YSwgZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZU1ldGEoZGF0YSwgZmlsZUlEKVxuICAgIH0pXG5cbiAgICAvLyBzaG93IGluZm9ybWVyIGlmIG9mZmxpbmVcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCAoKSA9PiB0aGlzLmlzT25saW5lKHRydWUpKVxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29mZmxpbmUnLCAoKSA9PiB0aGlzLmlzT25saW5lKGZhbHNlKSlcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5pc09ubGluZSgpLCAzMDAwKVxuICAgIH1cbiAgfVxuXG4gIGlzT25saW5lIChzdGF0dXMpIHtcbiAgICBjb25zdCBvbmxpbmUgPSBzdGF0dXMgfHwgd2luZG93Lm5hdmlnYXRvci5vbkxpbmVcbiAgICBpZiAoIW9ubGluZSkge1xuICAgICAgdGhpcy5lbWl0KCdpcy1vZmZsaW5lJylcbiAgICAgIHRoaXMuZW1pdCgnaW5mb3JtZXInLCAnTm8gaW50ZXJuZXQgY29ubmVjdGlvbicsICdlcnJvcicsIDApXG4gICAgICB0aGlzLndhc09mZmxpbmUgPSB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZW1pdCgnaXMtb25saW5lJylcbiAgICAgIGlmICh0aGlzLndhc09mZmxpbmUpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdpbmZvcm1lcicsICdDb25uZWN0ZWQhJywgJ3N1Y2Nlc3MnLCAzMDAwKVxuICAgICAgICB0aGlzLndhc09mZmxpbmUgPSBmYWxzZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4vKipcbiAqIFJlZ2lzdGVycyBhIHBsdWdpbiB3aXRoIENvcmVcbiAqXG4gKiBAcGFyYW0ge0NsYXNzfSBQbHVnaW4gb2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBvYmplY3QgdGhhdCB3aWxsIGJlIHBhc3NlZCB0byBQbHVnaW4gbGF0ZXJcbiAqIEByZXR1cm4ge09iamVjdH0gc2VsZiBmb3IgY2hhaW5pbmdcbiAqL1xuICB1c2UgKFBsdWdpbiwgb3B0cykge1xuICAgIC8vIFByZXBhcmUgcHJvcHMgdG8gcGFzcyB0byBwbHVnaW5zXG4gICAgLy8gY29uc3QgcHJvcHMgPSB7XG4gICAgLy8gICBnZXRTdGF0ZTogdGhpcy5nZXRTdGF0ZS5iaW5kKHRoaXMpLFxuICAgIC8vICAgc2V0U3RhdGU6IHRoaXMuc2V0U3RhdGUuYmluZCh0aGlzKSxcbiAgICAvLyAgIHVwZGF0ZU1ldGE6IHRoaXMudXBkYXRlTWV0YS5iaW5kKHRoaXMpLFxuICAgIC8vICAgYWRkRmlsZTogdGhpcy5hZGRGaWxlLmJpbmQodGhpcyksXG4gICAgLy8gICBpMThuOiB0aGlzLmkxOG4uYmluZCh0aGlzKSxcbiAgICAvLyAgIGJ1czogdGhpcy5lZSxcbiAgICAvLyAgIGxvZzogdGhpcy5sb2cuYmluZCh0aGlzKVxuICAgIC8vIH1cblxuICAgIC8vIEluc3RhbnRpYXRlXG4gICAgY29uc3QgcGx1Z2luID0gbmV3IFBsdWdpbih0aGlzLCBvcHRzKVxuICAgIGNvbnN0IHBsdWdpbk5hbWUgPSBwbHVnaW4uaWRcbiAgICB0aGlzLnBsdWdpbnNbcGx1Z2luLnR5cGVdID0gdGhpcy5wbHVnaW5zW3BsdWdpbi50eXBlXSB8fCBbXVxuXG4gICAgaWYgKCFwbHVnaW5OYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdXIgcGx1Z2luIG11c3QgaGF2ZSBhIG5hbWUnKVxuICAgIH1cblxuICAgIGlmICghcGx1Z2luLnR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91ciBwbHVnaW4gbXVzdCBoYXZlIGEgdHlwZScpXG4gICAgfVxuXG4gICAgbGV0IGV4aXN0c1BsdWdpbkFscmVhZHkgPSB0aGlzLmdldFBsdWdpbihwbHVnaW5OYW1lKVxuICAgIGlmIChleGlzdHNQbHVnaW5BbHJlYWR5KSB7XG4gICAgICBsZXQgbXNnID0gYEFscmVhZHkgZm91bmQgYSBwbHVnaW4gbmFtZWQgJyR7ZXhpc3RzUGx1Z2luQWxyZWFkeS5uYW1lfScuXG4gICAgICAgIFRyaWVkIHRvIHVzZTogJyR7cGx1Z2luTmFtZX0nLlxuICAgICAgICBVcHB5IGlzIGN1cnJlbnRseSBsaW1pdGVkIHRvIHJ1bm5pbmcgb25lIG9mIGV2ZXJ5IHBsdWdpbi5cbiAgICAgICAgU2hhcmUgeW91ciB1c2UgY2FzZSB3aXRoIHVzIG92ZXIgYXRcbiAgICAgICAgaHR0cHM6Ly9naXRodWIuY29tL3RyYW5zbG9hZGl0L3VwcHkvaXNzdWVzL1xuICAgICAgICBpZiB5b3Ugd2FudCB1cyB0byByZWNvbnNpZGVyLmBcbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpXG4gICAgfVxuXG4gICAgdGhpcy5wbHVnaW5zW3BsdWdpbi50eXBlXS5wdXNoKHBsdWdpbilcbiAgICBwbHVnaW4uaW5zdGFsbCgpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbi8qKlxuICogRmluZCBvbmUgUGx1Z2luIGJ5IG5hbWVcbiAqXG4gKiBAcGFyYW0gc3RyaW5nIG5hbWUgZGVzY3JpcHRpb25cbiAqL1xuICBnZXRQbHVnaW4gKG5hbWUpIHtcbiAgICBsZXQgZm91bmRQbHVnaW4gPSBmYWxzZVxuICAgIHRoaXMuaXRlcmF0ZVBsdWdpbnMoKHBsdWdpbikgPT4ge1xuICAgICAgY29uc3QgcGx1Z2luTmFtZSA9IHBsdWdpbi5pZFxuICAgICAgaWYgKHBsdWdpbk5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgZm91bmRQbHVnaW4gPSBwbHVnaW5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gZm91bmRQbHVnaW5cbiAgfVxuXG4vKipcbiAqIEl0ZXJhdGUgdGhyb3VnaCBhbGwgYHVzZWBkIHBsdWdpbnNcbiAqXG4gKiBAcGFyYW0gZnVuY3Rpb24gbWV0aG9kIGRlc2NyaXB0aW9uXG4gKi9cbiAgaXRlcmF0ZVBsdWdpbnMgKG1ldGhvZCkge1xuICAgIE9iamVjdC5rZXlzKHRoaXMucGx1Z2lucykuZm9yRWFjaCgocGx1Z2luVHlwZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW5zW3BsdWdpblR5cGVdLmZvckVhY2gobWV0aG9kKVxuICAgIH0pXG4gIH1cblxuLyoqXG4gKiBMb2dzIHN0dWZmIHRvIGNvbnNvbGUsIG9ubHkgaWYgYGRlYnVnYCBpcyBzZXQgdG8gdHJ1ZS4gU2lsZW50IGluIHByb2R1Y3Rpb24uXG4gKlxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH0gdG8gbG9nXG4gKi9cbiAgbG9nIChtc2csIHR5cGUpIHtcbiAgICBpZiAoIXRoaXMub3B0cy5kZWJ1Zykge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChtc2cgPT09IGAke21zZ31gKSB7XG4gICAgICBjb25zb2xlLmxvZyhgTE9HOiAke21zZ31gKVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmRpcihtc2cpXG4gICAgfVxuXG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYExPRzogJHttc2d9YClcbiAgICB9XG5cbiAgICBnbG9iYWwudXBweUxvZyA9IGdsb2JhbC51cHB5TG9nICsgJ1xcbicgKyAnREVCVUcgTE9HOiAnICsgbXNnXG4gIH1cblxuICBpbml0U29ja2V0IChvcHRzKSB7XG4gICAgaWYgKCF0aGlzLnNvY2tldCkge1xuICAgICAgdGhpcy5zb2NrZXQgPSBuZXcgVXBweVNvY2tldChvcHRzKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnNvY2tldFxuICB9XG5cbiAgLy8gaW5zdGFsbEFsbCAoKSB7XG4gIC8vICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gIC8vICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaCgocGx1Z2luKSA9PiB7XG4gIC8vICAgICAgIHBsdWdpbi5pbnN0YWxsKHRoaXMpXG4gIC8vICAgICB9KVxuICAvLyAgIH0pXG4gIC8vIH1cblxuLyoqXG4gKiBJbml0aWFsaXplcyBhY3Rpb25zLCBpbnN0YWxscyBhbGwgcGx1Z2lucyAoYnkgaXRlcmF0aW5nIG9uIHRoZW0gYW5kIGNhbGxpbmcgYGluc3RhbGxgKSwgc2V0cyBvcHRpb25zXG4gKlxuICovXG4gIHJ1biAoKSB7XG4gICAgdGhpcy5sb2coJ0NvcmUgaXMgcnVuLCBpbml0aWFsaXppbmcgYWN0aW9ucy4uLicpXG5cbiAgICB0aGlzLmFjdGlvbnMoKVxuXG4gICAgLy8gRm9yc2Ugc2V0IGBhdXRvUHJvY2VlZGAgb3B0aW9uIHRvIGZhbHNlIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBzZWxlY3RvciBQbHVnaW5zIGFjdGl2ZVxuICAgIC8vIGlmICh0aGlzLnBsdWdpbnMuYWNxdWlyZXIgJiYgdGhpcy5wbHVnaW5zLmFjcXVpcmVyLmxlbmd0aCA+IDEpIHtcbiAgICAvLyAgIHRoaXMub3B0cy5hdXRvUHJvY2VlZCA9IGZhbHNlXG4gICAgLy8gfVxuXG4gICAgLy8gSW5zdGFsbCBhbGwgcGx1Z2luc1xuICAgIC8vIHRoaXMuaW5zdGFsbEFsbCgpXG5cbiAgICByZXR1cm5cbiAgfVxufVxuXG4vLyBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRzKSB7XG4vLyAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBVcHB5KSkge1xuLy8gICAgIHJldHVybiBuZXcgVXBweShvcHRzKVxuLy8gICB9XG4vLyB9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFVwcHkpKSB7XG4gICAgcmV0dXJuIG5ldyBVcHB5KG9wdHMpXG4gIH1cbn1cbiIsIi8qKlxuICogVHJhbnNsYXRlcyBzdHJpbmdzIHdpdGggaW50ZXJwb2xhdGlvbiAmIHBsdXJhbGl6YXRpb24gc3VwcG9ydC5cbiAqIEV4dGVuc2libGUgd2l0aCBjdXN0b20gZGljdGlvbmFyaWVzIGFuZCBwbHVyYWxpemF0aW9uIGZ1bmN0aW9ucy5cbiAqXG4gKiBCb3Jyb3dzIGhlYXZpbHkgZnJvbSBhbmQgaW5zcGlyZWQgYnkgUG9seWdsb3QgaHR0cHM6Ly9naXRodWIuY29tL2FpcmJuYi9wb2x5Z2xvdC5qcyxcbiAqIGJhc2ljYWxseSBhIHN0cmlwcGVkLWRvd24gdmVyc2lvbiBvZiBpdC4gRGlmZmVyZW5jZXM6IHBsdXJhbGl6YXRpb24gZnVuY3Rpb25zIGFyZSBub3QgaGFyZGNvZGVkXG4gKiBhbmQgY2FuIGJlIGVhc2lseSBhZGRlZCBhbW9uZyB3aXRoIGRpY3Rpb25hcmllcywgbmVzdGVkIG9iamVjdHMgYXJlIHVzZWQgZm9yIHBsdXJhbGl6YXRpb25cbiAqIGFzIG9wcG9zZWQgdG8gYHx8fHxgIGRlbGltZXRlclxuICpcbiAqIFVzYWdlIGV4YW1wbGU6IGB0cmFuc2xhdG9yLnRyYW5zbGF0ZSgnZmlsZXNfY2hvc2VuJywge3NtYXJ0X2NvdW50OiAzfSlgXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9wdHNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBjbGFzcyBUcmFuc2xhdG9yIHtcbiAgY29uc3RydWN0b3IgKG9wdHMpIHtcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIGxvY2FsZToge1xuICAgICAgICBzdHJpbmdzOiB7fSxcbiAgICAgICAgcGx1cmFsaXplOiBmdW5jdGlvbiAobikge1xuICAgICAgICAgIGlmIChuID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gMFxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gMVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG4gICAgdGhpcy5sb2NhbGUgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucy5sb2NhbGUsIG9wdHMubG9jYWxlKVxuXG4gICAgY29uc29sZS5sb2codGhpcy5vcHRzLmxvY2FsZSlcblxuICAgIC8vIHRoaXMubG9jYWxlLnBsdXJhbGl6ZSA9IHRoaXMubG9jYWxlID8gdGhpcy5sb2NhbGUucGx1cmFsaXplIDogZGVmYXVsdFBsdXJhbGl6ZVxuICAgIC8vIHRoaXMubG9jYWxlLnN0cmluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBlbl9VUy5zdHJpbmdzLCB0aGlzLm9wdHMubG9jYWxlLnN0cmluZ3MpXG4gIH1cblxuLyoqXG4gKiBUYWtlcyBhIHN0cmluZyB3aXRoIHBsYWNlaG9sZGVyIHZhcmlhYmxlcyBsaWtlIGAle3NtYXJ0X2NvdW50fSBmaWxlIHNlbGVjdGVkYFxuICogYW5kIHJlcGxhY2VzIGl0IHdpdGggdmFsdWVzIGZyb20gb3B0aW9ucyBge3NtYXJ0X2NvdW50OiA1fWBcbiAqXG4gKiBAbGljZW5zZSBodHRwczovL2dpdGh1Yi5jb20vYWlyYm5iL3BvbHlnbG90LmpzL2Jsb2IvbWFzdGVyL0xJQ0VOU0VcbiAqIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2FpcmJuYi9wb2x5Z2xvdC5qcy9ibG9iL21hc3Rlci9saWIvcG9seWdsb3QuanMjTDI5OVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBwaHJhc2UgdGhhdCBuZWVkcyBpbnRlcnBvbGF0aW9uLCB3aXRoIHBsYWNlaG9sZGVyc1xuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgd2l0aCB2YWx1ZXMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVwbGFjZSBwbGFjZWhvbGRlcnNcbiAqIEByZXR1cm4ge3N0cmluZ30gaW50ZXJwb2xhdGVkXG4gKi9cbiAgaW50ZXJwb2xhdGUgKHBocmFzZSwgb3B0aW9ucykge1xuICAgIGNvbnN0IHJlcGxhY2UgPSBTdHJpbmcucHJvdG90eXBlLnJlcGxhY2VcbiAgICBjb25zdCBkb2xsYXJSZWdleCA9IC9cXCQvZ1xuICAgIGNvbnN0IGRvbGxhckJpbGxzWWFsbCA9ICckJCQkJ1xuXG4gICAgZm9yIChsZXQgYXJnIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmIChhcmcgIT09ICdfJyAmJiBvcHRpb25zLmhhc093blByb3BlcnR5KGFyZykpIHtcbiAgICAgICAgLy8gRW5zdXJlIHJlcGxhY2VtZW50IHZhbHVlIGlzIGVzY2FwZWQgdG8gcHJldmVudCBzcGVjaWFsICQtcHJlZml4ZWRcbiAgICAgICAgLy8gcmVnZXggcmVwbGFjZSB0b2tlbnMuIHRoZSBcIiQkJCRcIiBpcyBuZWVkZWQgYmVjYXVzZSBlYWNoIFwiJFwiIG5lZWRzIHRvXG4gICAgICAgIC8vIGJlIGVzY2FwZWQgd2l0aCBcIiRcIiBpdHNlbGYsIGFuZCB3ZSBuZWVkIHR3byBpbiB0aGUgcmVzdWx0aW5nIG91dHB1dC5cbiAgICAgICAgdmFyIHJlcGxhY2VtZW50ID0gb3B0aW9uc1thcmddXG4gICAgICAgIGlmICh0eXBlb2YgcmVwbGFjZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmVwbGFjZW1lbnQgPSByZXBsYWNlLmNhbGwob3B0aW9uc1thcmddLCBkb2xsYXJSZWdleCwgZG9sbGFyQmlsbHNZYWxsKVxuICAgICAgICB9XG4gICAgICAgIC8vIFdlIGNyZWF0ZSBhIG5ldyBgUmVnRXhwYCBlYWNoIHRpbWUgaW5zdGVhZCBvZiB1c2luZyBhIG1vcmUtZWZmaWNpZW50XG4gICAgICAgIC8vIHN0cmluZyByZXBsYWNlIHNvIHRoYXQgdGhlIHNhbWUgYXJndW1lbnQgY2FuIGJlIHJlcGxhY2VkIG11bHRpcGxlIHRpbWVzXG4gICAgICAgIC8vIGluIHRoZSBzYW1lIHBocmFzZS5cbiAgICAgICAgcGhyYXNlID0gcmVwbGFjZS5jYWxsKHBocmFzZSwgbmV3IFJlZ0V4cCgnJVxcXFx7JyArIGFyZyArICdcXFxcfScsICdnJyksIHJlcGxhY2VtZW50KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGhyYXNlXG4gIH1cblxuLyoqXG4gKiBQdWJsaWMgdHJhbnNsYXRlIG1ldGhvZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIHdpdGggdmFsdWVzIHRoYXQgd2lsbCBiZSB1c2VkIGxhdGVyIHRvIHJlcGxhY2UgcGxhY2Vob2xkZXJzIGluIHN0cmluZ1xuICogQHJldHVybiB7c3RyaW5nfSB0cmFuc2xhdGVkIChhbmQgaW50ZXJwb2xhdGVkKVxuICovXG4gIHRyYW5zbGF0ZSAoa2V5LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5zbWFydF9jb3VudCkge1xuICAgICAgdmFyIHBsdXJhbCA9IHRoaXMubG9jYWxlLnBsdXJhbGl6ZShvcHRpb25zLnNtYXJ0X2NvdW50KVxuICAgICAgcmV0dXJuIHRoaXMuaW50ZXJwb2xhdGUodGhpcy5vcHRzLmxvY2FsZS5zdHJpbmdzW2tleV1bcGx1cmFsXSwgb3B0aW9ucylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbnRlcnBvbGF0ZSh0aGlzLm9wdHMubG9jYWxlLnN0cmluZ3Nba2V5XSwgb3B0aW9ucylcbiAgfVxufVxuIiwiY29uc3QgZWUgPSByZXF1aXJlKCduYW1lc3BhY2UtZW1pdHRlcicpXG5cbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgVXBweVNvY2tldCB7XG4gIGNvbnN0cnVjdG9yIChvcHRzKSB7XG4gICAgdGhpcy5xdWV1ZWQgPSBbXVxuICAgIHRoaXMuaXNPcGVuID0gZmFsc2VcbiAgICB0aGlzLnNvY2tldCA9IG5ldyBXZWJTb2NrZXQob3B0cy50YXJnZXQpXG4gICAgdGhpcy5lbWl0dGVyID0gZWUoKVxuXG4gICAgdGhpcy5zb2NrZXQub25vcGVuID0gKGUpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdzb2NrZXQgY29ubmVjdGlvbiBzdWNjZXNzZnVsbHkgb3BlbmVkLicpXG4gICAgICB0aGlzLmlzT3BlbiA9IHRydWVcblxuICAgICAgd2hpbGUgKHRoaXMucXVldWVkLmxlbmd0aCA+IDAgJiYgdGhpcy5pc09wZW4pIHtcbiAgICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLnF1ZXVlZFswXVxuICAgICAgICB0aGlzLnNlbmQoZmlyc3QuYWN0aW9uLCBmaXJzdC5wYXlsb2FkKVxuICAgICAgICB0aGlzLnF1ZXVlZCA9IHRoaXMucXVldWVkLnNsaWNlKDEpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zb2NrZXQub25jbG9zZSA9IChlKSA9PiB7XG4gICAgICB0aGlzLmlzT3BlbiA9IGZhbHNlXG4gICAgfVxuXG4gICAgdGhpcy5faGFuZGxlTWVzc2FnZSA9IHRoaXMuX2hhbmRsZU1lc3NhZ2UuYmluZCh0aGlzKVxuXG4gICAgdGhpcy5zb2NrZXQub25tZXNzYWdlID0gdGhpcy5faGFuZGxlTWVzc2FnZVxuXG4gICAgdGhpcy5jbG9zZSA9IHRoaXMuY2xvc2UuYmluZCh0aGlzKVxuICAgIHRoaXMuZW1pdCA9IHRoaXMuZW1pdC5iaW5kKHRoaXMpXG4gICAgdGhpcy5vbiA9IHRoaXMub24uYmluZCh0aGlzKVxuICAgIHRoaXMub25jZSA9IHRoaXMub25jZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5zZW5kID0gdGhpcy5zZW5kLmJpbmQodGhpcylcbiAgfVxuXG4gIGNsb3NlICgpIHtcbiAgICByZXR1cm4gdGhpcy5zb2NrZXQuY2xvc2UoKVxuICB9XG5cbiAgc2VuZCAoYWN0aW9uLCBwYXlsb2FkKSB7XG4gICAgLy8gYXR0YWNoIHV1aWRcblxuICAgIGlmICghdGhpcy5pc09wZW4pIHtcbiAgICAgIHRoaXMucXVldWVkLnB1c2goe2FjdGlvbiwgcGF5bG9hZH0pXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGFjdGlvbixcbiAgICAgIHBheWxvYWRcbiAgICB9KSlcbiAgfVxuXG4gIG9uIChhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBjb25zb2xlLmxvZyhhY3Rpb24pXG4gICAgdGhpcy5lbWl0dGVyLm9uKGFjdGlvbiwgaGFuZGxlcilcbiAgfVxuXG4gIGVtaXQgKGFjdGlvbiwgcGF5bG9hZCkge1xuICAgIGNvbnNvbGUubG9nKGFjdGlvbilcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdChhY3Rpb24sIHBheWxvYWQpXG4gIH1cblxuICBvbmNlIChhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIub25jZShhY3Rpb24sIGhhbmRsZXIpXG4gIH1cblxuICBfaGFuZGxlTWVzc2FnZSAoZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gSlNPTi5wYXJzZShlLmRhdGEpXG4gICAgICBjb25zb2xlLmxvZyhtZXNzYWdlKVxuICAgICAgdGhpcy5lbWl0KG1lc3NhZ2UuYWN0aW9uLCBtZXNzYWdlLnBheWxvYWQpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmxvZyhlcnIpXG4gICAgfVxuICB9XG59XG4iLCIvLyBpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJ1xuLy8gaW1wb3J0IHBpY2EgZnJvbSAncGljYSdcblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gb2Ygc21hbGwgdXRpbGl0eSBmdW5jdGlvbnMgdGhhdCBoZWxwIHdpdGggZG9tIG1hbmlwdWxhdGlvbiwgYWRkaW5nIGxpc3RlbmVycyxcbiAqIHByb21pc2VzIGFuZCBvdGhlciBnb29kIHRoaW5ncy5cbiAqXG4gKiBAbW9kdWxlIFV0aWxzXG4gKi9cblxuLyoqXG4gKiBTaGFsbG93IGZsYXR0ZW4gbmVzdGVkIGFycmF5cy5cbiAqL1xuZnVuY3Rpb24gZmxhdHRlbiAoYXJyKSB7XG4gIHJldHVybiBbXS5jb25jYXQuYXBwbHkoW10sIGFycilcbn1cblxuZnVuY3Rpb24gaXNUb3VjaERldmljZSAoKSB7XG4gIHJldHVybiAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cgfHwgLy8gd29ya3Mgb24gbW9zdCBicm93c2Vyc1xuICAgICAgICAgIG5hdmlnYXRvci5tYXhUb3VjaFBvaW50cyAgIC8vIHdvcmtzIG9uIElFMTAvMTEgYW5kIFN1cmZhY2Vcbn1cblxuLyoqXG4gKiBTaG9ydGVyIGFuZCBmYXN0IHdheSB0byBzZWxlY3QgYSBzaW5nbGUgbm9kZSBpbiB0aGUgRE9NXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IHNlbGVjdG9yIC0gdW5pcXVlIGRvbSBzZWxlY3RvclxuICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0IG9mIG91ciBzZWFyY2ggd2lsbCBpcyBsb2NhdGVkXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IGRvbSBub2RlIGZvdW5kXG4gKi9cbmZ1bmN0aW9uICQgKHNlbGVjdG9yLCBjdHgpIHtcbiAgcmV0dXJuIChjdHggfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpXG59XG5cbi8qKlxuICogU2hvcnRlciBhbmQgZmFzdCB3YXkgdG8gc2VsZWN0IG11bHRpcGxlIG5vZGVzIGluIHRoZSBET01cbiAqIEBwYXJhbSAgIHsgU3RyaW5nfEFycmF5IH0gc2VsZWN0b3IgLSBET00gc2VsZWN0b3Igb3Igbm9kZXMgbGlzdFxuICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0cyBvZiBvdXIgc2VhcmNoIHdpbGwgaXMgbG9jYXRlZFxuICogQHJldHVybnMgeyBPYmplY3QgfSBkb20gbm9kZXMgZm91bmRcbiAqL1xuZnVuY3Rpb24gJCQgKHNlbGVjdG9yLCBjdHgpIHtcbiAgdmFyIGVsc1xuICBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJykge1xuICAgIGVscyA9IChjdHggfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpXG4gIH0gZWxzZSB7XG4gICAgZWxzID0gc2VsZWN0b3JcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZWxzKVxuICB9XG59XG5cbmZ1bmN0aW9uIHRydW5jYXRlU3RyaW5nIChzdHIsIGxlbmd0aCkge1xuICBpZiAoc3RyLmxlbmd0aCA+IGxlbmd0aCkge1xuICAgIHJldHVybiBzdHIuc3Vic3RyKDAsIGxlbmd0aCAvIDIpICsgJy4uLicgKyBzdHIuc3Vic3RyKHN0ci5sZW5ndGggLSBsZW5ndGggLyA0LCBzdHIubGVuZ3RoKVxuICB9XG4gIHJldHVybiBzdHJcblxuICAvLyBtb3JlIHByZWNpc2UgdmVyc2lvbiBpZiBuZWVkZWRcbiAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvODMxNTgzXG59XG5cbmZ1bmN0aW9uIHNlY29uZHNUb1RpbWUgKHJhd1NlY29uZHMpIHtcbiAgY29uc3QgaG91cnMgPSBNYXRoLmZsb29yKHJhd1NlY29uZHMgLyAzNjAwKSAlIDI0XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKHJhd1NlY29uZHMgLyA2MCkgJSA2MFxuICBjb25zdCBzZWNvbmRzID0gTWF0aC5mbG9vcihyYXdTZWNvbmRzICUgNjApXG5cbiAgcmV0dXJuIHsgaG91cnMsIG1pbnV0ZXMsIHNlY29uZHMgfVxufVxuXG4vKipcbiAqIFBhcnRpdGlvbiBhcnJheSBieSBhIGdyb3VwaW5nIGZ1bmN0aW9uLlxuICogQHBhcmFtICB7W3R5cGVdfSBhcnJheSAgICAgIElucHV0IGFycmF5XG4gKiBAcGFyYW0gIHtbdHlwZV19IGdyb3VwaW5nRm4gR3JvdXBpbmcgZnVuY3Rpb25cbiAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICBBcnJheSBvZiBhcnJheXNcbiAqL1xuZnVuY3Rpb24gZ3JvdXBCeSAoYXJyYXksIGdyb3VwaW5nRm4pIHtcbiAgcmV0dXJuIGFycmF5LnJlZHVjZSgocmVzdWx0LCBpdGVtKSA9PiB7XG4gICAgbGV0IGtleSA9IGdyb3VwaW5nRm4oaXRlbSlcbiAgICBsZXQgeHMgPSByZXN1bHQuZ2V0KGtleSkgfHwgW11cbiAgICB4cy5wdXNoKGl0ZW0pXG4gICAgcmVzdWx0LnNldChrZXksIHhzKVxuICAgIHJldHVybiByZXN1bHRcbiAgfSwgbmV3IE1hcCgpKVxufVxuXG4vKipcbiAqIFRlc3RzIGlmIGV2ZXJ5IGFycmF5IGVsZW1lbnQgcGFzc2VzIHByZWRpY2F0ZVxuICogQHBhcmFtICB7QXJyYXl9ICBhcnJheSAgICAgICBJbnB1dCBhcnJheVxuICogQHBhcmFtICB7T2JqZWN0fSBwcmVkaWNhdGVGbiBQcmVkaWNhdGVcbiAqIEByZXR1cm4ge2Jvb2x9ICAgICAgICAgICAgICAgRXZlcnkgZWxlbWVudCBwYXNzXG4gKi9cbmZ1bmN0aW9uIGV2ZXJ5IChhcnJheSwgcHJlZGljYXRlRm4pIHtcbiAgcmV0dXJuIGFycmF5LnJlZHVjZSgocmVzdWx0LCBpdGVtKSA9PiB7XG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiBwcmVkaWNhdGVGbihpdGVtKVxuICB9LCB0cnVlKVxufVxuXG4vKipcbiAqIENvbnZlcnRzIGxpc3QgaW50byBhcnJheVxuKi9cbmZ1bmN0aW9uIHRvQXJyYXkgKGxpc3QpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGxpc3QgfHwgW10sIDApXG59XG5cbi8qKlxuICogVGFrZXMgYSBmaWxlTmFtZSBhbmQgdHVybnMgaXQgaW50byBmaWxlSUQsIGJ5IGNvbnZlcnRpbmcgdG8gbG93ZXJjYXNlLFxuICogcmVtb3ZpbmcgZXh0cmEgY2hhcmFjdGVycyBhbmQgYWRkaW5nIHVuaXggdGltZXN0YW1wXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGZpbGVOYW1lXG4gKlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZUZpbGVJRCAoZmlsZU5hbWUpIHtcbiAgbGV0IGZpbGVJRCA9IGZpbGVOYW1lLnRvTG93ZXJDYXNlKClcbiAgZmlsZUlEID0gZmlsZUlELnJlcGxhY2UoL1teQS1aMC05XS9pZywgJycpXG4gIGZpbGVJRCA9IGZpbGVJRCArIERhdGUubm93KClcbiAgcmV0dXJuIGZpbGVJRFxufVxuXG5mdW5jdGlvbiBleHRlbmQgKC4uLm9ianMpIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24uYXBwbHkodGhpcywgW3t9XS5jb25jYXQob2JqcykpXG59XG5cbi8qKlxuICogVGFrZXMgZnVuY3Rpb24gb3IgY2xhc3MsIHJldHVybnMgaXRzIG5hbWUuXG4gKiBCZWNhdXNlIElFIGRvZXNu4oCZdCBzdXBwb3J0IGBjb25zdHJ1Y3Rvci5uYW1lYC5cbiAqIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2Rma2F5ZS82Mzg0NDM5LCBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNTcxNDQ0NVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBmbiDigJQgZnVuY3Rpb25cbiAqXG4gKi9cbi8vIGZ1bmN0aW9uIGdldEZuTmFtZSAoZm4pIHtcbi8vICAgdmFyIGYgPSB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbidcbi8vICAgdmFyIHMgPSBmICYmICgoZm4ubmFtZSAmJiBbJycsIGZuLm5hbWVdKSB8fCBmbi50b1N0cmluZygpLm1hdGNoKC9mdW5jdGlvbiAoW15cXChdKykvKSlcbi8vICAgcmV0dXJuICghZiAmJiAnbm90IGEgZnVuY3Rpb24nKSB8fCAocyAmJiBzWzFdIHx8ICdhbm9ueW1vdXMnKVxuLy8gfVxuXG5mdW5jdGlvbiBnZXRQcm9wb3J0aW9uYWxJbWFnZUhlaWdodCAoaW1nLCBuZXdXaWR0aCkge1xuICB2YXIgYXNwZWN0ID0gaW1nLndpZHRoIC8gaW1nLmhlaWdodFxuICB2YXIgbmV3SGVpZ2h0ID0gTWF0aC5yb3VuZChuZXdXaWR0aCAvIGFzcGVjdClcbiAgcmV0dXJuIG5ld0hlaWdodFxufVxuXG5mdW5jdGlvbiBnZXRGaWxlVHlwZSAoZmlsZSkge1xuICBpZiAoZmlsZS50eXBlKSB7XG4gICAgcmV0dXJuIGZpbGUudHlwZVxuICB9XG4gIHJldHVybiAnJ1xuICAvLyByZXR1cm4gbWltZS5sb29rdXAoZmlsZS5uYW1lKVxufVxuXG4vLyByZXR1cm5zIFtmaWxlTmFtZSwgZmlsZUV4dF1cbmZ1bmN0aW9uIGdldEZpbGVOYW1lQW5kRXh0ZW5zaW9uIChmdWxsRmlsZU5hbWUpIHtcbiAgdmFyIHJlID0gLyg/OlxcLihbXi5dKykpPyQvXG4gIHZhciBmaWxlRXh0ID0gcmUuZXhlYyhmdWxsRmlsZU5hbWUpWzFdXG4gIHZhciBmaWxlTmFtZSA9IGZ1bGxGaWxlTmFtZS5yZXBsYWNlKCcuJyArIGZpbGVFeHQsICcnKVxuICByZXR1cm4gW2ZpbGVOYW1lLCBmaWxlRXh0XVxufVxuXG4vKipcbiAqIFJlYWRzIGZpbGUgYXMgZGF0YSBVUkkgZnJvbSBmaWxlIG9iamVjdCxcbiAqIHRoZSBvbmUgeW91IGdldCBmcm9tIGlucHV0W3R5cGU9ZmlsZV0gb3IgZHJhZyAmIGRyb3AuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGZpbGUgb2JqZWN0XG4gKiBAcmV0dXJuIHtQcm9taXNlfSBkYXRhVVJMIG9mIHRoZSBmaWxlXG4gKlxuICovXG5mdW5jdGlvbiByZWFkRmlsZSAoZmlsZU9iaikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICByZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uIChldikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZXYudGFyZ2V0LnJlc3VsdClcbiAgICB9KVxuICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGVPYmopXG5cbiAgICAvLyBmdW5jdGlvbiB3b3JrZXJTY3JpcHQgKCkge1xuICAgIC8vICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgKGUpID0+IHtcbiAgICAvLyAgICAgY29uc3QgZmlsZSA9IGUuZGF0YS5maWxlXG4gICAgLy8gICAgIHRyeSB7XG4gICAgLy8gICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXJTeW5jKClcbiAgICAvLyAgICAgICBwb3N0TWVzc2FnZSh7XG4gICAgLy8gICAgICAgICBmaWxlOiByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKVxuICAgIC8vICAgICAgIH0pXG4gICAgLy8gICAgIH0gY2F0Y2ggKGVycikge1xuICAgIC8vICAgICAgIGNvbnNvbGUubG9nKGVycilcbiAgICAvLyAgICAgfVxuICAgIC8vICAgfSlcbiAgICAvLyB9XG4gICAgLy9cbiAgICAvLyBjb25zdCB3b3JrZXIgPSBtYWtlV29ya2VyKHdvcmtlclNjcmlwdClcbiAgICAvLyB3b3JrZXIucG9zdE1lc3NhZ2Uoe2ZpbGU6IGZpbGVPYmp9KVxuICAgIC8vIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgKGUpID0+IHtcbiAgICAvLyAgIGNvbnN0IGZpbGVEYXRhVVJMID0gZS5kYXRhLmZpbGVcbiAgICAvLyAgIGNvbnNvbGUubG9nKCdGSUxFIF8gREFUQSBfIFVSTCcpXG4gICAgLy8gICByZXR1cm4gcmVzb2x2ZShmaWxlRGF0YVVSTClcbiAgICAvLyB9KVxuICB9KVxufVxuXG4vKipcbiAqIFJlc2l6ZXMgYW4gaW1hZ2UgdG8gc3BlY2lmaWVkIHdpZHRoIGFuZCBwcm9wb3J0aW9uYWwgaGVpZ2h0LCB1c2luZyBjYW52YXNcbiAqIFNlZSBodHRwczovL2Rhdmlkd2Fsc2gubmFtZS9yZXNpemUtaW1hZ2UtY2FudmFzLFxuICogaHR0cDovL2JhYmFsYW4uY29tL3Jlc2l6aW5nLWltYWdlcy13aXRoLWphdmFzY3JpcHQvXG4gKiBAVE9ETyBzZWUgaWYgd2UgbmVlZCBodHRwczovL2dpdGh1Yi5jb20vc3RvbWl0YS9pb3MtaW1hZ2VmaWxlLW1lZ2FwaXhlbCBmb3IgaU9TXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IERhdGEgVVJJIG9mIHRoZSBvcmlnaW5hbCBpbWFnZVxuICogQHBhcmFtIHtTdHJpbmd9IHdpZHRoIG9mIHRoZSByZXN1bHRpbmcgaW1hZ2VcbiAqIEByZXR1cm4ge1N0cmluZ30gRGF0YSBVUkkgb2YgdGhlIHJlc2l6ZWQgaW1hZ2VcbiAqL1xuZnVuY3Rpb24gY3JlYXRlSW1hZ2VUaHVtYm5haWwgKGltZ0RhdGFVUkksIG5ld1dpZHRoKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgaW1nID0gbmV3IEltYWdlKClcbiAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0ltYWdlV2lkdGggPSBuZXdXaWR0aFxuICAgICAgY29uc3QgbmV3SW1hZ2VIZWlnaHQgPSBnZXRQcm9wb3J0aW9uYWxJbWFnZUhlaWdodChpbWcsIG5ld0ltYWdlV2lkdGgpXG5cbiAgICAgIC8vIGNyZWF0ZSBhbiBvZmYtc2NyZWVuIGNhbnZhc1xuICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG5cbiAgICAgIC8vIHNldCBpdHMgZGltZW5zaW9uIHRvIHRhcmdldCBzaXplXG4gICAgICBjYW52YXMud2lkdGggPSBuZXdJbWFnZVdpZHRoXG4gICAgICBjYW52YXMuaGVpZ2h0ID0gbmV3SW1hZ2VIZWlnaHRcblxuICAgICAgLy8gZHJhdyBzb3VyY2UgaW1hZ2UgaW50byB0aGUgb2ZmLXNjcmVlbiBjYW52YXM6XG4gICAgICAvLyBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpXG4gICAgICBjdHguZHJhd0ltYWdlKGltZywgMCwgMCwgbmV3SW1hZ2VXaWR0aCwgbmV3SW1hZ2VIZWlnaHQpXG5cbiAgICAgIC8vIHBpY2EucmVzaXplQ2FudmFzKGltZywgY2FudmFzLCAoZXJyKSA9PiB7XG4gICAgICAvLyAgIGlmIChlcnIpIGNvbnNvbGUubG9nKGVycilcbiAgICAgIC8vICAgY29uc3QgdGh1bWJuYWlsID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJylcbiAgICAgIC8vICAgcmV0dXJuIHJlc29sdmUodGh1bWJuYWlsKVxuICAgICAgLy8gfSlcblxuICAgICAgLy8gZW5jb2RlIGltYWdlIHRvIGRhdGEtdXJpIHdpdGggYmFzZTY0IHZlcnNpb24gb2YgY29tcHJlc3NlZCBpbWFnZVxuICAgICAgLy8gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycsIHF1YWxpdHkpOyAgLy8gcXVhbGl0eSA9IFswLjAsIDEuMF1cbiAgICAgIGNvbnN0IHRodW1ibmFpbCA9IGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpXG4gICAgICByZXR1cm4gcmVzb2x2ZSh0aHVtYm5haWwpXG4gICAgfSlcbiAgICBpbWcuc3JjID0gaW1nRGF0YVVSSVxuICB9KVxufVxuXG5mdW5jdGlvbiBkYXRhVVJJdG9CbG9iIChkYXRhVVJJLCBvcHRzLCB0b0ZpbGUpIHtcbiAgLy8gZ2V0IHRoZSBiYXNlNjQgZGF0YVxuICB2YXIgZGF0YSA9IGRhdGFVUkkuc3BsaXQoJywnKVsxXVxuXG4gIC8vIHVzZXIgbWF5IHByb3ZpZGUgbWltZSB0eXBlLCBpZiBub3QgZ2V0IGl0IGZyb20gZGF0YSBVUklcbiAgdmFyIG1pbWVUeXBlID0gb3B0cy5taW1lVHlwZSB8fCBkYXRhVVJJLnNwbGl0KCcsJylbMF0uc3BsaXQoJzonKVsxXS5zcGxpdCgnOycpWzBdXG5cbiAgLy8gZGVmYXVsdCB0byBwbGFpbi90ZXh0IGlmIGRhdGEgVVJJIGhhcyBubyBtaW1lVHlwZVxuICBpZiAobWltZVR5cGUgPT0gbnVsbCkge1xuICAgIG1pbWVUeXBlID0gJ3BsYWluL3RleHQnXG4gIH1cblxuICB2YXIgYmluYXJ5ID0gYXRvYihkYXRhKVxuICB2YXIgYXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGJpbmFyeS5sZW5ndGg7IGkrKykge1xuICAgIGFycmF5LnB1c2goYmluYXJ5LmNoYXJDb2RlQXQoaSkpXG4gIH1cblxuICAvLyBDb252ZXJ0IHRvIGEgRmlsZT9cbiAgaWYgKHRvRmlsZSkge1xuICAgIHJldHVybiBuZXcgRmlsZShbbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXSwgb3B0cy5uYW1lIHx8ICcnLCB7dHlwZTogbWltZVR5cGV9KVxuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtuZXcgVWludDhBcnJheShhcnJheSldLCB7dHlwZTogbWltZVR5cGV9KVxufVxuXG5mdW5jdGlvbiBkYXRhVVJJdG9GaWxlIChkYXRhVVJJLCBvcHRzKSB7XG4gIHJldHVybiBkYXRhVVJJdG9CbG9iKGRhdGFVUkksIG9wdHMsIHRydWUpXG59XG5cbi8qKlxuICogQ29waWVzIHRleHQgdG8gY2xpcGJvYXJkIGJ5IGNyZWF0aW5nIGFuIGFsbW9zdCBpbnZpc2libGUgdGV4dGFyZWEsXG4gKiBhZGRpbmcgdGV4dCB0aGVyZSwgdGhlbiBydW5uaW5nIGV4ZWNDb21tYW5kKCdjb3B5JykuXG4gKiBGYWxscyBiYWNrIHRvIHByb21wdCgpIHdoZW4gdGhlIGVhc3kgd2F5IGZhaWxzIChoZWxsbywgU2FmYXJpISlcbiAqIEZyb20gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzA4MTAzMjJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dFRvQ29weVxuICogQHBhcmFtIHtTdHJpbmd9IGZhbGxiYWNrU3RyaW5nXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBjb3B5VG9DbGlwYm9hcmQgKHRleHRUb0NvcHksIGZhbGxiYWNrU3RyaW5nKSB7XG4gIGZhbGxiYWNrU3RyaW5nID0gZmFsbGJhY2tTdHJpbmcgfHwgJ0NvcHkgdGhlIFVSTCBiZWxvdydcblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKVxuICAgIHRleHRBcmVhLnNldEF0dHJpYnV0ZSgnc3R5bGUnLCB7XG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICB3aWR0aDogJzJlbScsXG4gICAgICBoZWlnaHQ6ICcyZW0nLFxuICAgICAgcGFkZGluZzogMCxcbiAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgb3V0bGluZTogJ25vbmUnLFxuICAgICAgYm94U2hhZG93OiAnbm9uZScsXG4gICAgICBiYWNrZ3JvdW5kOiAndHJhbnNwYXJlbnQnXG4gICAgfSlcblxuICAgIHRleHRBcmVhLnZhbHVlID0gdGV4dFRvQ29weVxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGV4dEFyZWEpXG4gICAgdGV4dEFyZWEuc2VsZWN0KClcblxuICAgIGNvbnN0IG1hZ2ljQ29weUZhaWxlZCA9IChlcnIpID0+IHtcbiAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodGV4dEFyZWEpXG4gICAgICB3aW5kb3cucHJvbXB0KGZhbGxiYWNrU3RyaW5nLCB0ZXh0VG9Db3B5KVxuICAgICAgcmV0dXJuIHJlamVjdCgnT29wcywgdW5hYmxlIHRvIGNvcHkgZGlzcGxheWVkIGZhbGxiYWNrIHByb21wdDogJyArIGVycilcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3VjY2Vzc2Z1bCA9IGRvY3VtZW50LmV4ZWNDb21tYW5kKCdjb3B5JylcbiAgICAgIGlmICghc3VjY2Vzc2Z1bCkge1xuICAgICAgICByZXR1cm4gbWFnaWNDb3B5RmFpbGVkKCdjb3B5IGNvbW1hbmQgdW5hdmFpbGFibGUnKVxuICAgICAgfVxuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0QXJlYSlcbiAgICAgIHJldHVybiByZXNvbHZlKClcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodGV4dEFyZWEpXG4gICAgICByZXR1cm4gbWFnaWNDb3B5RmFpbGVkKGVycilcbiAgICB9XG4gIH0pXG59XG5cbi8vIGZ1bmN0aW9uIGNyZWF0ZUlubGluZVdvcmtlciAod29ya2VyRnVuY3Rpb24pIHtcbi8vICAgbGV0IGNvZGUgPSB3b3JrZXJGdW5jdGlvbi50b1N0cmluZygpXG4vLyAgIGNvZGUgPSBjb2RlLnN1YnN0cmluZyhjb2RlLmluZGV4T2YoJ3snKSArIDEsIGNvZGUubGFzdEluZGV4T2YoJ30nKSlcbi8vXG4vLyAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbY29kZV0sIHt0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCd9KVxuLy8gICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYikpXG4vL1xuLy8gICByZXR1cm4gd29ya2VyXG4vLyB9XG5cbi8vIGZ1bmN0aW9uIG1ha2VXb3JrZXIgKHNjcmlwdCkge1xuLy8gICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMXG4vLyAgIHZhciBCbG9iID0gd2luZG93LkJsb2Jcbi8vICAgdmFyIFdvcmtlciA9IHdpbmRvdy5Xb3JrZXJcbi8vXG4vLyAgIGlmICghVVJMIHx8ICFCbG9iIHx8ICFXb3JrZXIgfHwgIXNjcmlwdCkge1xuLy8gICAgIHJldHVybiBudWxsXG4vLyAgIH1cbi8vXG4vLyAgIGxldCBjb2RlID0gc2NyaXB0LnRvU3RyaW5nKClcbi8vICAgY29kZSA9IGNvZGUuc3Vic3RyaW5nKGNvZGUuaW5kZXhPZigneycpICsgMSwgY29kZS5sYXN0SW5kZXhPZignfScpKVxuLy9cbi8vICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbY29kZV0pXG4vLyAgIHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYikpXG4vLyAgIHJldHVybiB3b3JrZXJcbi8vIH1cblxuZnVuY3Rpb24gZ2V0U3BlZWQgKGZpbGVQcm9ncmVzcykge1xuICBpZiAoIWZpbGVQcm9ncmVzcy5ieXRlc1VwbG9hZGVkKSByZXR1cm4gMFxuXG4gIGNvbnN0IHRpbWVFbGFwc2VkID0gKG5ldyBEYXRlKCkpIC0gZmlsZVByb2dyZXNzLnVwbG9hZFN0YXJ0ZWRcbiAgY29uc3QgdXBsb2FkU3BlZWQgPSBmaWxlUHJvZ3Jlc3MuYnl0ZXNVcGxvYWRlZCAvICh0aW1lRWxhcHNlZCAvIDEwMDApXG4gIHJldHVybiB1cGxvYWRTcGVlZFxufVxuXG5mdW5jdGlvbiBnZXRFVEEgKGZpbGVQcm9ncmVzcykge1xuICBpZiAoIWZpbGVQcm9ncmVzcy5ieXRlc1VwbG9hZGVkKSByZXR1cm4gMFxuXG4gIGNvbnN0IHVwbG9hZFNwZWVkID0gZ2V0U3BlZWQoZmlsZVByb2dyZXNzKVxuICBjb25zdCBieXRlc1JlbWFpbmluZyA9IGZpbGVQcm9ncmVzcy5ieXRlc1RvdGFsIC0gZmlsZVByb2dyZXNzLmJ5dGVzVXBsb2FkZWRcbiAgY29uc3Qgc2Vjb25kc1JlbWFpbmluZyA9IE1hdGgucm91bmQoYnl0ZXNSZW1haW5pbmcgLyB1cGxvYWRTcGVlZCAqIDEwKSAvIDEwXG5cbiAgcmV0dXJuIHNlY29uZHNSZW1haW5pbmdcbn1cblxuZnVuY3Rpb24gcHJldHR5RVRBIChzZWNvbmRzKSB7XG4gIGNvbnN0IHRpbWUgPSBzZWNvbmRzVG9UaW1lKHNlY29uZHMpXG5cbiAgLy8gT25seSBkaXNwbGF5IGhvdXJzIGFuZCBtaW51dGVzIGlmIHRoZXkgYXJlIGdyZWF0ZXIgdGhhbiAwIGJ1dCBhbHdheXNcbiAgLy8gZGlzcGxheSBtaW51dGVzIGlmIGhvdXJzIGlzIGJlaW5nIGRpc3BsYXllZFxuICAvLyBEaXNwbGF5IGEgbGVhZGluZyB6ZXJvIGlmIHRoZSB0aGVyZSBpcyBhIHByZWNlZGluZyB1bml0OiAxbSAwNXMsIGJ1dCA1c1xuICBjb25zdCBob3Vyc1N0ciA9IHRpbWUuaG91cnMgPyB0aW1lLmhvdXJzICsgJ2ggJyA6ICcnXG4gIGNvbnN0IG1pbnV0ZXNWYWwgPSB0aW1lLmhvdXJzID8gKCcwJyArIHRpbWUubWludXRlcykuc3Vic3RyKC0yKSA6IHRpbWUubWludXRlc1xuICBjb25zdCBtaW51dGVzU3RyID0gbWludXRlc1ZhbCA/IG1pbnV0ZXNWYWwgKyAnbSAnIDogJydcbiAgY29uc3Qgc2Vjb25kc1ZhbCA9IG1pbnV0ZXNWYWwgPyAoJzAnICsgdGltZS5zZWNvbmRzKS5zdWJzdHIoLTIpIDogdGltZS5zZWNvbmRzXG4gIGNvbnN0IHNlY29uZHNTdHIgPSBzZWNvbmRzVmFsICsgJ3MnXG5cbiAgcmV0dXJuIGAke2hvdXJzU3RyfSR7bWludXRlc1N0cn0ke3NlY29uZHNTdHJ9YFxufVxuXG4vLyBmdW5jdGlvbiBtYWtlQ2FjaGluZ0Z1bmN0aW9uICgpIHtcbi8vICAgbGV0IGNhY2hlZEVsID0gbnVsbFxuLy8gICBsZXQgbGFzdFVwZGF0ZSA9IERhdGUubm93KClcbi8vXG4vLyAgIHJldHVybiBmdW5jdGlvbiBjYWNoZUVsZW1lbnQgKGVsLCB0aW1lKSB7XG4vLyAgICAgaWYgKERhdGUubm93KCkgLSBsYXN0VXBkYXRlIDwgdGltZSkge1xuLy8gICAgICAgcmV0dXJuIGNhY2hlZEVsXG4vLyAgICAgfVxuLy9cbi8vICAgICBjYWNoZWRFbCA9IGVsXG4vLyAgICAgbGFzdFVwZGF0ZSA9IERhdGUubm93KClcbi8vXG4vLyAgICAgcmV0dXJuIGVsXG4vLyAgIH1cbi8vIH1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdlbmVyYXRlRmlsZUlELFxuICB0b0FycmF5LFxuICBldmVyeSxcbiAgZmxhdHRlbixcbiAgZ3JvdXBCeSxcbiAgJCxcbiAgJCQsXG4gIGV4dGVuZCxcbiAgcmVhZEZpbGUsXG4gIGNyZWF0ZUltYWdlVGh1bWJuYWlsLFxuICBnZXRQcm9wb3J0aW9uYWxJbWFnZUhlaWdodCxcbiAgaXNUb3VjaERldmljZSxcbiAgZ2V0RmlsZU5hbWVBbmRFeHRlbnNpb24sXG4gIHRydW5jYXRlU3RyaW5nLFxuICBnZXRGaWxlVHlwZSxcbiAgc2Vjb25kc1RvVGltZSxcbiAgZGF0YVVSSXRvQmxvYixcbiAgZGF0YVVSSXRvRmlsZSxcbiAgZ2V0U3BlZWQsXG4gIGdldEVUQSxcbiAgLy8gbWFrZVdvcmtlcixcbiAgLy8gbWFrZUNhY2hpbmdGdW5jdGlvbixcbiAgY29weVRvQ2xpcGJvYXJkLFxuICBwcmV0dHlFVEFcbn1cbiIsImNvbnN0IENvcmUgPSByZXF1aXJlKCcuL0NvcmUnKVxubW9kdWxlLmV4cG9ydHMgPSBDb3JlXG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICBjb25zdCBkZW1vTGluayA9IHByb3BzLmRlbW8gPyAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIilcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzBdXG5hYyhiZWwwLCBbXCJQcm9jZWVkIHdpdGggRGVtbyBBY2NvdW50XCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KHByb3BzLmhhbmRsZURlbW9BdXRoKSkgOiBudWxsXG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlQcm92aWRlci1hdXRoZW50aWNhdGVcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImgxXCIpXG5hYyhiZWwwLCBbXCJZb3UgbmVlZCB0byBhdXRoZW50aWNhdGUgd2l0aCBcIixhcmd1bWVudHNbMF0sXCIgYmVmb3JlIHNlbGVjdGluZyBmaWxlcy5cIl0pXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcImhyZWZcIiwgYXJndW1lbnRzWzFdKVxuYWMoYmVsMSwgW1wiQXV0aGVudGljYXRlXCJdKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiLGJlbDEsXCJcXG4gICAgICBcIixhcmd1bWVudHNbMl0sXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KHByb3BzLnBsdWdpbk5hbWUscHJvcHMubGluayxkZW1vTGluaykpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgU29tZXRoaW5nIHdlbnQgd3JvbmcuICBQcm9iYWJseSBvdXIgZmF1bHQuIFwiLGFyZ3VtZW50c1swXSxcIlxcbiAgICAgIFwiXSlcbmFjKGJlbDEsIFtcIlxcbiAgICAgIFwiLGJlbDAsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KHByb3BzLmVycm9yKSlcbn1cbiIsImNvbnN0IEF1dGhWaWV3ID0gcmVxdWlyZSgnLi9BdXRoVmlldycpXG5jb25zdCBCcm93c2VyID0gcmVxdWlyZSgnLi9uZXcvQnJvd3NlcicpXG5jb25zdCBFcnJvclZpZXcgPSByZXF1aXJlKCcuL0Vycm9yJylcblxuLyoqXG4gKiBDbGFzcyB0byBlYXNpbHkgZ2VuZXJhdGUgZ2VuZXJpYyB2aWV3cyBmb3IgcGx1Z2luc1xuICpcbiAqIFRoaXMgY2xhc3MgZXhwZWN0cyB0aGUgcGx1Z2luIHVzaW5nIHRvIGhhdmUgdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzXG4gKlxuICogc3RhdGVJZCB7U3RyaW5nfSBvYmplY3Qga2V5IG9mIHdoaWNoIHRoZSBwbHVnaW4gc3RhdGUgaXMgc3RvcmVkXG4gKlxuICogVGhpcyBjbGFzcyBhbHNvIGV4cGVjdHMgdGhlIHBsdWdpbiBpbnN0YW5jZSB1c2luZyBpdCB0byBoYXZlIHRoZSBmb2xsb3dpbmdcbiAqIGFjY2Vzc29yIG1ldGhvZHMuXG4gKiBFYWNoIG1ldGhvZCB0YWtlcyB0aGUgaXRlbSB3aG9zZSBwcm9wZXJ0eSBpcyB0byBiZSBhY2Nlc3NlZFxuICogYXMgYSBwYXJhbVxuICpcbiAqIGlzRm9sZGVyXG4gKiAgICBAcmV0dXJuIHtCb29sZWFufSBmb3IgaWYgdGhlIGl0ZW0gaXMgYSBmb2xkZXIgb3Igbm90XG4gKiBnZXRJdGVtRGF0YVxuICogICAgQHJldHVybiB7T2JqZWN0fSB0aGF0IGlzIGZvcm1hdCByZWFkeSBmb3IgdXBweSB1cGxvYWQvZG93bmxvYWRcbiAqIGdldEl0ZW1JY29uXG4gKiAgICBAcmV0dXJuIHtPYmplY3R9IGh0bWwgaW5zdGFuY2Ugb2YgdGhlIGl0ZW0ncyBpY29uXG4gKiBnZXRJdGVtU3ViTGlzdFxuICogICAgQHJldHVybiB7QXJyYXl9IHN1Yi1pdGVtcyBpbiB0aGUgaXRlbS4gZS5nIGEgZm9sZGVyIG1heSBjb250YWluIHN1Yi1pdGVtc1xuICogZ2V0SXRlbU5hbWVcbiAqICAgIEByZXR1cm4ge1N0cmluZ30gZGlzcGxheSBmcmllbmRseSBuYW1lIG9mIHRoZSBpdGVtXG4gKiBnZXRNaW1lVHlwZVxuICogICAgQHJldHVybiB7U3RyaW5nfSBtaW1lIHR5cGUgb2YgdGhlIGl0ZW1cbiAqIGdldEl0ZW1JZFxuICogICAgQHJldHVybiB7U3RyaW5nfSB1bmlxdWUgaWQgb2YgdGhlIGl0ZW1cbiAqIGdldEl0ZW1SZXF1ZXN0UGF0aFxuICogICAgQHJldHVybiB7U3RyaW5nfSB1bmlxdWUgcmVxdWVzdCBwYXRoIG9mIHRoZSBpdGVtIHdoZW4gbWFraW5nIGNhbGxzIHRvIHVwcHkgc2VydmVyXG4gKiBnZXRJdGVtTW9kaWZpZWREYXRlXG4gKiAgICBAcmV0dXJuIHtvYmplY3R9IG9yIHtTdHJpbmd9IGRhdGUgb2Ygd2hlbiBsYXN0IHRoZSBpdGVtIHdhcyBtb2RpZmllZFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIFZpZXcge1xuICAvKipcbiAgICogQHBhcmFtIHtvYmplY3R9IGluc3RhbmNlIG9mIHRoZSBwbHVnaW5cbiAgICovXG4gIGNvbnN0cnVjdG9yIChwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpblxuICAgIHRoaXMuUHJvdmlkZXIgPSBwbHVnaW5bcGx1Z2luLmlkXVxuXG4gICAgLy8gTG9naWNcbiAgICB0aGlzLmFkZEZpbGUgPSB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKVxuICAgIHRoaXMuZmlsdGVySXRlbXMgPSB0aGlzLmZpbHRlckl0ZW1zLmJpbmQodGhpcylcbiAgICB0aGlzLmZpbHRlclF1ZXJ5ID0gdGhpcy5maWx0ZXJRdWVyeS5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRGb2xkZXIgPSB0aGlzLmdldEZvbGRlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXROZXh0Rm9sZGVyID0gdGhpcy5nZXROZXh0Rm9sZGVyLmJpbmQodGhpcylcbiAgICB0aGlzLmhhbmRsZVJvd0NsaWNrID0gdGhpcy5oYW5kbGVSb3dDbGljay5iaW5kKHRoaXMpXG4gICAgdGhpcy5sb2dvdXQgPSB0aGlzLmxvZ291dC5iaW5kKHRoaXMpXG4gICAgdGhpcy5oYW5kbGVEZW1vQXV0aCA9IHRoaXMuaGFuZGxlRGVtb0F1dGguYmluZCh0aGlzKVxuICAgIHRoaXMuc29ydEJ5VGl0bGUgPSB0aGlzLnNvcnRCeVRpdGxlLmJpbmQodGhpcylcbiAgICB0aGlzLnNvcnRCeURhdGUgPSB0aGlzLnNvcnRCeURhdGUuYmluZCh0aGlzKVxuICAgIHRoaXMuaXNBY3RpdmVSb3cgPSB0aGlzLmlzQWN0aXZlUm93LmJpbmQodGhpcylcblxuICAgIC8vIFZpc3VhbFxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIExpdHRsZSBzaG9ydGhhbmQgdG8gdXBkYXRlIHRoZSBzdGF0ZSB3aXRoIHRoZSBwbHVnaW4ncyBzdGF0ZVxuICAgKi9cbiAgdXBkYXRlU3RhdGUgKG5ld1N0YXRlKSB7XG4gICAgbGV0IHN0YXRlSWQgPSB0aGlzLnBsdWdpbi5zdGF0ZUlkXG4gICAgY29uc3Qge3N0YXRlfSA9IHRoaXMucGx1Z2luLmNvcmVcblxuICAgIHRoaXMucGx1Z2luLmNvcmUuc2V0U3RhdGUoe1tzdGF0ZUlkXTogT2JqZWN0LmFzc2lnbih7fSwgc3RhdGVbc3RhdGVJZF0sIG5ld1N0YXRlKX0pXG4gIH1cblxuICAvKipcbiAgICogQmFzZWQgb24gZm9sZGVyIElELCBmZXRjaCBhIG5ldyBmb2xkZXIgYW5kIHVwZGF0ZSBpdCB0byBzdGF0ZVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkIEZvbGRlciBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgIEZvbGRlcnMvZmlsZXMgaW4gZm9sZGVyXG4gICAqL1xuICBnZXRGb2xkZXIgKGlkKSB7XG4gICAgcmV0dXJuIHRoaXMuUHJvdmlkZXIubGlzdChpZClcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgbGV0IGZvbGRlcnMgPSBbXVxuICAgICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgICBsZXQgdXBkYXRlZERpcmVjdG9yaWVzXG5cbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLnBsdWdpbi5jb3JlLmdldFN0YXRlKClbdGhpcy5wbHVnaW4uc3RhdGVJZF1cbiAgICAgICAgY29uc3QgaW5kZXggPSBzdGF0ZS5kaXJlY3Rvcmllcy5maW5kSW5kZXgoKGRpcikgPT4gaWQgPT09IGRpci5pZClcblxuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgdXBkYXRlZERpcmVjdG9yaWVzID0gc3RhdGUuZGlyZWN0b3JpZXMuc2xpY2UoMCwgaW5kZXggKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVwZGF0ZWREaXJlY3RvcmllcyA9IHN0YXRlLmRpcmVjdG9yaWVzLmNvbmNhdChbe2lkLCB0aXRsZTogdGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUocmVzKX1dKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbHVnaW4uZ2V0SXRlbVN1Ykxpc3QocmVzKS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKHRoaXMucGx1Z2luLmlzRm9sZGVyKGl0ZW0pKSB7XG4gICAgICAgICAgICBmb2xkZXJzLnB1c2goaXRlbSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsZXMucHVzaChpdGVtKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBsZXQgZGF0YSA9IHtmb2xkZXJzLCBmaWxlcywgZGlyZWN0b3JpZXM6IHVwZGF0ZWREaXJlY3Rvcmllc31cbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZShkYXRhKVxuXG4gICAgICAgIHJldHVybiBkYXRhXG4gICAgICB9KVxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgcmV0dXJuIGVyclxuICAgICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaGVzIG5ldyBmb2xkZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBGb2xkZXJcbiAgICogQHBhcmFtICB7U3RyaW5nfSB0aXRsZSBGb2xkZXIgdGl0bGVcbiAgICovXG4gIGdldE5leHRGb2xkZXIgKGZvbGRlcikge1xuICAgIGxldCBpZCA9IHRoaXMucGx1Z2luLmdldEl0ZW1SZXF1ZXN0UGF0aChmb2xkZXIpXG4gICAgdGhpcy5nZXRGb2xkZXIoaWQpXG4gIH1cblxuICBhZGRGaWxlIChmaWxlKSB7XG4gICAgY29uc3QgdGFnRmlsZSA9IHtcbiAgICAgIHNvdXJjZTogdGhpcy5wbHVnaW4uaWQsXG4gICAgICBkYXRhOiB0aGlzLnBsdWdpbi5nZXRJdGVtRGF0YShmaWxlKSxcbiAgICAgIG5hbWU6IHRoaXMucGx1Z2luLmdldEl0ZW1OYW1lKGZpbGUpLFxuICAgICAgdHlwZTogdGhpcy5wbHVnaW4uZ2V0TWltZVR5cGUoZmlsZSksXG4gICAgICBpc1JlbW90ZTogdHJ1ZSxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgZmlsZUlkOiB0aGlzLnBsdWdpbi5nZXRJdGVtSWQoZmlsZSlcbiAgICAgIH0sXG4gICAgICByZW1vdGU6IHtcbiAgICAgICAgaG9zdDogdGhpcy5wbHVnaW4ub3B0cy5ob3N0LFxuICAgICAgICB1cmw6IGAke3RoaXMucGx1Z2luLm9wdHMuaG9zdH0vJHt0aGlzLlByb3ZpZGVyLmlkfS9nZXQvJHt0aGlzLnBsdWdpbi5nZXRJdGVtUmVxdWVzdFBhdGgoZmlsZSl9YCxcbiAgICAgICAgYm9keToge1xuICAgICAgICAgIGZpbGVJZDogdGhpcy5wbHVnaW4uZ2V0SXRlbUlkKGZpbGUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2FkZGluZyBmaWxlJylcbiAgICB0aGlzLnBsdWdpbi5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTpmaWxlLWFkZCcsIHRhZ0ZpbGUpXG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBzZXNzaW9uIHRva2VuIG9uIGNsaWVudCBzaWRlLlxuICAgKi9cbiAgbG9nb3V0ICgpIHtcbiAgICB0aGlzLlByb3ZpZGVyLmxvZ291dChsb2NhdGlvbi5ocmVmKVxuICAgICAgLnRoZW4oKHJlcykgPT4gcmVzLmpzb24oKSlcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcy5vaykge1xuICAgICAgICAgIGNvbnN0IG5ld1N0YXRlID0ge1xuICAgICAgICAgICAgYXV0aGVudGljYXRlZDogZmFsc2UsXG4gICAgICAgICAgICBmaWxlczogW10sXG4gICAgICAgICAgICBmb2xkZXJzOiBbXSxcbiAgICAgICAgICAgIGRpcmVjdG9yaWVzOiBbXVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKG5ld1N0YXRlKVxuICAgICAgICB9XG4gICAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gc2V0IGFjdGl2ZSBmaWxlL2ZvbGRlci5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBmaWxlICAgQWN0aXZlIGZpbGUvZm9sZGVyXG4gICAqL1xuICBoYW5kbGVSb3dDbGljayAoZmlsZSkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5wbHVnaW4uY29yZS5nZXRTdGF0ZSgpW3RoaXMucGx1Z2luLnN0YXRlSWRdXG4gICAgY29uc3QgbmV3U3RhdGUgPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwge1xuICAgICAgYWN0aXZlUm93OiB0aGlzLnBsdWdpbi5nZXRJdGVtSWQoZmlsZSlcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdGF0ZShuZXdTdGF0ZSlcbiAgfVxuXG4gIGZpbHRlclF1ZXJ5IChlKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLnBsdWdpbi5jb3JlLmdldFN0YXRlKClbdGhpcy5wbHVnaW4uc3RhdGVJZF1cbiAgICB0aGlzLnVwZGF0ZVN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBmaWx0ZXJJbnB1dDogZS50YXJnZXQudmFsdWVcbiAgICB9KSlcbiAgfVxuXG4gIGZpbHRlckl0ZW1zIChpdGVtcykge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5wbHVnaW4uY29yZS5nZXRTdGF0ZSgpW3RoaXMucGx1Z2luLnN0YXRlSWRdXG4gICAgcmV0dXJuIGl0ZW1zLmZpbHRlcigoZm9sZGVyKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUoZm9sZGVyKS50b0xvd2VyQ2FzZSgpLmluZGV4T2Yoc3RhdGUuZmlsdGVySW5wdXQudG9Mb3dlckNhc2UoKSkgIT09IC0xXG4gICAgfSlcbiAgfVxuXG4gIHNvcnRCeVRpdGxlICgpIHtcbiAgICBjb25zdCBzdGF0ZSA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucGx1Z2luLmNvcmUuZ2V0U3RhdGUoKVt0aGlzLnBsdWdpbi5zdGF0ZUlkXSlcbiAgICBjb25zdCB7ZmlsZXMsIGZvbGRlcnMsIHNvcnRpbmd9ID0gc3RhdGVcblxuICAgIGxldCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoKGZpbGVBLCBmaWxlQikgPT4ge1xuICAgICAgaWYgKHNvcnRpbmcgPT09ICd0aXRsZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsdWdpbi5nZXRJdGVtTmFtZShmaWxlQikubG9jYWxlQ29tcGFyZSh0aGlzLnBsdWdpbi5nZXRJdGVtTmFtZShmaWxlQSkpXG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUoZmlsZUEpLmxvY2FsZUNvbXBhcmUodGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUoZmlsZUIpKVxuICAgIH0pXG5cbiAgICBsZXQgc29ydGVkRm9sZGVycyA9IGZvbGRlcnMuc29ydCgoZm9sZGVyQSwgZm9sZGVyQikgPT4ge1xuICAgICAgaWYgKHNvcnRpbmcgPT09ICd0aXRsZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsdWdpbi5nZXRJdGVtTmFtZShmb2xkZXJCKS5sb2NhbGVDb21wYXJlKHRoaXMucGx1Z2luLmdldEl0ZW1OYW1lKGZvbGRlckEpKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucGx1Z2luLmdldEl0ZW1OYW1lKGZvbGRlckEpLmxvY2FsZUNvbXBhcmUodGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUoZm9sZGVyQikpXG4gICAgfSlcblxuICAgIHRoaXMudXBkYXRlU3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIHtcbiAgICAgIGZpbGVzOiBzb3J0ZWRGaWxlcyxcbiAgICAgIGZvbGRlcnM6IHNvcnRlZEZvbGRlcnMsXG4gICAgICBzb3J0aW5nOiAoc29ydGluZyA9PT0gJ3RpdGxlRGVzY2VuZGluZycpID8gJ3RpdGxlQXNjZW5kaW5nJyA6ICd0aXRsZURlc2NlbmRpbmcnXG4gICAgfSkpXG4gIH1cblxuICBzb3J0QnlEYXRlICgpIHtcbiAgICBjb25zdCBzdGF0ZSA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucGx1Z2luLmNvcmUuZ2V0U3RhdGUoKVt0aGlzLnBsdWdpbi5zdGF0ZUlkXSlcbiAgICBjb25zdCB7ZmlsZXMsIGZvbGRlcnMsIHNvcnRpbmd9ID0gc3RhdGVcblxuICAgIGxldCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoKGZpbGVBLCBmaWxlQikgPT4ge1xuICAgICAgbGV0IGEgPSBuZXcgRGF0ZSh0aGlzLnBsdWdpbi5nZXRJdGVtTW9kaWZpZWREYXRlKGZpbGVBKSlcbiAgICAgIGxldCBiID0gbmV3IERhdGUodGhpcy5wbHVnaW4uZ2V0SXRlbU1vZGlmaWVkRGF0ZShmaWxlQikpXG5cbiAgICAgIGlmIChzb3J0aW5nID09PSAnZGF0ZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiBhID4gYiA/IC0xIDogYSA8IGIgPyAxIDogMFxuICAgICAgfVxuICAgICAgcmV0dXJuIGEgPiBiID8gMSA6IGEgPCBiID8gLTEgOiAwXG4gICAgfSlcblxuICAgIGxldCBzb3J0ZWRGb2xkZXJzID0gZm9sZGVycy5zb3J0KChmb2xkZXJBLCBmb2xkZXJCKSA9PiB7XG4gICAgICBsZXQgYSA9IG5ldyBEYXRlKHRoaXMucGx1Z2luLmdldEl0ZW1Nb2RpZmllZERhdGUoZm9sZGVyQSkpXG4gICAgICBsZXQgYiA9IG5ldyBEYXRlKHRoaXMucGx1Z2luLmdldEl0ZW1Nb2RpZmllZERhdGUoZm9sZGVyQikpXG5cbiAgICAgIGlmIChzb3J0aW5nID09PSAnZGF0ZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiBhID4gYiA/IC0xIDogYSA8IGIgPyAxIDogMFxuICAgICAgfVxuXG4gICAgICByZXR1cm4gYSA+IGIgPyAxIDogYSA8IGIgPyAtMSA6IDBcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdGF0ZShPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwge1xuICAgICAgZmlsZXM6IHNvcnRlZEZpbGVzLFxuICAgICAgZm9sZGVyczogc29ydGVkRm9sZGVycyxcbiAgICAgIHNvcnRpbmc6IChzb3J0aW5nID09PSAnZGF0ZURlc2NlbmRpbmcnKSA/ICdkYXRlQXNjZW5kaW5nJyA6ICdkYXRlRGVzY2VuZGluZydcbiAgICB9KSlcbiAgfVxuXG4gIGlzQWN0aXZlUm93IChmaWxlKSB7XG4gICAgcmV0dXJuIHRoaXMucGx1Z2luLmNvcmUuZ2V0U3RhdGUoKVt0aGlzLnBsdWdpbi5zdGF0ZUlkXS5hY3RpdmVSb3cgPT09IHRoaXMucGx1Z2luLmdldEl0ZW1JZChmaWxlKVxuICB9XG5cbiAgaGFuZGxlRGVtb0F1dGggKCkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5wbHVnaW4uY29yZS5nZXRTdGF0ZSgpW3RoaXMucGx1Z2luLnN0YXRlSWRdXG4gICAgdGhpcy51cGRhdGVTdGF0ZSh7fSwgc3RhdGUsIHtcbiAgICAgIGF1dGhlbnRpY2F0ZWQ6IHRydWVcbiAgICB9KVxuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIGNvbnN0IHsgYXV0aGVudGljYXRlZCwgZXJyb3IgfSA9IHN0YXRlW3RoaXMucGx1Z2luLnN0YXRlSWRdXG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBFcnJvclZpZXcoeyBlcnJvcjogZXJyb3IgfSlcbiAgICB9XG5cbiAgICBpZiAoIWF1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIGNvbnN0IGF1dGhTdGF0ZSA9IGJ0b2EoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICByZWRpcmVjdDogbG9jYXRpb24uaHJlZi5zcGxpdCgnIycpWzBdXG4gICAgICB9KSlcblxuICAgICAgY29uc3QgbGluayA9IGAke3RoaXMucGx1Z2luLm9wdHMuaG9zdH0vY29ubmVjdC8ke3RoaXMuUHJvdmlkZXIuYXV0aFByb3ZpZGVyfT9zdGF0ZT0ke2F1dGhTdGF0ZX1gXG5cbiAgICAgIHJldHVybiBBdXRoVmlldyh7XG4gICAgICAgIHBsdWdpbk5hbWU6IHRoaXMucGx1Z2luLnRpdGxlLFxuICAgICAgICBsaW5rOiBsaW5rLFxuICAgICAgICBkZW1vOiB0aGlzLnBsdWdpbi5vcHRzLmRlbW8sXG4gICAgICAgIGhhbmRsZURlbW9BdXRoOiB0aGlzLmhhbmRsZURlbW9BdXRoXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IGJyb3dzZXJQcm9wcyA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlW3RoaXMucGx1Z2luLnN0YXRlSWRdLCB7XG4gICAgICBnZXROZXh0Rm9sZGVyOiB0aGlzLmdldE5leHRGb2xkZXIsXG4gICAgICBnZXRGb2xkZXI6IHRoaXMuZ2V0Rm9sZGVyLFxuICAgICAgYWRkRmlsZTogdGhpcy5hZGRGaWxlLFxuICAgICAgZmlsdGVySXRlbXM6IHRoaXMuZmlsdGVySXRlbXMsXG4gICAgICBmaWx0ZXJRdWVyeTogdGhpcy5maWx0ZXJRdWVyeSxcbiAgICAgIGhhbmRsZVJvd0NsaWNrOiB0aGlzLmhhbmRsZVJvd0NsaWNrLFxuICAgICAgc29ydEJ5VGl0bGU6IHRoaXMuc29ydEJ5VGl0bGUsXG4gICAgICBzb3J0QnlEYXRlOiB0aGlzLnNvcnRCeURhdGUsXG4gICAgICBsb2dvdXQ6IHRoaXMubG9nb3V0LFxuICAgICAgZGVtbzogdGhpcy5wbHVnaW4ub3B0cy5kZW1vLFxuICAgICAgaXNBY3RpdmVSb3c6IHRoaXMuaXNBY3RpdmVSb3csXG4gICAgICBnZXRJdGVtTmFtZTogdGhpcy5wbHVnaW4uZ2V0SXRlbU5hbWUsXG4gICAgICBnZXRJdGVtSWNvbjogdGhpcy5wbHVnaW4uZ2V0SXRlbUljb25cbiAgICB9KVxuXG4gICAgcmV0dXJuIEJyb3dzZXIoYnJvd3NlclByb3BzKVxuICB9XG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwwW1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1swXVxuYWMoYmVsMCwgW2FyZ3VtZW50c1sxXV0pXG5hYyhiZWwxLCBbXCJcXG4gICAgICBcIixiZWwwLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfShwcm9wcy5nZXRGb2xkZXIscHJvcHMudGl0bGUpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IEJyZWFkY3J1bWIgPSByZXF1aXJlKCcuL0JyZWFkY3J1bWInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlQcm92aWRlci1icmVhZGNydW1ic1wiKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgXCIsYXJndW1lbnRzWzBdLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShwcm9wcy5kaXJlY3Rvcmllcy5tYXAoKGRpcmVjdG9yeSkgPT4ge1xuICAgICAgICAgIHJldHVybiBCcmVhZGNydW1iKHtcbiAgICAgICAgICAgIGdldEZvbGRlcjogKCkgPT4gcHJvcHMuZ2V0Rm9sZGVyKGRpcmVjdG9yeS5pZCksXG4gICAgICAgICAgICB0aXRsZTogZGlyZWN0b3J5LnRpdGxlXG4gICAgICAgICAgfSlcbiAgICAgICAgfSkpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IEJyZWFkY3J1bWJzID0gcmVxdWlyZSgnLi9CcmVhZGNydW1icycpXG5jb25zdCBUYWJsZSA9IHJlcXVpcmUoJy4vVGFibGUnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICBsZXQgZmlsdGVyZWRGb2xkZXJzID0gcHJvcHMuZm9sZGVyc1xuICBsZXQgZmlsdGVyZWRGaWxlcyA9IHByb3BzLmZpbGVzXG5cbiAgaWYgKHByb3BzLmZpbHRlcklucHV0ICE9PSAnJykge1xuICAgIGZpbHRlcmVkRm9sZGVycyA9IHByb3BzLmZpbHRlckl0ZW1zKHByb3BzLmZvbGRlcnMpXG4gICAgZmlsdGVyZWRGaWxlcyA9IHByb3BzLmZpbHRlckl0ZW1zKHByb3BzLmZpbGVzKVxuICB9XG5cbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw1LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiQnJvd3NlclwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZGVyXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJwbGFjZWhvbGRlclwiLCBcIlNlYXJjaCBEcml2ZVwiKVxuYmVsMFtcIm9ua2V5dXBcIl0gPSBhcmd1bWVudHNbMF1cbmJlbDAuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgYXJndW1lbnRzWzFdKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIkJyb3dzZXItc2VhcmNoXCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgIFwiLGJlbDAsXCJcXG4gICAgICBcIl0pXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJCcm93c2VyLXN1YkhlYWRlclwiKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgICBcIixhcmd1bWVudHNbMl0sXCJcXG4gICAgICBcIl0pXG52YXIgYmVsNCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJCcm93c2VyLWJvZHlcIilcbnZhciBiZWwzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIm1haW5cIilcbmJlbDMuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJCcm93c2VyLWNvbnRlbnRcIilcbmFjKGJlbDMsIFtcIlxcbiAgICAgICAgICBcIixhcmd1bWVudHNbM10sXCJcXG4gICAgICAgIFwiXSlcbmFjKGJlbDQsIFtcIlxcbiAgICAgICAgXCIsYmVsMyxcIlxcbiAgICAgIFwiXSlcbmFjKGJlbDUsIFtcIlxcbiAgICAgIFwiLGJlbDEsXCJcXG4gICAgICBcIixiZWwyLFwiXFxuICAgICAgXCIsYmVsNCxcIlxcbiAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsNVxuICAgIH0ocHJvcHMuZmlsdGVyUXVlcnkscHJvcHMuZmlsdGVySW5wdXQsQnJlYWRjcnVtYnMoe1xuICAgICAgICAgIGdldEZvbGRlcjogcHJvcHMuZ2V0Rm9sZGVyLFxuICAgICAgICAgIGRpcmVjdG9yaWVzOiBwcm9wcy5kaXJlY3Rvcmllc1xuICAgICAgICB9KSxUYWJsZSh7XG4gICAgICAgICAgICBjb2x1bW5zOiBbe1xuICAgICAgICAgICAgICBuYW1lOiAnTmFtZScsXG4gICAgICAgICAgICAgIGtleTogJ3RpdGxlJ1xuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICBmb2xkZXJzOiBmaWx0ZXJlZEZvbGRlcnMsXG4gICAgICAgICAgICBmaWxlczogZmlsdGVyZWRGaWxlcyxcbiAgICAgICAgICAgIGFjdGl2ZVJvdzogcHJvcHMuaXNBY3RpdmVSb3csXG4gICAgICAgICAgICBzb3J0QnlUaXRsZTogcHJvcHMuc29ydEJ5VGl0bGUsXG4gICAgICAgICAgICBzb3J0QnlEYXRlOiBwcm9wcy5zb3J0QnlEYXRlLFxuICAgICAgICAgICAgaGFuZGxlUm93Q2xpY2s6IHByb3BzLmhhbmRsZVJvd0NsaWNrLFxuICAgICAgICAgICAgaGFuZGxlRmlsZURvdWJsZUNsaWNrOiBwcm9wcy5hZGRGaWxlLFxuICAgICAgICAgICAgaGFuZGxlRm9sZGVyRG91YmxlQ2xpY2s6IHByb3BzLmdldE5leHRGb2xkZXIsXG4gICAgICAgICAgICBnZXRJdGVtTmFtZTogcHJvcHMuZ2V0SXRlbU5hbWUsXG4gICAgICAgICAgICBnZXRJdGVtSWNvbjogcHJvcHMuZ2V0SXRlbUljb25cbiAgICAgICAgICB9KSkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuY29uc3QgUm93ID0gcmVxdWlyZSgnLi9UYWJsZVJvdycpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGhlYWRlcnMgPSBwcm9wcy5jb2x1bW5zLm1hcCgoY29sdW1uKSA9PiB7XG4gICAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGhcIilcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzBdXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiQnJvd3NlclRhYmxlLWhlYWRlckNvbHVtbiBCcm93c2VyVGFibGUtY29sdW1uXCIpXG5hYyhiZWwwLCBbXCJcXG4gICAgICAgIFwiLGFyZ3VtZW50c1sxXSxcIlxcbiAgICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShwcm9wcy5zb3J0QnlUaXRsZSxjb2x1bW4ubmFtZSkpXG4gIH0pXG5cbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGFibGVcIilcbmJlbDMuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJCcm93c2VyVGFibGVcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRoZWFkXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiQnJvd3NlclRhYmxlLWhlYWRlclwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidHJcIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgICBcIixhcmd1bWVudHNbMF0sXCJcXG4gICAgICAgIFwiXSlcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiXSlcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRib2R5XCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgICAgIFwiLGFyZ3VtZW50c1sxXSxcIlxcbiAgICAgICAgXCIsYXJndW1lbnRzWzJdLFwiXFxuICAgICAgXCJdKVxuYWMoYmVsMywgW1wiXFxuICAgICAgXCIsYmVsMSxcIlxcbiAgICAgIFwiLGJlbDIsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDNcbiAgICB9KGhlYWRlcnMscHJvcHMuZm9sZGVycy5tYXAoKGZvbGRlcikgPT4ge1xuICAgICAgICAgIHJldHVybiBSb3coe1xuICAgICAgICAgICAgdGl0bGU6IHByb3BzLmdldEl0ZW1OYW1lKGZvbGRlciksXG4gICAgICAgICAgICBhY3RpdmU6IHByb3BzLmFjdGl2ZVJvdyhmb2xkZXIpLFxuICAgICAgICAgICAgZ2V0SXRlbUljb246ICgpID0+IHByb3BzLmdldEl0ZW1JY29uKGZvbGRlciksXG4gICAgICAgICAgICBoYW5kbGVDbGljazogKCkgPT4gcHJvcHMuaGFuZGxlUm93Q2xpY2soZm9sZGVyKSxcbiAgICAgICAgICAgIGhhbmRsZURvdWJsZUNsaWNrOiAoKSA9PiBwcm9wcy5oYW5kbGVGb2xkZXJEb3VibGVDbGljayhmb2xkZXIpLFxuICAgICAgICAgICAgY29sdW1uczogcHJvcHMuY29sdW1uc1xuICAgICAgICAgIH0pXG4gICAgICAgIH0pLHByb3BzLmZpbGVzLm1hcCgoZmlsZSkgPT4ge1xuICAgICAgICAgIHJldHVybiBSb3coe1xuICAgICAgICAgICAgdGl0bGU6IHByb3BzLmdldEl0ZW1OYW1lKGZpbGUpLFxuICAgICAgICAgICAgYWN0aXZlOiBwcm9wcy5hY3RpdmVSb3coZmlsZSksXG4gICAgICAgICAgICBnZXRJdGVtSWNvbjogKCkgPT4gcHJvcHMuZ2V0SXRlbUljb24oZmlsZSksXG4gICAgICAgICAgICBoYW5kbGVDbGljazogKCkgPT4gcHJvcHMuaGFuZGxlUm93Q2xpY2soZmlsZSksXG4gICAgICAgICAgICBoYW5kbGVEb3VibGVDbGljazogKCkgPT4gcHJvcHMuaGFuZGxlRmlsZURvdWJsZUNsaWNrKGZpbGUpLFxuICAgICAgICAgICAgY29sdW1uczogcHJvcHMuY29sdW1uc1xuICAgICAgICAgIH0pXG4gICAgICAgIH0pKSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRkXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiQnJvd3NlclRhYmxlLXJvd0NvbHVtbiBCcm93c2VyVGFibGUtY29sdW1uXCIpXG5hYyhiZWwwLCBbXCJcXG4gICAgICBcIixhcmd1bWVudHNbMF0sXCIgXCIsYXJndW1lbnRzWzFdLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShwcm9wcy5nZXRJdGVtSWNvbigpLHByb3BzLnZhbHVlKSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5jb25zdCBDb2x1bW4gPSByZXF1aXJlKCcuL1RhYmxlQ29sdW1uJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY2xhc3NlcyA9IHByb3BzLmFjdGl2ZSA/ICdCcm93c2VyVGFibGUtcm93IGlzLWFjdGl2ZScgOiAnQnJvd3NlclRhYmxlLXJvdydcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidHJcIilcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzBdXG5iZWwwW1wib25kYmxjbGlja1wiXSA9IGFyZ3VtZW50c1sxXVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBhcmd1bWVudHNbMl0pXG5hYyhiZWwwLCBbXCJcXG4gICAgICBcIixhcmd1bWVudHNbM10sXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KHByb3BzLmhhbmRsZUNsaWNrLHByb3BzLmhhbmRsZURvdWJsZUNsaWNrLGNsYXNzZXMsQ29sdW1uKHtcbiAgICAgICAgZ2V0SXRlbUljb246IHByb3BzLmdldEl0ZW1JY29uLFxuICAgICAgICB2YWx1ZTogcHJvcHMudGl0bGVcbiAgICAgIH0pKSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwiYnV0dG9uXCIpXG5iZWwwW1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1swXVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtYnJvd3NlXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzFdXSlcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJmaWxlXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgXCJmaWxlc1tdXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcIm11bHRpcGxlXCIsIFwidHJ1ZVwiKVxuYmVsMVtcIm9uY2hhbmdlXCJdID0gYXJndW1lbnRzWzJdXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1pbnB1dFwiKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgXCIsYXJndW1lbnRzWzNdLFwiXFxuICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiLGJlbDEsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KChldikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgJHtwcm9wcy5jb250YWluZXJ9IC5VcHB5RGFzaGJvYXJkLWlucHV0YClcbiAgICAgICAgICAgICAgICBpbnB1dC5jbGljaygpXG4gICAgICAgICAgICAgIH0scHJvcHMuaTE4bignYnJvd3NlJykscHJvcHMuaGFuZGxlSW5wdXRDaGFuZ2UscHJvcHMuYWNxdWlyZXJzLmxlbmd0aCA9PT0gMFxuICAgICAgICA/IHByb3BzLmkxOG4oJ2Ryb3BQYXN0ZScpXG4gICAgICAgIDogcHJvcHMuaTE4bignZHJvcFBhc3RlSW1wb3J0JykpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IEZpbGVMaXN0ID0gcmVxdWlyZSgnLi9GaWxlTGlzdCcpXG5jb25zdCBUYWJzID0gcmVxdWlyZSgnLi9UYWJzJylcbmNvbnN0IEZpbGVDYXJkID0gcmVxdWlyZSgnLi9GaWxlQ2FyZCcpXG5jb25zdCBVcGxvYWRCdG4gPSByZXF1aXJlKCcuL1VwbG9hZEJ0bicpXG5jb25zdCBTdGF0dXNCYXIgPSByZXF1aXJlKCcuL1N0YXR1c0JhcicpXG5jb25zdCB7IGlzVG91Y2hEZXZpY2UsIHRvQXJyYXkgfSA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvVXRpbHMnKVxuY29uc3QgeyBjbG9zZUljb24gfSA9IHJlcXVpcmUoJy4vaWNvbnMnKVxuXG4vLyBodHRwOi8vZGV2LmVkZW5zcGlla2VybWFubi5jb20vMjAxNi8wMi8xMS9pbnRyb2R1Y2luZy1hY2Nlc3NpYmxlLW1vZGFsLWRpYWxvZ1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIERhc2hib2FyZCAocHJvcHMpIHtcbiAgY29uc3QgaGFuZGxlSW5wdXRDaGFuZ2UgPSAoZXYpID0+IHtcbiAgICBldi5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgZmlsZXMgPSB0b0FycmF5KGV2LnRhcmdldC5maWxlcylcblxuICAgIGZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgIHByb3BzLmFkZEZpbGUoe1xuICAgICAgICBzb3VyY2U6IHByb3BzLmlkLFxuICAgICAgICBuYW1lOiBmaWxlLm5hbWUsXG4gICAgICAgIHR5cGU6IGZpbGUudHlwZSxcbiAgICAgICAgZGF0YTogZmlsZVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgLy8gQFRPRE8gRXhwcmltZW50YWwsIHdvcmsgaW4gcHJvZ3Jlc3NcbiAgLy8gbm8gbmFtZXMsIHdlaXJkIEFQSSwgQ2hyb21lLW9ubHkgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI5NDAwMjBcbiAgY29uc3QgaGFuZGxlUGFzdGUgPSAoZXYpID0+IHtcbiAgICBldi5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBjb25zdCBmaWxlcyA9IHRvQXJyYXkoZXYuY2xpcGJvYXJkRGF0YS5pdGVtcylcbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICBpZiAoZmlsZS5raW5kICE9PSAnZmlsZScpIHJldHVyblxuXG4gICAgICBjb25zdCBibG9iID0gZmlsZS5nZXRBc0ZpbGUoKVxuICAgICAgcHJvcHMubG9nKCdGaWxlIHBhc3RlZCcpXG4gICAgICBwcm9wcy5hZGRGaWxlKHtcbiAgICAgICAgc291cmNlOiBwcm9wcy5pZCxcbiAgICAgICAgbmFtZTogZmlsZS5uYW1lLFxuICAgICAgICB0eXBlOiBmaWxlLnR5cGUsXG4gICAgICAgIGRhdGE6IGJsb2JcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IGRhc2hib2FyZFNpemUgPSBwcm9wcy5pbmxpbmUgPyBgd2lkdGg6ICR7cHJvcHMubWF4V2lkdGh9cHg7IGhlaWdodDogJHtwcm9wcy5tYXhIZWlnaHR9cHg7YCA6ICcnXG5cbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgb25sb2FkID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L25vZGVfbW9kdWxlcy9vbi1sb2FkL2luZGV4LmpzJylcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDExID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxudmFyIGFyZ3MgPSBhcmd1bWVudHNcbiAgICAgIG9ubG9hZChiZWwxMSwgZnVuY3Rpb24gYmVsX29ubG9hZCAoKSB7XG4gICAgICAgIGFyZ3NbMThdKGJlbDExKVxuICAgICAgfSwgZnVuY3Rpb24gYmVsX29udW5sb2FkICgpIHtcbiAgICAgICAgXG4gICAgICB9LCBcIm8wXCIpXG5iZWwxMS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWhpZGRlblwiLCBhcmd1bWVudHNbMTldKVxuYmVsMTEuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBhcmd1bWVudHNbMjBdKVxuYmVsMTEuc2V0QXR0cmlidXRlKFwicm9sZVwiLCBcImRpYWxvZ1wiKVxuYmVsMTFbXCJvbnBhc3RlXCJdID0gYXJndW1lbnRzWzIxXVxuYmVsMTEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5IFVwcHlUaGVtZS0tZGVmYXVsdCBVcHB5RGFzaGJvYXJkXFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiArIGFyZ3VtZW50c1syMl0gKyBcIlxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgKyBhcmd1bWVudHNbMjNdICsgXCJcXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiICsgYXJndW1lbnRzWzI0XSArIFwiXFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiArIGFyZ3VtZW50c1syNV0pXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcbmJlbDAuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBhcmd1bWVudHNbMF0pXG5iZWwwLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIGFyZ3VtZW50c1sxXSlcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzJdXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1jbG9zZVwiKVxuYWMoYmVsMCwgW2FyZ3VtZW50c1szXV0pXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDFbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzRdXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1vdmVybGF5XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgXCJdKVxudmFyIGJlbDEwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsMTAuc2V0QXR0cmlidXRlKFwidGFiaW5kZXhcIiwgXCIwXCIpXG5iZWwxMC5zZXRBdHRyaWJ1dGUoXCJzdHlsZVwiLCBhcmd1bWVudHNbMTddKVxuYmVsMTAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkLWlubmVyXCIpXG52YXIgYmVsOSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDkuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkLWlubmVyV3JhcFwiKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwzLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1maWxlc0NvbnRhaW5lclwiKVxudmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1hY3Rpb25zXCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgICAgICAgICBcIixhcmd1bWVudHNbNV0sXCJcXG4gICAgICAgICAgXCJdKVxuYWMoYmVsMywgW1wiXFxuXFxuICAgICAgICAgIFwiLGFyZ3VtZW50c1s2XSxcIlxcblxcbiAgICAgICAgICBcIixiZWwyLFwiXFxuXFxuICAgICAgICBcIl0pXG52YXIgYmVsNyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDcuc2V0QXR0cmlidXRlKFwicm9sZVwiLCBcInRhYnBhbmVsXCIpXG5iZWw3LnNldEF0dHJpYnV0ZShcImFyaWEtaGlkZGVuXCIsIGFyZ3VtZW50c1sxMV0pXG5iZWw3LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZENvbnRlbnQtcGFuZWxcIilcbnZhciBiZWw2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsNi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRDb250ZW50LWJhclwiKVxudmFyIGJlbDQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDJcIilcbmJlbDQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkQ29udGVudC10aXRsZVwiKVxuYWMoYmVsNCwgW1wiXFxuICAgICAgICAgICAgICBcIixhcmd1bWVudHNbN10sXCIgXCIsYXJndW1lbnRzWzhdLFwiXFxuICAgICAgICAgICAgXCJdKVxudmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWw1W1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1s5XVxuYmVsNS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRDb250ZW50LWJhY2tcIilcbmFjKGJlbDUsIFthcmd1bWVudHNbMTBdXSlcbmFjKGJlbDYsIFtcIlxcbiAgICAgICAgICAgIFwiLGJlbDQsXCJcXG4gICAgICAgICAgICBcIixiZWw1LFwiXFxuICAgICAgICAgIFwiXSlcbmFjKGJlbDcsIFtcIlxcbiAgICAgICAgICBcIixiZWw2LFwiXFxuICAgICAgICAgIFwiLGFyZ3VtZW50c1sxMl0sXCJcXG4gICAgICAgIFwiXSlcbnZhciBiZWw4ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsOC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtcHJvZ3Jlc3NpbmRpY2F0b3JzXCIpXG5hYyhiZWw4LCBbXCJcXG4gICAgICAgICAgXCIsYXJndW1lbnRzWzEzXSxcIlxcblxcbiAgICAgICAgICBcIixhcmd1bWVudHNbMTRdLFwiXFxuICAgICAgICBcIl0pXG5hYyhiZWw5LCBbXCJcXG5cXG4gICAgICAgIFwiLGFyZ3VtZW50c1sxNV0sXCJcXG5cXG4gICAgICAgIFwiLGFyZ3VtZW50c1sxNl0sXCJcXG5cXG4gICAgICAgIFwiLGJlbDMsXCJcXG5cXG4gICAgICAgIFwiLGJlbDcsXCJcXG5cXG4gICAgICAgIFwiLGJlbDgsXCJcXG5cXG4gICAgICBcIl0pXG5hYyhiZWwxMCwgW1wiXFxuICAgICAgXCIsYmVsOSxcIlxcbiAgICBcIl0pXG5hYyhiZWwxMSwgW1wiXFxuXFxuICAgIFwiLGJlbDAsXCJcXG5cXG4gICAgXCIsYmVsMSxcIlxcblxcbiAgICBcIixiZWwxMCxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDExXG4gICAgfShwcm9wcy5pMThuKCdjbG9zZU1vZGFsJykscHJvcHMuaTE4bignY2xvc2VNb2RhbCcpLHByb3BzLmhpZGVNb2RhbCxjbG9zZUljb24oKSxwcm9wcy5oaWRlTW9kYWwsIXByb3BzLmF1dG9Qcm9jZWVkICYmIHByb3BzLm5ld0ZpbGVzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgPyBVcGxvYWRCdG4oe1xuICAgICAgICAgICAgICAgIGkxOG46IHByb3BzLmkxOG4sXG4gICAgICAgICAgICAgICAgc3RhcnRVcGxvYWQ6IHByb3BzLnN0YXJ0VXBsb2FkLFxuICAgICAgICAgICAgICAgIG5ld0ZpbGVDb3VudDogcHJvcHMubmV3RmlsZXMubGVuZ3RoXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIDogbnVsbCxGaWxlTGlzdCh7XG4gICAgICAgICAgICBhY3F1aXJlcnM6IHByb3BzLmFjcXVpcmVycyxcbiAgICAgICAgICAgIGZpbGVzOiBwcm9wcy5maWxlcyxcbiAgICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBoYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICAgIGNvbnRhaW5lcjogcHJvcHMuY29udGFpbmVyLFxuICAgICAgICAgICAgc2hvd0ZpbGVDYXJkOiBwcm9wcy5zaG93RmlsZUNhcmQsXG4gICAgICAgICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiBwcm9wcy5zaG93UHJvZ3Jlc3NEZXRhaWxzLFxuICAgICAgICAgICAgdG90YWxQcm9ncmVzczogcHJvcHMudG90YWxQcm9ncmVzcyxcbiAgICAgICAgICAgIHRvdGFsRmlsZUNvdW50OiBwcm9wcy50b3RhbEZpbGVDb3VudCxcbiAgICAgICAgICAgIGluZm86IHByb3BzLmluZm8sXG4gICAgICAgICAgICBpMThuOiBwcm9wcy5pMThuLFxuICAgICAgICAgICAgbG9nOiBwcm9wcy5sb2csXG4gICAgICAgICAgICByZW1vdmVGaWxlOiBwcm9wcy5yZW1vdmVGaWxlLFxuICAgICAgICAgICAgcGF1c2VBbGw6IHByb3BzLnBhdXNlQWxsLFxuICAgICAgICAgICAgcmVzdW1lQWxsOiBwcm9wcy5yZXN1bWVBbGwsXG4gICAgICAgICAgICBwYXVzZVVwbG9hZDogcHJvcHMucGF1c2VVcGxvYWQsXG4gICAgICAgICAgICBzdGFydFVwbG9hZDogcHJvcHMuc3RhcnRVcGxvYWQsXG4gICAgICAgICAgICBjYW5jZWxVcGxvYWQ6IHByb3BzLmNhbmNlbFVwbG9hZCxcbiAgICAgICAgICAgIHJlc3VtYWJsZVVwbG9hZHM6IHByb3BzLnJlc3VtYWJsZVVwbG9hZHMsXG4gICAgICAgICAgICBpc1dpZGU6IHByb3BzLmlzV2lkZVxuICAgICAgICAgIH0pLHByb3BzLmkxOG4oJ2ltcG9ydEZyb20nKSxwcm9wcy5hY3RpdmVQYW5lbCA/IHByb3BzLmFjdGl2ZVBhbmVsLm5hbWUgOiBudWxsLHByb3BzLmhpZGVBbGxQYW5lbHMscHJvcHMuaTE4bignZG9uZScpLHByb3BzLmFjdGl2ZVBhbmVsID8gJ2ZhbHNlJyA6ICd0cnVlJyxwcm9wcy5hY3RpdmVQYW5lbCA/IHByb3BzLmFjdGl2ZVBhbmVsLnJlbmRlcihwcm9wcy5zdGF0ZSkgOiAnJyxTdGF0dXNCYXIoe1xuICAgICAgICAgICAgdG90YWxQcm9ncmVzczogcHJvcHMudG90YWxQcm9ncmVzcyxcbiAgICAgICAgICAgIHRvdGFsRmlsZUNvdW50OiBwcm9wcy50b3RhbEZpbGVDb3VudCxcbiAgICAgICAgICAgIHVwbG9hZFN0YXJ0ZWRGaWxlczogcHJvcHMudXBsb2FkU3RhcnRlZEZpbGVzLFxuICAgICAgICAgICAgaXNBbGxDb21wbGV0ZTogcHJvcHMuaXNBbGxDb21wbGV0ZSxcbiAgICAgICAgICAgIGlzQWxsUGF1c2VkOiBwcm9wcy5pc0FsbFBhdXNlZCxcbiAgICAgICAgICAgIGlzVXBsb2FkU3RhcnRlZDogcHJvcHMuaXNVcGxvYWRTdGFydGVkLFxuICAgICAgICAgICAgcGF1c2VBbGw6IHByb3BzLnBhdXNlQWxsLFxuICAgICAgICAgICAgcmVzdW1lQWxsOiBwcm9wcy5yZXN1bWVBbGwsXG4gICAgICAgICAgICBjYW5jZWxBbGw6IHByb3BzLmNhbmNlbEFsbCxcbiAgICAgICAgICAgIGNvbXBsZXRlOiBwcm9wcy5jb21wbGV0ZUZpbGVzLmxlbmd0aCxcbiAgICAgICAgICAgIGluUHJvZ3Jlc3M6IHByb3BzLmluUHJvZ3Jlc3MsXG4gICAgICAgICAgICB0b3RhbFNwZWVkOiBwcm9wcy50b3RhbFNwZWVkLFxuICAgICAgICAgICAgdG90YWxFVEE6IHByb3BzLnRvdGFsRVRBLFxuICAgICAgICAgICAgc3RhcnRVcGxvYWQ6IHByb3BzLnN0YXJ0VXBsb2FkLFxuICAgICAgICAgICAgbmV3RmlsZUNvdW50OiBwcm9wcy5uZXdGaWxlcy5sZW5ndGgsXG4gICAgICAgICAgICBpMThuOiBwcm9wcy5pMThuLFxuICAgICAgICAgICAgcmVzdW1hYmxlVXBsb2FkczogcHJvcHMucmVzdW1hYmxlVXBsb2Fkc1xuICAgICAgICAgIH0pLHByb3BzLnByb2dyZXNzaW5kaWNhdG9ycy5tYXAoKHRhcmdldCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRhcmdldC5yZW5kZXIocHJvcHMuc3RhdGUpXG4gICAgICAgICAgfSksVGFicyh7XG4gICAgICAgICAgZmlsZXM6IHByb3BzLmZpbGVzLFxuICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBoYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICBhY3F1aXJlcnM6IHByb3BzLmFjcXVpcmVycyxcbiAgICAgICAgICBjb250YWluZXI6IHByb3BzLmNvbnRhaW5lcixcbiAgICAgICAgICBwYW5lbFNlbGVjdG9yUHJlZml4OiBwcm9wcy5wYW5lbFNlbGVjdG9yUHJlZml4LFxuICAgICAgICAgIHNob3dQYW5lbDogcHJvcHMuc2hvd1BhbmVsLFxuICAgICAgICAgIGkxOG46IHByb3BzLmkxOG5cbiAgICAgICAgfSksRmlsZUNhcmQoe1xuICAgICAgICAgIGZpbGVzOiBwcm9wcy5maWxlcyxcbiAgICAgICAgICBmaWxlQ2FyZEZvcjogcHJvcHMuZmlsZUNhcmRGb3IsXG4gICAgICAgICAgZG9uZTogcHJvcHMuZmlsZUNhcmREb25lLFxuICAgICAgICAgIG1ldGFGaWVsZHM6IHByb3BzLm1ldGFGaWVsZHMsXG4gICAgICAgICAgbG9nOiBwcm9wcy5sb2csXG4gICAgICAgICAgaTE4bjogcHJvcHMuaTE4blxuICAgICAgICB9KSxkYXNoYm9hcmRTaXplLCgpID0+IHByb3BzLnVwZGF0ZURhc2hib2FyZEVsV2lkdGgoKSxwcm9wcy5pbmxpbmUgPyAnZmFsc2UnIDogcHJvcHMubW9kYWwuaXNIaWRkZW4sIXByb3BzLmlubGluZVxuICAgICAgICAgICAgICAgICAgICAgICA/IHByb3BzLmkxOG4oJ2Rhc2hib2FyZFdpbmRvd1RpdGxlJylcbiAgICAgICAgICAgICAgICAgICAgICAgOiBwcm9wcy5pMThuKCdkYXNoYm9hcmRUaXRsZScpLGhhbmRsZVBhc3RlLGlzVG91Y2hEZXZpY2UoKSA/ICdVcHB5LS1pc1RvdWNoRGV2aWNlJyA6ICcnLHByb3BzLnNlbWlUcmFuc3BhcmVudCA/ICdVcHB5RGFzaGJvYXJkLS1zZW1pVHJhbnNwYXJlbnQnIDogJycsIXByb3BzLmlubGluZSA/ICdVcHB5RGFzaGJvYXJkLS1tb2RhbCcgOiAnJyxwcm9wcy5pc1dpZGUgPyAnVXBweURhc2hib2FyZC0td2lkZScgOiAnJykpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuY29uc3QgeyBpY29uVGV4dCwgaWNvbkZpbGUsIGljb25BdWRpbywgY2hlY2tJY29uIH0gPSByZXF1aXJlKCcuL2ljb25zJylcblxuZnVuY3Rpb24gZ2V0SWNvbkJ5TWltZSAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gIHN3aXRjaCAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gICAgY2FzZSAndGV4dCc6XG4gICAgICByZXR1cm4gaWNvblRleHQoKVxuICAgIGNhc2UgJ2F1ZGlvJzpcbiAgICAgIHJldHVybiBpY29uQXVkaW8oKVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gaWNvbkZpbGUoKVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZmlsZUNhcmQgKHByb3BzKSB7XG4gIGNvbnN0IGZpbGUgPSBwcm9wcy5maWxlQ2FyZEZvciA/IHByb3BzLmZpbGVzW3Byb3BzLmZpbGVDYXJkRm9yXSA6IGZhbHNlXG4gIGNvbnN0IG1ldGEgPSB7fVxuXG4gIGZ1bmN0aW9uIHRlbXBTdG9yZU1ldGEgKGV2KSB7XG4gICAgY29uc3QgdmFsdWUgPSBldi50YXJnZXQudmFsdWVcbiAgICBjb25zdCBuYW1lID0gZXYudGFyZ2V0LmF0dHJpYnV0ZXMubmFtZS52YWx1ZVxuICAgIG1ldGFbbmFtZV0gPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyTWV0YUZpZWxkcyAoZmlsZSkge1xuICAgIGNvbnN0IG1ldGFGaWVsZHMgPSBwcm9wcy5tZXRhRmllbGRzIHx8IFtdXG4gICAgcmV0dXJuIG1ldGFGaWVsZHMubWFwKChmaWVsZCkgPT4ge1xuICAgICAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZmllbGRzZXRcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkRmlsZUNhcmQtZmllbGRzZXRcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEZpbGVDYXJkLWxhYmVsXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzBdXSlcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgYXJndW1lbnRzWzFdKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLCBhcmd1bWVudHNbMl0pXG5iZWwxLnNldEF0dHJpYnV0ZShcInBsYWNlaG9sZGVyXCIsIGFyZ3VtZW50c1szXSlcbmJlbDFbXCJvbmtleXVwXCJdID0gYXJndW1lbnRzWzRdXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEZpbGVDYXJkLWlucHV0XCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgICAgIFwiLGJlbDAsXCJcXG4gICAgICAgIFwiLGJlbDFdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KGZpZWxkLm5hbWUsZmllbGQuaWQsZmlsZS5tZXRhW2ZpZWxkLmlkXSxmaWVsZC5wbGFjZWhvbGRlciB8fCAnJyx0ZW1wU3RvcmVNZXRhKSlcbiAgICB9KVxuICB9XG5cbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw2LnNldEF0dHJpYnV0ZShcImFyaWEtaGlkZGVuXCIsIGFyZ3VtZW50c1s0XSlcbmJlbDYuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkRmlsZUNhcmRcIilcbnZhciBiZWwzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRDb250ZW50LWJhclwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDJcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkQ29udGVudC10aXRsZVwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRDb250ZW50LXRpdGxlRmlsZVwiKVxuYWMoYmVsMCwgW2FyZ3VtZW50c1swXV0pXG5hYyhiZWwxLCBbXCJFZGl0aW5nIFwiLGJlbDBdKVxudmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIFwiRmluaXNoIGVkaXRpbmcgZmlsZVwiKVxuYmVsMltcIm9uY2xpY2tcIl0gPSBhcmd1bWVudHNbMV1cbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkQ29udGVudC1iYWNrXCIpXG5hYyhiZWwyLCBbXCJEb25lXCJdKVxuYWMoYmVsMywgW1wiXFxuICAgICAgXCIsYmVsMSxcIlxcbiAgICAgIFwiLGJlbDIsXCJcXG4gICAgXCJdKVxudmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw1LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1hY3Rpb25zXCIpXG52YXIgYmVsNCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcbmJlbDQuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcImJ1dHRvblwiKVxuYmVsNC5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCBcIkZpbmlzaCBlZGl0aW5nIGZpbGVcIilcbmJlbDRbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzJdXG5iZWw0LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweUJ1dHRvbi0tY2lyY3VsYXIgVXBweUJ1dHRvbi0tYmx1ZSBVcHB5RGFzaGJvYXJkRmlsZUNhcmQtZG9uZVwiKVxuYWMoYmVsNCwgW2FyZ3VtZW50c1szXV0pXG5hYyhiZWw1LCBbXCJcXG4gICAgICBcIixiZWw0LFwiXFxuICAgIFwiXSlcbmFjKGJlbDYsIFtcIlxcbiAgICBcIixiZWwzLFwiXFxuICAgIFwiLGFyZ3VtZW50c1s1XSxcIlxcbiAgICBcIixiZWw1LFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWw2XG4gICAgfShmaWxlLm1ldGEgPyBmaWxlLm1ldGEubmFtZSA6IGZpbGUubmFtZSwoKSA9PiBwcm9wcy5kb25lKG1ldGEsIGZpbGUuaWQpLCgpID0+IHByb3BzLmRvbmUobWV0YSwgZmlsZS5pZCksY2hlY2tJY29uKCksIXByb3BzLmZpbGVDYXJkRm9yLHByb3BzLmZpbGVDYXJkRm9yXG4gICAgICA/IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw1LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEZpbGVDYXJkLWlubmVyXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkRmlsZUNhcmQtcHJldmlld1wiKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgICAgICAgXCIsYXJndW1lbnRzWzBdLFwiXFxuICAgICAgICAgIFwiXSlcbnZhciBiZWw0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsNC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1pbmZvXCIpXG52YXIgYmVsMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJmaWVsZHNldFwiKVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1maWVsZHNldFwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGFiZWxcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkRmlsZUNhcmQtbGFiZWxcIilcbmFjKGJlbDEsIFtcIk5hbWVcIl0pXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJuYW1lXCIsIFwibmFtZVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dFwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLCBhcmd1bWVudHNbMV0pXG5iZWwyW1wib25rZXl1cFwiXSA9IGFyZ3VtZW50c1syXVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1pbnB1dFwiKVxuYWMoYmVsMywgW1wiXFxuICAgICAgICAgICAgICBcIixiZWwxLFwiXFxuICAgICAgICAgICAgICBcIixiZWwyLFwiXFxuICAgICAgICAgICAgXCJdKVxuYWMoYmVsNCwgW1wiXFxuICAgICAgICAgICAgXCIsYmVsMyxcIlxcbiAgICAgICAgICAgIFwiLGFyZ3VtZW50c1szXSxcIlxcbiAgICAgICAgICBcIl0pXG5hYyhiZWw1LCBbXCJcXG4gICAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgICAgICBcIixiZWw0LFwiXFxuICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsNVxuICAgIH0oZmlsZS5wcmV2aWV3XG4gICAgICAgICAgICAgID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIilcbmJlbDAuc2V0QXR0cmlidXRlKFwiYWx0XCIsIGFyZ3VtZW50c1swXSlcbmJlbDAuc2V0QXR0cmlidXRlKFwic3JjXCIsIGFyZ3VtZW50c1sxXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShmaWxlLm5hbWUsZmlsZS5wcmV2aWV3KSlcbiAgICAgICAgICAgICAgOiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRJdGVtLXByZXZpZXdJY29uXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzBdXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShnZXRJY29uQnlNaW1lKGZpbGUudHlwZS5nZW5lcmFsKSkpLGZpbGUubWV0YS5uYW1lLHRlbXBTdG9yZU1ldGEscmVuZGVyTWV0YUZpZWxkcyhmaWxlKSkpXG4gICAgICA6IG51bGwpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IHsgZ2V0RVRBLFxuICAgICAgICAgZ2V0U3BlZWQsXG4gICAgICAgICBwcmV0dHlFVEEsXG4gICAgICAgICBnZXRGaWxlTmFtZUFuZEV4dGVuc2lvbixcbiAgICAgICAgIHRydW5jYXRlU3RyaW5nLFxuICAgICAgICAgY29weVRvQ2xpcGJvYXJkIH0gPSByZXF1aXJlKCcuLi8uLi9jb3JlL1V0aWxzJylcbmNvbnN0IHByZXR0eUJ5dGVzID0gcmVxdWlyZSgncHJldHR5LWJ5dGVzJylcbmNvbnN0IEZpbGVJdGVtUHJvZ3Jlc3MgPSByZXF1aXJlKCcuL0ZpbGVJdGVtUHJvZ3Jlc3MnKVxuY29uc3QgeyBpY29uVGV4dCwgaWNvbkZpbGUsIGljb25BdWRpbywgaWNvbkVkaXQsIGljb25Db3B5IH0gPSByZXF1aXJlKCcuL2ljb25zJylcblxuZnVuY3Rpb24gZ2V0SWNvbkJ5TWltZSAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gIHN3aXRjaCAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gICAgY2FzZSAndGV4dCc6XG4gICAgICByZXR1cm4gaWNvblRleHQoKVxuICAgIGNhc2UgJ2F1ZGlvJzpcbiAgICAgIHJldHVybiBpY29uQXVkaW8oKVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gaWNvbkZpbGUoKVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZmlsZUl0ZW0gKHByb3BzKSB7XG4gIGNvbnN0IGZpbGUgPSBwcm9wcy5maWxlXG5cbiAgY29uc3QgaXNVcGxvYWRlZCA9IGZpbGUucHJvZ3Jlc3MudXBsb2FkQ29tcGxldGVcbiAgY29uc3QgdXBsb2FkSW5Qcm9ncmVzc09yQ29tcGxldGUgPSBmaWxlLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWRcbiAgY29uc3QgdXBsb2FkSW5Qcm9ncmVzcyA9IGZpbGUucHJvZ3Jlc3MudXBsb2FkU3RhcnRlZCAmJiAhZmlsZS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZVxuICBjb25zdCBpc1BhdXNlZCA9IGZpbGUuaXNQYXVzZWQgfHwgZmFsc2VcblxuICBjb25zdCBmaWxlTmFtZSA9IGdldEZpbGVOYW1lQW5kRXh0ZW5zaW9uKGZpbGUubWV0YS5uYW1lKVswXVxuICBjb25zdCB0cnVuY2F0ZWRGaWxlTmFtZSA9IHByb3BzLmlzV2lkZSA/IHRydW5jYXRlU3RyaW5nKGZpbGVOYW1lLCAxNSkgOiBmaWxlTmFtZVxuXG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWw4ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpXG5iZWw4LnNldEF0dHJpYnV0ZShcImlkXCIsIFwidXBweV9cIiArIGFyZ3VtZW50c1sxMV0pXG5iZWw4LnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIGFyZ3VtZW50c1sxMl0pXG5iZWw4LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW1cXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiArIGFyZ3VtZW50c1sxM10gKyBcIlxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiICsgYXJndW1lbnRzWzE0XSArIFwiXFxuICAgICAgICAgICAgICAgICAgICAgICAgXCIgKyBhcmd1bWVudHNbMTVdICsgXCJcXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiArIGFyZ3VtZW50c1sxNl0pXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkSXRlbS1wcmV2aWV3XCIpXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkSXRlbS1wcm9ncmVzc1wiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIGFyZ3VtZW50c1swXSlcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzFdXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0tcHJvZ3Jlc3NCdG5cIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgICAgIFwiLGFyZ3VtZW50c1syXSxcIlxcbiAgICAgICAgICBcIl0pXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgICAgICBcIixhcmd1bWVudHNbM10sXCJcXG4gICAgICAgIFwiXSlcbmFjKGJlbDIsIFtcIlxcbiAgICAgICAgXCIsYXJndW1lbnRzWzRdLFwiXFxuICAgICAgICBcIixiZWwxLFwiXFxuICAgICAgXCJdKVxudmFyIGJlbDYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw2LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0taW5mb1wiKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDRcIilcbmJlbDMuc2V0QXR0cmlidXRlKFwidGl0bGVcIiwgYXJndW1lbnRzWzVdKVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRJdGVtLW5hbWVcIilcbmFjKGJlbDMsIFtcIlxcbiAgICAgICAgXCIsYXJndW1lbnRzWzZdLFwiXFxuICAgICAgXCJdKVxudmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWw1LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0tc3RhdHVzXCIpXG52YXIgYmVsNCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpXG5iZWw0LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0tc3RhdHVzU2l6ZVwiKVxuYWMoYmVsNCwgW2FyZ3VtZW50c1s3XV0pXG5hYyhiZWw1LCBbXCJcXG4gICAgICAgIFwiLGJlbDQsXCJcXG4gICAgICBcIl0pXG5hYyhiZWw2LCBbXCJcXG4gICAgICBcIixiZWwzLFwiXFxuICAgICAgXCIsYmVsNSxcIlxcbiAgICAgIFwiLGFyZ3VtZW50c1s4XSxcIlxcbiAgICAgIFwiLGFyZ3VtZW50c1s5XSxcIlxcbiAgICBcIl0pXG52YXIgYmVsNyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDcuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkSXRlbS1hY3Rpb25cIilcbmFjKGJlbDcsIFtcIlxcbiAgICAgIFwiLGFyZ3VtZW50c1sxMF0sXCJcXG4gICAgXCJdKVxuYWMoYmVsOCwgW1wiXFxuICAgICAgXCIsYmVsMixcIlxcbiAgICBcIixiZWw2LFwiXFxuICAgIFwiLGJlbDcsXCJcXG4gIFwiXSlcbiAgICAgIHJldHVybiBiZWw4XG4gICAgfShpc1VwbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gJ3VwbG9hZCBjb21wbGV0ZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiBwcm9wcy5yZXN1bWFibGVVcGxvYWRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBmaWxlLmlzUGF1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdyZXN1bWUgdXBsb2FkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAncGF1c2UgdXBsb2FkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ2NhbmNlbCB1cGxvYWQnLChldikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNVcGxvYWRlZCkgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wcy5yZXN1bWFibGVVcGxvYWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcHJvcHMucGF1c2VVcGxvYWQoZmlsZS5pZClcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5jYW5jZWxVcGxvYWQoZmlsZS5pZClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSxGaWxlSXRlbVByb2dyZXNzKHtcbiAgICAgICAgICAgICAgcHJvZ3Jlc3M6IGZpbGUucHJvZ3Jlc3MucGVyY2VudGFnZSxcbiAgICAgICAgICAgICAgZmlsZUlEOiBmaWxlLmlkXG4gICAgICAgICAgICB9KSxwcm9wcy5zaG93UHJvZ3Jlc3NEZXRhaWxzXG4gICAgICAgICAgICA/IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIGFyZ3VtZW50c1swXSlcbmJlbDAuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBhcmd1bWVudHNbMV0pXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0tcHJvZ3Jlc3NJbmZvXCIpXG5hYyhiZWwwLCBbXCJcXG4gICAgICAgICAgICAgICAgXCIsYXJndW1lbnRzWzJdLFwiXFxuICAgICAgICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMFxuICAgIH0ocHJvcHMuaTE4bignZmlsZVByb2dyZXNzJykscHJvcHMuaTE4bignZmlsZVByb2dyZXNzJyksIWZpbGUuaXNQYXVzZWQgJiYgIWlzVXBsb2FkZWRcbiAgICAgICAgICAgICAgICAgID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzBdLFwiIOODuyDihpEgXCIsYXJndW1lbnRzWzFdLFwiL3NcIl0pXG4gICAgICByZXR1cm4gYmVsMFxuICAgIH0ocHJldHR5RVRBKGdldEVUQShmaWxlLnByb2dyZXNzKSkscHJldHR5Qnl0ZXMoZ2V0U3BlZWQoZmlsZS5wcm9ncmVzcykpKSlcbiAgICAgICAgICAgICAgICAgIDogbnVsbCkpXG4gICAgICAgICAgICA6IG51bGwsZmlsZS5wcmV2aWV3XG4gICAgICAgICAgPyAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJhbHRcIiwgYXJndW1lbnRzWzBdKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJzcmNcIiwgYXJndW1lbnRzWzFdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KGZpbGUubmFtZSxmaWxlLnByZXZpZXcpKVxuICAgICAgICAgIDogKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkSXRlbS1wcmV2aWV3SWNvblwiKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgICAgICAgICBcIixhcmd1bWVudHNbMF0sXCJcXG4gICAgICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMFxuICAgIH0oZ2V0SWNvbkJ5TWltZShmaWxlLnR5cGUuZ2VuZXJhbCkpKSxmaWxlTmFtZSxmaWxlLnVwbG9hZFVSTFxuICAgICAgICAgID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImhyZWZcIiwgYXJndW1lbnRzWzBdKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJ0YXJnZXRcIiwgXCJfYmxhbmtcIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgICAgICAgXCIsYXJndW1lbnRzWzFdLFwiXFxuICAgICAgICAgICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KGZpbGUudXBsb2FkVVJMLGZpbGUuZXh0ZW5zaW9uID8gdHJ1bmNhdGVkRmlsZU5hbWUgKyAnLicgKyBmaWxlLmV4dGVuc2lvbiA6IHRydW5jYXRlZEZpbGVOYW1lKSlcbiAgICAgICAgICA6IGZpbGUuZXh0ZW5zaW9uID8gdHJ1bmNhdGVkRmlsZU5hbWUgKyAnLicgKyBmaWxlLmV4dGVuc2lvbiA6IHRydW5jYXRlZEZpbGVOYW1lLGZpbGUuZGF0YS5zaXplID8gcHJldHR5Qnl0ZXMoZmlsZS5kYXRhLnNpemUpIDogJz8nLCF1cGxvYWRJblByb2dyZXNzT3JDb21wbGV0ZVxuICAgICAgICA/IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgXCJFZGl0IGZpbGVcIilcbmJlbDAuc2V0QXR0cmlidXRlKFwidGl0bGVcIiwgXCJFZGl0IGZpbGVcIilcbmJlbDBbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzBdXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZEl0ZW0tZWRpdFwiKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgICAgICAgICAgICAgICAgICAgXCIsYXJndW1lbnRzWzFdXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfSgoZSkgPT4gcHJvcHMuc2hvd0ZpbGVDYXJkKGZpbGUuaWQpLGljb25FZGl0KCkpKVxuICAgICAgICA6IG51bGwsZmlsZS51cGxvYWRVUkxcbiAgICAgICAgPyAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiQ29weSBsaW5rXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIFwiQ29weSBsaW5rXCIpXG5iZWwwW1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1swXVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRJdGVtLWNvcHlMaW5rXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzFdXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgY29weVRvQ2xpcGJvYXJkKGZpbGUudXBsb2FkVVJMLCBwcm9wcy5pMThuKCdjb3B5TGlua1RvQ2xpcGJvYXJkRmFsbGJhY2snKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLmxvZygnTGluayBjb3BpZWQgdG8gY2xpcGJvYXJkLicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMuaW5mbyhwcm9wcy5pMThuKCdjb3B5TGlua1RvQ2xpcGJvYXJkU3VjY2VzcycpLCAnaW5mbycsIDMwMDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChwcm9wcy5sb2cpXG4gICAgICAgICAgICAgICAgICAgICAgIH0saWNvbkNvcHkoKSkpXG4gICAgICAgIDogbnVsbCwhaXNVcGxvYWRlZFxuICAgICAgICA/IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwzLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgXCJSZW1vdmUgZmlsZVwiKVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCBcIlJlbW92ZSBmaWxlXCIpXG5iZWwzW1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1swXVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRJdGVtLXJlbW92ZVwiKVxudmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMjJcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIyMVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMTggMTdcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwiZWxsaXBzZVwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImZpbGxcIiwgXCIjNDI0MjQyXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY3hcIiwgXCI4LjYyXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY3lcIiwgXCI4LjM4M1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJ4XCIsIFwiOC42MlwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJ5XCIsIFwiOC4zODNcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwic3Ryb2tlXCIsIFwiI0ZGRlwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImZpbGxcIiwgXCIjRkZGXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xMSA2LjE0N0wxMC44NSA2IDguNSA4LjI4NCA2LjE1IDYgNiA2LjE0NyA4LjM1IDguNDMgNiAxMC43MTdsLjE1LjE0Nkw4LjUgOC41NzhsMi4zNSAyLjI4NC4xNS0uMTQ2TDguNjUgOC40M3pcIilcbmFjKGJlbDIsIFtcIlxcbiAgICAgICAgICAgICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICAgICAgICAgICAgIFwiLGJlbDEsXCJcXG4gICAgICAgICAgICAgICAgIFwiXSlcbmFjKGJlbDMsIFtcIlxcbiAgICAgICAgICAgICAgICAgXCIsYmVsMixcIlxcbiAgICAgICAgICAgICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwzXG4gICAgfSgoKSA9PiBwcm9wcy5yZW1vdmVGaWxlKGZpbGUuaWQpKSlcbiAgICAgICAgOiBudWxsLGZpbGUuaWQsZmlsZS5tZXRhLm5hbWUsdXBsb2FkSW5Qcm9ncmVzcyA/ICdpcy1pbnByb2dyZXNzJyA6ICcnLGlzVXBsb2FkZWQgPyAnaXMtY29tcGxldGUnIDogJycsaXNQYXVzZWQgPyAnaXMtcGF1c2VkJyA6ICcnLHByb3BzLnJlc3VtYWJsZVVwbG9hZHMgPyAnaXMtcmVzdW1hYmxlJyA6ICcnKSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5cbi8vIGh0dHA6Ly9jb2RlcGVuLmlvL0hhcmtrby9wZW4vclZ4dk5NXG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9lc3dhay9hZDRlYTU3YmNkNWZmN2FhNWQ0MlxuXG5tb2R1bGUuZXhwb3J0cyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsOSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWw5LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCI3MFwiKVxuYmVsOS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjcwXCIpXG5iZWw5LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAzNiAzNlwiKVxuYmVsOS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb24gVXBweUljb24tcHJvZ3Jlc3NDaXJjbGVcIilcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImdcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJwcm9ncmVzcy1ncm91cFwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcImNpcmNsZVwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJcIiwgXCIxNVwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImN4XCIsIFwiMThcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjeVwiLCBcIjE4XCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwic3Ryb2tlLXdpZHRoXCIsIFwiMlwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImZpbGxcIiwgXCJub25lXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJiZ1wiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcImNpcmNsZVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJcIiwgXCIxNVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImN4XCIsIFwiMThcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjeVwiLCBcIjE4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidHJhbnNmb3JtXCIsIFwicm90YXRlKC05MCwgMTgsIDE4KVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInN0cm9rZS13aWR0aFwiLCBcIjJcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJmaWxsXCIsIFwibm9uZVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInN0cm9rZS1kYXNoYXJyYXlcIiwgXCIxMDBcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJzdHJva2UtZGFzaG9mZnNldFwiLCBhcmd1bWVudHNbMF0pXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJwcm9ncmVzc1wiKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICBcIixiZWwxLFwiXFxuICAgICAgXCJdKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBvbHlnb25cIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMywgMylcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJwb2ludHNcIiwgXCIxMiAyMCAxMiAxMCAyMCAxNVwiKVxuYmVsMy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwicGxheVwiKVxudmFyIGJlbDYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZ1wiKVxuYmVsNi5zZXRBdHRyaWJ1dGUoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMTQuNSwgMTMpXCIpXG5iZWw2LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwicGF1c2VcIilcbnZhciBiZWw0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJyZWN0XCIpXG5iZWw0LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwieFwiLCBcIjBcIilcbmJlbDQuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ5XCIsIFwiMFwiKVxuYmVsNC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMlwiKVxuYmVsNC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjEwXCIpXG5iZWw0LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwicnhcIiwgXCIwXCIpXG52YXIgYmVsNSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicmVjdFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInhcIiwgXCI1XCIpXG5iZWw1LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwieVwiLCBcIjBcIilcbmJlbDUuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjJcIilcbmJlbDUuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIxMFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJ4XCIsIFwiMFwiKVxuYWMoYmVsNiwgW1wiXFxuICAgICAgICBcIixiZWw0LFwiXFxuICAgICAgICBcIixiZWw1LFwiXFxuICAgICAgXCJdKVxudmFyIGJlbDcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBvbHlnb25cIilcbmJlbDcuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMiwgMylcIilcbmJlbDcuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJwb2ludHNcIiwgXCIxNCAyMi41IDcgMTUuMjQ1NzA2NSA4Ljk5OTg1ODU3IDEzLjE3MzI4MTUgMTQgMTguMzU0NzEwNCAyMi45NzI5ODgzIDkgMjUgMTEuMTAwNTYzNFwiKVxuYmVsNy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiY2hlY2tcIilcbnZhciBiZWw4ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwb2x5Z29uXCIpXG5iZWw4LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDIsIDIpXCIpXG5iZWw4LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwicG9pbnRzXCIsIFwiMTkuODg1NjUxNiAxMS4wNjI1IDE2IDE0Ljk0ODE1MTYgMTIuMTAxOTczNyAxMS4wNjI1IDExLjA2MjUgMTIuMTE0MzQ4NCAxNC45NDgxNTE2IDE2IDExLjA2MjUgMTkuODk4MDI2MyAxMi4xMDE5NzM3IDIwLjkzNzUgMTYgMTcuMDUxODQ4NCAxOS44ODU2NTE2IDIwLjkzNzUgMjAuOTM3NSAxOS44OTgwMjYzIDE3LjA1MTg0ODQgMTYgMjAuOTM3NSAxMlwiKVxuYmVsOC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiY2FuY2VsXCIpXG5hYyhiZWw5LCBbXCJcXG4gICAgICBcIixiZWwyLFwiXFxuICAgICAgXCIsYmVsMyxcIlxcbiAgICAgIFwiLGJlbDYsXCJcXG4gICAgICBcIixiZWw3LFwiXFxuICAgICAgXCIsYmVsOF0pXG4gICAgICByZXR1cm4gYmVsOVxuICAgIH0oMTAwIC0gcHJvcHMucHJvZ3Jlc3MpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IEZpbGVJdGVtID0gcmVxdWlyZSgnLi9GaWxlSXRlbScpXG5jb25zdCBBY3Rpb25Ccm93c2VUYWdsaW5lID0gcmVxdWlyZSgnLi9BY3Rpb25Ccm93c2VUYWdsaW5lJylcbmNvbnN0IHsgZGFzaGJvYXJkQmdJY29uIH0gPSByZXF1aXJlKCcuL2ljb25zJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIilcbmJlbDAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkLWZpbGVzXFxuICAgICAgICAgICAgICAgICAgICAgICAgIFwiICsgYXJndW1lbnRzWzBdKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgXCIsYXJndW1lbnRzWzFdLFwiXFxuICAgICAgXCIsYXJndW1lbnRzWzJdLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwwXG4gICAgfShwcm9wcy50b3RhbEZpbGVDb3VudCA9PT0gMCA/ICdVcHB5RGFzaGJvYXJkLWZpbGVzLS1ub0ZpbGVzJyA6ICcnLHByb3BzLnRvdGFsRmlsZUNvdW50ID09PSAwXG4gICAgICAgPyAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtYmdJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoM1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtZHJvcEZpbGVzVGl0bGVcIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgICAgIFwiLGFyZ3VtZW50c1swXSxcIlxcbiAgICAgICAgICBcIl0pXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwiZmlsZVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJuYW1lXCIsIFwiZmlsZXNbXVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJtdWx0aXBsZVwiLCBcInRydWVcIilcbmJlbDFbXCJvbmNoYW5nZVwiXSA9IGFyZ3VtZW50c1sxXVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtaW5wdXRcIilcbmFjKGJlbDIsIFtcIlxcbiAgICAgICAgICBcIixhcmd1bWVudHNbMl0sXCJcXG4gICAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgICAgICBcIixiZWwxLFwiXFxuICAgICAgICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KEFjdGlvbkJyb3dzZVRhZ2xpbmUoe1xuICAgICAgICAgICAgICBhY3F1aXJlcnM6IHByb3BzLmFjcXVpcmVycyxcbiAgICAgICAgICAgICAgY29udGFpbmVyOiBwcm9wcy5jb250YWluZXIsXG4gICAgICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBwcm9wcy5oYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICAgICAgaTE4bjogcHJvcHMuaTE4blxuICAgICAgICAgICAgfSkscHJvcHMuaGFuZGxlSW5wdXRDaGFuZ2UsZGFzaGJvYXJkQmdJY29uKCkpKVxuICAgICAgIDogbnVsbCxPYmplY3Qua2V5cyhwcm9wcy5maWxlcykubWFwKChmaWxlSUQpID0+IHtcbiAgICAgICAgcmV0dXJuIEZpbGVJdGVtKHtcbiAgICAgICAgICBmaWxlOiBwcm9wcy5maWxlc1tmaWxlSURdLFxuICAgICAgICAgIHNob3dGaWxlQ2FyZDogcHJvcHMuc2hvd0ZpbGVDYXJkLFxuICAgICAgICAgIHNob3dQcm9ncmVzc0RldGFpbHM6IHByb3BzLnNob3dQcm9ncmVzc0RldGFpbHMsXG4gICAgICAgICAgaW5mbzogcHJvcHMuaW5mbyxcbiAgICAgICAgICBsb2c6IHByb3BzLmxvZyxcbiAgICAgICAgICBpMThuOiBwcm9wcy5pMThuLFxuICAgICAgICAgIHJlbW92ZUZpbGU6IHByb3BzLnJlbW92ZUZpbGUsXG4gICAgICAgICAgcGF1c2VVcGxvYWQ6IHByb3BzLnBhdXNlVXBsb2FkLFxuICAgICAgICAgIGNhbmNlbFVwbG9hZDogcHJvcHMuY2FuY2VsVXBsb2FkLFxuICAgICAgICAgIHJlc3VtYWJsZVVwbG9hZHM6IHByb3BzLnJlc3VtYWJsZVVwbG9hZHNcbiAgICAgICAgfSlcbiAgICAgIH0pKSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIHByb3BzID0gcHJvcHMgfHwge31cblxuICBjb25zdCBpc0hpZGRlbiA9IHByb3BzLnRvdGFsRmlsZUNvdW50ID09PSAwIHx8ICFwcm9wcy5pc1VwbG9hZFN0YXJ0ZWRcblxuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiYXJpYS1oaWRkZW5cIiwgYXJndW1lbnRzWzNdKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtc3RhdHVzQmFyXFxuICAgICAgICAgICAgICAgIFwiICsgYXJndW1lbnRzWzRdKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInN0eWxlXCIsIFwid2lkdGg6IFwiICsgYXJndW1lbnRzWzBdICsgXCIlXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1zdGF0dXNCYXJQcm9ncmVzc1wiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1zdGF0dXNCYXJDb250ZW50XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgIFwiLGFyZ3VtZW50c1sxXSxcIlxcbiAgICAgICAgXCIsYXJndW1lbnRzWzJdLFwiXFxuICAgICAgXCJdKVxuYWMoYmVsMiwgW1wiXFxuXFxuICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiLGJlbDEsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KHByb3BzLnRvdGFsUHJvZ3Jlc3MscHJvcHMuaXNVcGxvYWRTdGFydGVkICYmICFwcm9wcy5pc0FsbENvbXBsZXRlXG4gICAgICAgICAgPyAhcHJvcHMuaXNBbGxQYXVzZWRcbiAgICAgICAgICAgID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzBdLFwiIFVwbG9hZGluZy4uLiBcIixhcmd1bWVudHNbMV0sXCIl44O7XCIsYXJndW1lbnRzWzJdLFwiIC8gXCIsYXJndW1lbnRzWzNdLFwi44O7XCIsYXJndW1lbnRzWzRdLFwi44O74oaRIFwiLGFyZ3VtZW50c1s1XSxcIi9zXCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KHBhdXNlUmVzdW1lQnV0dG9ucyhwcm9wcykscHJvcHMudG90YWxQcm9ncmVzcyB8fCAwLHByb3BzLmNvbXBsZXRlLHByb3BzLmluUHJvZ3Jlc3MscHJvcHMudG90YWxFVEEscHJvcHMudG90YWxTcGVlZCkpXG4gICAgICAgICAgICA6IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKVxuYWMoYmVsMCwgW2FyZ3VtZW50c1swXSxcIiBQYXVzZWTjg7tcIixhcmd1bWVudHNbMV0sXCIlXCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KHBhdXNlUmVzdW1lQnV0dG9ucyhwcm9wcykscHJvcHMudG90YWxQcm9ncmVzcykpXG4gICAgICAgICAgOiBudWxsLHByb3BzLmlzQWxsQ29tcGxldGVcbiAgICAgICAgICA/IChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMThcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIxN1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMjMgMTdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtc3RhdHVzQmFyQWN0aW9uIFVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNOC45NDQgMTdMMCA3Ljg2NWwyLjU1NS0yLjYxIDYuMzkgNi41MjVMMjAuNDEgMCAyMyAyLjY0NXpcIilcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgICAgICAgIFwiXSlcbmFjKGJlbDIsIFtiZWwxLFwiVXBsb2FkIGNvbXBsZXRl44O7XCIsYXJndW1lbnRzWzBdLFwiJVwiXSlcbiAgICAgIHJldHVybiBiZWwyXG4gICAgfShwcm9wcy50b3RhbFByb2dyZXNzKSlcbiAgICAgICAgICA6IG51bGwsaXNIaWRkZW4scHJvcHMuaXNBbGxDb21wbGV0ZSA/ICdpcy1jb21wbGV0ZScgOiAnJykpXG59XG5cbmNvbnN0IHBhdXNlUmVzdW1lQnV0dG9ucyA9IChwcm9wcykgPT4ge1xuICBjb25zb2xlLmxvZyhwcm9wcy5yZXN1bWFibGVVcGxvYWRzKVxuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcbmJlbDAuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcImJ1dHRvblwiKVxuYmVsMFtcIm9uY2xpY2tcIl0gPSBhcmd1bWVudHNbMF1cbmJlbDAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkLXN0YXR1c0JhckFjdGlvblwiKVxuYWMoYmVsMCwgW1wiXFxuICAgIFwiLGFyZ3VtZW50c1sxXSxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KCgpID0+IHRvZ2dsZVBhdXNlUmVzdW1lKHByb3BzKSxwcm9wcy5yZXN1bWFibGVVcGxvYWRzXG4gICAgICA/IHByb3BzLmlzQWxsUGF1c2VkXG4gICAgICAgID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIxNVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjE3XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAxMSAxM1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xLjI2IDEyLjUzNGEuNjcuNjcgMCAwIDEtLjY3NC4wMTIuNjcuNjcgMCAwIDEtLjMzNi0uNTgzdi0xMUMuMjUuNzI0LjM4LjUuNTg2LjM4MmEuNjU4LjY1OCAwIDAgMSAuNjczLjAxMmw5LjE2NSA1LjVhLjY2LjY2IDAgMCAxIC4zMjUuNTcuNjYuNjYgMCAwIDEtLjMyNS41NzNsLTkuMTY2IDUuNXpcIilcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMVxuICAgIH0oKSlcbiAgICAgICAgOiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjE2XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDEyIDEzXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJVcHB5SWNvblwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTQuODg4LjgxdjExLjM4YzAgLjQ0Ni0uMzI0LjgxLS43MjIuODFIMi43MjJDMi4zMjQgMTMgMiAxMi42MzYgMiAxMi4xOVYuODFjMC0uNDQ2LjMyNC0uODEuNzIyLS44MWgxLjQ0NGMuMzk4IDAgLjcyMi4zNjQuNzIyLjgxek05Ljg4OC44MXYxMS4zOGMwIC40NDYtLjMyNC44MS0uNzIyLjgxSDcuNzIyQzcuMzI0IDEzIDcgMTIuNjM2IDcgMTIuMTlWLjgxYzAtLjQ0Ni4zMjQtLjgxLjcyMi0uODFoMS40NDRjLjM5OCAwIC43MjIuMzY0LjcyMi44MXpcIilcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMVxuICAgIH0oKSlcbiAgICAgIDogKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIxNnB4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTZweFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMTkgMTlcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMTcuMzE4IDE3LjIzMkw5Ljk0IDkuODU0IDkuNTg2IDkuNWwtLjM1NC4zNTQtNy4zNzggNy4zNzhoLjcwN2wtLjYyLS42MnYuNzA2TDkuMzE4IDkuOTRsLjM1NC0uMzU0LS4zNTQtLjM1NEwxLjk0IDEuODU0di43MDdsLjYyLS42MmgtLjcwNmw3LjM3OCA3LjM3OC4zNTQuMzU0LjM1NC0uMzU0IDcuMzc4LTcuMzc4aC0uNzA3bC42MjIuNjJ2LS43MDZMOS44NTQgOS4yMzJsLS4zNTQuMzU0LjM1NC4zNTQgNy4zNzggNy4zNzguNzA4LS43MDctNy4zOC03LjM3OHYuNzA4bDcuMzgtNy4zOC4zNTMtLjM1My0uMzUzLS4zNTMtLjYyMi0uNjIyLS4zNTMtLjM1My0uMzU0LjM1Mi03LjM3OCA3LjM4aC43MDhMMi41NiAxLjIzIDIuMjA4Ljg4bC0uMzUzLjM1My0uNjIyLjYyLS4zNTMuMzU1LjM1Mi4zNTMgNy4zOCA3LjM4di0uNzA4bC03LjM4IDcuMzgtLjM1My4zNTMuMzUyLjM1My42MjIuNjIyLjM1My4zNTMuMzU0LS4zNTMgNy4zOC03LjM4aC0uNzA4bDcuMzggNy4zOHpcIilcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfSgpKSkpXG59XG5cbmNvbnN0IHRvZ2dsZVBhdXNlUmVzdW1lID0gKHByb3BzKSA9PiB7XG4gIGlmIChwcm9wcy5pc0FsbENvbXBsZXRlKSByZXR1cm5cblxuICBpZiAoIXByb3BzLnJlc3VtYWJsZVVwbG9hZHMpIHtcbiAgICByZXR1cm4gcHJvcHMuY2FuY2VsQWxsKClcbiAgfVxuXG4gIGlmIChwcm9wcy5pc0FsbFBhdXNlZCkge1xuICAgIHJldHVybiBwcm9wcy5yZXN1bWVBbGwoKVxuICB9XG5cbiAgcmV0dXJuIHByb3BzLnBhdXNlQWxsKClcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5jb25zdCBBY3Rpb25Ccm93c2VUYWdsaW5lID0gcmVxdWlyZSgnLi9BY3Rpb25Ccm93c2VUYWdsaW5lJylcbmNvbnN0IHsgbG9jYWxJY29uIH0gPSByZXF1aXJlKCcuL2ljb25zJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgY29uc3QgaXNIaWRkZW4gPSBPYmplY3Qua2V5cyhwcm9wcy5maWxlcykubGVuZ3RoID09PSAwXG5cbiAgaWYgKHByb3BzLmFjcXVpcmVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiYXJpYS1oaWRkZW5cIiwgYXJndW1lbnRzWzFdKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRUYWJzXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoM1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRUYWJzLXRpdGxlXCIpXG5hYyhiZWwwLCBbXCJcXG4gICAgICAgIFwiLGFyZ3VtZW50c1swXSxcIlxcbiAgICAgICAgXCJdKVxuYWMoYmVsMSwgW1wiXFxuICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KEFjdGlvbkJyb3dzZVRhZ2xpbmUoe1xuICAgICAgICAgIGFjcXVpcmVyczogcHJvcHMuYWNxdWlyZXJzLFxuICAgICAgICAgIGNvbnRhaW5lcjogcHJvcHMuY29udGFpbmVyLFxuICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBwcm9wcy5oYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICBpMThuOiBwcm9wcy5pMThuXG4gICAgICAgIH0pLGlzSGlkZGVuKSlcbiAgfVxuXG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWw2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuYmVsNi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRUYWJzXCIpXG52YXIgYmVsNSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJuYXZcIilcbnZhciBiZWw0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInVsXCIpXG5iZWw0LnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJ0YWJsaXN0XCIpXG5iZWw0LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZFRhYnMtbGlzdFwiKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIilcbmJlbDMuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkVGFiXCIpXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcbmJlbDEuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcImJ1dHRvblwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJyb2xlXCIsIFwidGFiXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIFwiMFwiKVxuYmVsMVtcIm9uY2xpY2tcIl0gPSBhcmd1bWVudHNbMV1cbmJlbDEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5RGFzaGJvYXJkVGFiLWJ0biBVcHB5RGFzaGJvYXJkLWZvY3VzXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoNVwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRUYWItbmFtZVwiKVxuYWMoYmVsMCwgW2FyZ3VtZW50c1swXV0pXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgICAgICBcIixhcmd1bWVudHNbMl0sXCJcXG4gICAgICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICAgIFwiXSlcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJmaWxlXCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcIm5hbWVcIiwgXCJmaWxlc1tdXCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcIm11bHRpcGxlXCIsIFwidHJ1ZVwiKVxuYmVsMltcIm9uY2hhbmdlXCJdID0gYXJndW1lbnRzWzNdXG5iZWwyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZC1pbnB1dFwiKVxuYWMoYmVsMywgW1wiXFxuICAgICAgICAgIFwiLGJlbDEsXCJcXG4gICAgICAgICAgXCIsYmVsMixcIlxcbiAgICAgICAgXCJdKVxuYWMoYmVsNCwgW1wiXFxuICAgICAgICBcIixiZWwzLFwiXFxuICAgICAgICBcIixhcmd1bWVudHNbNF0sXCJcXG4gICAgICBcIl0pXG5hYyhiZWw1LCBbXCJcXG4gICAgICBcIixiZWw0LFwiXFxuICAgIFwiXSlcbmFjKGJlbDYsIFtcIlxcbiAgICBcIixiZWw1LFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsNlxuICAgIH0ocHJvcHMuaTE4bignbG9jYWxEaXNrJyksKGV2KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgJHtwcm9wcy5jb250YWluZXJ9IC5VcHB5RGFzaGJvYXJkLWlucHV0YClcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQuY2xpY2soKVxuICAgICAgICAgICAgICAgICAgfSxsb2NhbEljb24oKSxwcm9wcy5oYW5kbGVJbnB1dENoYW5nZSxwcm9wcy5hY3F1aXJlcnMubWFwKCh0YXJnZXQpID0+IHtcbiAgICAgICAgICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmRUYWJcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJyb2xlXCIsIFwidGFiXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIFwiMFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWNvbnRyb2xzXCIsIFwiVXBweURhc2hib2FyZENvbnRlbnQtcGFuZWwtLVwiICsgYXJndW1lbnRzWzFdKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIsIGFyZ3VtZW50c1syXSlcbmJlbDFbXCJvbmNsaWNrXCJdID0gYXJndW1lbnRzWzNdXG5iZWwxLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZFRhYi1idG5cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImg1XCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweURhc2hib2FyZFRhYi1uYW1lXCIpXG5hYyhiZWwwLCBbYXJndW1lbnRzWzBdXSlcbmFjKGJlbDEsIFtcIlxcbiAgICAgICAgICAgICAgXCIsYXJndW1lbnRzWzRdLFwiXFxuICAgICAgICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICAgICAgXCJdKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgICAgICAgXCIsYmVsMSxcIlxcbiAgICAgICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMlxuICAgIH0odGFyZ2V0Lm5hbWUsdGFyZ2V0LmlkLHRhcmdldC5pc0hpZGRlbiA/ICdmYWxzZScgOiAndHJ1ZScsKCkgPT4gcHJvcHMuc2hvd1BhbmVsKHRhcmdldC5pZCksdGFyZ2V0Lmljb24pKVxuICAgICAgICB9KSkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuY29uc3QgeyB1cGxvYWRJY29uIH0gPSByZXF1aXJlKCcuL2ljb25zJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgcHJvcHMgPSBwcm9wcyB8fCB7fVxuXG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwiYnV0dG9uXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcInRpdGxlXCIsIGFyZ3VtZW50c1szXSlcbmJlbDEuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBhcmd1bWVudHNbNF0pXG5iZWwxW1wib25jbGlja1wiXSA9IGFyZ3VtZW50c1s1XVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlCdXR0b24tLWNpcmN1bGFyXFxuICAgICAgICAgICAgICAgICAgIFVwcHlCdXR0b24tLWJsdWVcXG4gICAgICAgICAgICAgICAgICAgVXBweURhc2hib2FyZC11cGxvYWRcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN1cFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCBhcmd1bWVudHNbMF0pXG5iZWwwLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgYXJndW1lbnRzWzFdKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlEYXNoYm9hcmQtdXBsb2FkQ291bnRcIilcbmFjKGJlbDAsIFtcIlxcbiAgICAgICAgICAgICAgICAgIFwiLGFyZ3VtZW50c1syXV0pXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgICAgICBcIixhcmd1bWVudHNbNl0sXCJcXG4gICAgICAgICAgICBcIixiZWwwLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfShwcm9wcy5pMThuKCdudW1iZXJPZlNlbGVjdGVkRmlsZXMnKSxwcm9wcy5pMThuKCdudW1iZXJPZlNlbGVjdGVkRmlsZXMnKSxwcm9wcy5uZXdGaWxlQ291bnQscHJvcHMuaTE4bigndXBsb2FkQWxsTmV3RmlsZXMnKSxwcm9wcy5pMThuKCd1cGxvYWRBbGxOZXdGaWxlcycpLHByb3BzLnN0YXJ0VXBsb2FkLHVwbG9hZEljb24oKSkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG4vLyBodHRwczovL2Nzcy10cmlja3MuY29tL2NyZWF0aW5nLXN2Zy1pY29uLXN5c3RlbS1yZWFjdC9cblxuZnVuY3Rpb24gZGVmYXVsdFRhYkljb24gKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIzMFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjMwXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAzMCAzMFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xNSAzMGM4LjI4NCAwIDE1LTYuNzE2IDE1LTE1IDAtOC4yODQtNi43MTYtMTUtMTUtMTVDNi43MTYgMCAwIDYuNzE2IDAgMTVjMCA4LjI4NCA2LjcxNiAxNSAxNSAxNXptNC4yNTgtMTIuNjc2djYuODQ2aC04LjQyNnYtNi44NDZINS4yMDRsOS44Mi0xMi4zNjQgOS44MiAxMi4zNjRIMTkuMjZ6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KCkpXG59XG5cbmZ1bmN0aW9uIGljb25Db3B5ICgpIHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiNTFcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCI1MVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNTEgNTFcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMTcuMjEgNDUuNzY1YTUuMzk0IDUuMzk0IDAgMCAxLTcuNjIgMGwtNC4xMi00LjEyMmE1LjM5MyA1LjM5MyAwIDAgMSAwLTcuNjE4bDYuNzc0LTYuNzc1LTIuNDA0LTIuNDA0LTYuNzc1IDYuNzc2Yy0zLjQyNCAzLjQyNy0zLjQyNCA5IDAgMTIuNDI2bDQuMTIgNC4xMjNhOC43NjYgOC43NjYgMCAwIDAgNi4yMTYgMi41N2MyLjI1IDAgNC41LS44NTggNi4yMTQtMi41N2wxMy41NS0xMy41NTJhOC43MiA4LjcyIDAgMCAwIDIuNTc1LTYuMjEzIDguNzMgOC43MyAwIDAgMC0yLjU3NS02LjIxM2wtNC4xMjMtNC4xMi0yLjQwNCAyLjQwNCA0LjEyMyA0LjEyYTUuMzUyIDUuMzUyIDAgMCAxIDEuNTggMy44MWMwIDEuNDM4LS41NjIgMi43OS0xLjU4IDMuODA4bC0xMy41NSAxMy41NXpcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk00NC4yNTYgMi44NThBOC43MjggOC43MjggMCAwIDAgMzguMDQzLjI4M2gtLjAwMmE4LjczIDguNzMgMCAwIDAtNi4yMTIgMi41NzRsLTEzLjU1IDEzLjU1YTguNzI1IDguNzI1IDAgMCAwLTIuNTc1IDYuMjE0IDguNzMgOC43MyAwIDAgMCAyLjU3NCA2LjIxNmw0LjEyIDQuMTIgMi40MDUtMi40MDMtNC4xMi00LjEyYTUuMzU3IDUuMzU3IDAgMCAxLTEuNTgtMy44MTJjMC0xLjQzNy41NjItMi43OSAxLjU4LTMuODA4bDEzLjU1LTEzLjU1YTUuMzQ4IDUuMzQ4IDAgMCAxIDMuODEtMS41OGMxLjQ0IDAgMi43OTIuNTYyIDMuODEgMS41OGw0LjEyIDQuMTJjMi4xIDIuMSAyLjEgNS41MTggMCA3LjYxN0wzOS4yIDIzLjc3NWwyLjQwNCAyLjQwNCA2Ljc3NS02Ljc3N2MzLjQyNi0zLjQyNyAzLjQyNi05IDAtMTIuNDI2bC00LjEyLTQuMTJ6XCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgICBcIixiZWwxLFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsMlxuICAgIH0oKSlcbn1cblxuZnVuY3Rpb24gaWNvblJlc3VtZSAoKSB7XG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjI1XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMjVcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDQ0IDQ0XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJVcHB5SWNvblwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBvbHlnb25cIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoNiwgNS41KVwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInBvaW50c1wiLCBcIjEzIDIxLjY2NjY2NjcgMTMgMTEgMjEgMTYuMzMzMzMzM1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwicGxheVwiKVxuYWMoYmVsMSwgW1wiXFxuICAgIFwiLGJlbDAsXCJcXG4gIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfSgpKVxufVxuXG5mdW5jdGlvbiBpY29uUGF1c2UgKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwzLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIyNXB4XCIpXG5iZWwzLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMjVweFwiKVxuYmVsMy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNDQgNDRcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJnXCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgxOCwgMTcpXCIpXG5iZWwyLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwicGF1c2VcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJyZWN0XCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwieFwiLCBcIjBcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ5XCIsIFwiMFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMlwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjEwXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwicnhcIiwgXCIwXCIpXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicmVjdFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInhcIiwgXCI2XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwieVwiLCBcIjBcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjJcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIxMFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInJ4XCIsIFwiMFwiKVxuYWMoYmVsMiwgW1wiXFxuICAgICAgXCIsYmVsMCxcIlxcbiAgICAgIFwiLGJlbDEsXCJcXG4gICAgXCJdKVxuYWMoYmVsMywgW1wiXFxuICAgIFwiLGJlbDIsXCJcXG4gIFwiXSlcbiAgICAgIHJldHVybiBiZWwzXG4gICAgfSgpKVxufVxuXG5mdW5jdGlvbiBpY29uRWRpdCAoKSB7XG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjI4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMjhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDI4IDI4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJVcHB5SWNvblwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI1LjQzNiAyLjU2NmE3Ljk4IDcuOTggMCAwIDAtMi4wNzgtMS41MUMyMi42MzguNzAzIDIxLjkwNi41IDIxLjE5OC41YTMgMyAwIDAgMC0xLjAyMy4xNyAyLjQzNiAyLjQzNiAwIDAgMC0uODkzLjU2MkwyLjI5MiAxOC4yMTcuNSAyNy41bDkuMjgtMS43OTYgMTYuOTktMTYuOTljLjI1NS0uMjU0LjQ0NC0uNTYuNTYyLS44ODhhMyAzIDAgMCAwIC4xNy0xLjAyM2MwLS43MDgtLjIwNS0xLjQ0LS41NTUtMi4xNmE4IDggMCAwIDAtMS41MS0yLjA3N3pNOS4wMSAyNC4yNTJsLTQuMzEzLjgzNGMwLS4wMy4wMDgtLjA2LjAxMi0uMDkuMDA3LS45NDQtLjc0LTEuNzE1LTEuNjctMS43MjMtLjA0IDAtLjA3OC4wMDctLjExOC4wMWwuODMtNC4yOUwxNy43MiA1LjAyNGw1LjI2NCA1LjI2NEw5LjAxIDI0LjI1MnptMTYuODQtMTYuOTZhLjgxOC44MTggMCAwIDEtLjE5NC4zMWwtMS41NyAxLjU3LTUuMjYtNS4yNiAxLjU3LTEuNTdhLjgyLjgyIDAgMCAxIC4zMS0uMTk0IDEuNDUgMS40NSAwIDAgMSAuNDkyLS4wNzRjLjM5NyAwIC45MTcuMTI2IDEuNDY4LjM5Ny41NS4yNyAxLjEzLjY3OCAxLjY1NiAxLjIxLjUzLjUzLjk0IDEuMTEgMS4yMDggMS42NTUuMjcyLjU1LjM5NyAxLjA3LjM5MyAxLjQ2OC4wMDQuMTkzLS4wMjcuMzU4LS4wNzQuNDg4elwiKVxuYWMoYmVsMSwgW1wiXFxuICAgIFwiLGJlbDAsXCJcXG4gIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfSgpKVxufVxuXG5mdW5jdGlvbiBsb2NhbEljb24gKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIyN1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjI1XCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAyNyAyNVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk01LjU4NiA5LjI4OGEuMzEzLjMxMyAwIDAgMCAuMjgyLjE3Nmg0Ljg0djMuOTIyYzAgMS41MTQgMS4yNSAyLjI0IDIuNzkyIDIuMjQgMS41NCAwIDIuNzktLjcyNiAyLjc5LTIuMjRWOS40NjRoNC44NGMuMTIyIDAgLjIzLS4wNjguMjg0LS4xNzZhLjMwNC4zMDQgMCAwIDAtLjA0Ni0uMzI0TDEzLjczNS4xMDZhLjMxNi4zMTYgMCAwIDAtLjQ3MiAwbC03LjYzIDguODU3YS4zMDIuMzAyIDAgMCAwLS4wNDcuMzI1elwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI0LjMgNS4wOTNjLS4yMTgtLjc2LS41NC0xLjE4Ny0xLjIwOC0xLjE4N2gtNC44NTZsMS4wMTggMS4xOGgzLjk0OGwyLjA0MyAxMS4wMzhoLTcuMTkzdjIuNzI4SDkuMTE0di0yLjcyNWgtNy4zNmwyLjY2LTExLjA0aDMuMzNsMS4wMTgtMS4xOEgzLjkwN2MtLjY2OCAwLTEuMDYuNDYtMS4yMSAxLjE4NkwwIDE2LjQ1NnY3LjA2MkMwIDI0LjMzOC42NzYgMjUgMS41MSAyNWgyMy45OGMuODMzIDAgMS41MS0uNjYzIDEuNTEtMS40ODJ2LTcuMDYyTDI0LjMgNS4wOTN6XCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgICBcIixiZWwxLFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsMlxuICAgIH0oKSlcbn1cblxuZnVuY3Rpb24gY2xvc2VJY29uICgpIHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMTRweFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjE0cHhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDE5IDE5XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJVcHB5SWNvblwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTE3LjMxOCAxNy4yMzJMOS45NCA5Ljg1NCA5LjU4NiA5LjVsLS4zNTQuMzU0LTcuMzc4IDcuMzc4aC43MDdsLS42Mi0uNjJ2LjcwNkw5LjMxOCA5Ljk0bC4zNTQtLjM1NC0uMzU0LS4zNTRMMS45NCAxLjg1NHYuNzA3bC42Mi0uNjJoLS43MDZsNy4zNzggNy4zNzguMzU0LjM1NC4zNTQtLjM1NCA3LjM3OC03LjM3OGgtLjcwN2wuNjIyLjYydi0uNzA2TDkuODU0IDkuMjMybC0uMzU0LjM1NC4zNTQuMzU0IDcuMzc4IDcuMzc4LjcwOC0uNzA3LTcuMzgtNy4zNzh2LjcwOGw3LjM4LTcuMzguMzUzLS4zNTMtLjM1My0uMzUzLS42MjItLjYyMi0uMzUzLS4zNTMtLjM1NC4zNTItNy4zNzggNy4zOGguNzA4TDIuNTYgMS4yMyAyLjIwOC44OGwtLjM1My4zNTMtLjYyMi42Mi0uMzUzLjM1NS4zNTIuMzUzIDcuMzggNy4zOHYtLjcwOGwtNy4zOCA3LjM4LS4zNTMuMzUzLjM1Mi4zNTMuNjIyLjYyMi4zNTMuMzUzLjM1NC0uMzUzIDcuMzgtNy4zOGgtLjcwOGw3LjM4IDcuMzh6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KCkpXG59XG5cbmZ1bmN0aW9uIHBsdWdpbkljb24gKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIxNnB4XCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTZweFwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMzIgMzBcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNNi42MjA5ODk0LDExLjE0NTExNjIgQzYuNjgyMzA1MSwxMS4yNzUxNjY5IDYuODEzNzQyNDgsMTEuMzU3MjE4OCA2Ljk1NDYzODEzLDExLjM1NzIxODggTDEyLjY5MjU0ODIsMTEuMzU3MjE4OCBMMTIuNjkyNTQ4MiwxNi4wNjMwNDI3IEMxMi42OTI1NDgyLDE3Ljg4MDUwOSAxNC4xNzI2MDQ4LDE4Ljc1IDE2LjAwMDAwODMsMTguNzUgQzE3LjgyNjEwNzIsMTguNzUgMTkuMzA3NDY4NCwxNy44ODAxODQ3IDE5LjMwNzQ2ODQsMTYuMDYzMDQyNyBMMTkuMzA3NDY4NCwxMS4zNTcyMTg4IEwyNS4wNDM3NDc4LDExLjM1NzIxODggQzI1LjE4NzU3ODcsMTEuMzU3MjE4OCAyNS4zMTY0MDY5LDExLjI3NTE2NjkgMjUuMzc5MDI3MiwxMS4xNDUxMTYyIEMyNS40MzcwODE0LDExLjAxNzMzNTggMjUuNDE3MTg2NSwxMC44NjQyNTg3IDI1LjMyNTIxMjksMTAuNzU2MjYxNSBMMTYuMjc4MjEyLDAuMTI3MTMxODM3IEMxNi4yMDkzOTQ5LDAuMDQ2Mzc3MTc1MSAxNi4xMDY5ODQ2LDAgMTUuOTk5NjgyMiwwIEMxNS44OTEwNzUxLDAgMTUuNzg4NjY0OCwwLjA0NjM3NzE3NTEgMTUuNzE4MjE3LDAuMTI3MTMxODM3IEw2LjY3NjEwODMsMTAuNzU1OTM3MSBDNi41ODI1MDQwMiwxMC44NjQyNTg3IDYuNTYyOTM1MTgsMTEuMDE3MzM1OCA2LjYyMDk4OTQsMTEuMTQ1MTE2MiBMNi42MjA5ODk0LDExLjE0NTExNjIgWlwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI4LjgwMDg3MjIsNi4xMTE0MjY0NSBDMjguNTQxNzg5MSw1LjE5ODMxNTU1IDI4LjE1ODMzMzEsNC42ODc1IDI3LjM2ODQ4NDgsNC42ODc1IEwyMS42MTI0NDU0LDQuNjg3NSBMMjIuODE5MDIzNCw2LjEwMzA3ODc0IEwyNy40OTg2NzI1LDYuMTAzMDc4NzQgTDI5LjkxOTU4MTcsMTkuMzQ4NjQ0OSBMMjEuMzk0Mzg5MSwxOS4zNTAyNTAyIEwyMS4zOTQzODkxLDIyLjYyMjU1MiBMMTAuODAyMzQ2MSwyMi42MjI1NTIgTDEwLjgwMjM0NjEsMTkuMzUyNDk3NyBMMi4wNzgxNTcwMiwxOS4zNTM0NjA5IEw1LjIyOTc5Njk5LDYuMTAzMDc4NzQgTDkuMTc4NzE1MjksNi4xMDMwNzg3NCBMMTAuMzg0MDAxMSw0LjY4NzUgTDQuNjMwODY5MSw0LjY4NzUgQzMuODM5NDA1NTksNC42ODc1IDMuMzc0MjE4ODgsNS4yMzkwOTA5IDMuMTk4MTU4NjQsNi4xMTE0MjY0NSBMMCwxOS43NDcwODc0IEwwLDI4LjIyMTI5NTkgQzAsMjkuMjA0Mzk5MiAwLjgwMTQ3NzkzNywzMCAxLjc4ODcwNzUxLDMwIEwzMC4yMDk2NzczLDMwIEMzMS4xOTgxOTksMzAgMzIsMjkuMjA0Mzk5MiAzMiwyOC4yMjEyOTU5IEwzMiwxOS43NDcwODc0IEwyOC44MDA4NzIyLDYuMTExNDI2NDUgTDI4LjgwMDg3MjIsNi4xMTE0MjY0NSBaXCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgICBcIixiZWwwLFwiXFxuICAgICAgXCIsYmVsMSxcIlxcbiAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMlxuICAgIH0oKSlcbn1cblxuZnVuY3Rpb24gY2hlY2tJY29uICgpIHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMTNweFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjlweFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMTMgOVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb24gVXBweUljb24tY2hlY2tcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwb2x5Z29uXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwicG9pbnRzXCIsIFwiNSA3LjI5MyAxLjM1NCAzLjY0NyAwLjY0NiA0LjM1NCA1IDguNzA3IDEyLjM1NCAxLjM1NCAxMS42NDYgMC42NDdcIilcbmFjKGJlbDEsIFtcIlxcbiAgICBcIixiZWwwXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfSgpKVxufVxuXG5mdW5jdGlvbiBpY29uQXVkaW8gKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIzNFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjkxXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAzNCA5MVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yMi4zNjYgNDMuMTM0VjI5LjMzYzUuODkyLTYuNTg4IDEwLjk4Ni0xNC41MDcgMTAuOTg2LTIyLjE4MyAwLTQuMTE0LTIuOTg2LTcuMS03LjEtNy4xLTMuOTE0IDAtNy4xIDMuMTg2LTcuMSA3LjF2MjAuOTM2YTkyLjU2MiA5Mi41NjIgMCAwIDEtNS43MjggNS42NzdsLS4zODQuMzQ4QzQuNjQzIDQxLjc2Mi40MjggNDUuNjA0LjQyOCA1NC44MDJjMCA4Ljg2NiA3LjIxNCAxNi4wOCAxNi4wOCAxNi4wOC45MDIgMCAxLjc4NC0uMDc0IDIuNjQ0LS4yMTZ2MTEuMjZjMCAyLjcwMi0yLjE5OCA0LjktNC45IDQuOWE0Ljg1NSA0Ljg1NSAwIDAgMS0yLjk1LTEuMDE1YzIuMzY0LS4yNCA0LjIyMi0yLjIxOCA0LjIyMi00LjY0M2E0LjY5OCA0LjY5OCAwIDAgMC00LjY5Mi00LjY5MiA0LjczOCA0LjczOCAwIDAgMC00LjIxMyAyLjYyOGMtLjkyMyAxLjg3NC0uNTYgNC4zODYuMjc3IDYuMjI4YTcuODIgNy44MiAwIDAgMCAuOSAxLjUwMiA4LjE3OCA4LjE3OCAwIDAgMCA0LjIzIDIuODk2Yy43MjMuMjA3IDEuNDc0LjMxIDIuMjI2LjMxIDQuNDc0IDAgOC4xMTMtMy42NCA4LjExMy04LjExM1Y2OS43OGM1Ljk4LTIuMzQ1IDEwLjIyNS04LjE3NiAxMC4yMjUtMTQuOTc3IDAtNS45NzUtNC40NjQtMTAuODc2LTEwLjIyNC0xMS42N3ptMC0zNS45ODdhMy44OSAzLjg5IDAgMCAxIDMuODg3LTMuODg1YzEuOTMzIDAgMy44ODUgMS4yMDIgMy44ODUgMy44ODUgMCA0Ljk1LTIuNzAyIDEwLjg2Mi03Ljc3MiAxNy4yMDRWNy4xNDh6TTE2LjUxIDY3LjY3Yy03LjA5NiAwLTEyLjg2Ny01Ljc3LTEyLjg2Ny0xMi44NjcgMC03Ljc4IDMuMzg1LTEwLjg2NSAxMS41NjMtMTguMzJsLjM4NC0uMzVjMS4xNjYtMS4wNjQgMi4zNjUtMi4yIDMuNTYyLTMuNDAydjEwLjQwNGMtNS43NTguNzkzLTEwLjIyMyA1LjY5NS0xMC4yMjMgMTEuNjcgMCAzLjkzNSAxLjk0OCA3LjYwMyA1LjIxMiA5LjgxYTEuNjA1IDEuNjA1IDAgMSAwIDEuOC0yLjY2IDguNjIyIDguNjIyIDAgMCAxLTMuOC03LjE1YzAtNC4yIDMuMDI1LTcuNyA3LjAxLTguNDU2djIxLjA1Yy0uODUzLjE3OC0xLjczNi4yNzItMi42NDIuMjcyem01Ljg1Ni0xLjQxMnYtMTkuOTFjMy45ODUuNzU2IDcuMDEgNC4yNTMgNy4wMSA4LjQ1NSAwIDQuOTg3LTIuODUgOS4zMi03LjAxIDExLjQ1NXpcIilcbmFjKGJlbDEsIFtcIlxcbiAgICBcIixiZWwwLFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsMVxuICAgIH0oKSlcbn1cblxuZnVuY3Rpb24gaWNvbkZpbGUgKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCI0NFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjU4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCA0NCA1OFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yNy40MzcuNTE3YTEgMSAwIDAgMC0uMDk0LjAzSDQuMjVDMi4wMzcuNTQ4LjIxNyAyLjM2OC4yMTcgNC41OHY0OC40MDVjMCAyLjIxMiAxLjgyIDQuMDMgNC4wMyA0LjAzSDM5LjAzYzIuMjEgMCA0LjAzLTEuODE4IDQuMDMtNC4wM1YxNS42MWExIDEgMCAwIDAtLjAzLS4yOCAxIDEgMCAwIDAgMC0uMDkzIDEgMSAwIDAgMC0uMDMtLjAzMiAxIDEgMCAwIDAgMC0uMDMgMSAxIDAgMCAwLS4wMzItLjA2MyAxIDEgMCAwIDAtLjAzLS4wNjMgMSAxIDAgMCAwLS4wMzIgMCAxIDEgMCAwIDAtLjAzLS4wNjMgMSAxIDAgMCAwLS4wMzItLjAzIDEgMSAwIDAgMC0uMDMtLjA2MyAxIDEgMCAwIDAtLjA2My0uMDYybC0xNC41OTMtMTRhMSAxIDAgMCAwLS4wNjItLjA2MkExIDEgMCAwIDAgMjggLjcwOGExIDEgMCAwIDAtLjM3NC0uMTU3IDEgMSAwIDAgMC0uMTU2IDAgMSAxIDAgMCAwLS4wMy0uMDNsLS4wMDMtLjAwM3pNNC4yNSAyLjU0N2gyMi4yMTh2OS45N2MwIDIuMjEgMS44MiA0LjAzIDQuMDMgNC4wM2gxMC41NjR2MzYuNDM4YTIuMDIgMi4wMiAwIDAgMS0yLjAzMiAyLjAzMkg0LjI1Yy0xLjEzIDAtMi4wMzItLjktMi4wMzItMi4wMzJWNC41OGMwLTEuMTMuOTAyLTIuMDMyIDIuMDMtMi4wMzJ6bTI0LjIxOCAxLjM0NWwxMC4zNzUgOS45MzcuNzUuNzE4SDMwLjVjLTEuMTMgMC0yLjAzMi0uOS0yLjAzMi0yLjAzVjMuODl6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KCkpXG59XG5cbmZ1bmN0aW9uIGljb25UZXh0ICgpIHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiNTBcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCI2M1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNTAgNjNcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMCAuNXYxNS42MTdoNi4yNWwxLjctNS4xYTYuMjQyIDYuMjQyIDAgMCAxIDUuOTMzLTQuMjY3aDhWNTAuNWMwIDMuNDUtMi44IDYuMjUtNi4yNSA2LjI1SDEyLjVWNjNoMjV2LTYuMjVoLTMuMTMzYy0zLjQ1IDAtNi4yNS0yLjgtNi4yNS02LjI1VjYuNzVoOGE2LjI1NyA2LjI1NyAwIDAgMSA1LjkzMyA0LjI2N2wxLjcgNS4xSDUwVi41SDB6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDFcbiAgICB9KCkpXG59XG5cbmZ1bmN0aW9uIHVwbG9hZEljb24gKCkge1xuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIzN1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjMzXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAzNyAzM1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yOS4xMDcgMjQuNWM0LjA3IDAgNy4zOTMtMy4zNTUgNy4zOTMtNy40NDIgMC0zLjk5NC0zLjEwNS03LjMwNy03LjAxMi03LjUwMmwuNDY4LjQxNUMyOS4wMiA0LjUyIDI0LjM0LjUgMTguODg2LjVjLTQuMzQ4IDAtOC4yNyAyLjUyMi0xMC4xMzggNi41MDZsLjQ0Ni0uMjg4QzQuMzk0IDYuNzgyLjUgMTAuNzU4LjUgMTUuNjA4YzAgNC45MjQgMy45MDYgOC44OTIgOC43NiA4Ljg5Mmg0Ljg3MmMuNjM1IDAgMS4wOTUtLjQ2NyAxLjA5NS0xLjEwNCAwLS42MzYtLjQ2LTEuMTAzLTEuMDk1LTEuMTAzSDkuMjZjLTMuNjQ0IDAtNi42My0zLjAzNS02LjYzLTYuNzQ0IDAtMy43MSAyLjkyNi02LjY4NSA2LjU3LTYuNjg1aC45NjRsLjE0LS4yOC4xNzctLjM2MmMxLjQ3Ny0zLjQgNC43NDQtNS41NzYgOC4zNDctNS41NzYgNC41OCAwIDguNDUgMy40NTIgOS4wMSA4LjA3MmwuMDYuNTM2LjA1LjQ0NmgxLjEwMWMyLjg3IDAgNS4yMDQgMi4zNyA1LjIwNCA1LjI5NXMtMi4zMzMgNS4yOTYtNS4yMDQgNS4yOTZoLTYuMDYyYy0uNjM0IDAtMS4wOTQuNDY3LTEuMDk0IDEuMTAzIDAgLjYzNy40NiAxLjEwNCAxLjA5NCAxLjEwNGg2LjEyelwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTIzLjE5NiAxOC45MmwtNC44MjgtNS4yNTgtLjM2Ni0uNC0uMzY4LjM5OC00LjgyOCA1LjE5NmExLjEzIDEuMTMgMCAwIDAgMCAxLjU0NmMuNDI4LjQ2IDEuMTEuNDYgMS41MzcgMGwzLjQ1LTMuNzEtLjg2OC0uMzR2MTUuMDNjMCAuNjQuNDQ1IDEuMTE4IDEuMDc1IDEuMTE4LjYzIDAgMS4wNzUtLjQ4IDEuMDc1LTEuMTJWMTYuMzVsLS44NjcuMzQgMy40NSAzLjcxMmExIDEgMCAwIDAgLjc2Ny4zNDUgMSAxIDAgMCAwIC43Ny0uMzQ1Yy40MTYtLjMzLjQxNi0xLjAzNiAwLTEuNDg1di4wMDN6XCIpXG5hYyhiZWwyLCBbXCJcXG4gICAgXCIsYmVsMCxcIlxcbiAgICBcIixiZWwxLFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsMlxuICAgIH0oKSlcbn1cblxuZnVuY3Rpb24gZGFzaGJvYXJkQmdJY29uICgpIHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiNDhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCI2OVwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNDggNjlcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNLjUgMS41aDV6TTEwLjUgMS41aDV6TTIwLjUgMS41aDV6TTMwLjUwNCAxLjVoNXpNNDUuNSAxMS41djV6TTQ1LjUgMjEuNXY1ek00NS41IDMxLjV2NXpNNDUuNSA0MS41MDJ2NXpNNDUuNSA1MS41MDJ2NXpNNDUuNSA2MS41djV6TTQ1LjUgNjYuNTAyaC00Ljk5OHpNMzUuNTAzIDY2LjUwMmgtNXpNMjUuNSA2Ni41MDJoLTV6TTE1LjUgNjYuNTAyaC01ek01LjUgNjYuNTAyaC01ek0uNSA2Ni41MDJ2LTV6TS41IDU2LjUwMnYtNXpNLjUgNDYuNTAzVjQxLjV6TS41IDM2LjV2LTV6TS41IDI2LjV2LTV6TS41IDE2LjV2LTV6TS41IDYuNVYxLjQ5OHpNNDQuODA3IDExSDM2VjIuMTk1elwiKVxuYWMoYmVsMSwgW1wiXFxuICAgIFwiLGJlbDAsXCJcXG4gIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfSgpKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGVmYXVsdFRhYkljb24sXG4gIGljb25Db3B5LFxuICBpY29uUmVzdW1lLFxuICBpY29uUGF1c2UsXG4gIGljb25FZGl0LFxuICBsb2NhbEljb24sXG4gIGNsb3NlSWNvbixcbiAgcGx1Z2luSWNvbixcbiAgY2hlY2tJY29uLFxuICBpY29uQXVkaW8sXG4gIGljb25GaWxlLFxuICBpY29uVGV4dCxcbiAgdXBsb2FkSWNvbixcbiAgZGFzaGJvYXJkQmdJY29uXG59XG4iLCJjb25zdCBQbHVnaW4gPSByZXF1aXJlKCcuLi9QbHVnaW4nKVxuY29uc3QgVHJhbnNsYXRvciA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvVHJhbnNsYXRvcicpXG5jb25zdCBkcmFnRHJvcCA9IHJlcXVpcmUoJ2RyYWctZHJvcCcpXG5jb25zdCBEYXNoYm9hcmQgPSByZXF1aXJlKCcuL0Rhc2hib2FyZCcpXG5jb25zdCB7IGdldFNwZWVkIH0gPSByZXF1aXJlKCcuLi8uLi9jb3JlL1V0aWxzJylcbmNvbnN0IHsgZ2V0RVRBIH0gPSByZXF1aXJlKCcuLi8uLi9jb3JlL1V0aWxzJylcbmNvbnN0IHsgcHJldHR5RVRBIH0gPSByZXF1aXJlKCcuLi8uLi9jb3JlL1V0aWxzJylcbmNvbnN0IHByZXR0eUJ5dGVzID0gcmVxdWlyZSgncHJldHR5LWJ5dGVzJylcbmNvbnN0IHsgZGVmYXVsdFRhYkljb24gfSA9IHJlcXVpcmUoJy4vaWNvbnMnKVxuXG4vKipcbiAqIE1vZGFsIERpYWxvZyAmIERhc2hib2FyZFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIERhc2hib2FyZFVJIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMuaWQgPSAnRGFzaGJvYXJkVUknXG4gICAgdGhpcy50aXRsZSA9ICdEYXNoYm9hcmQgVUknXG4gICAgdGhpcy50eXBlID0gJ29yY2hlc3RyYXRvcidcblxuICAgIGNvbnN0IGRlZmF1bHRMb2NhbGUgPSB7XG4gICAgICBzdHJpbmdzOiB7XG4gICAgICAgIHNlbGVjdFRvVXBsb2FkOiAnU2VsZWN0IGZpbGVzIHRvIHVwbG9hZCcsXG4gICAgICAgIGNsb3NlTW9kYWw6ICdDbG9zZSBNb2RhbCcsXG4gICAgICAgIHVwbG9hZDogJ1VwbG9hZCcsXG4gICAgICAgIGltcG9ydEZyb206ICdJbXBvcnQgZmlsZXMgZnJvbScsXG4gICAgICAgIGRhc2hib2FyZFdpbmRvd1RpdGxlOiAnVXBweSBEYXNoYm9hcmQgV2luZG93IChQcmVzcyBlc2NhcGUgdG8gY2xvc2UpJyxcbiAgICAgICAgZGFzaGJvYXJkVGl0bGU6ICdVcHB5IERhc2hib2FyZCcsXG4gICAgICAgIGNvcHlMaW5rVG9DbGlwYm9hcmRTdWNjZXNzOiAnTGluayBjb3BpZWQgdG8gY2xpcGJvYXJkLicsXG4gICAgICAgIGNvcHlMaW5rVG9DbGlwYm9hcmRGYWxsYmFjazogJ0NvcHkgdGhlIFVSTCBiZWxvdycsXG4gICAgICAgIGRvbmU6ICdEb25lJyxcbiAgICAgICAgbG9jYWxEaXNrOiAnTG9jYWwgRGlzaycsXG4gICAgICAgIGRyb3BQYXN0ZUltcG9ydDogJ0Ryb3AgZmlsZXMgaGVyZSwgcGFzdGUsIGltcG9ydCBmcm9tIG9uZSBvZiB0aGUgbG9jYXRpb25zIGFib3ZlIG9yJyxcbiAgICAgICAgZHJvcFBhc3RlOiAnRHJvcCBmaWxlcyBoZXJlLCBwYXN0ZSBvcicsXG4gICAgICAgIGJyb3dzZTogJ2Jyb3dzZScsXG4gICAgICAgIGZpbGVQcm9ncmVzczogJ0ZpbGUgcHJvZ3Jlc3M6IHVwbG9hZCBzcGVlZCBhbmQgRVRBJyxcbiAgICAgICAgbnVtYmVyT2ZTZWxlY3RlZEZpbGVzOiAnTnVtYmVyIG9mIHNlbGVjdGVkIGZpbGVzJyxcbiAgICAgICAgdXBsb2FkQWxsTmV3RmlsZXM6ICdVcGxvYWQgYWxsIG5ldyBmaWxlcydcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICB0YXJnZXQ6ICdib2R5JyxcbiAgICAgIGlubGluZTogZmFsc2UsXG4gICAgICB3aWR0aDogNzUwLFxuICAgICAgaGVpZ2h0OiA1NTAsXG4gICAgICBzZW1pVHJhbnNwYXJlbnQ6IGZhbHNlLFxuICAgICAgZGVmYXVsdFRhYkljb246IGRlZmF1bHRUYWJJY29uKCksXG4gICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiB0cnVlLFxuICAgICAgbG9jYWxlOiBkZWZhdWx0TG9jYWxlXG4gICAgfVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcblxuICAgIHRoaXMubG9jYWxlID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdExvY2FsZSwgdGhpcy5vcHRzLmxvY2FsZSlcbiAgICB0aGlzLmxvY2FsZS5zdHJpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdExvY2FsZS5zdHJpbmdzLCB0aGlzLm9wdHMubG9jYWxlLnN0cmluZ3MpXG5cbiAgICB0aGlzLnRyYW5zbGF0b3IgPSBuZXcgVHJhbnNsYXRvcih7bG9jYWxlOiB0aGlzLmxvY2FsZX0pXG4gICAgdGhpcy5jb250YWluZXJXaWR0aCA9IHRoaXMudHJhbnNsYXRvci50cmFuc2xhdGUuYmluZCh0aGlzLnRyYW5zbGF0b3IpXG5cbiAgICB0aGlzLmhpZGVNb2RhbCA9IHRoaXMuaGlkZU1vZGFsLmJpbmQodGhpcylcbiAgICB0aGlzLnNob3dNb2RhbCA9IHRoaXMuc2hvd01vZGFsLmJpbmQodGhpcylcblxuICAgIHRoaXMuYWRkVGFyZ2V0ID0gdGhpcy5hZGRUYXJnZXQuYmluZCh0aGlzKVxuICAgIHRoaXMuYWN0aW9ucyA9IHRoaXMuYWN0aW9ucy5iaW5kKHRoaXMpXG4gICAgdGhpcy5oaWRlQWxsUGFuZWxzID0gdGhpcy5oaWRlQWxsUGFuZWxzLmJpbmQodGhpcylcbiAgICB0aGlzLnNob3dQYW5lbCA9IHRoaXMuc2hvd1BhbmVsLmJpbmQodGhpcylcbiAgICB0aGlzLmluaXRFdmVudHMgPSB0aGlzLmluaXRFdmVudHMuYmluZCh0aGlzKVxuICAgIHRoaXMuaGFuZGxlRHJvcCA9IHRoaXMuaGFuZGxlRHJvcC5iaW5kKHRoaXMpXG4gICAgdGhpcy5wYXVzZUFsbCA9IHRoaXMucGF1c2VBbGwuYmluZCh0aGlzKVxuICAgIHRoaXMucmVzdW1lQWxsID0gdGhpcy5yZXN1bWVBbGwuYmluZCh0aGlzKVxuICAgIHRoaXMuY2FuY2VsQWxsID0gdGhpcy5jYW5jZWxBbGwuYmluZCh0aGlzKVxuICAgIHRoaXMudXBkYXRlRGFzaGJvYXJkRWxXaWR0aCA9IHRoaXMudXBkYXRlRGFzaGJvYXJkRWxXaWR0aC5iaW5kKHRoaXMpXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5pbnN0YWxsID0gdGhpcy5pbnN0YWxsLmJpbmQodGhpcylcbiAgfVxuXG4gIGFkZFRhcmdldCAocGx1Z2luKSB7XG4gICAgY29uc3QgY2FsbGVyUGx1Z2luSWQgPSBwbHVnaW4uY29uc3RydWN0b3IubmFtZVxuICAgIGNvbnN0IGNhbGxlclBsdWdpbk5hbWUgPSBwbHVnaW4udGl0bGUgfHwgY2FsbGVyUGx1Z2luSWRcbiAgICBjb25zdCBjYWxsZXJQbHVnaW5JY29uID0gcGx1Z2luLmljb24gfHwgdGhpcy5vcHRzLmRlZmF1bHRUYWJJY29uXG4gICAgY29uc3QgY2FsbGVyUGx1Z2luVHlwZSA9IHBsdWdpbi50eXBlXG5cbiAgICBpZiAoY2FsbGVyUGx1Z2luVHlwZSAhPT0gJ2FjcXVpcmVyJyAmJlxuICAgICAgICBjYWxsZXJQbHVnaW5UeXBlICE9PSAncHJvZ3Jlc3NpbmRpY2F0b3InICYmXG4gICAgICAgIGNhbGxlclBsdWdpblR5cGUgIT09ICdwcmVzZW50ZXInKSB7XG4gICAgICBsZXQgbXNnID0gJ0Vycm9yOiBNb2RhbCBjYW4gb25seSBiZSB1c2VkIGJ5IHBsdWdpbnMgb2YgdHlwZXM6IGFjcXVpcmVyLCBwcm9ncmVzc2luZGljYXRvciwgcHJlc2VudGVyJ1xuICAgICAgdGhpcy5jb3JlLmxvZyhtc2cpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXQgPSB7XG4gICAgICBpZDogY2FsbGVyUGx1Z2luSWQsXG4gICAgICBuYW1lOiBjYWxsZXJQbHVnaW5OYW1lLFxuICAgICAgaWNvbjogY2FsbGVyUGx1Z2luSWNvbixcbiAgICAgIHR5cGU6IGNhbGxlclBsdWdpblR5cGUsXG4gICAgICBmb2N1czogcGx1Z2luLmZvY3VzLFxuICAgICAgcmVuZGVyOiBwbHVnaW4ucmVuZGVyLFxuICAgICAgaXNIaWRkZW46IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG4gICAgY29uc3QgbmV3VGFyZ2V0cyA9IG1vZGFsLnRhcmdldHMuc2xpY2UoKVxuICAgIG5ld1RhcmdldHMucHVzaCh0YXJnZXQpXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgbW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICAgIHRhcmdldHM6IG5ld1RhcmdldHNcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzLm9wdHMudGFyZ2V0XG4gIH1cblxuICBoaWRlQWxsUGFuZWxzICgpIHtcbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe21vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgYWN0aXZlUGFuZWw6IGZhbHNlXG4gICAgfSl9KVxuICB9XG5cbiAgc2hvd1BhbmVsIChpZCkge1xuICAgIGNvbnN0IG1vZGFsID0gdGhpcy5jb3JlLmdldFN0YXRlKCkubW9kYWxcblxuICAgIGNvbnN0IGFjdGl2ZVBhbmVsID0gbW9kYWwudGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT4ge1xuICAgICAgcmV0dXJuIHRhcmdldC50eXBlID09PSAnYWNxdWlyZXInICYmIHRhcmdldC5pZCA9PT0gaWRcbiAgICB9KVswXVxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHttb2RhbDogT2JqZWN0LmFzc2lnbih7fSwgbW9kYWwsIHtcbiAgICAgIGFjdGl2ZVBhbmVsOiBhY3RpdmVQYW5lbFxuICAgIH0pfSlcbiAgfVxuXG4gIGhpZGVNb2RhbCAoKSB7XG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgICBpc0hpZGRlbjogdHJ1ZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdpcy1VcHB5RGFzaGJvYXJkLW9wZW4nKVxuICB9XG5cbiAgc2hvd01vZGFsICgpIHtcbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgbW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICAgIGlzSGlkZGVuOiBmYWxzZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgLy8gYWRkIGNsYXNzIHRvIGJvZHkgdGhhdCBzZXRzIHBvc2l0aW9uIGZpeGVkXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdpcy1VcHB5RGFzaGJvYXJkLW9wZW4nKVxuICAgIC8vIGZvY3VzIG9uIG1vZGFsIGlubmVyIGJsb2NrXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlEYXNoYm9hcmQtaW5uZXInKS5mb2N1cygpXG5cbiAgICB0aGlzLnVwZGF0ZURhc2hib2FyZEVsV2lkdGgoKVxuICB9XG5cbiAgaW5pdEV2ZW50cyAoKSB7XG4gICAgLy8gY29uc3QgZGFzaGJvYXJkRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAke3RoaXMub3B0cy50YXJnZXR9IC5VcHB5RGFzaGJvYXJkYClcblxuICAgIC8vIE1vZGFsIG9wZW4gYnV0dG9uXG4gICAgY29uc3Qgc2hvd01vZGFsVHJpZ2dlciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLnRyaWdnZXIpXG4gICAgaWYgKCF0aGlzLm9wdHMuaW5saW5lICYmIHNob3dNb2RhbFRyaWdnZXIpIHtcbiAgICAgIHNob3dNb2RhbFRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnNob3dNb2RhbClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb3JlLmxvZygnTW9kYWwgdHJpZ2dlciB3YXNu4oCZdCBmb3VuZCcpXG4gICAgfVxuXG4gICAgLy8gQ2xvc2UgdGhlIE1vZGFsIG9uIGVzYyBrZXkgcHJlc3NcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMjcpIHtcbiAgICAgICAgdGhpcy5oaWRlTW9kYWwoKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICAvLyBEcmFnIERyb3BcbiAgICBkcmFnRHJvcCh0aGlzLmVsLCAoZmlsZXMpID0+IHtcbiAgICAgIHRoaXMuaGFuZGxlRHJvcChmaWxlcylcbiAgICB9KVxuICB9XG5cbiAgYWN0aW9ucyAoKSB7XG4gICAgY29uc3QgYnVzID0gdGhpcy5jb3JlLmJ1c1xuXG4gICAgYnVzLm9uKCdjb3JlOmZpbGUtYWRkJywgKCkgPT4ge1xuICAgICAgdGhpcy5oaWRlQWxsUGFuZWxzKClcbiAgICB9KVxuXG4gICAgYnVzLm9uKCdkYXNoYm9hcmQ6ZmlsZS1jYXJkJywgKGZpbGVJZCkgPT4ge1xuICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgICBtb2RhbDogT2JqZWN0LmFzc2lnbih7fSwgbW9kYWwsIHtcbiAgICAgICAgICBmaWxlQ2FyZEZvcjogZmlsZUlkIHx8IGZhbHNlXG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgKGV2KSA9PiB0aGlzLnVwZGF0ZURhc2hib2FyZEVsV2lkdGgoKSlcblxuICAgIC8vIGJ1cy5vbignY29yZTpzdWNjZXNzJywgKHVwbG9hZGVkQ291bnQpID0+IHtcbiAgICAvLyAgIGJ1cy5lbWl0KFxuICAgIC8vICAgICAnaW5mb3JtZXInLFxuICAgIC8vICAgICBgJHt0aGlzLmNvcmUuaTE4bignZmlsZXMnLCB7J3NtYXJ0X2NvdW50JzogdXBsb2FkZWRDb3VudH0pfSBzdWNjZXNzZnVsbHkgdXBsb2FkZWQsIFNpciFgLFxuICAgIC8vICAgICAnaW5mbycsXG4gICAgLy8gICAgIDYwMDBcbiAgICAvLyAgIClcbiAgICAvLyB9KVxuICB9XG5cbiAgdXBkYXRlRGFzaGJvYXJkRWxXaWR0aCAoKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuVXBweURhc2hib2FyZC1pbm5lcicpXG5cbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgICBjb250YWluZXJXaWR0aDogZGFzaGJvYXJkRWwub2Zmc2V0V2lkdGhcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGhhbmRsZURyb3AgKGZpbGVzKSB7XG4gICAgdGhpcy5jb3JlLmxvZygnQWxsIHJpZ2h0LCBzb21lb25lIGRyb3BwZWQgc29tZXRoaW5nLi4uJylcblxuICAgIGZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgIHRoaXMuY29yZS5idXMuZW1pdCgnY29yZTpmaWxlLWFkZCcsIHtcbiAgICAgICAgc291cmNlOiB0aGlzLmlkLFxuICAgICAgICBuYW1lOiBmaWxlLm5hbWUsXG4gICAgICAgIHR5cGU6IGZpbGUudHlwZSxcbiAgICAgICAgZGF0YTogZmlsZVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgY2FuY2VsQWxsICgpIHtcbiAgICB0aGlzLmNvcmUuYnVzLmVtaXQoJ2NvcmU6Y2FuY2VsLWFsbCcpXG4gIH1cblxuICBwYXVzZUFsbCAoKSB7XG4gICAgdGhpcy5jb3JlLmJ1cy5lbWl0KCdjb3JlOnBhdXNlLWFsbCcpXG4gIH1cblxuICByZXN1bWVBbGwgKCkge1xuICAgIHRoaXMuY29yZS5idXMuZW1pdCgnY29yZTpyZXN1bWUtYWxsJylcbiAgfVxuXG4gIGdldFRvdGFsU3BlZWQgKGZpbGVzKSB7XG4gICAgbGV0IHRvdGFsU3BlZWQgPSAwXG4gICAgZmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgdG90YWxTcGVlZCA9IHRvdGFsU3BlZWQgKyBnZXRTcGVlZChmaWxlLnByb2dyZXNzKVxuICAgIH0pXG4gICAgcmV0dXJuIHRvdGFsU3BlZWRcbiAgfVxuXG4gIGdldFRvdGFsRVRBIChmaWxlcykge1xuICAgIGxldCB0b3RhbFNlY29uZHMgPSAwXG5cbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICB0b3RhbFNlY29uZHMgPSB0b3RhbFNlY29uZHMgKyBnZXRFVEEoZmlsZS5wcm9ncmVzcylcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRvdGFsU2Vjb25kc1xuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIGNvbnN0IGZpbGVzID0gc3RhdGUuZmlsZXNcblxuICAgIGNvbnN0IG5ld0ZpbGVzID0gT2JqZWN0LmtleXMoZmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuICFmaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gICAgfSlcbiAgICBjb25zdCB1cGxvYWRTdGFydGVkRmlsZXMgPSBPYmplY3Qua2V5cyhmaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gZmlsZXNbZmlsZV0ucHJvZ3Jlc3MudXBsb2FkU3RhcnRlZFxuICAgIH0pXG4gICAgY29uc3QgY29tcGxldGVGaWxlcyA9IE9iamVjdC5rZXlzKGZpbGVzKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZVxuICAgIH0pXG4gICAgY29uc3QgaW5Qcm9ncmVzc0ZpbGVzID0gT2JqZWN0LmtleXMoZmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuICFmaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZSAmJlxuICAgICAgICAgICAgIGZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWQgJiZcbiAgICAgICAgICAgICAhZmlsZXNbZmlsZV0uaXNQYXVzZWRcbiAgICB9KVxuXG4gICAgbGV0IGluUHJvZ3Jlc3NGaWxlc0FycmF5ID0gW11cbiAgICBpblByb2dyZXNzRmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgaW5Qcm9ncmVzc0ZpbGVzQXJyYXkucHVzaChmaWxlc1tmaWxlXSlcbiAgICB9KVxuXG4gICAgY29uc3QgdG90YWxTcGVlZCA9IHByZXR0eUJ5dGVzKHRoaXMuZ2V0VG90YWxTcGVlZChpblByb2dyZXNzRmlsZXNBcnJheSkpXG4gICAgY29uc3QgdG90YWxFVEEgPSBwcmV0dHlFVEEodGhpcy5nZXRUb3RhbEVUQShpblByb2dyZXNzRmlsZXNBcnJheSkpXG5cbiAgICBjb25zdCBpc0FsbENvbXBsZXRlID0gc3RhdGUudG90YWxQcm9ncmVzcyA9PT0gMTAwXG4gICAgY29uc3QgaXNBbGxQYXVzZWQgPSBpblByb2dyZXNzRmlsZXMubGVuZ3RoID09PSAwICYmICFpc0FsbENvbXBsZXRlICYmIHVwbG9hZFN0YXJ0ZWRGaWxlcy5sZW5ndGggPiAwXG4gICAgY29uc3QgaXNVcGxvYWRTdGFydGVkID0gdXBsb2FkU3RhcnRlZEZpbGVzLmxlbmd0aCA+IDBcblxuICAgIGNvbnN0IGFjcXVpcmVycyA9IHN0YXRlLm1vZGFsLnRhcmdldHMuZmlsdGVyKCh0YXJnZXQpID0+IHtcbiAgICAgIHJldHVybiB0YXJnZXQudHlwZSA9PT0gJ2FjcXVpcmVyJ1xuICAgIH0pXG5cbiAgICBjb25zdCBwcm9ncmVzc2luZGljYXRvcnMgPSBzdGF0ZS5tb2RhbC50YXJnZXRzLmZpbHRlcigodGFyZ2V0KSA9PiB7XG4gICAgICByZXR1cm4gdGFyZ2V0LnR5cGUgPT09ICdwcm9ncmVzc2luZGljYXRvcidcbiAgICB9KVxuXG4gICAgY29uc3QgYWRkRmlsZSA9IChmaWxlKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOmZpbGUtYWRkJywgZmlsZSlcbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmVGaWxlID0gKGZpbGVJRCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTpmaWxlLXJlbW92ZScsIGZpbGVJRClcbiAgICB9XG5cbiAgICBjb25zdCBzdGFydFVwbG9hZCA9IChldikgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQnKVxuICAgIH1cblxuICAgIGNvbnN0IHBhdXNlVXBsb2FkID0gKGZpbGVJRCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQtcGF1c2UnLCBmaWxlSUQpXG4gICAgfVxuXG4gICAgY29uc3QgY2FuY2VsVXBsb2FkID0gKGZpbGVJRCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQtY2FuY2VsJywgZmlsZUlEKVxuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTpmaWxlLXJlbW92ZScsIGZpbGVJRClcbiAgICB9XG5cbiAgICBjb25zdCBzaG93RmlsZUNhcmQgPSAoZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdkYXNoYm9hcmQ6ZmlsZS1jYXJkJywgZmlsZUlEKVxuICAgIH1cblxuICAgIGNvbnN0IGZpbGVDYXJkRG9uZSA9IChtZXRhLCBmaWxlSUQpID0+IHtcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6dXBkYXRlLW1ldGEnLCBtZXRhLCBmaWxlSUQpXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdkYXNoYm9hcmQ6ZmlsZS1jYXJkJylcbiAgICB9XG5cbiAgICBjb25zdCBpbmZvID0gKHRleHQsIHR5cGUsIGR1cmF0aW9uKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdpbmZvcm1lcicsIHRleHQsIHR5cGUsIGR1cmF0aW9uKVxuICAgIH1cblxuICAgIGNvbnN0IHJlc3VtYWJsZVVwbG9hZHMgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5jYXBhYmlsaXRpZXMucmVzdW1hYmxlVXBsb2FkcyB8fCBmYWxzZVxuXG4gICAgcmV0dXJuIERhc2hib2FyZCh7XG4gICAgICBzdGF0ZTogc3RhdGUsXG4gICAgICBtb2RhbDogc3RhdGUubW9kYWwsXG4gICAgICBuZXdGaWxlczogbmV3RmlsZXMsXG4gICAgICBmaWxlczogZmlsZXMsXG4gICAgICB0b3RhbEZpbGVDb3VudDogT2JqZWN0LmtleXMoZmlsZXMpLmxlbmd0aCxcbiAgICAgIGlzVXBsb2FkU3RhcnRlZDogaXNVcGxvYWRTdGFydGVkLFxuICAgICAgaW5Qcm9ncmVzczogdXBsb2FkU3RhcnRlZEZpbGVzLmxlbmd0aCxcbiAgICAgIGNvbXBsZXRlRmlsZXM6IGNvbXBsZXRlRmlsZXMsXG4gICAgICBpblByb2dyZXNzRmlsZXM6IGluUHJvZ3Jlc3NGaWxlcyxcbiAgICAgIHRvdGFsU3BlZWQ6IHRvdGFsU3BlZWQsXG4gICAgICB0b3RhbEVUQTogdG90YWxFVEEsXG4gICAgICB0b3RhbFByb2dyZXNzOiBzdGF0ZS50b3RhbFByb2dyZXNzLFxuICAgICAgaXNBbGxDb21wbGV0ZTogaXNBbGxDb21wbGV0ZSxcbiAgICAgIGlzQWxsUGF1c2VkOiBpc0FsbFBhdXNlZCxcbiAgICAgIGFjcXVpcmVyczogYWNxdWlyZXJzLFxuICAgICAgYWN0aXZlUGFuZWw6IHN0YXRlLm1vZGFsLmFjdGl2ZVBhbmVsLFxuICAgICAgcHJvZ3Jlc3NpbmRpY2F0b3JzOiBwcm9ncmVzc2luZGljYXRvcnMsXG4gICAgICBhdXRvUHJvY2VlZDogdGhpcy5jb3JlLm9wdHMuYXV0b1Byb2NlZWQsXG4gICAgICBpZDogdGhpcy5pZCxcbiAgICAgIGNvbnRhaW5lcjogdGhpcy5vcHRzLnRhcmdldCxcbiAgICAgIGhpZGVNb2RhbDogdGhpcy5oaWRlTW9kYWwsXG4gICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiB0aGlzLm9wdHMuc2hvd1Byb2dyZXNzRGV0YWlscyxcbiAgICAgIGlubGluZTogdGhpcy5vcHRzLmlubGluZSxcbiAgICAgIHNlbWlUcmFuc3BhcmVudDogdGhpcy5vcHRzLnNlbWlUcmFuc3BhcmVudCxcbiAgICAgIG9uUGFzdGU6IHRoaXMuaGFuZGxlUGFzdGUsXG4gICAgICBzaG93UGFuZWw6IHRoaXMuc2hvd1BhbmVsLFxuICAgICAgaGlkZUFsbFBhbmVsczogdGhpcy5oaWRlQWxsUGFuZWxzLFxuICAgICAgbG9nOiB0aGlzLmNvcmUubG9nLFxuICAgICAgYnVzOiB0aGlzLmNvcmUuZW1pdHRlcixcbiAgICAgIGkxOG46IHRoaXMuY29udGFpbmVyV2lkdGgsXG4gICAgICBwYXVzZUFsbDogdGhpcy5wYXVzZUFsbCxcbiAgICAgIHJlc3VtZUFsbDogdGhpcy5yZXN1bWVBbGwsXG4gICAgICBjYW5jZWxBbGw6IHRoaXMuY2FuY2VsQWxsLFxuICAgICAgYWRkRmlsZTogYWRkRmlsZSxcbiAgICAgIHJlbW92ZUZpbGU6IHJlbW92ZUZpbGUsXG4gICAgICBpbmZvOiBpbmZvLFxuICAgICAgbWV0YUZpZWxkczogc3RhdGUubWV0YUZpZWxkcyxcbiAgICAgIHJlc3VtYWJsZVVwbG9hZHM6IHJlc3VtYWJsZVVwbG9hZHMsXG4gICAgICBzdGFydFVwbG9hZDogc3RhcnRVcGxvYWQsXG4gICAgICBwYXVzZVVwbG9hZDogcGF1c2VVcGxvYWQsXG4gICAgICBjYW5jZWxVcGxvYWQ6IGNhbmNlbFVwbG9hZCxcbiAgICAgIGZpbGVDYXJkRm9yOiBzdGF0ZS5tb2RhbC5maWxlQ2FyZEZvcixcbiAgICAgIHNob3dGaWxlQ2FyZDogc2hvd0ZpbGVDYXJkLFxuICAgICAgZmlsZUNhcmREb25lOiBmaWxlQ2FyZERvbmUsXG4gICAgICB1cGRhdGVEYXNoYm9hcmRFbFdpZHRoOiB0aGlzLnVwZGF0ZURhc2hib2FyZEVsV2lkdGgsXG4gICAgICBtYXhXaWR0aDogdGhpcy5vcHRzLm1heFdpZHRoLFxuICAgICAgbWF4SGVpZ2h0OiB0aGlzLm9wdHMubWF4SGVpZ2h0LFxuICAgICAgY3VycmVudFdpZHRoOiBzdGF0ZS5tb2RhbC5jb250YWluZXJXaWR0aCxcbiAgICAgIGlzV2lkZTogc3RhdGUubW9kYWwuY29udGFpbmVyV2lkdGggPiA0MDBcbiAgICB9KVxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgLy8gU2V0IGRlZmF1bHQgc3RhdGUgZm9yIE1vZGFsXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHttb2RhbDoge1xuICAgICAgaXNIaWRkZW46IHRydWUsXG4gICAgICBzaG93RmlsZUNhcmQ6IGZhbHNlLFxuICAgICAgYWN0aXZlUGFuZWw6IGZhbHNlLFxuICAgICAgdGFyZ2V0czogW11cbiAgICB9fSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMub3B0cy50YXJnZXRcbiAgICBjb25zdCBwbHVnaW4gPSB0aGlzXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLm1vdW50KHRhcmdldCwgcGx1Z2luKVxuXG4gICAgdGhpcy5pbml0RXZlbnRzKClcbiAgICB0aGlzLmFjdGlvbnMoKVxuICB9XG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZm9sZGVyOiAoKSA9PlxuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInN0eWxlXCIsIFwid2lkdGg6MTZweDttYXJnaW4tcmlnaHQ6M3B4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAyNzYuMTU3IDI3Ni4xNTdcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMjczLjA4IDEwMS4zNzhjLTMuMy00LjY1LTguODYtNy4zMi0xNS4yNTQtNy4zMmgtMjQuMzRWNjcuNTljMC0xMC4yLTguMy0xOC41LTE4LjUtMTguNWgtODUuMzIyYy0zLjYzIDAtOS4yOTUtMi44NzUtMTEuNDM2LTUuODA1bC02LjM4Ni04LjczNWMtNC45ODItNi44MTQtMTUuMTA0LTExLjk1NC0yMy41NDYtMTEuOTU0SDU4LjczYy05LjI5MiAwLTE4LjYzOCA2LjYwOC0yMS43MzcgMTUuMzcybC0yLjAzMyA1Ljc1MmMtLjk1OCAyLjcxLTQuNzIgNS4zNy03LjU5NiA1LjM3SDE4LjVDOC4zIDQ5LjA5IDAgNTcuMzkgMCA2Ny41OXYxNjcuMDdjMCAuODg2LjE2IDEuNzMuNDQzIDIuNTIuMTUyIDMuMzA2IDEuMTggNi40MjQgMy4wNTMgOS4wNjQgMy4zIDQuNjUyIDguODYgNy4zMiAxNS4yNTUgNy4zMmgxODguNDg3YzExLjM5NSAwIDIzLjI3LTguNDI1IDI3LjAzNS0xOS4xOGw0MC42NzctMTE2LjE4OGMyLjExLTYuMDM1IDEuNDMtMTIuMTY0LTEuODctMTYuODE2ek0xOC41IDY0LjA4OGg4Ljg2NGM5LjI5NSAwIDE4LjY0LTYuNjA3IDIxLjczOC0xNS4zN2wyLjAzMi01Ljc1Yy45Ni0yLjcxMiA0LjcyMi01LjM3MyA3LjU5Ny01LjM3M2gyOS41NjVjMy42MyAwIDkuMjk1IDIuODc2IDExLjQzNyA1LjgwNmw2LjM4NiA4LjczNWM0Ljk4MiA2LjgxNSAxNS4xMDQgMTEuOTU0IDIzLjU0NiAxMS45NTRoODUuMzIyYzEuODk4IDAgMy41IDEuNjAyIDMuNSAzLjV2MjYuNDdINjkuMzRjLTExLjM5NSAwLTIzLjI3IDguNDIzLTI3LjAzNSAxOS4xNzhMMTUgMTkxLjIzVjY3LjU5YzAtMS44OTggMS42MDMtMy41IDMuNS0zLjV6bTI0Mi4yOSA0OS4xNWwtNDAuNjc2IDExNi4xODhjLTEuNjc0IDQuNzgtNy44MTIgOS4xMzUtMTIuODc3IDkuMTM1SDE4Ljc1Yy0xLjQ0NyAwLTIuNTc2LS4zNzItMy4wMi0uOTk3LS40NDItLjYyNS0uNDIyLTEuODE0LjA1Ny0zLjE4bDQwLjY3Ny0xMTYuMTljMS42NzQtNC43OCA3LjgxMi05LjEzNCAxMi44NzctOS4xMzRoMTg4LjQ4N2MxLjQ0OCAwIDIuNTc3LjM3MiAzLjAyLjk5Ny40NDMuNjI1LjQyMyAxLjgxNC0uMDU2IDMuMTh6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgICBcIixiZWwwLFwiXFxuICBcIl0pXG4gICAgICByZXR1cm4gYmVsMVxuICAgIH0oKSksXG4gIG11c2ljOiAoKSA9PlxuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMTYuMDAwMDAwcHRcIilcbmJlbDUuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIxNi4wMDAwMDBwdFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNDguMDAwMDAwIDQ4LjAwMDAwMFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInByZXNlcnZlQXNwZWN0UmF0aW9cIiwgXCJ4TWlkWU1pZCBtZWV0XCIpXG5iZWw1LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiY2xhc3NcIiwgXCJVcHB5SWNvblwiKVxudmFyIGJlbDQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZ1wiKVxuYmVsNC5zZXRBdHRyaWJ1dGUoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMC4wMDAwMDAsNDguMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApXCIpXG5iZWw0LnNldEF0dHJpYnV0ZShcImZpbGxcIiwgXCIjNTI1MDUwXCIpXG5iZWw0LnNldEF0dHJpYnV0ZShcInN0cm9rZVwiLCBcIm5vbmVcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yMDkgNDczIGMwIC01IDAgLTUyIDEgLTEwNiAxIC01NCAtMiAtMTE4IC02IC0xNDMgbC03IC00NiAtNDQgNVxcbiAgICBjLTczIDggLTEzMyAtNDYgLTEzMyAtMTIwIDAgLTE3IC01IC0zNSAtMTAgLTM4IC0xOCAtMTEgMCAtMjUgMzMgLTI0IDMwIDEgMzBcXG4gICAgMSA3IDggLTE1IDQgLTIwIDEwIC0xMyAxNCA2IDQgOSAxNiA2IDI3IC05IDM0IDcgNzAgNDAgOTAgMTcgMTEgMzkgMjAgNDcgMjBcXG4gICAgOCAwIC0zIC05IC0yNiAtMTkgLTQyIC0xOSAtNTQgLTM2IC01NCAtNzUgMCAtMzYgMzAgLTU2IDg0IC01NiA0MSAwIDUzIDUgODJcXG4gICAgMzQgMTkgMTkgMzQgMzEgMzQgMjcgMCAtNCAtNSAtMTIgLTEyIC0xOSAtOSAtOSAtMSAtMTIgMzkgLTEyIDEwNiAwIDE4MyAtMjFcXG4gICAgMTIxIC0zMyAtMTcgLTMgLTE0IC01IDEwIC02IDI1IC0xIDMyIDMgMzIgMTcgMCAyNiAtMjAgNDIgLTUxIDQyIC0zOSAwIC00M1xcbiAgICAxMyAtMTAgMzggNTYgNDEgNzYgMTI0IDQ1IDE4NSAtMjUgNDggLTcyIDEwNSAtMTAzIDEyMyAtMTUgOSAtMzYgMjkgLTQ3IDQ1XFxuICAgIC0xNyAyNiAtNjMgNDEgLTY1IDIyeiBtNTYgLTQ4IGMxNiAtMjQgMzEgLTQyIDM0IC0zOSA5IDkgNzkgLTY5IDc0IC04MyAtMyAtN1xcbiAgICAtMiAtMTMgMyAtMTIgMTggMyAyNSAtMSAxOSAtMTIgLTUgLTcgLTE2IC0yIC0zMyAxMyBsLTI2IDIzIDE2IC0yNSBjMTcgLTI3XFxuICAgIDI5IC05MiAxNiAtODQgLTQgMyAtOCAtOCAtOCAtMjUgMCAtMTYgNCAtMzMgMTAgLTM2IDUgLTMgNyAwIDQgOSAtMyA5IDMgMjBcXG4gICAgMTUgMjggMTMgOCAyMSAyNCAyMiA0MyAxIDE4IDMgMjMgNiAxMiAzIC0xMCAyIC0yOSAtMSAtNDMgLTcgLTI2IC02MiAtOTQgLTc3XFxuICAgIC05NCAtMTMgMCAtMTEgMTcgNCAzMiAyMSAxOSA0IDg4IC0yOCAxMTUgLTE0IDEzIC0yMiAyMyAtMTYgMjMgNSAwIDIxIC0xNCAzNVxcbiAgICAtMzEgMTQgLTE3IDI2IC0yNSAyNiAtMTkgMCAyMSAtNjAgNzIgLTc5IDY3IC0xNiAtNCAtMTcgLTEgLTggMzQgNiAyNCAxNCAzNlxcbiAgICAyMSAzMiA2IC0zIDEgNSAtMTEgMTggLTEyIDEzIC0yMiAyOSAtMjMgMzQgLTEgNiAtNiAxNyAtMTIgMjUgLTYgMTAgLTcgLTM5XFxuICAgIC00IC0xNDIgbDYgLTE1OCAtMjYgMTAgYy0zMyAxMyAtNDQgMTIgLTIxIC0xIDE3IC0xMCAyNCAtNDQgMTAgLTUyIC01IC0zIC0zOVxcbiAgICAtOCAtNzYgLTEyIC02OCAtNyAtNjkgLTcgLTY1IDE3IDQgMjggNjQgNjAgMTE3IDYyIGwzNiAxIDAgMTU3IGMwIDg3IDIgMTU4IDVcXG4gICAgMTU4IDMgMCAxOCAtMjAgMzUgLTQ1eiBtMTUgLTE1OSBjMCAtMiAtNyAtNyAtMTYgLTEwIC04IC0zIC0xMiAtMiAtOSA0IDYgMTBcXG4gICAgMjUgMTQgMjUgNnogbTUwIC05MiBjMCAtMTMgLTQgLTI2IC0xMCAtMjkgLTE0IC05IC0xMyAtNDggMiAtNjMgOSAtOSA2IC0xMlxcbiAgICAtMTUgLTEyIC0yMiAwIC0yNyA1IC0yNyAyNCAwIDE0IC00IDI4IC0xMCAzMSAtMTUgOSAtMTMgMTAyIDMgMTA4IDE4IDcgNTdcXG4gICAgLTMzIDU3IC01OXogbS0xMzkgLTEzNSBjLTMyIC0yNiAtMTIxIC0yNSAtMTIxIDIgMCA2IDggNSAxOSAtMSAyNiAtMTQgNjQgLTEzXFxuICAgIDU1IDEgLTQgOCAxIDkgMTYgNCAxMyAtNCAyMCAtMyAxNyAyIC0zIDUgNCAxMCAxNiAxMCAyMiAyIDIyIDIgLTIgLTE4elwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTMzMCAzNDUgYzE5IC0xOSAzNiAtMzUgMzkgLTM1IDMgMCAtMTAgMTYgLTI5IDM1IC0xOSAxOSAtMzYgMzUgLTM5XFxuICAgIDM1IC0zIDAgMTAgLTE2IDI5IC0zNXpcIilcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0zNDkgMTIzIGMtMTMgLTE2IC0xMiAtMTcgNCAtNCAxNiAxMyAyMSAyMSAxMyAyMSAtMiAwIC0xMCAtOCAtMTdcXG4gICAgLTE3elwiKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI0MyAxMyBjMTUgLTIgMzkgLTIgNTUgMCAxNSAyIDIgNCAtMjggNCAtMzAgMCAtNDMgLTIgLTI3IC00elwiKVxuYWMoYmVsNCwgW1wiXFxuICAgIFwiLGJlbDAsXCJcXG4gICAgXCIsYmVsMSxcIlxcbiAgICBcIixiZWwyLFwiXFxuICAgIFwiLGJlbDMsXCJcXG4gICAgXCJdKVxuYWMoYmVsNSwgW1wiXFxuICAgIFwiLGJlbDQsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDVcbiAgICB9KCkpLFxuICBwYWdlX3doaXRlX3BpY3R1cmU6ICgpID0+XG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMTAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMTAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjE2LjAwMDAwMHB0XCIpXG5iZWwxMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjE2LjAwMDAwMHB0XCIpXG5iZWwxMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgNDguMDAwMDAwIDM2LjAwMDAwMFwiKVxuYmVsMTAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsIFwieE1pZFlNaWQgbWVldFwiKVxuYmVsMTAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsOSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJnXCIpXG5iZWw5LnNldEF0dHJpYnV0ZShcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLjAwMDAwMCwzNi4wMDAwMDApIHNjYWxlKDAuMTAwMDAwLC0wLjEwMDAwMClcIilcbmJlbDkuc2V0QXR0cmlidXRlKFwiZmlsbFwiLCBcIiM1NjU1NTVcIilcbmJlbDkuc2V0QXR0cmlidXRlKFwic3Ryb2tlXCIsIFwibm9uZVwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTAgMTgwIGwwIC0xODAgMjQwIDAgMjQwIDAgMCAxODAgMCAxODAgLTI0MCAwIC0yNDAgMCAwIC0xODB6IG00NzBcXG4gICAgMCBsMCAtMTcwIC0yMzAgMCAtMjMwIDAgMCAxNzAgMCAxNzAgMjMwIDAgMjMwIDAgMCAtMTcwelwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTQwIDE4NSBsMCAtMTM1IDIwMCAwIDIwMCAwIDAgMTM1IDAgMTM1IC0yMDAgMCAtMjAwIDAgMCAtMTM1eiBtMzkwXFxuICAgIDU5IGwwIC02NSAtMjkgMjAgYy0zNyAyNyAtNDUgMjYgLTY1IC00IC05IC0xNCAtMjIgLTI1IC0yOCAtMjUgLTcgMCAtMjQgLTEyXFxuICAgIC0zOSAtMjYgLTI2IC0yNSAtMjggLTI1IC01MyAtOSAtMTcgMTEgLTI2IDEzIC0yNiA2IDAgLTcgLTQgLTkgLTEwIC02IC01IDNcXG4gICAgLTIyIC0yIC0zNyAtMTIgbC0yOCAtMTggMjAgMjcgYzExIDE1IDI2IDI1IDMzIDIzIDYgLTIgMTIgLTEgMTIgNCAwIDEwIC0zN1xcbiAgICAyMSAtNjUgMjAgLTE0IC0xIC0xMiAtMyA3IC04IGwyOCAtNiAtNTAgLTU1IC00OSAtNTUgMCAxMjYgMSAxMjYgMTg5IDEgMTg5IDJcXG4gICAgMCAtNjZ6IG0tMTYgLTczIGMxMSAtMTIgMTQgLTIxIDggLTIxIC02IDAgLTEzIDQgLTE3IDEwIC0zIDUgLTEyIDcgLTE5IDQgLThcXG4gICAgLTMgLTE2IDIgLTE5IDEzIC0zIDExIC00IDcgLTQgLTkgMSAtMTkgNiAtMjUgMTggLTIzIDE5IDQgNDYgLTIxIDM1IC0zMiAtNFxcbiAgICAtNCAtMTEgLTEgLTE2IDcgLTYgOCAtMTAgMTAgLTEwIDQgMCAtNiA3IC0xNyAxNSAtMjQgMjQgLTIwIDExIC0yNCAtNzYgLTI3XFxuICAgIC02OSAtMSAtODMgMSAtOTcgMTggLTkgMTAgLTIwIDE5IC0yNSAxOSAtNSAwIC00IC02IDIgLTE0IDE0IC0xNyAtNSAtMjYgLTU1XFxuICAgIC0yNiAtMzYgMCAtNDYgMTYgLTE3IDI3IDEwIDQgMjIgMTMgMjcgMjIgOCAxMyAxMCAxMiAxNyAtNCA3IC0xNyA4IC0xOCA4IC0yXFxuICAgIDEgMjMgMTEgMjIgNTUgLTggMzMgLTIyIDM1IC0yMyAyNiAtNSAtOSAxNiAtOCAyMCA1IDIwIDggMCAxNSA1IDE1IDExIDAgNSAtNFxcbiAgICA3IC0xMCA0IC01IC0zIC0xMCAtNCAtMTAgLTEgMCA0IDU5IDM2IDY3IDM2IDIgMCAxIC0xMCAtMiAtMjEgLTUgLTE1IC00IC0xOVxcbiAgICA1IC0xNCA2IDQgOSAxNyA2IDI4IC0xMiA0OSAyNyA1MyA2OCA4elwiKVxudmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTEwMCAyOTYgYzAgLTIgNyAtNyAxNiAtMTAgOCAtMyAxMiAtMiA5IDQgLTYgMTAgLTI1IDE0IC0yNSA2elwiKVxudmFyIGJlbDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI0MyAyOTMgYzkgLTIgMjMgLTIgMzAgMCA2IDMgLTEgNSAtMTggNSAtMTYgMCAtMjIgLTIgLTEyIC01elwiKVxudmFyIGJlbDQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDQuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTY1IDI4MCBjLTMgLTUgLTIgLTEwIDQgLTEwIDUgMCAxMyA1IDE2IDEwIDMgNiAyIDEwIC00IDEwIC01IDAgLTEzXFxuICAgIC00IC0xNiAtMTB6XCIpXG52YXIgYmVsNSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMTU1IDI3MCBjLTMgLTYgMSAtNyA5IC00IDE4IDcgMjEgMTQgNyAxNCAtNiAwIC0xMyAtNCAtMTYgLTEwelwiKVxudmFyIGJlbDYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDYuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTIzMyAyNTIgYy0xMyAtMiAtMjMgLTggLTIzIC0xMyAwIC03IC0xMiAtOCAtMzAgLTQgLTIyIDUgLTMwIDMgLTMwXFxuICAgIC03IDAgLTEwIC0yIC0xMCAtOSAxIC01IDggLTE5IDEyIC0zNSA5IC0xNCAtMyAtMjcgLTEgLTMwIDQgLTIgNSAtNCA0IC0zIC0zXFxuICAgIDIgLTYgNiAtMTAgMTAgLTEwIDMgMCAyMCAtNCAzNyAtOSAxOCAtNSAzMiAtNSAzNiAxIDMgNiAxMyA4IDIxIDUgMTMgLTUgMTEzXFxuICAgIDIxIDExMyAzMCAwIDMgLTE5IDIgLTU3IC00elwiKVxudmFyIGJlbDcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDcuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTI3NSAyMjAgYy0xMyAtNiAtMTUgLTkgLTUgLTkgOCAwIDIyIDQgMzAgOSAxOCAxMiAyIDEyIC0yNSAwelwiKVxudmFyIGJlbDggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTEzMiAyMyBjNTkgLTIgMTU4IC0yIDIyMCAwIDYyIDEgMTQgMyAtMTA3IDMgLTEyMSAwIC0xNzIgLTIgLTExM1xcbiAgICAtM3pcIilcbmFjKGJlbDksIFtcIlxcbiAgICBcIixiZWwwLFwiXFxuICAgIFwiLGJlbDEsXCJcXG4gICAgXCIsYmVsMixcIlxcbiAgICBcIixiZWwzLFwiXFxuICAgIFwiLGJlbDQsXCJcXG4gICAgXCIsYmVsNSxcIlxcbiAgICBcIixiZWw2LFwiXFxuICAgIFwiLGJlbDcsXCJcXG4gICAgXCIsYmVsOCxcIlxcbiAgICBcIl0pXG5hYyhiZWwxMCwgW1wiXFxuICAgIFwiLGJlbDksXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDEwXG4gICAgfSgpKSxcbiAgd29yZDogKCkgPT5cbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWw4ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjE2LjAwMDAwMHB0XCIpXG5iZWw4LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTYuMDAwMDAwcHRcIilcbmJlbDguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDQ4LjAwMDAwMCA0OC4wMDAwMDBcIilcbmJlbDguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsIFwieE1pZFlNaWQgbWVldFwiKVxuYmVsOC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWw3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImdcIilcbmJlbDcuc2V0QXR0cmlidXRlKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAuMDAwMDAwLDQ4LjAwMDAwMCkgc2NhbGUoMC4xMDAwMDAsLTAuMTAwMDAwKVwiKVxuYmVsNy5zZXRBdHRyaWJ1dGUoXCJmaWxsXCIsIFwiIzQyM2QzZFwiKVxuYmVsNy5zZXRBdHRyaWJ1dGUoXCJzdHJva2VcIiwgXCJub25lXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMCA0NjYgYzAgLTE1IDg3IC0yNiAyMTMgLTI2IGw3NyAwIDAgLTE0MCAwIC0xNDAgLTc3IDAgYy0xMDUgMFxcbiAgICAtMjEzIC0xMSAtMjEzIC0yMSAwIC01IDE1IC05IDM0IC05IDI1IDAgMzMgLTQgMzMgLTE3IDAgLTc0IDQgLTExMyAxMyAtMTEzIDZcXG4gICAgMCAxMCAzMiAxMCA3NSBsMCA3NSAxMDUgMCAxMDUgMCAwIDE1MCAwIDE1MCAtMTA1IDAgYy04NyAwIC0xMDUgMyAtMTA1IDE1IDBcXG4gICAgMTEgLTEyIDE1IC00NSAxNSAtMzEgMCAtNDUgLTQgLTQ1IC0xNHpcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xMjMgNDY4IGMtMiAtNSA1MCAtOCAxMTYgLTggbDEyMSAwIDAgLTUwIGMwIC00NiAtMiAtNTAgLTIzIC01MFxcbiAgICAtMTQgMCAtMjQgLTYgLTI0IC0xNSAwIC04IDQgLTE1IDkgLTE1IDQgMCA4IC0yMCA4IC00NSAwIC0yNSAtNCAtNDUgLTggLTQ1XFxuICAgIC01IDAgLTkgLTcgLTkgLTE1IDAgLTkgMTAgLTE1IDI0IC0xNSAyMiAwIDIzIDMgMjMgNzUgbDAgNzUgNTAgMCA1MCAwIDAgLTE3MFxcbiAgICAwIC0xNzAgLTE3NSAwIC0xNzUgMCAtMiA2MyBjLTIgNTkgLTIgNjAgLTUgMTMgLTMgLTI3IC0yIC02MCAyIC03MyBsNSAtMjNcXG4gICAgMTgzIDIgMTgyIDMgMiAyMTYgYzMgMjc1IDE5IDI1NCAtMTk0IDI1NCAtODUgMCAtMTU3IC0zIC0xNjAgLTd6IG0zMzcgLTg1IGMwXFxuICAgIC0yIC0xOCAtMyAtMzkgLTMgLTM5IDAgLTM5IDAgLTQzIDQ1IGwtMyA0NCA0MiAtNDEgYzI0IC0yMyA0MyAtNDMgNDMgLTQ1elxcbiAgICBtLTE5IDUwIGMxOSAtMjIgMjMgLTI5IDkgLTE4IC0zNiAzMCAtNTAgNDMgLTUwIDQ5IDAgMTEgNiA2IDQxIC0zMXpcIilcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk00IDMwMCBjMCAtNzQgMSAtMTA1IDMgLTY3IDIgMzcgMiA5NyAwIDEzNSAtMiAzNyAtMyA2IC0zIC02OHpcIilcbnZhciBiZWwzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwzLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yMCAzMDAgbDAgLTEzMSAxMjggMyAxMjcgMyAzIDEyOCAzIDEyNyAtMTMxIDAgLTEzMCAwIDAgLTEzMHogbTI1MFxcbiAgICAxMDAgYzAgLTE2IC03IC0yMCAtMzMgLTIwIC0zMSAwIC0zNCAtMiAtMzQgLTMxIDAgLTI4IDIgLTMwIDEzIC0xNCA4IDEwIDExXFxuICAgIDIyIDggMjYgLTMgNSAxIDkgOSA5IDExIDAgOSAtMTIgLTEyIC01MCAtMTQgLTI3IC0zMiAtNTAgLTM5IC01MCAtMTUgMCAtMzFcXG4gICAgMzggLTI2IDYzIDIgMTAgLTEgMTUgLTggMTEgLTYgLTQgLTkgLTEgLTYgNiAyIDggMTAgMTYgMTYgMTggOCAyIDEyIC0xMCAxMlxcbiAgICAtMzggMCAtMzggMiAtNDEgMTYgLTI5IDkgNyAxMiAxNSA3IDE2IC01IDIgLTcgMTcgLTUgMzMgNCAyNiAxIDMwIC0yMCAzMCAtMTdcXG4gICAgMCAtMjkgLTkgLTM5IC0yNyAtMjAgLTQxIC0yMiAtNTAgLTYgLTMwIDE0IDE3IDE1IDE2IDIwIC01IDQgLTEzIDIgLTQwIC0yXFxuICAgIC02MCAtOSAtMzcgLTggLTM4IDIwIC0zOCAyNiAwIDMzIDggNjQgNzAgMTkgMzkgMzcgNzAgNDAgNzAgMyAwIDUgLTQwIDUgLTkwXFxuICAgIGwwIC05MCAtMTIwIDAgLTEyMCAwIDAgMTIwIDAgMTIwIDEyMCAwIGMxMTMgMCAxMjAgLTEgMTIwIC0yMHpcIilcbnZhciBiZWw0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWw0LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk00MCAzNzEgYzAgLTYgNSAtMTMgMTAgLTE2IDYgLTMgMTAgLTM1IDEwIC03MSAwIC01NyAyIC02NCAyMCAtNjRcXG4gICAgMTMgMCAyNyAxNCA0MCA0MCAyNSA0OSAyNSA2MyAwIDMwIC0xOSAtMjUgLTM5IC0yMyAtMjQgMiA1IDcgNyAyMyA2IDM1IC0yIDExXFxuICAgIDIgMjQgNyAyOCAyMyAxMyA5IDI1IC0yOSAyNSAtMjIgMCAtNDAgLTQgLTQwIC05eiBtNTMgLTkgYy02IC00IC0xMyAtMjggLTE1XFxuICAgIC01MiBsLTMgLTQ1IC01IDUzIGMtNSA0NyAtMyA1MiAxNSA1MiAxMyAwIDE2IC0zIDggLTh6XCIpXG52YXIgYmVsNSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMzEzIDE2NSBjMCAtOSAxMCAtMTUgMjQgLTE1IDE0IDAgMjMgNiAyMyAxNSAwIDkgLTkgMTUgLTIzIDE1IC0xNFxcbiAgICAwIC0yNCAtNiAtMjQgLTE1elwiKVxudmFyIGJlbDYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDYuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTE4MCAxMDUgYzAgLTEyIDE3IC0xNSA5MCAtMTUgNzMgMCA5MCAzIDkwIDE1IDAgMTIgLTE3IDE1IC05MCAxNVxcbiAgICAtNzMgMCAtOTAgLTMgLTkwIC0xNXpcIilcbmFjKGJlbDcsIFtcIlxcbiAgICBcIixiZWwwLFwiXFxuICAgIFwiLGJlbDEsXCJcXG4gICAgXCIsYmVsMixcIlxcbiAgICBcIixiZWwzLFwiXFxuICAgIFwiLGJlbDQsXCJcXG4gICAgXCIsYmVsNSxcIlxcbiAgICBcIixiZWw2LFwiXFxuICAgIFwiXSlcbmFjKGJlbDgsIFtcIlxcbiAgICBcIixiZWw3LFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWw4XG4gICAgfSgpKSxcbiAgcG93ZXJwb2ludDogKCkgPT5cbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwxOSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxOS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMTYuMDAwMDAwcHRcIilcbmJlbDE5LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTYuMDAwMDAwcHRcIilcbmJlbDE5LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAxNi4wMDAwMDAgMTYuMDAwMDAwXCIpXG5iZWwxOS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInByZXNlcnZlQXNwZWN0UmF0aW9cIiwgXCJ4TWlkWU1pZCBtZWV0XCIpXG5iZWwxOS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWwxOCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJnXCIpXG5iZWwxOC5zZXRBdHRyaWJ1dGUoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMC4wMDAwMDAsMTQ0LjAwMDAwMCkgc2NhbGUoMC4xMDAwMDAsLTAuMTAwMDAwKVwiKVxuYmVsMTguc2V0QXR0cmlidXRlKFwiZmlsbFwiLCBcIiM0OTQ3NDdcIilcbmJlbDE4LnNldEF0dHJpYnV0ZShcInN0cm9rZVwiLCBcIm5vbmVcIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0wIDEzOTAgbDAgLTUwIDkzIDAgYzUwIDAgMTA5IC0zIDEzMCAtNiBsMzcgLTcgMCA1NyAwIDU2IC0xMzAgMFxcbiAgICAtMTMwIDAgMCAtNTB6XCIpXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNODcwIDE0MjUgYzAgLTggLTEyIC0xOCAtMjcgLTIyIGwtMjggLTYgMzAgLTkgYzE3IC01IDc1IC0xMCAxMzBcXG4gICAgLTEyIDg2IC0yIDEwMCAtNSA5OSAtMTkgMCAtMTAgLTEgLTgwIC0yIC0xNTcgbC0yIC0xNDAgLTY1IDAgYy02MCAwIC04MCAtOVxcbiAgICAtNTUgLTI1IDggLTUgNyAtMTEgLTEgLTIxIC0xNyAtMjAgMiAtMjUgMTEyIC0yNyBsOTQgLTIgMCA0MCAwIDQwIDEwMCA1IGM1NVxcbiAgICAzIDEwNCAzIDEwOCAtMSA4IC02IDExIC0xMDA4IDQgLTEwMTYgLTIgLTIgLTIzNiAtNCAtNTIwIC02IC0yODMgLTEgLTUxOSAtNVxcbiAgICAtNTIzIC05IC00IC00IC0xIC0xNCA2IC0yMyAxMSAtMTMgODIgLTE1IDU2MSAtMTUgbDU0OSAwIDAgNTcwIGMwIDU0MyAtMSA1NzBcXG4gICAgLTE4IDU3MCAtMTAgMCAtNTYgMzkgLTEwMyA4NiAtNDYgNDcgLTkzIDkwIC0xMDQgOTUgLTExIDYgMjIgLTMxIDczIC04MiA1MFxcbiAgICAtNTAgOTIgLTk1IDkyIC05OSAwIC0xNCAtMjMgLTE2IC0xMzYgLTEyIGwtMTExIDQgLTYgMTI0IGMtNiAxMTkgLTcgMTI2IC0zMlxcbiAgICAxNDUgLTE0IDEyIC0yMyAyNSAtMjAgMzAgNCA1IC0zOCA5IC05OSA5IC04NyAwIC0xMDYgLTMgLTEwNiAtMTV6XCIpXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMTE5MCAxNDI5IGMwIC0xNCAyMjUgLTIzOSAyMzkgLTIzOSA3IDAgMTEgMzAgMTEgODUgMCA3NyAtMiA4NSAtMTlcXG4gICAgODUgLTIxIDAgLTYxIDQ0IC02MSA2NiAwIDExIC0yMCAxNCAtODUgMTQgLTU1IDAgLTg1IC00IC04NSAtMTF6XCIpXG52YXIgYmVsMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMjgxIDEzMzEgYy0yNCAtMTYgNyAtMjMgMTI3IC0zMSAxMDAgLTYgMTA3IC03IDQ3IC05IC0zOCAtMSAtMTQyXFxuICAgIC04IC0yMjkgLTE0IGwtMTYwIC0xMiAtNyAtMjggYy0xMCAtMzcgLTE2IC02ODMgLTYgLTY5MyA0IC00IDEwIC00IDE1IDAgNCA0XFxuICAgIDggMTY2IDkgMzU5IGwyIDM1MiAzNTggLTMgMzU4IC0yIDUgLTM1MyBjMyAtMTkzIDIgLTM1NiAtMiAtMzYxIC0zIC00IC0xMzZcXG4gICAgLTggLTI5NSAtNyAtMjkwIDIgLTQyMyAtNCAtNDIzIC0yMCAwIC01IDMzIC05IDczIC05IDM5IDAgOTAgLTMgMTExIC03IGwzOVxcbiAgICAtNiAtNDUgLTE4IGMtMjYgLTEwIC05MCAtMjAgLTE1MSAtMjUgbC0xMDcgLTcgMCAtMzggYzAgLTM1IDMgLTM5IDI0IC0zOSAzNlxcbiAgICAwIDEyNiAtNDggMTI4IC02OCAxIC05IDIgLTQwIDMgLTY5IDIgLTI5IDYgLTkxIDEwIC0xMzggbDcgLTg1IDQ0IDAgNDQgMCAwXFxuICAgIDIxOSAwIDIyMCAzMTEgMSBjMTcyIDAgMzE0IDIgMzE4IDQgNSA0IDYgMzAxIDIgNzU5IGwtMSAxMzcgLTI5NyAwIGMtMTY0IDBcXG4gICAgLTMwNCAtNCAtMzEyIC05elwiKVxudmFyIGJlbDQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDQuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTIgODgwIGMtMSAtMjc2IDIgLTM3OCAxMCAtMzYwIDEyIDMwIDExIDY1NyAtMiA3MTAgLTUgMjEgLTggLTEyMVxcbiAgICAtOCAtMzUwelwiKVxudmFyIGJlbDUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDUuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTE0NSAxMTc4IGMtMyAtOCAtNCAtMTQxIC0zIC0yOTggbDMgLTI4NSAyOTUgMCAyOTUgMCAwIDI5NSAwIDI5NVxcbiAgICAtMjkzIDMgYy0yMzAgMiAtMjk0IDAgLTI5NyAtMTB6IG01NTMgLTI3IGMxMSAtNiAxMyAtNjAgMTEgLTI2MCAtMSAtMTM5IC02XFxuICAgIC0yNTQgLTkgLTI1NiAtNCAtMyAtMTI0IC02IC0yNjYgLTcgbC0yNTkgLTMgLTMgMjU1IGMtMSAxNDAgMCAyNjAgMyAyNjcgMyAxMFxcbiAgICA2MiAxMyAyNTcgMTMgMTM5IDAgMjU5IC00IDI2NiAtOXpcIilcbnZhciBiZWw2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWw2LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk00NDUgMTA5MCBsLTIxMCAtNSAtMyAtMzcgLTMgLTM4IDIyNSAwIDIyNiAwIDAgMzQgYzAgMTggLTYgMzcgLTEyXFxuICAgIDQyIC03IDUgLTEwNyA3IC0yMjMgNHpcIilcbnZhciBiZWw3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWw3LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yOTUgOTQwIGMtMyAtNiAxIC0xMiA5IC0xNSA5IC0zIDIzIC03IDMxIC0xMCAxMCAtMyAxNSAtMTggMTUgLTQ5XFxuICAgIDAgLTI1IDMgLTQ3IDggLTQ5IDE1IC05IDQ3IDExIDUyIDMzIDkgMzggMjggMzQgNDEgLTggMTAgLTM1IDkgLTQzIC03IC02NlxcbiAgICAtMjMgLTMxIC01MSAtMzQgLTU2IC00IC00IDMxIC0yNiAzNCAtMzggNCAtNSAtMTQgLTEyIC0yNiAtMTYgLTI2IC00IDAgLTIyXFxuICAgIDE2IC00MSAzNiAtMzMgMzUgLTM0IDQwIC0yOCA4NiA3IDQ4IDYgNTAgLTE2IDQ2IC0xOCAtMiAtMjMgLTkgLTIxIC0yMyAyIC0xMVxcbiAgICAzIC00OSAzIC04NSAwIC03MiA2IC04MyA2MCAtMTExIDU3IC0yOSA5NSAtMjUgMTQ0IDE1IDM3IDMxIDQ2IDM0IDgzIDI5IDQwXFxuICAgIC01IDQyIC01IDQyIDIxIDAgMjQgLTMgMjcgLTI3IDI0IC0yNCAtMyAtMjggMSAtMzEgMjUgLTMgMjQgMCAyOCAyMCAyNSAxMyAtMlxcbiAgICAyMyAyIDIzIDcgMCA2IC05IDkgLTIwIDggLTEzIC0yIC0yOCA5IC00NCAzMiAtMTMgMTkgLTMxIDM1IC00MSAzNSAtMTAgMCAtMjNcXG4gICAgNyAtMzAgMTUgLTE0IDE3IC0xMDUgMjEgLTExNSA1elwiKVxudmFyIGJlbDggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTUyMiA5MTkgYy0yOCAtMTEgLTIwIC0yOSAxNCAtMjkgMTQgMCAyNCA2IDI0IDE0IDAgMjEgLTExIDI1IC0zOFxcbiAgICAxNXpcIilcbnZhciBiZWw5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWw5LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk02MjMgOTIyIGMtNTMgLTUgLTQzIC0zMiAxMiAtMzIgMzIgMCA0NSA0IDQ1IDE0IDAgMTcgLTE2IDIyIC01NyAxOHpcIilcbnZhciBiZWwxMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMTAuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTU5NyA4NTQgYy0xMyAtMTQgNiAtMjQgNDQgLTI0IDI4IDAgMzkgNCAzOSAxNSAwIDExIC0xMSAxNSAtMzggMTVcXG4gICAgLTIxIDAgLTQyIC0zIC00NSAtNnpcIilcbnZhciBiZWwxMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMTEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTU5NyA3OTQgYy00IC00IC03IC0xOCAtNyAtMzEgMCAtMjEgNCAtMjMgNDYgLTIzIDQ0IDAgNDUgMSA0MiAyOFxcbiAgICAtMyAyMyAtOCAyNyAtMzggMzAgLTIwIDIgLTM5IDAgLTQzIC00elwiKVxudmFyIGJlbDEyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNOTg5IDg4MyBjLTM0IC00IC0zNyAtNiAtMzcgLTM3IDAgLTMyIDIgLTM0IDQ1IC00MCAyNSAtMyA3MiAtNiAxMDRcXG4gICAgLTYgbDU5IDAgMCA0NSAwIDQ1IC02NyAtMiBjLTM4IC0xIC04NCAtMyAtMTA0IC01elwiKVxudmFyIGJlbDEzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxMy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNOTkzIDcwMyBjLTQyIC00IC01NCAtMTUgLTMzIC0yOCA4IC01IDggLTExIDAgLTIwIC0xNiAtMjAgLTMgLTI0XFxuICAgIDEwNCAtMzEgbDk2IC03IDAgNDcgMCA0NiAtNjIgLTIgYy0zNSAtMSAtODIgLTMgLTEwNSAtNXpcIilcbnZhciBiZWwxNCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMTQuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTEwMDUgNTIzIGMtNTAgLTYgLTU5IC0xMiAtNDYgLTI2IDggLTEwIDcgLTE3IC0xIC0yNSAtNiAtNiAtOSAtMTRcXG4gICAgLTYgLTE3IDMgLTMgNTEgLTggMTA3IC0xMiBsMTAxIC02IDAgNDYgMCA0NyAtNjIgLTEgYy0zNSAtMSAtNzYgLTQgLTkzIC02elwiKVxudmFyIGJlbDE1ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxNS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNNTM3IDM0NCBjLTQgLTQgLTcgLTI1IC03IC00NiBsMCAtMzggNDYgMCA0NSAwIC0zIDQzIGMtMyA0MCAtNCA0MlxcbiAgICAtMzggNDUgLTIwIDIgLTM5IDAgLTQzIC00elwiKVxudmFyIGJlbDE2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxNi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNNzE0IDM0MSBjLTIgLTIgLTQgLTIyIC00IC00MyBsMCAtMzggMjI1IDAgMjI1IDAgMCA0NSAwIDQ2IC0yMjEgLTNcXG4gICAgYy0xMjEgLTIgLTIyMiAtNSAtMjI1IC03elwiKVxudmFyIGJlbDE3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxNy5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMzA0IDIwNSBjMCAtNjYgMSAtOTIgMyAtNTcgMiAzNCAyIDg4IDAgMTIwIC0yIDMxIC0zIDMgLTMgLTYzelwiKVxuYWMoYmVsMTgsIFtcIlxcbiAgICBcIixiZWwwLFwiXFxuICAgIFwiLGJlbDEsXCJcXG4gICAgXCIsYmVsMixcIlxcbiAgICBcIixiZWwzLFwiXFxuICAgIFwiLGJlbDQsXCJcXG4gICAgXCIsYmVsNSxcIlxcbiAgICBcIixiZWw2LFwiXFxuICAgIFwiLGJlbDcsXCJcXG4gICAgXCIsYmVsOCxcIlxcbiAgICBcIixiZWw5LFwiXFxuICAgIFwiLGJlbDEwLFwiXFxuICAgIFwiLGJlbDExLFwiXFxuICAgIFwiLGJlbDEyLFwiXFxuICAgIFwiLGJlbDEzLFwiXFxuICAgIFwiLGJlbDE0LFwiXFxuICAgIFwiLGJlbDE1LFwiXFxuICAgIFwiLGJlbDE2LFwiXFxuICAgIFwiLGJlbDE3LFwiXFxuICAgIFwiXSlcbmFjKGJlbDE5LCBbXCJcXG4gICAgXCIsYmVsMTgsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDE5XG4gICAgfSgpKSxcbiAgcGFnZV93aGl0ZTogKCkgPT5cbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWw2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDYuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjE2LjAwMDAwMHB0XCIpXG5iZWw2LnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiaGVpZ2h0XCIsIFwiMTYuMDAwMDAwcHRcIilcbmJlbDYuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDQ4LjAwMDAwMCA0OC4wMDAwMDBcIilcbmJlbDYuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsIFwieE1pZFlNaWQgbWVldFwiKVxuYmVsNi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb25cIilcbnZhciBiZWw1ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImdcIilcbmJlbDUuc2V0QXR0cmlidXRlKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAuMDAwMDAwLDQ4LjAwMDAwMCkgc2NhbGUoMC4xMDAwMDAsLTAuMTAwMDAwKVwiKVxuYmVsNS5zZXRBdHRyaWJ1dGUoXCJmaWxsXCIsIFwiIzAwMDAwMFwiKVxuYmVsNS5zZXRBdHRyaWJ1dGUoXCJzdHJva2VcIiwgXCJub25lXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMjAgMjQwIGMxIC0yMDIgMyAtMjQwIDE2IC0yNDAgMTIgMCAxNCAzOCAxNCAyNDAgMCAyMDggLTIgMjQwIC0xNVxcbiAgICAyNDAgLTEzIDAgLTE1IC0zMSAtMTUgLTI0MHpcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk03NSA0NzEgYy00IC04IDMyIC0xMSAxMTkgLTExIGwxMjYgMCAwIC01MCAwIC01MCA1MCAwIGMyOCAwIDUwIDVcXG4gICAgNTAgMTAgMCA2IC0xOCAxMCAtNDAgMTAgbC00MCAwIDAgNDIgMCA0MiA0MyAtMzkgNDIgLTQwIC00MyA0NSAtNDIgNDUgLTEyOSAzXFxuICAgIGMtODUgMiAtMTMxIDAgLTEzNiAtN3pcIilcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0zOTggNDM3IGw0MiAtNDMgMCAtMTk3IGMwIC0xNjggMiAtMTk3IDE1IC0xOTcgMTMgMCAxNSAyOSAxNSAxOThcXG4gICAgbDAgMTk4IC0zNiA0MiBjLTIxIDI1IC00NCA0MiAtNTcgNDIgLTE4IDAgLTE2IC02IDIxIC00M3pcIilcbnZhciBiZWwzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwzLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk05MiAzNTMgbDIgLTg4IDMgNzggNCA3NyA4OSAwIDg5IDAgOCAtNDIgYzggLTQzIDkgLTQzIDU1IC00NiA0NCAtM1xcbiAgICA0NyAtNSA1MSAtMzUgNCAtMzEgNCAtMzEgNSA2IGwyIDM3IC01MCAwIC01MCAwIDAgNTAgMCA1MCAtMTA1IDAgLTEwNSAwIDJcXG4gICAgLTg3elwiKVxudmFyIGJlbDQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDQuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTc1IDEwIGM4IC0xMyAzMzIgLTEzIDM0MCAwIDQgNyAtNTUgMTAgLTE3MCAxMCAtMTE1IDAgLTE3NCAtMyAtMTcwXFxuICAgIC0xMHpcIilcbmFjKGJlbDUsIFtcIlxcbiAgICBcIixiZWwwLFwiXFxuICAgIFwiLGJlbDEsXCJcXG4gICAgXCIsYmVsMixcIlxcbiAgICBcIixiZWwzLFwiXFxuICAgIFwiLGJlbDQsXCJcXG4gICAgXCJdKVxuYWMoYmVsNiwgW1wiXFxuICAgIFwiLGJlbDUsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDZcbiAgICB9KCkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuY29uc3QgUGx1Z2luID0gcmVxdWlyZSgnLi4vUGx1Z2luJylcblxuY29uc3QgUHJvdmlkZXIgPSByZXF1aXJlKCcuLi8uLi91cHB5LWJhc2Uvc3JjL3BsdWdpbnMvUHJvdmlkZXInKVxuXG5jb25zdCBWaWV3ID0gcmVxdWlyZSgnLi4vLi4vZ2VuZXJpYy1wcm92aWRlci12aWV3cy9pbmRleCcpXG5jb25zdCBpY29ucyA9IHJlcXVpcmUoJy4vaWNvbnMnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIERyb3Bib3ggZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy50eXBlID0gJ2FjcXVpcmVyJ1xuICAgIHRoaXMuaWQgPSAnRHJvcGJveCdcbiAgICB0aGlzLnRpdGxlID0gJ0Ryb3Bib3gnXG4gICAgdGhpcy5zdGF0ZUlkID0gJ2Ryb3Bib3gnXG4gICAgdGhpcy5pY29uID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwzLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIxMjhcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIxMThcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ2aWV3Qm94XCIsIFwiMCAwIDEyOCAxMThcIilcbmJlbDMuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMzguMTQ1Ljc3N0wxLjEwOCAyNC45NmwyNS42MDggMjAuNTA3IDM3LjM0NC0yMy4wNnpcIilcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xLjEwOCA2NS45NzVsMzcuMDM3IDI0LjE4M0w2NC4wNiA2OC41MjVsLTM3LjM0My0yMy4wNnpNNjQuMDYgNjguNTI1bDI1LjkxNyAyMS42MzMgMzcuMDM2LTI0LjE4My0yNS42MS0yMC41MXpcIilcbnZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0xMjcuMDE0IDI0Ljk2TDg5Ljk3Ny43NzYgNjQuMDYgMjIuNDA3bDM3LjM0NSAyMy4wNnpNNjQuMTM2IDczLjE4bC0yNS45OSAyMS41NjctMTEuMTIyLTcuMjYydjguMTQybDM3LjExMiAyMi4yNTYgMzcuMTE0LTIyLjI1NnYtOC4xNDJsLTExLjEyIDcuMjYyelwiKVxuYWMoYmVsMywgW1wiXFxuICAgICAgICBcIixiZWwwLFwiXFxuICAgICAgICBcIixiZWwxLFwiXFxuICAgICAgICBcIixiZWwyLFwiXFxuICAgICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDNcbiAgICB9KCkpXG5cbiAgICAvLyB3cml0aW5nIG91dCB0aGUga2V5IGV4cGxpY2l0bHkgZm9yIHJlYWRhYmlsaXR5IHRoZSBrZXkgdXNlZCB0byBzdG9yZVxuICAgIC8vIHRoZSBwcm92aWRlciBpbnN0YW5jZSBtdXN0IGJlIGVxdWFsIHRvIHRoaXMuaWQuXG4gICAgdGhpcy5Ecm9wYm94ID0gbmV3IFByb3ZpZGVyKHtcbiAgICAgIGhvc3Q6IHRoaXMub3B0cy5ob3N0LFxuICAgICAgcHJvdmlkZXI6ICdkcm9wYm94J1xuICAgIH0pXG5cbiAgICB0aGlzLmZpbGVzID0gW11cblxuICAgIC8vIFZpc3VhbFxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge31cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICB0aGlzLnZpZXcgPSBuZXcgVmlldyh0aGlzKVxuICAgIC8vIFNldCBkZWZhdWx0IHN0YXRlXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIC8vIHdyaXRpbmcgb3V0IHRoZSBrZXkgZXhwbGljaXRseSBmb3IgcmVhZGFiaWxpdHkgdGhlIGtleSB1c2VkIHRvIHN0b3JlXG4gICAgICAvLyB0aGUgcGx1Z2luIHN0YXRlIG11c3QgYmUgZXF1YWwgdG8gdGhpcy5zdGF0ZUlkLlxuICAgICAgZHJvcGJveDoge1xuICAgICAgICBhdXRoZW50aWNhdGVkOiBmYWxzZSxcbiAgICAgICAgZmlsZXM6IFtdLFxuICAgICAgICBmb2xkZXJzOiBbXSxcbiAgICAgICAgZGlyZWN0b3JpZXM6IFtdLFxuICAgICAgICBhY3RpdmVSb3c6IC0xLFxuICAgICAgICBmaWx0ZXJJbnB1dDogJydcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldFxuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMubW91bnQodGFyZ2V0LCBwbHVnaW4pXG5cbiAgICB0aGlzW3RoaXMuaWRdLmF1dGgoKVxuICAgICAgLnRoZW4oKGF1dGhlbnRpY2F0ZWQpID0+IHtcbiAgICAgICAgdGhpcy52aWV3LnVwZGF0ZVN0YXRlKHthdXRoZW50aWNhdGVkfSlcbiAgICAgICAgaWYgKGF1dGhlbnRpY2F0ZWQpIHtcbiAgICAgICAgICB0aGlzLnZpZXcuZ2V0Rm9sZGVyKClcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgIHJldHVyblxuICB9XG5cbiAgaXNGb2xkZXIgKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5pc19kaXJcbiAgfVxuXG4gIGdldEl0ZW1EYXRhIChpdGVtKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGl0ZW0sIHtzaXplOiBpdGVtLmJ5dGVzfSlcbiAgfVxuXG4gIGdldEl0ZW1JY29uIChpdGVtKSB7XG4gICAgdmFyIGljb24gPSBpY29uc1tpdGVtLmljb25dXG5cbiAgICBpZiAoIWljb24pIHtcbiAgICAgIGlmIChpdGVtLmljb24uc3RhcnRzV2l0aCgnZm9sZGVyJykpIHtcbiAgICAgICAgaWNvbiA9IGljb25zWydmb2xkZXInXVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWNvbiA9IGljb25zWydwYWdlX3doaXRlJ11cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGljb24oKVxuICB9XG5cbiAgZ2V0SXRlbVN1Ykxpc3QgKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5jb250ZW50c1xuICB9XG5cbiAgZ2V0SXRlbU5hbWUgKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5wYXRoLmxlbmd0aCA+IDEgPyBpdGVtLnBhdGguc3Vic3RyaW5nKDEpIDogaXRlbS5wYXRoXG4gIH1cblxuICBnZXRNaW1lVHlwZSAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLm1pbWVfdHlwZVxuICB9XG5cbiAgZ2V0SXRlbUlkIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0ucmV2XG4gIH1cblxuICBnZXRJdGVtUmVxdWVzdFBhdGggKGl0ZW0pIHtcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuZ2V0SXRlbU5hbWUoaXRlbSkpXG4gIH1cblxuICBnZXRJdGVtTW9kaWZpZWREYXRlIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0ubW9kaWZpZWRcbiAgfVxuXG4gIHJlbmRlciAoc3RhdGUpIHtcbiAgICByZXR1cm4gdGhpcy52aWV3LnJlbmRlcihzdGF0ZSlcbiAgfVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcbmNvbnN0IFBsdWdpbiA9IHJlcXVpcmUoJy4uL1BsdWdpbicpXG5cbmNvbnN0IFByb3ZpZGVyID0gcmVxdWlyZSgnLi4vLi4vdXBweS1iYXNlL3NyYy9wbHVnaW5zL1Byb3ZpZGVyJylcblxuY29uc3QgVmlldyA9IHJlcXVpcmUoJy4uLy4uL2dlbmVyaWMtcHJvdmlkZXItdmlld3MvaW5kZXgnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIEdvb2dsZSBleHRlbmRzIFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yIChjb3JlLCBvcHRzKSB7XG4gICAgc3VwZXIoY29yZSwgb3B0cylcbiAgICB0aGlzLnR5cGUgPSAnYWNxdWlyZXInXG4gICAgdGhpcy5pZCA9ICdHb29nbGVEcml2ZSdcbiAgICB0aGlzLnRpdGxlID0gJ0dvb2dsZSBEcml2ZSdcbiAgICB0aGlzLnN0YXRlSWQgPSAnZ29vZ2xlRHJpdmUnXG4gICAgdGhpcy5pY29uID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwic3ZnXCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwid2lkdGhcIiwgXCIyOFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjI4XCIpXG5iZWwxLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAxNiAxNlwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImNsYXNzXCIsIFwiVXBweUljb24gVXBweU1vZGFsVGFiLWljb25cIilcbnZhciBiZWwwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpXG5iZWwwLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwiZFwiLCBcIk0yLjk1NSAxNC45M2wyLjY2Ny00LjYySDE2bC0yLjY2NyA0LjYySDIuOTU1em0yLjM3OC00LjYybC0yLjY2NiA0LjYyTDAgMTAuMzFsNS4xOS04Ljk5IDIuNjY2IDQuNjItMi41MjMgNC4zN3ptMTAuNTIzLS4yNWgtNS4zMzNsLTUuMTktOC45OWg1LjMzNGw1LjE5IDguOTl6XCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgIFwiLGJlbDAsXCJcXG4gICAgICBcIl0pXG4gICAgICByZXR1cm4gYmVsMVxuICAgIH0oKSlcblxuICAgIC8vIHdyaXRpbmcgb3V0IHRoZSBrZXkgZXhwbGljaXRseSBmb3IgcmVhZGFiaWxpdHkgdGhlIGtleSB1c2VkIHRvIHN0b3JlXG4gICAgLy8gdGhlIHByb3ZpZGVyIGluc3RhbmNlIG11c3QgYmUgZXF1YWwgdG8gdGhpcy5pZC5cbiAgICB0aGlzLkdvb2dsZURyaXZlID0gbmV3IFByb3ZpZGVyKHtcbiAgICAgIGhvc3Q6IHRoaXMub3B0cy5ob3N0LFxuICAgICAgcHJvdmlkZXI6ICdkcml2ZScsXG4gICAgICBhdXRoUHJvdmlkZXI6ICdnb29nbGUnXG4gICAgfSlcblxuICAgIHRoaXMuZmlsZXMgPSBbXVxuXG4gICAgLy8gVmlzdWFsXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7fVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIHRoaXMudmlldyA9IG5ldyBWaWV3KHRoaXMpXG4gICAgLy8gU2V0IGRlZmF1bHQgc3RhdGUgZm9yIEdvb2dsZSBEcml2ZVxuICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7XG4gICAgICAvLyB3cml0aW5nIG91dCB0aGUga2V5IGV4cGxpY2l0bHkgZm9yIHJlYWRhYmlsaXR5IHRoZSBrZXkgdXNlZCB0byBzdG9yZVxuICAgICAgLy8gdGhlIHBsdWdpbiBzdGF0ZSBtdXN0IGJlIGVxdWFsIHRvIHRoaXMuc3RhdGVJZC5cbiAgICAgIGdvb2dsZURyaXZlOiB7XG4gICAgICAgIGF1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICBmaWxlczogW10sXG4gICAgICAgIGZvbGRlcnM6IFtdLFxuICAgICAgICBkaXJlY3RvcmllczogW10sXG4gICAgICAgIGFjdGl2ZVJvdzogLTEsXG4gICAgICAgIGZpbHRlcklucHV0OiAnJ1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcblxuICAgIHRoaXNbdGhpcy5pZF0uYXV0aCgpXG4gICAgICAudGhlbigoYXV0aGVudGljYXRlZCkgPT4ge1xuICAgICAgICB0aGlzLnZpZXcudXBkYXRlU3RhdGUoe2F1dGhlbnRpY2F0ZWR9KVxuICAgICAgICBpZiAoYXV0aGVudGljYXRlZCkge1xuICAgICAgICAgIHRoaXMudmlldy5nZXRGb2xkZXIoJ3Jvb3QnKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgcmV0dXJuXG4gIH1cblxuICBpc0ZvbGRlciAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLm1pbWVUeXBlID09PSAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLmZvbGRlcidcbiAgfVxuXG4gIGdldEl0ZW1EYXRhIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW1cbiAgfVxuXG4gIGdldEl0ZW1JY29uIChpdGVtKSB7XG4gICAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInNyY1wiLCBhcmd1bWVudHNbMF0pXG4gICAgICByZXR1cm4gYmVsMFxuICAgIH0oaXRlbS5pY29uTGluaykpXG4gIH1cblxuICBnZXRJdGVtU3ViTGlzdCAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0ZW1zXG4gIH1cblxuICBnZXRJdGVtTmFtZSAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLnRpdGxlXG4gIH1cblxuICBnZXRNaW1lVHlwZSAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLm1pbWVUeXBlXG4gIH1cblxuICBnZXRJdGVtSWQgKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5pZFxuICB9XG5cbiAgZ2V0SXRlbVJlcXVlc3RQYXRoIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SXRlbUlkKGl0ZW0pXG4gIH1cblxuICBnZXRJdGVtTW9kaWZpZWREYXRlIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0ubW9kaWZpZWRCeU1lRGF0ZVxuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIHJldHVybiB0aGlzLnZpZXcucmVuZGVyKHN0YXRlKVxuICB9XG59XG4iLCJjb25zdCBQbHVnaW4gPSByZXF1aXJlKCcuL1BsdWdpbicpXG5jb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuXG4vKipcbiAqIEluZm9ybWVyXG4gKiBTaG93cyByYWQgbWVzc2FnZSBidWJibGVzXG4gKiB1c2VkIGxpa2UgdGhpczogYGJ1cy5lbWl0KCdpbmZvcm1lcicsICdoZWxsbyB3b3JsZCcsICdpbmZvJywgNTAwMClgXG4gKiBvciBmb3IgZXJyb3JzOiBgYnVzLmVtaXQoJ2luZm9ybWVyJywgJ0Vycm9yIHVwbG9hZGluZyBpbWcuanBnJywgJ2Vycm9yJywgNTAwMClgXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIEluZm9ybWVyIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdwcm9ncmVzc2luZGljYXRvcidcbiAgICB0aGlzLmlkID0gJ0luZm9ybWVyJ1xuICAgIHRoaXMudGl0bGUgPSAnSW5mb3JtZXInXG4gICAgdGhpcy50aW1lb3V0SUQgPSB1bmRlZmluZWRcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHt9XG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuICB9XG5cbiAgc2hvd0luZm9ybWVyIChtc2csIHR5cGUsIGR1cmF0aW9uKSB7XG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIGluZm9ybWVyOiB7XG4gICAgICAgIGlzSGlkZGVuOiBmYWxzZSxcbiAgICAgICAgbXNnOiBtc2dcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRJRClcbiAgICBpZiAoZHVyYXRpb24gPT09IDApIHtcbiAgICAgIHRoaXMudGltZW91dElEID0gdW5kZWZpbmVkXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBoaWRlIHRoZSBpbmZvcm1lciBhZnRlciBgZHVyYXRpb25gIG1pbGxpc2Vjb25kc1xuICAgIHRoaXMudGltZW91dElEID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBjb25zdCBuZXdJbmZvcm1lciA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29yZS5nZXRTdGF0ZSgpLmluZm9ybWVyLCB7XG4gICAgICAgIGlzSGlkZGVuOiB0cnVlXG4gICAgICB9KVxuICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgICAgaW5mb3JtZXI6IG5ld0luZm9ybWVyXG4gICAgICB9KVxuICAgIH0sIGR1cmF0aW9uKVxuICB9XG5cbiAgaGlkZUluZm9ybWVyICgpIHtcbiAgICBjb25zdCBuZXdJbmZvcm1lciA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29yZS5nZXRTdGF0ZSgpLmluZm9ybWVyLCB7XG4gICAgICBpc0hpZGRlbjogdHJ1ZVxuICAgIH0pXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIGluZm9ybWVyOiBuZXdJbmZvcm1lclxuICAgIH0pXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgY29uc3QgbXNnID0gc3RhdGUuaW5mb3JtZXIubXNnXG4gICAgY29uc3QgaXNIaWRkZW4gPSBzdGF0ZS5pbmZvcm1lci5pc0hpZGRlblxuXG4gICAgLy8gQFRPRE8gYWRkIGFyaWEtbGl2ZSBmb3Igc2NyZWVuLXJlYWRlcnNcbiAgICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiYXJpYS1oaWRkZW5cIiwgYXJndW1lbnRzWzFdKVxuYmVsMS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlJbmZvcm1lclwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKVxuYWMoYmVsMCwgW2FyZ3VtZW50c1swXV0pXG5hYyhiZWwxLCBbXCJcXG4gICAgICBcIixiZWwwLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwxXG4gICAgfShtc2csaXNIaWRkZW4pKVxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgLy8gU2V0IGRlZmF1bHQgc3RhdGUgZm9yIEdvb2dsZSBEcml2ZVxuICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7XG4gICAgICBpbmZvcm1lcjoge1xuICAgICAgICBpc0hpZGRlbjogdHJ1ZSxcbiAgICAgICAgbXNnOiAnJ1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBidXMgPSB0aGlzLmNvcmUuYnVzXG5cbiAgICBidXMub24oJ2luZm9ybWVyJywgKG1zZywgdHlwZSwgZHVyYXRpb24pID0+IHtcbiAgICAgIHRoaXMuc2hvd0luZm9ybWVyKG1zZywgdHlwZSwgZHVyYXRpb24pXG4gICAgfSlcblxuICAgIGJ1cy5vbignaW5mb3JtZXI6aGlkZScsICgpID0+IHtcbiAgICAgIHRoaXMuaGlkZUluZm9ybWVyKClcbiAgICB9KVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldFxuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMubW91bnQodGFyZ2V0LCBwbHVnaW4pXG4gIH1cbn1cbiIsImNvbnN0IFBsdWdpbiA9IHJlcXVpcmUoJy4vUGx1Z2luJylcblxuLyoqXG4gKiBNZXRhIERhdGFcbiAqIEFkZHMgbWV0YWRhdGEgZmllbGRzIHRvIFVwcHlcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgTWV0YURhdGEgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy50eXBlID0gJ21vZGlmaWVyJ1xuICAgIHRoaXMuaWQgPSAnTWV0YURhdGEnXG4gICAgdGhpcy50aXRsZSA9ICdNZXRhIERhdGEnXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7fVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIGFkZEluaXRpYWxNZXRhICgpIHtcbiAgICBjb25zdCBtZXRhRmllbGRzID0gdGhpcy5vcHRzLmZpZWxkc1xuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1ldGFGaWVsZHM6IG1ldGFGaWVsZHNcbiAgICB9KVxuXG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2ZpbGUtYWRkZWQnLCAoZmlsZUlEKSA9PiB7XG4gICAgICBtZXRhRmllbGRzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3Qgb2JqID0ge31cbiAgICAgICAgb2JqW2l0ZW0uaWRdID0gaXRlbS52YWx1ZVxuICAgICAgICB0aGlzLmNvcmUudXBkYXRlTWV0YShvYmosIGZpbGVJRClcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIHRoaXMuYWRkSW5pdGlhbE1ldGEoKVxuICB9XG59XG4iLCJjb25zdCB5byA9IHJlcXVpcmUoJ3lvLXlvJylcblxuLyoqXG4gKiBCb2lsZXJwbGF0ZSB0aGF0IGFsbCBQbHVnaW5zIHNoYXJlIC0gYW5kIHNob3VsZCBub3QgYmUgdXNlZFxuICogZGlyZWN0bHkuIEl0IGFsc28gc2hvd3Mgd2hpY2ggbWV0aG9kcyBmaW5hbCBwbHVnaW5zIHNob3VsZCBpbXBsZW1lbnQvb3ZlcnJpZGUsXG4gKiB0aGlzIGRlY2lkaW5nIG9uIHN0cnVjdHVyZS5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gbWFpbiBVcHB5IGNvcmUgb2JqZWN0XG4gKiBAcGFyYW0ge29iamVjdH0gb2JqZWN0IHdpdGggcGx1Z2luIG9wdGlvbnNcbiAqIEByZXR1cm4ge2FycmF5IHwgc3RyaW5nfSBmaWxlcyBvciBzdWNjZXNzL2ZhaWwgbWVzc2FnZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIFBsdWdpbiB7XG5cbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICB0aGlzLmNvcmUgPSBjb3JlXG4gICAgdGhpcy5vcHRzID0gb3B0cyB8fCB7fVxuICAgIHRoaXMudHlwZSA9ICdub25lJ1xuXG4gICAgLy8gY2xlYXIgZXZlcnl0aGluZyBpbnNpZGUgdGhlIHRhcmdldCBzZWxlY3RvclxuICAgIHRoaXMub3B0cy5yZXBsYWNlVGFyZ2V0Q29udGVudCA9PT0gdGhpcy5vcHRzLnJlcGxhY2VUYXJnZXRDb250ZW50IHx8IHRydWVcblxuICAgIHRoaXMudXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKVxuICAgIHRoaXMubW91bnQgPSB0aGlzLm1vdW50LmJpbmQodGhpcylcbiAgICB0aGlzLmZvY3VzID0gdGhpcy5mb2N1cy5iaW5kKHRoaXMpXG4gICAgdGhpcy5pbnN0YWxsID0gdGhpcy5pbnN0YWxsLmJpbmQodGhpcylcbiAgfVxuXG4gIHVwZGF0ZSAoc3RhdGUpIHtcbiAgICBpZiAodHlwZW9mIHRoaXMuZWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBuZXdFbCA9IHRoaXMucmVuZGVyKHN0YXRlKVxuICAgIHlvLnVwZGF0ZSh0aGlzLmVsLCBuZXdFbClcblxuICAgIC8vIG9wdGltaXplcyBwZXJmb3JtYW5jZT9cbiAgICAvLyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgIC8vICAgY29uc3QgbmV3RWwgPSB0aGlzLnJlbmRlcihzdGF0ZSlcbiAgICAvLyAgIHlvLnVwZGF0ZSh0aGlzLmVsLCBuZXdFbClcbiAgICAvLyB9KVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHN1cHBsaWVkIGB0YXJnZXRgIGlzIGEgYHN0cmluZ2Agb3IgYW4gYG9iamVjdGAuXG4gICAqIElmIGl04oCZcyBhbiBvYmplY3Qg4oCUIHRhcmdldCBpcyBhIHBsdWdpbiwgYW5kIHdlIHNlYXJjaCBgcGx1Z2luc2BcbiAgICogZm9yIGEgcGx1Z2luIHdpdGggc2FtZSBuYW1lIGFuZCByZXR1cm4gaXRzIHRhcmdldC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSB0YXJnZXRcbiAgICpcbiAgICovXG4gIG1vdW50ICh0YXJnZXQsIHBsdWdpbikge1xuICAgIGNvbnN0IGNhbGxlclBsdWdpbk5hbWUgPSBwbHVnaW4uaWRcblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5jb3JlLmxvZyhgSW5zdGFsbGluZyAke2NhbGxlclBsdWdpbk5hbWV9IHRvICR7dGFyZ2V0fWApXG5cbiAgICAgIC8vIGNsZWFyIGV2ZXJ5dGhpbmcgaW5zaWRlIHRoZSB0YXJnZXQgY29udGFpbmVyXG4gICAgICBpZiAodGhpcy5vcHRzLnJlcGxhY2VUYXJnZXRDb250ZW50KSB7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0KS5pbm5lckhUTUwgPSAnJ1xuICAgICAgfVxuXG4gICAgICB0aGlzLmVsID0gcGx1Z2luLnJlbmRlcih0aGlzLmNvcmUuc3RhdGUpXG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRhcmdldCkuYXBwZW5kQ2hpbGQodGhpcy5lbClcblxuICAgICAgcmV0dXJuIHRhcmdldFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPOiBpcyBpbnN0YW50aWF0aW5nIHRoZSBwbHVnaW4gcmVhbGx5IHRoZSB3YXkgdG8gcm9sbFxuICAgICAgLy8ganVzdCB0byBnZXQgdGhlIHBsdWdpbiBuYW1lP1xuICAgICAgY29uc3QgVGFyZ2V0ID0gdGFyZ2V0XG4gICAgICBjb25zdCB0YXJnZXRQbHVnaW5OYW1lID0gbmV3IFRhcmdldCgpLmlkXG5cbiAgICAgIHRoaXMuY29yZS5sb2coYEluc3RhbGxpbmcgJHtjYWxsZXJQbHVnaW5OYW1lfSB0byAke3RhcmdldFBsdWdpbk5hbWV9YClcblxuICAgICAgY29uc3QgdGFyZ2V0UGx1Z2luID0gdGhpcy5jb3JlLmdldFBsdWdpbih0YXJnZXRQbHVnaW5OYW1lKVxuICAgICAgY29uc3Qgc2VsZWN0b3JUYXJnZXQgPSB0YXJnZXRQbHVnaW4uYWRkVGFyZ2V0KHBsdWdpbilcblxuICAgICAgcmV0dXJuIHNlbGVjdG9yVGFyZ2V0XG4gICAgfVxuICB9XG5cbiAgZm9jdXMgKCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgcmV0dXJuXG4gIH1cbn1cbiIsImNvbnN0IFBsdWdpbiA9IHJlcXVpcmUoJy4vUGx1Z2luJylcbmNvbnN0IHR1cyA9IHJlcXVpcmUoJ3R1cy1qcy1jbGllbnQnKVxuY29uc3QgVXBweVNvY2tldCA9IHJlcXVpcmUoJy4uL2NvcmUvVXBweVNvY2tldCcpXG5cbi8qKlxuICogVHVzIHJlc3VtYWJsZSBmaWxlIHVwbG9hZGVyXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIFR1czEwIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICd1cGxvYWRlcidcbiAgICB0aGlzLmlkID0gJ1R1cydcbiAgICB0aGlzLnRpdGxlID0gJ1R1cydcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHJlc3VtZTogdHJ1ZSxcbiAgICAgIGFsbG93UGF1c2U6IHRydWVcbiAgICB9XG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuICB9XG5cbiAgcGF1c2VSZXN1bWUgKGFjdGlvbiwgZmlsZUlEKSB7XG4gICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5jb3JlLmdldFN0YXRlKCkuZmlsZXMpXG4gICAgY29uc3QgaW5Qcm9ncmVzc1VwZGF0ZWRGaWxlcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gIXVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZSAmJlxuICAgICAgICAgICAgIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gICAgfSlcblxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlICd0b2dnbGUnOlxuICAgICAgICBpZiAodXBkYXRlZEZpbGVzW2ZpbGVJRF0udXBsb2FkQ29tcGxldGUpIHJldHVyblxuXG4gICAgICAgIGNvbnN0IHdhc1BhdXNlZCA9IHVwZGF0ZWRGaWxlc1tmaWxlSURdLmlzUGF1c2VkIHx8IGZhbHNlXG4gICAgICAgIGNvbnN0IGlzUGF1c2VkID0gIXdhc1BhdXNlZFxuICAgICAgICBsZXQgdXBkYXRlZEZpbGVcbiAgICAgICAgaWYgKHdhc1BhdXNlZCkge1xuICAgICAgICAgIHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sIHtcbiAgICAgICAgICAgIGlzUGF1c2VkOiBmYWxzZVxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSwge1xuICAgICAgICAgICAgaXNQYXVzZWQ6IHRydWVcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZWRGaWxlc1tmaWxlSURdID0gdXBkYXRlZEZpbGVcbiAgICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgICAgcmV0dXJuIGlzUGF1c2VkXG4gICAgICBjYXNlICdwYXVzZUFsbCc6XG4gICAgICAgIGluUHJvZ3Jlc3NVcGRhdGVkRmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVdLCB7XG4gICAgICAgICAgICBpc1BhdXNlZDogdHJ1ZVxuICAgICAgICAgIH0pXG4gICAgICAgICAgdXBkYXRlZEZpbGVzW2ZpbGVdID0gdXBkYXRlZEZpbGVcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICBjYXNlICdyZXN1bWVBbGwnOlxuICAgICAgICBpblByb2dyZXNzVXBkYXRlZEZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCB1cGRhdGVkRmlsZSA9IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlXSwge1xuICAgICAgICAgICAgaXNQYXVzZWQ6IGZhbHNlXG4gICAgICAgICAgfSlcbiAgICAgICAgICB1cGRhdGVkRmlsZXNbZmlsZV0gPSB1cGRhdGVkRmlsZVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuICAgICAgICByZXR1cm5cbiAgICB9XG4gIH1cblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgVHVzIHVwbG9hZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWxlIGZvciB1c2Ugd2l0aCB1cGxvYWRcbiAqIEBwYXJhbSB7aW50ZWdlcn0gY3VycmVudCBmaWxlIGluIGEgcXVldWVcbiAqIEBwYXJhbSB7aW50ZWdlcn0gdG90YWwgbnVtYmVyIG9mIGZpbGVzIGluIGEgcXVldWVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG4gIHVwbG9hZCAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICB0aGlzLmNvcmUubG9nKGB1cGxvYWRpbmcgJHtjdXJyZW50fSBvZiAke3RvdGFsfWApXG5cbiAgICAvLyBDcmVhdGUgYSBuZXcgdHVzIHVwbG9hZFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cGxvYWQgPSBuZXcgdHVzLlVwbG9hZChmaWxlLmRhdGEsIHtcblxuICAgICAgICAvLyBUT0RPIG1lcmdlIHRoaXMub3B0cyBvciB0aGlzLm9wdHMudHVzIGhlcmVcbiAgICAgICAgbWV0YWRhdGE6IGZpbGUubWV0YSxcbiAgICAgICAgcmVzdW1lOiB0aGlzLm9wdHMucmVzdW1lLFxuICAgICAgICBlbmRwb2ludDogdGhpcy5vcHRzLmVuZHBvaW50LFxuXG4gICAgICAgIG9uRXJyb3I6IChlcnIpID0+IHtcbiAgICAgICAgICB0aGlzLmNvcmUubG9nKGVycilcbiAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1lcnJvcicsIGZpbGUuaWQpXG4gICAgICAgICAgcmVqZWN0KCdGYWlsZWQgYmVjYXVzZTogJyArIGVycilcbiAgICAgICAgfSxcbiAgICAgICAgb25Qcm9ncmVzczogKGJ5dGVzVXBsb2FkZWQsIGJ5dGVzVG90YWwpID0+IHtcbiAgICAgICAgICAvLyBEaXNwYXRjaCBwcm9ncmVzcyBldmVudFxuICAgICAgICAgIGNvbnNvbGUubG9nKGJ5dGVzVXBsb2FkZWQsIGJ5dGVzVG90YWwpXG4gICAgICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQtcHJvZ3Jlc3MnLCB7XG4gICAgICAgICAgICB1cGxvYWRlcjogdGhpcyxcbiAgICAgICAgICAgIGlkOiBmaWxlLmlkLFxuICAgICAgICAgICAgYnl0ZXNVcGxvYWRlZDogYnl0ZXNVcGxvYWRlZCxcbiAgICAgICAgICAgIGJ5dGVzVG90YWw6IGJ5dGVzVG90YWxcbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgICBvblN1Y2Nlc3M6ICgpID0+IHtcbiAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1zdWNjZXNzJywgZmlsZS5pZCwgdXBsb2FkLnVybClcblxuICAgICAgICAgIHRoaXMuY29yZS5sb2coYERvd25sb2FkICR7dXBsb2FkLmZpbGUubmFtZX0gZnJvbSAke3VwbG9hZC51cmx9YClcbiAgICAgICAgICByZXNvbHZlKHVwbG9hZClcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2NvcmU6ZmlsZS1yZW1vdmUnLCAoZmlsZUlEKSA9PiB7XG4gICAgICAgIGlmIChmaWxlSUQgPT09IGZpbGUuaWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcgZmlsZTogJywgZmlsZUlEKVxuICAgICAgICAgIHVwbG9hZC5hYm9ydCgpXG4gICAgICAgICAgcmVzb2x2ZShgdXBsb2FkICR7ZmlsZUlEfSB3YXMgcmVtb3ZlZGApXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLm9uKCdjb3JlOnVwbG9hZC1wYXVzZScsIChmaWxlSUQpID0+IHtcbiAgICAgICAgaWYgKGZpbGVJRCA9PT0gZmlsZS5pZCkge1xuICAgICAgICAgIGNvbnN0IGlzUGF1c2VkID0gdGhpcy5wYXVzZVJlc3VtZSgndG9nZ2xlJywgZmlsZUlEKVxuICAgICAgICAgIGlzUGF1c2VkID8gdXBsb2FkLmFib3J0KCkgOiB1cGxvYWQuc3RhcnQoKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpwYXVzZS1hbGwnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZmlsZXNcbiAgICAgICAgaWYgKCFmaWxlc1tmaWxlLmlkXSkgcmV0dXJuXG4gICAgICAgIHVwbG9hZC5hYm9ydCgpXG4gICAgICB9KVxuXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpyZXN1bWUtYWxsJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmZpbGVzXG4gICAgICAgIGlmICghZmlsZXNbZmlsZS5pZF0pIHJldHVyblxuICAgICAgICB1cGxvYWQuc3RhcnQoKVxuICAgICAgfSlcblxuICAgICAgdXBsb2FkLnN0YXJ0KClcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6dXBsb2FkLXN0YXJ0ZWQnLCBmaWxlLmlkLCB1cGxvYWQpXG4gICAgfSlcbiAgfVxuXG4gIHVwbG9hZFJlbW90ZSAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmxvZyhmaWxlLnJlbW90ZS51cmwpXG4gICAgICBmZXRjaChmaWxlLnJlbW90ZS51cmwsIHtcbiAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoT2JqZWN0LmFzc2lnbih7fSwgZmlsZS5yZW1vdGUuYm9keSwge1xuICAgICAgICAgIGVuZHBvaW50OiB0aGlzLm9wdHMuZW5kcG9pbnQsXG4gICAgICAgICAgcHJvdG9jb2w6ICd0dXMnXG4gICAgICAgIH0pKVxuICAgICAgfSlcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcy5zdGF0dXMgPCAyMDAgJiYgcmVzLnN0YXR1cyA+IDMwMCkge1xuICAgICAgICAgIHJldHVybiByZWplY3QocmVzLnN0YXR1c1RleHQpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1zdGFydGVkJywgZmlsZS5pZClcblxuICAgICAgICByZXMuanNvbigpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAvLyBnZXQgdGhlIGhvc3QgZG9tYWluXG4gICAgICAgICAgdmFyIHJlZ2V4ID0gL14oPzpodHRwcz86XFwvXFwvfFxcL1xcLyk/KD86W15AXFwvXFxuXStAKT8oPzp3d3dcXC4pPyhbXlxcL1xcbl0rKS9cbiAgICAgICAgICB2YXIgaG9zdCA9IHJlZ2V4LmV4ZWMoZmlsZS5yZW1vdGUuaG9zdClbMV1cbiAgICAgICAgICB2YXIgc29ja2V0UHJvdG9jb2wgPSBsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyAnd3NzJyA6ICd3cydcblxuICAgICAgICAgIHZhciB0b2tlbiA9IGRhdGEudG9rZW5cbiAgICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFVwcHlTb2NrZXQoe1xuICAgICAgICAgICAgdGFyZ2V0OiBzb2NrZXRQcm90b2NvbCArIGA6Ly8ke2hvc3R9L2FwaS8ke3Rva2VufWBcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgc29ja2V0Lm9uKCdwcm9ncmVzcycsIChwcm9ncmVzc0RhdGEpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHtwcm9ncmVzcywgYnl0ZXNVcGxvYWRlZCwgYnl0ZXNUb3RhbH0gPSBwcm9ncmVzc0RhdGFcblxuICAgICAgICAgICAgaWYgKHByb2dyZXNzKSB7XG4gICAgICAgICAgICAgIHRoaXMuY29yZS5sb2coYFVwbG9hZCBwcm9ncmVzczogJHtwcm9ncmVzc31gKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhmaWxlLmlkKVxuXG4gICAgICAgICAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6dXBsb2FkLXByb2dyZXNzJywge1xuICAgICAgICAgICAgICAgIHVwbG9hZGVyOiB0aGlzLFxuICAgICAgICAgICAgICAgIGlkOiBmaWxlLmlkLFxuICAgICAgICAgICAgICAgIGJ5dGVzVXBsb2FkZWQ6IGJ5dGVzVXBsb2FkZWQsXG4gICAgICAgICAgICAgICAgYnl0ZXNUb3RhbDogYnl0ZXNUb3RhbFxuICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgIGlmIChwcm9ncmVzcyA9PT0gJzEwMC4wMCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1zdWNjZXNzJywgZmlsZS5pZClcbiAgICAgICAgICAgICAgICBzb2NrZXQuY2xvc2UoKVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICB1cGxvYWRGaWxlcyAoZmlsZXMpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMoZmlsZXMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5jb3JlLmxvZygnbm8gZmlsZXMgdG8gdXBsb2FkIScpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCB1cGxvYWRlcnMgPSBbXVxuICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gcGFyc2VJbnQoaW5kZXgsIDEwKSArIDFcbiAgICAgIGNvbnN0IHRvdGFsID0gZmlsZXMubGVuZ3RoXG5cbiAgICAgIGlmICghZmlsZS5pc1JlbW90ZSkge1xuICAgICAgICB1cGxvYWRlcnMucHVzaCh0aGlzLnVwbG9hZChmaWxlLCBjdXJyZW50LCB0b3RhbCkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB1cGxvYWRlcnMucHVzaCh0aGlzLnVwbG9hZFJlbW90ZShmaWxlLCBjdXJyZW50LCB0b3RhbCkpXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBQcm9taXNlLmFsbCh1cGxvYWRlcnMpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHRoaXMuY29yZS5sb2coJ0FsbCBmaWxlcyB1cGxvYWRlZCcpXG4gICAgICAgIHJldHVybiB7IHVwbG9hZGVkQ291bnQ6IGZpbGVzLmxlbmd0aCB9XG4gICAgICB9KVxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgdGhpcy5jb3JlLmxvZygnVXBsb2FkIGVycm9yOiAnICsgZXJyKVxuICAgICAgfSlcbiAgfVxuXG4gIHNlbGVjdEZvclVwbG9hZCAoZmlsZXMpIHtcbiAgICAvLyBUT0RPOiByZXBsYWNlIGZpbGVzW2ZpbGVdLmlzUmVtb3RlIHdpdGggc29tZSBsb2dpY1xuICAgIC8vXG4gICAgLy8gZmlsdGVyIGZpbGVzIHRoYXQgYXJlIG5vdyB5ZXQgYmVpbmcgdXBsb2FkZWQgLyBoYXZlbuKAmXQgYmVlbiB1cGxvYWRlZFxuICAgIC8vIGFuZCByZW1vdGUgdG9vXG4gICAgY29uc3QgZmlsZXNGb3JVcGxvYWQgPSBPYmplY3Qua2V5cyhmaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICBpZiAoIWZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWQgfHwgZmlsZXNbZmlsZV0uaXNSZW1vdGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0pLm1hcCgoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuIGZpbGVzW2ZpbGVdXG4gICAgfSlcblxuICAgIHRoaXMudXBsb2FkRmlsZXMoZmlsZXNGb3JVcGxvYWQpXG4gIH1cblxuICBhY3Rpb25zICgpIHtcbiAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpwYXVzZS1hbGwnLCAoKSA9PiB7XG4gICAgICB0aGlzLnBhdXNlUmVzdW1lKCdwYXVzZUFsbCcpXG4gICAgfSlcblxuICAgIHRoaXMuY29yZS5lbWl0dGVyLm9uKCdjb3JlOnJlc3VtZS1hbGwnLCAoKSA9PiB7XG4gICAgICB0aGlzLnBhdXNlUmVzdW1lKCdyZXN1bWVBbGwnKVxuICAgIH0pXG5cbiAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTp1cGxvYWQnLCAoKSA9PiB7XG4gICAgICB0aGlzLmNvcmUubG9nKCdUdXMgaXMgdXBsb2FkaW5nLi4uJylcbiAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZmlsZXNcbiAgICAgIHRoaXMuc2VsZWN0Rm9yVXBsb2FkKGZpbGVzKVxuICAgIH0pXG4gIH1cblxuICBhZGRSZXN1bWFibGVVcGxvYWRzQ2FwYWJpbGl0eUZsYWcgKCkge1xuICAgIGNvbnN0IG5ld0NhcGFiaWxpdGllcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29yZS5nZXRTdGF0ZSgpLmNhcGFiaWxpdGllcylcbiAgICBuZXdDYXBhYmlsaXRpZXMucmVzdW1hYmxlVXBsb2FkcyA9IHRydWVcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgY2FwYWJpbGl0aWVzOiBuZXdDYXBhYmlsaXRpZXNcbiAgICB9KVxuICB9XG5cbiAgaW5zdGFsbCAoKSB7XG4gICAgdGhpcy5hZGRSZXN1bWFibGVVcGxvYWRzQ2FwYWJpbGl0eUZsYWcoKVxuICAgIHRoaXMuYWN0aW9ucygpXG4gIH1cbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCd5by15bycpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgXG4gICAgICB2YXIgYWMgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbGliL2FwcGVuZENoaWxkLmpzJylcbiAgICAgIHZhciBiZWwyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJzdmdcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ3aWR0aFwiLCBcIjEwMFwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImhlaWdodFwiLCBcIjc3XCIpXG5iZWwyLnNldEF0dHJpYnV0ZU5TKG51bGwsIFwidmlld0JveFwiLCBcIjAgMCAxMDAgNzdcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNNTAgMzJjLTcuMTY4IDAtMTMgNS44MzItMTMgMTNzNS44MzIgMTMgMTMgMTMgMTMtNS44MzIgMTMtMTMtNS44MzItMTMtMTMtMTN6XCIpXG52YXIgYmVsMSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMS5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNODcgMTNINzJjMC03LjE4LTUuODItMTMtMTMtMTNINDFjLTcuMTggMC0xMyA1LjgyLTEzIDEzSDEzQzUuODIgMTMgMCAxOC44MiAwIDI2djM4YzAgNy4xOCA1LjgyIDEzIDEzIDEzaDc0YzcuMTggMCAxMy01LjgyIDEzLTEzVjI2YzAtNy4xOC01LjgyLTEzLTEzLTEzek01MCA2OGMtMTIuNjgzIDAtMjMtMTAuMzE4LTIzLTIzczEwLjMxNy0yMyAyMy0yMyAyMyAxMC4zMTggMjMgMjMtMTAuMzE3IDIzLTIzIDIzelwiKVxuYWMoYmVsMiwgW1wiXFxuICAgIFwiLGJlbDAsXCJcXG4gICAgXCIsYmVsMSxcIlxcbiAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDJcbiAgICB9KCkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgneW8teW8nKVxuY29uc3QgQ2FtZXJhSWNvbiA9IHJlcXVpcmUoJy4vQ2FtZXJhSWNvbicpXG5cbm1vZHVsZS5leHBvcnRzID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHNyYyA9IHByb3BzLnNyYyB8fCAnJ1xuICBsZXQgdmlkZW9cblxuICBpZiAocHJvcHMudXNlVGhlRmxhc2gpIHtcbiAgICB2aWRlbyA9IHByb3BzLmdldFNXRkhUTUwoKVxuICB9IGVsc2Uge1xuICAgIHZpZGVvID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgIFxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ2aWRlb1wiKVxuYmVsMC5zZXRBdHRyaWJ1dGUoXCJhdXRvcGxheVwiLCBcImF1dG9wbGF5XCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcInNyY1wiLCBhcmd1bWVudHNbMF0pXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweVdlYmNhbS12aWRlb1wiKVxuICAgICAgcmV0dXJuIGJlbDBcbiAgICB9KHNyYykpXG4gIH1cblxuICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBvbmxvYWQgPSByZXF1aXJlKCcvaG9tZS90cmF2aXMvYnVpbGQvdHJhbnNsb2FkaXQvdXBweS9ub2RlX21vZHVsZXMveW8teW9pZnkvbm9kZV9tb2R1bGVzL29uLWxvYWQvaW5kZXguanMnKVxuICAgICAgdmFyIGFjID0gcmVxdWlyZSgnL2hvbWUvdHJhdmlzL2J1aWxkL3RyYW5zbG9hZGl0L3VwcHkvbm9kZV9tb2R1bGVzL3lvLXlvaWZ5L2xpYi9hcHBlbmRDaGlsZC5qcycpXG4gICAgICB2YXIgYmVsNCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbnZhciBhcmdzID0gYXJndW1lbnRzXG4gICAgICBvbmxvYWQoYmVsNCwgZnVuY3Rpb24gYmVsX29ubG9hZCAoKSB7XG4gICAgICAgIGFyZ3NbM10oYmVsNClcbiAgICAgIH0sIGZ1bmN0aW9uIGJlbF9vbnVubG9hZCAoKSB7XG4gICAgICAgIGFyZ3NbNF0oYmVsNClcbiAgICAgIH0sIFwibzFcIilcbmJlbDQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5V2ViY2FtLWNvbnRhaW5lclwiKVxudmFyIGJlbDAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5iZWwwLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwiVXBweVdlYmNhbS12aWRlb0NvbnRhaW5lclwiKVxuYWMoYmVsMCwgW1wiXFxuICAgICAgICBcIixhcmd1bWVudHNbMF0sXCJcXG4gICAgICBcIl0pXG52YXIgYmVsMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbmJlbDIuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5V2ViY2FtLWJ1dHRvbkNvbnRhaW5lclwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5iZWwxLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJidXR0b25cIilcbmJlbDEuc2V0QXR0cmlidXRlKFwidGl0bGVcIiwgXCJUYWtlIGEgc25hcHNob3RcIilcbmJlbDEuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBcIlRha2UgYSBzbmFwc2hvdFwiKVxuYmVsMVtcIm9uY2xpY2tcIl0gPSBhcmd1bWVudHNbMV1cbmJlbDEuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJVcHB5QnV0dG9uLS1jaXJjdWxhciBVcHB5QnV0dG9uLS1yZWQgVXBweUJ1dHRvbi0tc2l6ZU0gVXBweVdlYmNhbS1zdG9wUmVjb3JkQnRuXCIpXG5hYyhiZWwxLCBbXCJcXG4gICAgICAgICAgXCIsYXJndW1lbnRzWzJdLFwiXFxuICAgICAgICBcIl0pXG5hYyhiZWwyLCBbXCJcXG4gICAgICAgIFwiLGJlbDEsXCJcXG4gICAgICBcIl0pXG52YXIgYmVsMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIilcbmJlbDMuc2V0QXR0cmlidXRlKFwic3R5bGVcIiwgXCJkaXNwbGF5OiBub25lO1wiKVxuYmVsMy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcIlVwcHlXZWJjYW0tY2FudmFzXCIpXG5hYyhiZWw0LCBbXCJcXG4gICAgICBcIixiZWwwLFwiXFxuICAgICAgXCIsYmVsMixcIlxcbiAgICAgIFwiLGJlbDMsXCJcXG4gICAgXCJdKVxuICAgICAgcmV0dXJuIGJlbDRcbiAgICB9KHZpZGVvLHByb3BzLm9uU25hcHNob3QsQ2FtZXJhSWNvbigpLChlbCkgPT4ge1xuICAgICAgcHJvcHMub25Gb2N1cygpXG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuVXBweVdlYmNhbS1zdG9wUmVjb3JkQnRuJykuZm9jdXMoKVxuICAgIH0sKGVsKSA9PiB7XG4gICAgICBwcm9wcy5vblN0b3AoKVxuICAgIH0pKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoMVwiKVxuYWMoYmVsMCwgW1wiUGxlYXNlIGFsbG93IGFjY2VzcyB0byB5b3VyIGNhbWVyYVwiXSlcbnZhciBiZWwxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIilcbmFjKGJlbDEsIFtcIllvdSBoYXZlIGJlZW4gcHJvbXB0ZWQgdG8gYWxsb3cgY2FtZXJhIGFjY2VzcyBmcm9tIHRoaXMgc2l0ZS4gSW4gb3JkZXIgdG8gdGFrZSBwaWN0dXJlcyB3aXRoIHlvdXIgY2FtZXJhIHlvdSBtdXN0IGFwcHJvdmUgdGhpcyByZXF1ZXN0LlwiXSlcbmFjKGJlbDIsIFtcIlxcbiAgICAgIFwiLGJlbDAsXCJcXG4gICAgICBcIixiZWwxLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwyXG4gICAgfSgpKVxufVxuIiwiY29uc3QgaHRtbCA9IHJlcXVpcmUoJ3lvLXlvJylcblxubW9kdWxlLmV4cG9ydHMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICBcbiAgICAgIHZhciBhYyA9IHJlcXVpcmUoJy9ob21lL3RyYXZpcy9idWlsZC90cmFuc2xvYWRpdC91cHB5L25vZGVfbW9kdWxlcy95by15b2lmeS9saWIvYXBwZW5kQ2hpbGQuanMnKVxuICAgICAgdmFyIGJlbDIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcIndpZHRoXCIsIFwiMThcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJoZWlnaHRcIiwgXCIyMVwiKVxuYmVsMi5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInZpZXdCb3hcIiwgXCIwIDAgMTggMjFcIilcbmJlbDIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJjbGFzc1wiLCBcIlVwcHlJY29uIFVwcHlNb2RhbFRhYi1pY29uXCIpXG52YXIgYmVsMCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicGF0aFwiKVxuYmVsMC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcImRcIiwgXCJNMTQuOCAxNi45YzEuOS0xLjcgMy4yLTQuMSAzLjItNi45IDAtNS00LTktOS05cy05IDQtOSA5YzAgMi44IDEuMiA1LjIgMy4yIDYuOUMxLjkgMTcuOS41IDE5LjQgMCAyMWgzYzEtMS45IDExLTEuOSAxMiAwaDNjLS41LTEuNi0xLjktMy4xLTMuMi00LjF6TTkgNGMzLjMgMCA2IDIuNyA2IDZzLTIuNyA2LTYgNi02LTIuNy02LTYgMi43LTYgNi02elwiKVxudmFyIGJlbDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIilcbmJlbDEuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJkXCIsIFwiTTkgMTRjMi4yIDAgNC0xLjggNC00cy0xLjgtNC00LTQtNCAxLjgtNCA0IDEuOCA0IDQgNHpNOCA4Yy42IDAgMSAuNCAxIDFzLS40IDEtMSAxLTEtLjQtMS0xYzAtLjUuNC0xIDEtMXpcIilcbmFjKGJlbDIsIFtcIlxcbiAgICAgIFwiLGJlbDAsXCJcXG4gICAgICBcIixiZWwxLFwiXFxuICAgIFwiXSlcbiAgICAgIHJldHVybiBiZWwyXG4gICAgfSgpKVxufVxuIiwiY29uc3QgUGx1Z2luID0gcmVxdWlyZSgnLi4vUGx1Z2luJylcbmNvbnN0IFdlYmNhbVByb3ZpZGVyID0gcmVxdWlyZSgnLi4vLi4vdXBweS1iYXNlL3NyYy9wbHVnaW5zL1dlYmNhbScpXG5jb25zdCB7IGV4dGVuZCB9ID0gcmVxdWlyZSgnLi4vLi4vY29yZS9VdGlscycpXG5jb25zdCBXZWJjYW1JY29uID0gcmVxdWlyZSgnLi9XZWJjYW1JY29uJylcbmNvbnN0IENhbWVyYVNjcmVlbiA9IHJlcXVpcmUoJy4vQ2FtZXJhU2NyZWVuJylcbmNvbnN0IFBlcm1pc3Npb25zU2NyZWVuID0gcmVxdWlyZSgnLi9QZXJtaXNzaW9uc1NjcmVlbicpXG5cbi8qKlxuICogV2ViY2FtXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgV2ViY2FtIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudXNlck1lZGlhID0gdHJ1ZVxuICAgIHRoaXMucHJvdG9jb2wgPSBsb2NhdGlvbi5wcm90b2NvbC5tYXRjaCgvaHR0cHMvaSkgPyAnaHR0cHMnIDogJ2h0dHAnXG4gICAgdGhpcy50eXBlID0gJ2FjcXVpcmVyJ1xuICAgIHRoaXMuaWQgPSAnV2ViY2FtJ1xuICAgIHRoaXMudGl0bGUgPSAnV2ViY2FtJ1xuICAgIHRoaXMuaWNvbiA9IFdlYmNhbUljb24oKVxuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgICAgZW5hYmxlRmxhc2g6IHRydWVcbiAgICB9XG5cbiAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgIHN3ZlVSTDogJ3dlYmNhbS5zd2YnLFxuICAgICAgd2lkdGg6IDQwMCxcbiAgICAgIGhlaWdodDogMzAwLFxuICAgICAgZGVzdF93aWR0aDogODAwLCAgICAgICAgIC8vIHNpemUgb2YgY2FwdHVyZWQgaW1hZ2VcbiAgICAgIGRlc3RfaGVpZ2h0OiA2MDAsICAgICAgICAvLyB0aGVzZSBkZWZhdWx0IHRvIHdpZHRoL2hlaWdodFxuICAgICAgaW1hZ2VfZm9ybWF0OiAnanBlZycsICAvLyBpbWFnZSBmb3JtYXQgKG1heSBiZSBqcGVnIG9yIHBuZylcbiAgICAgIGpwZWdfcXVhbGl0eTogOTAsICAgICAgLy8ganBlZyBpbWFnZSBxdWFsaXR5IGZyb20gMCAod29yc3QpIHRvIDEwMCAoYmVzdClcbiAgICAgIGVuYWJsZV9mbGFzaDogdHJ1ZSwgICAgLy8gZW5hYmxlIGZsYXNoIGZhbGxiYWNrLFxuICAgICAgZm9yY2VfZmxhc2g6IGZhbHNlLCAgICAvLyBmb3JjZSBmbGFzaCBtb2RlLFxuICAgICAgZmxpcF9ob3JpejogZmFsc2UsICAgICAvLyBmbGlwIGltYWdlIGhvcml6IChtaXJyb3IgbW9kZSlcbiAgICAgIGZwczogMzAsICAgICAgICAgICAgICAgLy8gY2FtZXJhIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICB1cGxvYWRfbmFtZTogJ3dlYmNhbScsIC8vIG5hbWUgb2YgZmlsZSBpbiB1cGxvYWQgcG9zdCBkYXRhXG4gICAgICBjb25zdHJhaW50czogbnVsbCwgICAgIC8vIGN1c3RvbSB1c2VyIG1lZGlhIGNvbnN0cmFpbnRzLFxuICAgICAgZmxhc2hOb3REZXRlY3RlZFRleHQ6ICdFUlJPUjogTm8gQWRvYmUgRmxhc2ggUGxheWVyIGRldGVjdGVkLiAgV2ViY2FtLmpzIHJlbGllcyBvbiBGbGFzaCBmb3IgYnJvd3NlcnMgdGhhdCBkbyBub3Qgc3VwcG9ydCBnZXRVc2VyTWVkaWEgKGxpa2UgeW91cnMpLicsXG4gICAgICBub0ludGVyZmFjZUZvdW5kVGV4dDogJ05vIHN1cHBvcnRlZCB3ZWJjYW0gaW50ZXJmYWNlIGZvdW5kLicsXG4gICAgICB1bmZyZWV6ZV9zbmFwOiB0cnVlICAgIC8vIFdoZXRoZXIgdG8gdW5mcmVlemUgdGhlIGNhbWVyYSBhZnRlciBzbmFwIChkZWZhdWx0cyB0byB0cnVlKVxuICAgIH1cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICB0aGlzLmluc3RhbGwgPSB0aGlzLmluc3RhbGwuYmluZCh0aGlzKVxuICAgIHRoaXMudXBkYXRlU3RhdGUgPSB0aGlzLnVwZGF0ZVN0YXRlLmJpbmQodGhpcylcblxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuXG4gICAgLy8gQ2FtZXJhIGNvbnRyb2xzXG4gICAgdGhpcy5zdGFydCA9IHRoaXMuc3RhcnQuYmluZCh0aGlzKVxuICAgIHRoaXMuc3RvcCA9IHRoaXMuc3RvcC5iaW5kKHRoaXMpXG4gICAgdGhpcy50YWtlU25hcHNob3QgPSB0aGlzLnRha2VTbmFwc2hvdC5iaW5kKHRoaXMpXG5cbiAgICB0aGlzLndlYmNhbSA9IG5ldyBXZWJjYW1Qcm92aWRlcih0aGlzLm9wdHMsIHRoaXMucGFyYW1zKVxuICAgIHRoaXMud2ViY2FtQWN0aXZlID0gZmFsc2VcbiAgfVxuXG4gIHN0YXJ0ICgpIHtcbiAgICB0aGlzLndlYmNhbUFjdGl2ZSA9IHRydWVcblxuICAgIHRoaXMud2ViY2FtLnN0YXJ0KClcbiAgICAgIC50aGVuKChzdHJlYW0pID0+IHtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBzdHJlYW1cbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZSh7XG4gICAgICAgICAgLy8gdmlkZW9TdHJlYW06IHN0cmVhbSxcbiAgICAgICAgICBjYW1lcmFSZWFkeTogdHJ1ZVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdGUoe1xuICAgICAgICAgIGNhbWVyYUVycm9yOiBlcnJcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gIH1cblxuICBzdG9wICgpIHtcbiAgICB0aGlzLnN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdLnN0b3AoKVxuICAgIHRoaXMud2ViY2FtQWN0aXZlID0gZmFsc2VcbiAgICB0aGlzLnN0cmVhbSA9IG51bGxcbiAgICB0aGlzLnN0cmVhbVNyYyA9IG51bGxcbiAgfVxuXG4gIHRha2VTbmFwc2hvdCAoKSB7XG4gICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgIG5hbWU6IGB3ZWJjYW0tJHtEYXRlLm5vdygpfS5qcGdgLFxuICAgICAgbWltZVR5cGU6ICdpbWFnZS9qcGVnJ1xuICAgIH1cblxuICAgIGNvbnN0IHZpZGVvID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlXZWJjYW0tdmlkZW8nKVxuXG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLndlYmNhbS5nZXRJbWFnZSh2aWRlbywgb3B0cylcblxuICAgIGNvbnN0IHRhZ0ZpbGUgPSB7XG4gICAgICBzb3VyY2U6IHRoaXMuaWQsXG4gICAgICBuYW1lOiBvcHRzLm5hbWUsXG4gICAgICBkYXRhOiBpbWFnZS5kYXRhLFxuICAgICAgdHlwZTogb3B0cy5taW1lVHlwZVxuICAgIH1cblxuICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6ZmlsZS1hZGQnLCB0YWdGaWxlKVxuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIGlmICghdGhpcy53ZWJjYW1BY3RpdmUpIHtcbiAgICAgIHRoaXMuc3RhcnQoKVxuICAgIH1cblxuICAgIGlmICghc3RhdGUud2ViY2FtLmNhbWVyYVJlYWR5ICYmICFzdGF0ZS53ZWJjYW0udXNlVGhlRmxhc2gpIHtcbiAgICAgIHJldHVybiBQZXJtaXNzaW9uc1NjcmVlbihzdGF0ZS53ZWJjYW0pXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnN0cmVhbVNyYykge1xuICAgICAgdGhpcy5zdHJlYW1TcmMgPSB0aGlzLnN0cmVhbSA/IFVSTC5jcmVhdGVPYmplY3RVUkwodGhpcy5zdHJlYW0pIDogbnVsbFxuICAgIH1cblxuICAgIHJldHVybiBDYW1lcmFTY3JlZW4oZXh0ZW5kKHN0YXRlLndlYmNhbSwge1xuICAgICAgb25TbmFwc2hvdDogdGhpcy50YWtlU25hcHNob3QsXG4gICAgICBvbkZvY3VzOiB0aGlzLmZvY3VzLFxuICAgICAgb25TdG9wOiB0aGlzLnN0b3AsXG4gICAgICBnZXRTV0ZIVE1MOiB0aGlzLndlYmNhbS5nZXRTV0ZIVE1MLFxuICAgICAgc3JjOiB0aGlzLnN0cmVhbVNyY1xuICAgIH0pKVxuICB9XG5cbiAgZm9jdXMgKCkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnaW5mb3JtZXInLCAnU21pbGUhJywgJ2luZm8nLCAyMDAwKVxuICAgIH0sIDEwMDApXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICB0aGlzLndlYmNhbS5pbml0KClcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgd2ViY2FtOiB7XG4gICAgICAgIGNhbWVyYVJlYWR5OiBmYWxzZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXR0bGUgc2hvcnRoYW5kIHRvIHVwZGF0ZSB0aGUgc3RhdGUgd2l0aCBteSBuZXcgc3RhdGVcbiAgICovXG4gIHVwZGF0ZVN0YXRlIChuZXdTdGF0ZSkge1xuICAgIGNvbnN0IHtzdGF0ZX0gPSB0aGlzLmNvcmVcbiAgICBjb25zdCB3ZWJjYW0gPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZS53ZWJjYW0sIG5ld1N0YXRlKVxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHt3ZWJjYW19KVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxucmVxdWlyZSgnd2hhdHdnLWZldGNoJylcblxuY29uc3QgX2dldE5hbWUgPSAoaWQpID0+IHtcbiAgcmV0dXJuIGlkLnNwbGl0KCctJykubWFwKChzKSA9PiBzLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcy5zbGljZSgxKSkuam9pbignICcpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgUHJvdmlkZXIge1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIHRoaXMub3B0cyA9IG9wdHNcbiAgICB0aGlzLnByb3ZpZGVyID0gb3B0cy5wcm92aWRlclxuICAgIHRoaXMuaWQgPSB0aGlzLnByb3ZpZGVyXG4gICAgdGhpcy5hdXRoUHJvdmlkZXIgPSBvcHRzLmF1dGhQcm92aWRlciB8fCB0aGlzLnByb3ZpZGVyXG4gICAgdGhpcy5uYW1lID0gdGhpcy5vcHRzLm5hbWUgfHwgX2dldE5hbWUodGhpcy5pZClcbiAgfVxuXG4gIGF1dGggKCkge1xuICAgIHJldHVybiBmZXRjaChgJHt0aGlzLm9wdHMuaG9zdH0vJHt0aGlzLmlkfS9hdXRoYCwge1xuICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24uanNvbidcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgIHJldHVybiByZXMuanNvbigpXG4gICAgICAudGhlbigocGF5bG9hZCkgPT4ge1xuICAgICAgICByZXR1cm4gcGF5bG9hZC5hdXRoZW50aWNhdGVkXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBsaXN0IChkaXJlY3RvcnkpIHtcbiAgICByZXR1cm4gZmV0Y2goYCR7dGhpcy5vcHRzLmhvc3R9LyR7dGhpcy5pZH0vbGlzdC8ke2RpcmVjdG9yeSB8fCAnJ31gLCB7XG4gICAgICBtZXRob2Q6ICdnZXQnLFxuICAgICAgY3JlZGVudGlhbHM6ICdpbmNsdWRlJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgfVxuICAgIH0pXG4gICAgLnRoZW4oKHJlcykgPT4gcmVzLmpzb24oKSlcbiAgfVxuXG4gIGxvZ291dCAocmVkaXJlY3QgPSBsb2NhdGlvbi5ocmVmKSB7XG4gICAgcmV0dXJuIGZldGNoKGAke3RoaXMub3B0cy5ob3N0fS8ke3RoaXMuaWR9L2xvZ291dD9yZWRpcmVjdD0ke3JlZGlyZWN0fWAsIHtcbiAgICAgIG1ldGhvZDogJ2dldCcsXG4gICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IGRhdGFVUkl0b0ZpbGUgPSByZXF1aXJlKCcuLi91dGlscy9kYXRhVVJJdG9GaWxlJylcblxuLyoqXG4gKiBXZWJjYW0gUGx1Z2luXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgV2ViY2FtIHtcbiAgY29uc3RydWN0b3IgKG9wdHMgPSB7fSwgcGFyYW1zID0ge30pIHtcbiAgICB0aGlzLl91c2VyTWVkaWFcbiAgICB0aGlzLnVzZXJNZWRpYSA9IHRydWVcbiAgICB0aGlzLnByb3RvY29sID0gbG9jYXRpb24ucHJvdG9jb2wubWF0Y2goL2h0dHBzL2kpID8gJ2h0dHBzJyA6ICdodHRwJ1xuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgICAgZW5hYmxlRmxhc2g6IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBkZWZhdWx0UGFyYW1zID0ge1xuICAgICAgc3dmVVJMOiAnd2ViY2FtLnN3ZicsXG4gICAgICB3aWR0aDogNDAwLFxuICAgICAgaGVpZ2h0OiAzMDAsXG4gICAgICBkZXN0X3dpZHRoOiA4MDAsICAgICAgICAgLy8gc2l6ZSBvZiBjYXB0dXJlZCBpbWFnZVxuICAgICAgZGVzdF9oZWlnaHQ6IDYwMCwgICAgICAgIC8vIHRoZXNlIGRlZmF1bHQgdG8gd2lkdGgvaGVpZ2h0XG4gICAgICBpbWFnZV9mb3JtYXQ6ICdqcGVnJywgIC8vIGltYWdlIGZvcm1hdCAobWF5IGJlIGpwZWcgb3IgcG5nKVxuICAgICAganBlZ19xdWFsaXR5OiA5MCwgICAgICAvLyBqcGVnIGltYWdlIHF1YWxpdHkgZnJvbSAwICh3b3JzdCkgdG8gMTAwIChiZXN0KVxuICAgICAgZW5hYmxlX2ZsYXNoOiB0cnVlLCAgICAvLyBlbmFibGUgZmxhc2ggZmFsbGJhY2ssXG4gICAgICBmb3JjZV9mbGFzaDogZmFsc2UsICAgIC8vIGZvcmNlIGZsYXNoIG1vZGUsXG4gICAgICBmbGlwX2hvcml6OiBmYWxzZSwgICAgIC8vIGZsaXAgaW1hZ2UgaG9yaXogKG1pcnJvciBtb2RlKVxuICAgICAgZnBzOiAzMCwgICAgICAgICAgICAgICAvLyBjYW1lcmEgZnJhbWVzIHBlciBzZWNvbmRcbiAgICAgIHVwbG9hZF9uYW1lOiAnd2ViY2FtJywgLy8gbmFtZSBvZiBmaWxlIGluIHVwbG9hZCBwb3N0IGRhdGFcbiAgICAgIGNvbnN0cmFpbnRzOiBudWxsLCAgICAgLy8gY3VzdG9tIHVzZXIgbWVkaWEgY29uc3RyYWludHMsXG4gICAgICBmbGFzaE5vdERldGVjdGVkVGV4dDogJ0VSUk9SOiBObyBBZG9iZSBGbGFzaCBQbGF5ZXIgZGV0ZWN0ZWQuICBXZWJjYW0uanMgcmVsaWVzIG9uIEZsYXNoIGZvciBicm93c2VycyB0aGF0IGRvIG5vdCBzdXBwb3J0IGdldFVzZXJNZWRpYSAobGlrZSB5b3VycykuJyxcbiAgICAgIG5vSW50ZXJmYWNlRm91bmRUZXh0OiAnTm8gc3VwcG9ydGVkIHdlYmNhbSBpbnRlcmZhY2UgZm91bmQuJyxcbiAgICAgIHVuZnJlZXplX3NuYXA6IHRydWUgICAgLy8gV2hldGhlciB0byB1bmZyZWV6ZSB0aGUgY2FtZXJhIGFmdGVyIHNuYXAgKGRlZmF1bHRzIHRvIHRydWUpXG4gICAgfVxuXG4gICAgdGhpcy5wYXJhbXMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0UGFyYW1zLCBwYXJhbXMpXG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuXG4gICAgLy8gQ2FtZXJhIGNvbnRyb2xzXG4gICAgdGhpcy5zdGFydCA9IHRoaXMuc3RhcnQuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5pdCA9IHRoaXMuaW5pdC5iaW5kKHRoaXMpXG4gICAgdGhpcy5zdG9wID0gdGhpcy5zdG9wLmJpbmQodGhpcylcbiAgICAvLyB0aGlzLnN0YXJ0UmVjb3JkaW5nID0gdGhpcy5zdGFydFJlY29yZGluZy5iaW5kKHRoaXMpXG4gICAgLy8gdGhpcy5zdG9wUmVjb3JkaW5nID0gdGhpcy5zdG9wUmVjb3JkaW5nLmJpbmQodGhpcylcbiAgICB0aGlzLnRha2VTbmFwc2hvdCA9IHRoaXMudGFrZVNuYXBzaG90LmJpbmQodGhpcylcbiAgICB0aGlzLmdldEltYWdlID0gdGhpcy5nZXRJbWFnZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRTV0ZIVE1MID0gdGhpcy5nZXRTV0ZIVE1MLmJpbmQodGhpcylcbiAgICB0aGlzLmRldGVjdEZsYXNoID0gdGhpcy5kZXRlY3RGbGFzaC5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRVc2VyTWVkaWEgPSB0aGlzLmdldFVzZXJNZWRpYS5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRNZWRpYURldmljZXMgPSB0aGlzLmdldE1lZGlhRGV2aWNlcy5iaW5kKHRoaXMpXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGZvciBnZXRVc2VyTWVkaWEgc3VwcG9ydFxuICAgKi9cbiAgaW5pdCAoKSB7XG4gICAgLy8gaW5pdGlhbGl6ZSwgY2hlY2sgZm9yIGdldFVzZXJNZWRpYSBzdXBwb3J0XG4gICAgdGhpcy5tZWRpYURldmljZXMgPSB0aGlzLmdldE1lZGlhRGV2aWNlcygpXG5cbiAgICB0aGlzLnVzZXJNZWRpYSA9IHRoaXMuZ2V0VXNlck1lZGlhKHRoaXMubWVkaWFEZXZpY2VzKVxuXG4gICAgLy8gTWFrZSBzdXJlIG1lZGlhIHN0cmVhbSBpcyBjbG9zZWQgd2hlbiBuYXZpZ2F0aW5nIGF3YXkgZnJvbSBwYWdlXG4gICAgaWYgKHRoaXMudXNlck1lZGlhKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgKGV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVkaWFEZXZpY2VzOiB0aGlzLm1lZGlhRGV2aWNlcyxcbiAgICAgIHVzZXJNZWRpYTogdGhpcy51c2VyTWVkaWFcbiAgICB9XG4gIH1cblxuICAvLyBTZXR1cCBnZXRVc2VyTWVkaWEsIHdpdGggcG9seWZpbGwgZm9yIG9sZGVyIGJyb3dzZXJzXG4gIC8vIEFkYXB0ZWQgZnJvbTogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL01lZGlhRGV2aWNlcy9nZXRVc2VyTWVkaWFcbiAgZ2V0TWVkaWFEZXZpY2VzICgpIHtcbiAgICByZXR1cm4gKG5hdmlnYXRvci5tZWRpYURldmljZXMgJiYgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEpXG4gICAgICA/IG5hdmlnYXRvci5tZWRpYURldmljZXMgOiAoKG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSkgPyB7XG4gICAgICAgIGdldFVzZXJNZWRpYTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgKG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHxcbiAgICAgICAgICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEpLmNhbGwobmF2aWdhdG9yLCBvcHRzLCByZXNvbHZlLCByZWplY3QpXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSA6IG51bGwpXG4gIH1cblxuICBnZXRVc2VyTWVkaWEgKG1lZGlhRGV2aWNlcykge1xuICAgIGNvbnN0IHVzZXJNZWRpYSA9IHRydWVcbiAgICAvLyBPbGRlciB2ZXJzaW9ucyBvZiBmaXJlZm94ICg8IDIxKSBhcHBhcmVudGx5IGNsYWltIHN1cHBvcnQgYnV0IHVzZXIgbWVkaWEgZG9lcyBub3QgYWN0dWFsbHkgd29ya1xuICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC9GaXJlZm94XFxEKyhcXGQrKS8pKSB7XG4gICAgICBpZiAocGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPCAyMSkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgIH1cblxuICAgIHdpbmRvdy5VUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkxcbiAgICByZXR1cm4gdXNlck1lZGlhICYmICEhbWVkaWFEZXZpY2VzICYmICEhd2luZG93LlVSTFxuICB9XG5cbiAgc3RhcnQgKCkge1xuICAgIHRoaXMudXNlck1lZGlhID0gdGhpcy5fdXNlck1lZGlhID09PSB1bmRlZmluZWQgPyB0aGlzLnVzZXJNZWRpYSA6IHRoaXMuX3VzZXJNZWRpYVxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodGhpcy51c2VyTWVkaWEpIHtcbiAgICAgICAgLy8gYXNrIHVzZXIgZm9yIGFjY2VzcyB0byB0aGVpciBjYW1lcmFcbiAgICAgICAgdGhpcy5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgICBhdWRpbzogZmFsc2UsXG4gICAgICAgICAgdmlkZW86IHRydWVcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKHN0cmVhbSkgPT4ge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKHN0cmVhbSlcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycilcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIERldGVjdHMgaWYgYnJvd3NlciBzdXBwb3J0cyBmbGFzaFxuICAgKiBDb2RlIHNuaXBwZXQgYm9ycm93ZWQgZnJvbTogaHR0cHM6Ly9naXRodWIuY29tL3N3Zm9iamVjdC9zd2ZvYmplY3RcbiAgICpcbiAgICogQHJldHVybiB7Ym9vbH0gZmxhc2ggc3VwcG9ydGVkXG4gICAqL1xuICBkZXRlY3RGbGFzaCAoKSB7XG4gICAgY29uc3QgU0hPQ0tXQVZFX0ZMQVNIID0gJ1Nob2Nrd2F2ZSBGbGFzaCdcbiAgICBjb25zdCBTSE9DS1dBVkVfRkxBU0hfQVggPSAnU2hvY2t3YXZlRmxhc2guU2hvY2t3YXZlRmxhc2gnXG4gICAgY29uc3QgRkxBU0hfTUlNRV9UWVBFID0gJ2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJ1xuICAgIGNvbnN0IHdpbiA9IHdpbmRvd1xuICAgIGNvbnN0IG5hdiA9IG5hdmlnYXRvclxuICAgIGxldCBoYXNGbGFzaCA9IGZhbHNlXG5cbiAgICBpZiAodHlwZW9mIG5hdi5wbHVnaW5zICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHZhciBkZXNjID0gbmF2LnBsdWdpbnNbU0hPQ0tXQVZFX0ZMQVNIXS5kZXNjcmlwdGlvblxuICAgICAgaWYgKGRlc2MgJiYgKHR5cGVvZiBuYXYubWltZVR5cGVzICE9PSAndW5kZWZpbmVkJyAmJiBuYXYubWltZVR5cGVzW0ZMQVNIX01JTUVfVFlQRV0gJiYgbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdLmVuYWJsZWRQbHVnaW4pKSB7XG4gICAgICAgIGhhc0ZsYXNoID0gdHJ1ZVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHdpbi5BY3RpdmVYT2JqZWN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIGF4ID0gbmV3IHdpbi5BY3RpdmVYT2JqZWN0KFNIT0NLV0FWRV9GTEFTSF9BWClcbiAgICAgICAgaWYgKGF4KSB7XG4gICAgICAgICAgdmFyIHZlciA9IGF4LkdldFZhcmlhYmxlKCckdmVyc2lvbicpXG4gICAgICAgICAgaWYgKHZlcikgaGFzRmxhc2ggPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc0ZsYXNoXG4gIH1cblxuICByZXNldCAoKSB7XG4gICAgLy8gc2h1dGRvd24gY2FtZXJhLCByZXNldCB0byBwb3RlbnRpYWxseSBhdHRhY2ggYWdhaW5cbiAgICBpZiAodGhpcy5wcmV2aWV3X2FjdGl2ZSkgdGhpcy51bmZyZWV6ZSgpXG5cbiAgICBpZiAodGhpcy51c2VyTWVkaWEpIHtcbiAgICAgIGlmICh0aGlzLnN0cmVhbSkge1xuICAgICAgICBpZiAodGhpcy5zdHJlYW0uZ2V0VmlkZW9UcmFja3MpIHtcbiAgICAgICAgICAvLyBnZXQgdmlkZW8gdHJhY2sgdG8gY2FsbCBzdG9wIG9uIGl0XG4gICAgICAgICAgdmFyIHRyYWNrcyA9IHRoaXMuc3RyZWFtLmdldFZpZGVvVHJhY2tzKClcbiAgICAgICAgICBpZiAodHJhY2tzICYmIHRyYWNrc1swXSAmJiB0cmFja3NbMF0uc3RvcCkgdHJhY2tzWzBdLnN0b3AoKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3RyZWFtLnN0b3ApIHtcbiAgICAgICAgICAvLyBkZXByZWNhdGVkLCBtYXkgYmUgcmVtb3ZlZCBpbiBmdXR1cmVcbiAgICAgICAgICB0aGlzLnN0cmVhbS5zdG9wKClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuc3RyZWFtXG4gICAgICBkZWxldGUgdGhpcy52aWRlb1xuICAgIH1cblxuICAgIGlmICh0aGlzLnVzZXJNZWRpYSAhPT0gdHJ1ZSkge1xuICAgICAgLy8gY2FsbCBmb3IgdHVybiBvZmYgY2FtZXJhIGluIGZsYXNoXG4gICAgICB0aGlzLmdldE1vdmllKCkuX3JlbGVhc2VDYW1lcmEoKVxuICAgIH1cbiAgfVxuXG4gIGdldFNXRkhUTUwgKCkge1xuICAgIC8vIFJldHVybiBIVE1MIGZvciBlbWJlZGRpbmcgZmxhc2ggYmFzZWQgd2ViY2FtIGNhcHR1cmUgbW92aWVcbiAgICB2YXIgc3dmVVJMID0gdGhpcy5wYXJhbXMuc3dmVVJMXG5cbiAgICAvLyBtYWtlIHN1cmUgd2UgYXJlbid0IHJ1bm5pbmcgbG9jYWxseSAoZmxhc2ggZG9lc24ndCB3b3JrKVxuICAgIGlmIChsb2NhdGlvbi5wcm90b2NvbC5tYXRjaCgvZmlsZS8pKSB7XG4gICAgICByZXR1cm4gJzxoMyBzdHlsZT1cImNvbG9yOnJlZFwiPkVSUk9SOiB0aGUgV2ViY2FtLmpzIEZsYXNoIGZhbGxiYWNrIGRvZXMgbm90IHdvcmsgZnJvbSBsb2NhbCBkaXNrLiAgUGxlYXNlIHJ1biBpdCBmcm9tIGEgd2ViIHNlcnZlci48L2gzPidcbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBmbGFzaFxuICAgIGlmICghdGhpcy5kZXRlY3RGbGFzaCgpKSB7XG4gICAgICByZXR1cm4gJzxoMyBzdHlsZT1cImNvbG9yOnJlZFwiPk5vIGZsYXNoPC9oMz4nXG4gICAgfVxuXG4gICAgLy8gc2V0IGRlZmF1bHQgc3dmVVJMIGlmIG5vdCBleHBsaWNpdGx5IHNldFxuICAgIGlmICghc3dmVVJMKSB7XG4gICAgICAvLyBmaW5kIG91ciBzY3JpcHQgdGFnLCBhbmQgdXNlIHRoYXQgYmFzZSBVUkxcbiAgICAgIHZhciBiYXNlX3VybCA9ICcnXG4gICAgICB2YXIgc2NwdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylcbiAgICAgIGZvciAodmFyIGlkeCA9IDAsIGxlbiA9IHNjcHRzLmxlbmd0aDsgaWR4IDwgbGVuOyBpZHgrKykge1xuICAgICAgICB2YXIgc3JjID0gc2NwdHNbaWR4XS5nZXRBdHRyaWJ1dGUoJ3NyYycpXG4gICAgICAgIGlmIChzcmMgJiYgc3JjLm1hdGNoKC9cXC93ZWJjYW0oXFwubWluKT9cXC5qcy8pKSB7XG4gICAgICAgICAgYmFzZV91cmwgPSBzcmMucmVwbGFjZSgvXFwvd2ViY2FtKFxcLm1pbik/XFwuanMuKiQvLCAnJylcbiAgICAgICAgICBpZHggPSBsZW5cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGJhc2VfdXJsKSBzd2ZVUkwgPSBiYXNlX3VybCArICcvd2ViY2FtLnN3ZidcbiAgICAgIGVsc2Ugc3dmVVJMID0gJ3dlYmNhbS5zd2YnXG4gICAgfVxuXG4gICAgLy8gLy8gaWYgdGhpcyBpcyB0aGUgdXNlcidzIGZpcnN0IHZpc2l0LCBzZXQgZmxhc2h2YXIgc28gZmxhc2ggcHJpdmFjeSBzZXR0aW5ncyBwYW5lbCBpcyBzaG93biBmaXJzdFxuICAgIC8vIGlmICh3aW5kb3cubG9jYWxTdG9yYWdlICYmICFsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndmlzaXRlZCcpKSB7XG4gICAgLy8gICAvLyB0aGlzLnBhcmFtcy5uZXdfdXNlciA9IDFcbiAgICAvLyAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd2aXNpdGVkJywgMSlcbiAgICAvLyB9XG4gICAgLy8gdGhpcy5wYXJhbXMubmV3X3VzZXIgPSAxXG4gICAgLy8gY29uc3RydWN0IGZsYXNodmFycyBzdHJpbmdcbiAgICB2YXIgZmxhc2h2YXJzID0gJydcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5wYXJhbXMpIHtcbiAgICAgIGlmIChmbGFzaHZhcnMpIGZsYXNodmFycyArPSAnJidcbiAgICAgIGZsYXNodmFycyArPSBrZXkgKyAnPScgKyBlc2NhcGUodGhpcy5wYXJhbXNba2V5XSlcbiAgICB9XG5cbiAgICAvLyBjb25zdHJ1Y3Qgb2JqZWN0L2VtYmVkIHRhZ1xuXG4gICAgcmV0dXJuIGA8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpkMjdjZGI2ZS1hZTZkLTExY2YtOTZiOC00NDQ1NTM1NDAwMDBcIiB0eXBlPVwiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIiBjb2RlYmFzZT1cIiR7dGhpcy5wcm90b2NvbH06Ly9kb3dubG9hZC5tYWNyb21lZGlhLmNvbS9wdWIvc2hvY2t3YXZlL2NhYnMvZmxhc2gvc3dmbGFzaC5jYWIjdmVyc2lvbj05LDAsMCwwXCIgd2lkdGg9XCIke3RoaXMucGFyYW1zLndpZHRofVwiIGhlaWdodD1cIiR7dGhpcy5wYXJhbXMuaGVpZ2h0fVwiIGlkPVwid2ViY2FtX21vdmllX29ialwiIGFsaWduPVwibWlkZGxlXCI+PHBhcmFtIG5hbWU9XCJ3bW9kZVwiIHZhbHVlPVwib3BhcXVlXCIgLz48cGFyYW0gbmFtZT1cImFsbG93U2NyaXB0QWNjZXNzXCIgdmFsdWU9XCJhbHdheXNcIiAvPjxwYXJhbSBuYW1lPVwiYWxsb3dGdWxsU2NyZWVuXCIgdmFsdWU9XCJmYWxzZVwiIC8+PHBhcmFtIG5hbWU9XCJtb3ZpZVwiIHZhbHVlPVwiJHtzd2ZVUkx9XCIgLz48cGFyYW0gbmFtZT1cImxvb3BcIiB2YWx1ZT1cImZhbHNlXCIgLz48cGFyYW0gbmFtZT1cIm1lbnVcIiB2YWx1ZT1cImZhbHNlXCIgLz48cGFyYW0gbmFtZT1cInF1YWxpdHlcIiB2YWx1ZT1cImJlc3RcIiAvPjxwYXJhbSBuYW1lPVwiYmdjb2xvclwiIHZhbHVlPVwiI2ZmZmZmZlwiIC8+PHBhcmFtIG5hbWU9XCJmbGFzaHZhcnNcIiB2YWx1ZT1cIiR7Zmxhc2h2YXJzfVwiLz48ZW1iZWQgaWQ9XCJ3ZWJjYW1fbW92aWVfZW1iZWRcIiBzcmM9XCIke3N3ZlVSTH1cIiB3bW9kZT1cIm9wYXF1ZVwiIGxvb3A9XCJmYWxzZVwiIG1lbnU9XCJmYWxzZVwiIHF1YWxpdHk9XCJiZXN0XCIgYmdjb2xvcj1cIiNmZmZmZmZcIiB3aWR0aD1cIiR7dGhpcy5wYXJhbXMud2lkdGh9XCIgaGVpZ2h0PVwiJHt0aGlzLnBhcmFtcy5oZWlnaHR9XCIgbmFtZT1cIndlYmNhbV9tb3ZpZV9lbWJlZFwiIGFsaWduPVwibWlkZGxlXCIgYWxsb3dTY3JpcHRBY2Nlc3M9XCJhbHdheXNcIiBhbGxvd0Z1bGxTY3JlZW49XCJmYWxzZVwiIHR5cGU9XCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiIHBsdWdpbnNwYWdlPVwiaHR0cDovL3d3dy5tYWNyb21lZGlhLmNvbS9nby9nZXRmbGFzaHBsYXllclwiIGZsYXNodmFycz1cIiR7Zmxhc2h2YXJzfVwiPjwvZW1iZWQ+PC9vYmplY3Q+YFxuICB9XG5cbiAgZ2V0TW92aWUgKCkge1xuICAgIC8vIGdldCByZWZlcmVuY2UgdG8gbW92aWUgb2JqZWN0L2VtYmVkIGluIERPTVxuICAgIHZhciBtb3ZpZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3ZWJjYW1fbW92aWVfb2JqJylcbiAgICBpZiAoIW1vdmllIHx8ICFtb3ZpZS5fc25hcCkgbW92aWUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2ViY2FtX21vdmllX2VtYmVkJylcbiAgICBpZiAoIW1vdmllKSBjb25zb2xlLmxvZygnZ2V0TW92aWUgZXJyb3InKVxuICAgIHJldHVybiBtb3ZpZVxuICB9XG5cbiAgLyoqXG4gICAqIFN0b3BzIHRoZSB3ZWJjYW0gY2FwdHVyZSBhbmQgdmlkZW8gcGxheWJhY2suXG4gICAqL1xuICBzdG9wICgpIHtcbiAgICBsZXQgeyB2aWRlbywgdmlkZW9TdHJlYW0gfSA9IHRoaXNcblxuICAgIHRoaXMudXBkYXRlU3RhdGUoe1xuICAgICAgY2FtZXJhUmVhZHk6IGZhbHNlXG4gICAgfSlcblxuICAgIGlmICh2aWRlb1N0cmVhbSkge1xuICAgICAgaWYgKHZpZGVvU3RyZWFtLnN0b3ApIHtcbiAgICAgICAgdmlkZW9TdHJlYW0uc3RvcCgpXG4gICAgICB9IGVsc2UgaWYgKHZpZGVvU3RyZWFtLm1zU3RvcCkge1xuICAgICAgICB2aWRlb1N0cmVhbS5tc1N0b3AoKVxuICAgICAgfVxuXG4gICAgICB2aWRlb1N0cmVhbS5vbmVuZGVkID0gbnVsbFxuICAgICAgdmlkZW9TdHJlYW0gPSBudWxsXG4gICAgfVxuXG4gICAgaWYgKHZpZGVvKSB7XG4gICAgICB2aWRlby5vbmVycm9yID0gbnVsbFxuICAgICAgdmlkZW8ucGF1c2UoKVxuXG4gICAgICBpZiAodmlkZW8ubW96U3JjT2JqZWN0KSB7XG4gICAgICAgIHZpZGVvLm1velNyY09iamVjdCA9IG51bGxcbiAgICAgIH1cblxuICAgICAgdmlkZW8uc3JjID0gJydcbiAgICB9XG5cbiAgICB0aGlzLnZpZGVvID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlXZWJjYW0tdmlkZW8nKVxuICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlXZWJjYW0tY2FudmFzJylcbiAgfVxuXG4gIGZsYXNoTm90aWZ5ICh0eXBlLCBtc2cpIHtcbiAgICAvLyByZWNlaXZlIG5vdGlmaWNhdGlvbiBmcm9tIGZsYXNoIGFib3V0IGV2ZW50XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdmbGFzaExvYWRDb21wbGV0ZSc6XG4gICAgICAgIC8vIG1vdmllIGxvYWRlZCBzdWNjZXNzZnVsbHlcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSAnY2FtZXJhTGl2ZSc6XG4gICAgICAgIC8vIGNhbWVyYSBpcyBsaXZlIGFuZCByZWFkeSB0byBzbmFwXG4gICAgICAgIHRoaXMubGl2ZSA9IHRydWVcbiAgICAgICAgYnJlYWtcblxuICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAvLyBGbGFzaCBlcnJvclxuICAgICAgICBjb25zb2xlLmxvZygnVGhlcmUgd2FzIGEgZmxhc2ggZXJyb3InLCBtc2cpXG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIGNhdGNoLWFsbCBldmVudCwganVzdCBpbiBjYXNlXG4gICAgICAgIGNvbnNvbGUubG9nKCd3ZWJjYW0gZmxhc2hfbm90aWZ5OiAnICsgdHlwZSArICc6ICcgKyBtc2cpXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgY29uZmlndXJlIChwYW5lbCkge1xuICAgIC8vIG9wZW4gZmxhc2ggY29uZmlndXJhdGlvbiBwYW5lbCAtLSBzcGVjaWZ5IHRhYiBuYW1lOlxuICAgIC8vICdjYW1lcmEnLCAncHJpdmFjeScsICdkZWZhdWx0JywgJ2xvY2FsU3RvcmFnZScsICdtaWNyb3Bob25lJywgJ3NldHRpbmdzTWFuYWdlcidcbiAgICBpZiAoIXBhbmVsKSBwYW5lbCA9ICdjYW1lcmEnXG4gICAgdGhpcy5nZXRNb3ZpZSgpLl9jb25maWd1cmUocGFuZWwpXG4gIH1cblxuICAvKipcbiAgICogVGFrZXMgYSBzbmFwc2hvdCBhbmQgZGlzcGxheXMgaXQgaW4gYSBjYW52YXMuXG4gICAqL1xuICBnZXRJbWFnZSAodmlkZW8sIG9wdHMpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICBjYW52YXMud2lkdGggPSB2aWRlby52aWRlb1dpZHRoXG4gICAgY2FudmFzLmhlaWdodCA9IHZpZGVvLnZpZGVvSGVpZ2h0XG4gICAgY2FudmFzLmdldENvbnRleHQoJzJkJykuZHJhd0ltYWdlKHZpZGVvLCAwLCAwKVxuXG4gICAgdmFyIGRhdGFVcmwgPSBjYW52YXMudG9EYXRhVVJMKG9wdHMubWltZVR5cGUpXG5cbiAgICB2YXIgZmlsZSA9IGRhdGFVUkl0b0ZpbGUoZGF0YVVybCwge1xuICAgICAgbmFtZTogb3B0cy5uYW1lXG4gICAgfSlcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhVXJsOiBkYXRhVXJsLFxuICAgICAgZGF0YTogZmlsZSxcbiAgICAgIHR5cGU6IG9wdHMubWltZVR5cGVcbiAgICB9XG4gIH1cblxuICB0YWtlU25hcHNob3QgKHZpZGVvLCBjYW52YXMpIHtcbiAgICBjb25zdCBvcHRzID0ge1xuICAgICAgbmFtZTogYHdlYmNhbS0ke0RhdGUubm93KCl9LmpwZ2AsXG4gICAgICBtaW1lVHlwZTogJ2ltYWdlL2pwZWcnXG4gICAgfVxuXG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmdldEltYWdlKHZpZGVvLCBjYW52YXMsIG9wdHMpXG5cbiAgICBjb25zdCB0YWdGaWxlID0ge1xuICAgICAgc291cmNlOiB0aGlzLmlkLFxuICAgICAgbmFtZTogb3B0cy5uYW1lLFxuICAgICAgZGF0YTogaW1hZ2UuZGF0YSxcbiAgICAgIHR5cGU6IG9wdHMudHlwZVxuICAgIH1cblxuICAgIHJldHVybiB0YWdGaWxlXG4gIH1cbn1cbiIsImZ1bmN0aW9uIGRhdGFVUkl0b0Jsb2IgKGRhdGFVUkksIG9wdHMsIHRvRmlsZSkge1xuICAvLyBnZXQgdGhlIGJhc2U2NCBkYXRhXG4gIHZhciBkYXRhID0gZGF0YVVSSS5zcGxpdCgnLCcpWzFdXG5cbiAgLy8gdXNlciBtYXkgcHJvdmlkZSBtaW1lIHR5cGUsIGlmIG5vdCBnZXQgaXQgZnJvbSBkYXRhIFVSSVxuICB2YXIgbWltZVR5cGUgPSBvcHRzLm1pbWVUeXBlIHx8IGRhdGFVUkkuc3BsaXQoJywnKVswXS5zcGxpdCgnOicpWzFdLnNwbGl0KCc7JylbMF1cblxuICAvLyBkZWZhdWx0IHRvIHBsYWluL3RleHQgaWYgZGF0YSBVUkkgaGFzIG5vIG1pbWVUeXBlXG4gIGlmIChtaW1lVHlwZSA9PSBudWxsKSB7XG4gICAgbWltZVR5cGUgPSAncGxhaW4vdGV4dCdcbiAgfVxuXG4gIHZhciBiaW5hcnkgPSBhdG9iKGRhdGEpXG4gIHZhciBhcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYmluYXJ5Lmxlbmd0aDsgaSsrKSB7XG4gICAgYXJyYXkucHVzaChiaW5hcnkuY2hhckNvZGVBdChpKSlcbiAgfVxuXG4gIC8vIENvbnZlcnQgdG8gYSBGaWxlP1xuICBpZiAodG9GaWxlKSB7XG4gICAgcmV0dXJuIG5ldyBGaWxlKFtuZXcgVWludDhBcnJheShhcnJheSldLCBvcHRzLm5hbWUgfHwgJycsIHt0eXBlOiBtaW1lVHlwZX0pXG4gIH1cblxuICByZXR1cm4gbmV3IEJsb2IoW25ldyBVaW50OEFycmF5KGFycmF5KV0sIHt0eXBlOiBtaW1lVHlwZX0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRhdGFVUkksIG9wdHMpIHtcbiAgcmV0dXJuIGRhdGFVUkl0b0Jsb2IoZGF0YVVSSSwgb3B0cywgdHJ1ZSlcbn1cbiIsIiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJjb25zdCBVcHB5ID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vc3JjL2NvcmUnKVxuY29uc3QgRGFzaGJvYXJkID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vc3JjL3BsdWdpbnMvRGFzaGJvYXJkJylcbmNvbnN0IEdvb2dsZURyaXZlID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vc3JjL3BsdWdpbnMvR29vZ2xlRHJpdmUnKVxuY29uc3QgRHJvcGJveCA9IHJlcXVpcmUoJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL0Ryb3Bib3gnKVxuY29uc3QgV2ViY2FtID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vc3JjL3BsdWdpbnMvV2ViY2FtJylcbmNvbnN0IFR1czEwID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vc3JjL3BsdWdpbnMvVHVzMTAnKVxuY29uc3QgTWV0YURhdGEgPSByZXF1aXJlKCcuLi8uLi8uLi8uLi9zcmMvcGx1Z2lucy9NZXRhRGF0YScpXG5jb25zdCBJbmZvcm1lciA9IHJlcXVpcmUoJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL0luZm9ybWVyJylcblxuY29uc3QgVVBQWV9TRVJWRVIgPSByZXF1aXJlKCcuLi9lbnYnKVxuXG5jb25zdCBQUk9UT0NPTCA9IGxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICdodHRwcycgOiAnaHR0cCdcbmNvbnN0IFRVU19FTkRQT0lOVCA9IFBST1RPQ09MICsgJzovL21hc3Rlci50dXMuaW8vZmlsZXMvJ1xuXG5mdW5jdGlvbiB1cHB5SW5pdCAoKSB7XG4gIGNvbnN0IG9wdHMgPSB3aW5kb3cudXBweU9wdGlvbnNcbiAgY29uc3QgZGFzaGJvYXJkRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuVXBweURhc2hib2FyZCcpXG4gIGlmIChkYXNoYm9hcmRFbCkge1xuICAgIGNvbnN0IGRhc2hib2FyZEVsUGFyZW50ID0gZGFzaGJvYXJkRWwucGFyZW50Tm9kZVxuICAgIGRhc2hib2FyZEVsUGFyZW50LnJlbW92ZUNoaWxkKGRhc2hib2FyZEVsKVxuICB9XG5cbiAgY29uc3QgdXBweSA9IFVwcHkoe2RlYnVnOiB0cnVlLCBhdXRvUHJvY2VlZDogb3B0cy5hdXRvUHJvY2VlZH0pXG4gIHVwcHkudXNlKERhc2hib2FyZCwge1xuICAgIHRyaWdnZXI6ICcuVXBweU1vZGFsT3BlbmVyQnRuJyxcbiAgICBpbmxpbmU6IG9wdHMuRGFzaGJvYXJkSW5saW5lLFxuICAgIHRhcmdldDogb3B0cy5EYXNoYm9hcmRJbmxpbmUgPyAnLkRhc2hib2FyZENvbnRhaW5lcicgOiAnYm9keSdcbiAgfSlcblxuICBpZiAob3B0cy5Hb29nbGVEcml2ZSkge1xuICAgIHVwcHkudXNlKEdvb2dsZURyaXZlLCB7dGFyZ2V0OiBEYXNoYm9hcmQsIGhvc3Q6IFVQUFlfU0VSVkVSfSlcbiAgfVxuXG4gIGlmIChvcHRzLkRyb3Bib3gpIHtcbiAgICB1cHB5LnVzZShEcm9wYm94LCB7dGFyZ2V0OiBEYXNoYm9hcmQsIGhvc3Q6IFVQUFlfU0VSVkVSfSlcbiAgfVxuXG4gIGlmIChvcHRzLldlYmNhbSkge1xuICAgIHVwcHkudXNlKFdlYmNhbSwge3RhcmdldDogRGFzaGJvYXJkfSlcbiAgfVxuXG4gIHVwcHkudXNlKFR1czEwLCB7ZW5kcG9pbnQ6IFRVU19FTkRQT0lOVCwgcmVzdW1lOiB0cnVlfSlcbiAgdXBweS51c2UoSW5mb3JtZXIsIHt0YXJnZXQ6IERhc2hib2FyZH0pXG4gIHVwcHkudXNlKE1ldGFEYXRhLCB7XG4gICAgZmllbGRzOiBbXG4gICAgICB7IGlkOiAncmVzaXplVG8nLCBuYW1lOiAnUmVzaXplIHRvJywgdmFsdWU6IDEyMDAsIHBsYWNlaG9sZGVyOiAnc3BlY2lmeSBmdXR1cmUgaW1hZ2Ugc2l6ZScgfSxcbiAgICAgIHsgaWQ6ICdkZXNjcmlwdGlvbicsIG5hbWU6ICdEZXNjcmlwdGlvbicsIHZhbHVlOiAnbm9uZScsIHBsYWNlaG9sZGVyOiAnZGVzY3JpYmUgd2hhdCB0aGUgZmlsZSBpcyBmb3InIH1cbiAgICBdXG4gIH0pXG4gIHVwcHkucnVuKClcblxuICB1cHB5Lm9uKCdjb3JlOnN1Y2Nlc3MnLCAoZmlsZUNvdW50KSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1lvLCB1cGxvYWRlZDogJyArIGZpbGVDb3VudClcbiAgfSlcbn1cblxudXBweUluaXQoKVxud2luZG93LnVwcHlJbml0ID0gdXBweUluaXRcbiIsImxldCB1cHB5U2VydmVyRW5kcG9pbnQgPSAnaHR0cDovL2xvY2FsaG9zdDozMDIwJ1xuXG5pZiAobG9jYXRpb24uaG9zdG5hbWUgPT09ICd1cHB5LmlvJykge1xuICB1cHB5U2VydmVyRW5kcG9pbnQgPSAnLy9zZXJ2ZXIudXBweS5pbydcbn1cblxuY29uc3QgVVBQWV9TRVJWRVIgPSB1cHB5U2VydmVyRW5kcG9pbnRcbm1vZHVsZS5leHBvcnRzID0gVVBQWV9TRVJWRVJcbiJdfQ==
