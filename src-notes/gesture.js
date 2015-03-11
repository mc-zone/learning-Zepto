//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  if ($.os.ios) {
        //手势信息对象
    var gesture = {},
        gestureTimeout

    //非标签节点时向上找到标签节点
    function parentIfText(node){
      return 'tagName' in node ? node : node.parentNode
    }

    $(document).bind('gesturestart', function(e){
      var now = Date.now(),
          //上一次到现在的时间
          delta = now - (gesture.last || now)
      //设置影响的 DOM 目标
      gesture.target = parentIfText(e.target)
      //取消掉超时处理
      gestureTimeout && clearTimeout(gestureTimeout)
      //存储当前手势比例
      gesture.e1 = e.scale
      //本次(当前最后一次)的发生时间
      gesture.last = now
    }).bind('gesturechange', function(e){
      //手势变化时存储新比例
      gesture.e2 = e.scale
    }).bind('gestureend', function(e){
      //手势结束
      //在有过新比例的情况下
      if (gesture.e2 > 0) {
        //两次比例不同时，触发 pinch .如果新比例小于旧比例，pinchIn (缩小)，否则 pinchOut (放大)
        Math.abs(gesture.e1 - gesture.e2) != 0 && $(gesture.target).trigger('pinch') &&
          $(gesture.target).trigger('pinch' + (gesture.e1 - gesture.e2 > 0 ? 'In' : 'Out'))
        //重置存储器
        gesture.e1 = gesture.e2 = gesture.last = 0
      } else if ('last' in gesture) {
        //有触发过 gesture 但是没遇到 e2 (没有gesturechange，scale没有变化)，置空存储器
        gesture = {}
      }
    })

    //快捷方式
    ;['pinch', 'pinchIn', 'pinchOut'].forEach(function(m){
      $.fn[m] = function(callback){ return this.bind(m, callback) }
    })
  }
})(Zepto)
