//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  //存储touch对象信息
  var touch = {},
    //timeout id
    touchTimeout, tapTimeout, swipeTimeout, longTapTimeout,
    //长按标准
    longTapDelay = 750,
    //手势库
    gesture

  //通过前后坐标点移动幅度，判断位移的方向
  function swipeDirection(x1, x2, y1, y2) {
    return Math.abs(x1 - x2) >=
      Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'Left' : 'Right') : (y1 - y2 > 0 ? 'Up' : 'Down')
  }

  //触发长按
  function longTap() {
    longTapTimeout = null
    if (touch.last) {
      touch.el.trigger('longTap')
      touch = {}
    }
  }

  //取消长按判断跟踪
  function cancelLongTap() {
    if (longTapTimeout) clearTimeout(longTapTimeout)
    longTapTimeout = null
  }

  //取消所有判断跟踪
  function cancelAll() {
    if (touchTimeout) clearTimeout(touchTimeout)
    if (tapTimeout) clearTimeout(tapTimeout)
    if (swipeTimeout) clearTimeout(swipeTimeout)
    if (longTapTimeout) clearTimeout(longTapTimeout)
    touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null
    touch = {}
  }

  //是否是第一个touch事件(primary pointer = first contact pointer)
  function isPrimaryTouch(event){
    return (event.pointerType == 'touch' ||
      event.pointerType == event.MSPOINTER_TYPE_TOUCH)
      && event.isPrimary
  }

  //判断pointer类型是否为指定类型
  function isPointerEventType(e, type){
    return (e.type == 'pointer'+type ||
      e.type.toLowerCase() == 'mspointer'+type)
  }

  //注册一个ready
  $(document).ready(function(){
    var now, delta, deltaX = 0, deltaY = 0, firstTouch, _isPointerType

    //如果有微软 MSGesture 手势库（IE），实例化一个手势对象
    if ('MSGesture' in window) {
      gesture = new MSGesture()
      gesture.target = document.body
    }

    //在document上绑定处理事件
    $(document)
      //MSGesture 手势结束时
      .bind('MSGestureEnd', function(e){
        //判断滑动的方向
        var swipeDirectionFromVelocity =
          e.velocityX > 1 ? 'Right' : e.velocityX < -1 ? 'Left' : e.velocityY > 1 ? 'Down' : e.velocityY < -1 ? 'Up' : null;
        //如果有滑动了
        if (swipeDirectionFromVelocity) {
          //触发滑动事件
          touch.el.trigger('swipe')
          touch.el.trigger('swipe'+ swipeDirectionFromVelocity)
        }
      })
      //触摸开始时
      .on('touchstart MSPointerDown pointerdown', function(e){
        //只记录 primary touch
        if((_isPointerType = isPointerEventType(e, 'down')) &&
          !isPrimaryTouch(e)) return
        //存储touch对象
        firstTouch = _isPointerType ? e : e.touches[0]
        //如果有遗留未清除的坐标记录(上次touchcancel没能触发)，先清除掉
        if (e.touches && e.touches.length === 1 && touch.x2) {
          // Clear out touch movement data if we have it sticking around
          // This can occur if touchcancel doesn't fire due to preventDefault, etc.
          touch.x2 = undefined
          touch.y2 = undefined
        }
        now = Date.now()
        //计算上一次到现在的时间
        delta = now - (touch.last || now)
        //存储touch发生的dom
        touch.el = $('tagName' in firstTouch.target ?
          firstTouch.target : firstTouch.target.parentNode)
        //如果有 touchTimeout,先终止掉 (TODO ?) 
        touchTimeout && clearTimeout(touchTimeout)
        //记录第一坐标点
        touch.x1 = firstTouch.pageX
        touch.y1 = firstTouch.pageY
        //距离上次的时间小于 250 ,判定为双击
        if (delta > 0 && delta <= 250) touch.isDoubleTap = true
        //重置 最近一次(即本次) touch 的时间
        touch.last = now
        //注册长按判定
        longTapTimeout = setTimeout(longTap, longTapDelay)
        // adds the current touch contact for IE gesture recognition
        if (gesture && _isPointerType) gesture.addPointer(e.pointerId);
      })
      //滑动时监听
      .on('touchmove MSPointerMove pointermove', function(e){
        //只处理 primary touch
        if((_isPointerType = isPointerEventType(e, 'move')) &&
          !isPrimaryTouch(e)) return
        firstTouch = _isPointerType ? e : e.touches[0]
        //由于move了，所以肯定不是长按。取消长按判断。
        cancelLongTap()
        //记录当前坐标点
        touch.x2 = firstTouch.pageX
        touch.y2 = firstTouch.pageY

        //计算位移的相对距离
        deltaX += Math.abs(touch.x1 - touch.x2)
        deltaY += Math.abs(touch.y1 - touch.y2)
      })
      //touch 结束事件
      .on('touchend MSPointerUp pointerup', function(e){
        if((_isPointerType = isPointerEventType(e, 'up')) &&
          !isPrimaryTouch(e)) return
        //如果还没确定是不是长按。取消掉长按
        cancelLongTap()

        // 位移超过30就算滑动了
        // swipe
        if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
            (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30))

          //触发swipe事件
          swipeTimeout = setTimeout(function() {
            touch.el.trigger('swipe')
            touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
            touch = {}
          }, 0)
       
        // 正常点击
        // normal tap
        // 如果上次的还在
        else if ('last' in touch)
          // 判断处理，避免移出又移回的情况
          // don't fire tap when delta position changed by more than 30 pixels,
          // for instance when moving to a point and back to origin
          if (deltaX < 30 && deltaY < 30) {
            // 用setTimeout是为了可以使 scroll 时有机会把 tap 处理取消掉
            // 但是容易引起『穿透』BUG
            // delay by one tick so we can cancel the 'tap' event if 'scroll' fires
            // ('tap' fires before 'scroll')
            tapTimeout = setTimeout(function() {

              //创建并触发tap事件
              // trigger universal 'tap' with the option to cancelTouch()
              // (cancelTouch cancels processing of single vs double taps for faster 'tap' response)
              var event = $.Event('tap')
              event.cancelTouch = cancelAll
              touch.el.trigger(event)

              //触发双击事件
              // trigger double tap immediately
              if (touch.isDoubleTap) {
                if (touch.el) touch.el.trigger('doubleTap')
                touch = {}
              }

              // trigger single tap after 250ms of inactivity
              else {
                //250 ms 后认为是单击
                touchTimeout = setTimeout(function(){
                  touchTimeout = null
                  if (touch.el) touch.el.trigger('singleTap')
                  touch = {}
                }, 250)
              }
            }, 0)
          } else {
            touch = {}
          }
          //清空位移记录
          deltaX = deltaY = 0

      })
      // 失去焦点时的触发，取消掉所有判断
      // when the browser window loses focus,
      // for example when a modal dialog is shown,
      // cancel all ongoing events
      .on('touchcancel MSPointerCancel pointercancel', cancelAll)

    // 如果是window.scroll，则不算touch. 取消和清空所有判断
    // scrolling the window indicates intention of the user
    // to scroll, not tap or swipe, so cancel all ongoing events
    $(window).on('scroll', cancelAll)
  })

  //快捷方式
  ;['swipe', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
    'doubleTap', 'tap', 'singleTap', 'longTap'].forEach(function(eventName){
    $.fn[eventName] = function(callback){ return this.on(eventName, callback) }
  })
})(Zepto)
