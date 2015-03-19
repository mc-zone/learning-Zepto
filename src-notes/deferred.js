//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.
//
//     Some code (c) 2005, 2013 jQuery Foundation, Inc. and other contributors

;(function($){
  var slice = Array.prototype.slice

  function Deferred(func) {
    var tuples = [
          // 三种操作(发布)，相应的监听(订阅)，和导致的状态
          // action, add listener, listener list, final state
          [ "resolve", "done", $.Callbacks({once:1, memory:1}), "resolved" ],
          [ "reject", "fail", $.Callbacks({once:1, memory:1}), "rejected" ],
          [ "notify", "progress", $.Callbacks({memory:1}) ]
        ],
        state = "pending", //state 有三种 resolved解决 rejected拒绝 pending挂起

        //扩展用的 promise 对象，只提供 callback 订阅注册，不提供 deferred 的 resolve 等发布操作
        promise = {
          //返回当前状态
          state: function() {
            return state
          },
          //无论结果，结束后总是回调
          always: function() {
            //成功和失败都调用
            deferred.done(arguments).fail(arguments)
            return this
          },
          //then方法，接受三种回调(成功，失败，进度)
          then: function(/* fnDone [, fnFailed [, fnProgress]] */) {
            var fns = arguments
            //再调用Deferred,使得返回的都是deferred对象，可以链式调用
            return Deferred(function(defer){
              //对每一种操作
              $.each(tuples, function(i, tuple){
                var fn = $.isFunction(fns[i]) && fns[i]
                //注册发布的监听
                deferred[tuple[1]](function(){
                  var returned = fn && fn.apply(this, arguments)
                  //如果返回的是 promise 对象，直接使用 promise 中的 done fail progress 注册监听
                  if (returned && $.isFunction(returned.promise)) {
                    returned.promise()
                      .done(defer.resolve)
                      .fail(defer.reject)
                      .progress(defer.notify)
                  } else {
                    var context = this === promise ? defer.promise() : this,
                        values = fn ? [returned] : arguments
                    defer[tuple[0] + "With"](context, values)
                  }
                })
              })
              fns = null
            }).promise()
          },
          //保证返回 promise 对象（将 promise 混入）
          promise: function(obj) {
            return obj != null ? $.extend( obj, promise ) : promise
          }
        },
        //初始化 deferred 对象
        deferred = {}

    //对 tuples 中每组内容处理，把订阅接口加到 deferred 上
    $.each(tuples, function(i, tuple){
      var list = tuple[2],//list 即为 Callbacks 返回的操作对象
          stateString = tuple[3]

      //为 promise 设置订阅接口(done,fail,progress)，即为使用 list.add 增加订阅收到信息后的操作
      promise[tuple[1]] = list.add

      //有状态的情况下（非progress）,处理状态
      if (stateString) {
        list.add(function(){
          state = stateString //把状态改为当前状态

        //[ reject_list | resolve_list ].disable; progress_list.lock (Callbacks的操作)
        }, tuples[i^1][2].disable, tuples[2][2].lock)
      }

      //添加发布操作接口到 deferred 对象(resolve,reject,notify)
      deferred[tuple[0]] = function(){
        deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments)
        return this
      }
      deferred[tuple[0] + "With"] = list.fireWith
    })

    //把 deferred 包装为 promise 对象
    promise.promise(deferred)
    //如果最初传递的是函数,直接执行函数
    if (func) func.call(deferred, deferred)
    return deferred
  }

  //when 方法作为一个合集处理，接受多个 deferred 的发布监听
  $.when = function(sub) {
    var resolveValues = slice.call(arguments),
        len = resolveValues.length,
        i = 0,
        //设置剩余计数器，len不为1时使用len(传入监听参数的数量),
        //只传入一个参数时，必须是 deferred 对象，使用1
        //否则 0
        remain = len !== 1 || (sub && $.isFunction(sub.promise)) ? len : 0,
        //如果是监听多个，创建一个新的 deffered 来处理
        deferred = remain === 1 ? sub : Deferred(),
        progressValues, progressContexts, resolveContexts, 
        // 对resolve和progress的值处理
        updateFn = function(i, ctx, val){
          return function(value){
            ctx[i] = this
            val[i] = arguments.length > 1 ? slice.call(arguments) : value
            if (val === progressValues) {
              deferred.notifyWith(ctx, val)
            } else if (!(--remain)) {
              deferred.resolveWith(ctx, val)
            }
          }
        }

    //注册 updateFn 到各个处理
    if (len > 1) {
      progressValues = new Array(len)
      progressContexts = new Array(len)
      resolveContexts = new Array(len)
      for ( ; i < len; ++i ) {
        if (resolveValues[i] && $.isFunction(resolveValues[i].promise)) {
          resolveValues[i].promise()
            .done(updateFn(i, resolveContexts, resolveValues))
            .fail(deferred.reject)
            .progress(updateFn(i, progressContexts, progressValues))
        } else {
          --remain
        }
      }
    }
    //如果没有剩余了 发布 when 的 resolve
    if (!remain) deferred.resolveWith(resolveContexts, resolveValues)
    return deferred.promise()
  }

  $.Deferred = Deferred
})(Zepto)
