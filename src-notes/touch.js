//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  //存储 touch 信息
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

  //是否是主要(通常是第一个)touch事件(primary pointer = first contact pointer)
  //http://www.w3.org/TR/pointerevents/#multiple-primary-pointers
  function isPrimaryTouch(event){
    return (event.pointerType == 'touch' ||
      event.pointerType == event.MSPOINTER_TYPE_TOUCH)
      && event.isPrimary
  }

  //判断是否为指定类型的 Pointer 事件
  //Pointer Event 包含了 mouse, pen, touch 等事件都会触发
  //http://www.w3.org/TR/pointerevents/
  function isPointerEventType(e, type){
    return (e.type == 'pointer'+type ||
      e.type.toLowerCase() == 'mspointer'+type)
  }

  //注册到dom ready中去处理
  $(document).ready(function(){
    var now,
        //时间量
        delta,
        //位移量
        deltaX = 0, deltaY = 0,
        //第一个触控
        firstTouch,
        //是否是 Pointer Event
        _isPointerType

    //如果有 MSGesture 手势库（IE），实例化一个手势对象
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
        //如果是 pointerDown 并且不是 primary touch 则不处理
        //即只记录第一个触控事件
        if((_isPointerType = isPointerEventType(e, 'down')) &&
          !isPrimaryTouch(e)) return
        //存储第一个触控
        firstTouch = _isPointerType ? e : e.touches[0]
        //如果有遗留未清除的坐标记录(例如上次touchcancel没能触发)，先清除掉
        if (e.touches && e.touches.length === 1 && touch.x2) {
          // Clear out touch movement data if we have it sticking around
          // This can occur if touchcancel doesn't fire due to preventDefault, etc.
          touch.x2 = undefined
          touch.y2 = undefined
        }
        now = Date.now()
        //计算上一次到现在渡过的时间
        delta = now - (touch.last || now)
        //存储touch发生的dom
        touch.el = $('tagName' in firstTouch.target ?
          firstTouch.target : firstTouch.target.parentNode)
        //如果有 touchTimeout,先终止掉 (用在 singleTap 的跟踪判断上）
        touchTimeout && clearTimeout(touchTimeout)
        //记录第一坐标点
        touch.x1 = firstTouch.pageX
        touch.y1 = firstTouch.pageY
        //如果有时间记录（即有上一次存在），距离上次的时间小于 250 ,判定为双击
        if (delta > 0 && delta <= 250) touch.isDoubleTap = true
        //重置最后一次 touch 的时间为本次
        touch.last = now
        //注册长按判定
        longTapTimeout = setTimeout(longTap, longTapDelay)
        // 如果有 MSGesture 支持，加上 pointer 关联
        // https://msdn.microsoft.com/en-us/library/windows/apps/hh968037.aspx
        // adds the current touch contact for IE gesture recognition
        if (gesture && _isPointerType) gesture.addPointer(e.pointerId);
      })
      //移动时监听
      .on('touchmove MSPointerMove pointermove', function(e){
        //同上，不处理不是 primary 的 pointer 事件
        if((_isPointerType = isPointerEventType(e, 'move')) &&
          !isPrimaryTouch(e)) return
        firstTouch = _isPointerType ? e : e.touches[0]
        //由于move了，所以肯定不是长按。取消长按判断。
        cancelLongTap()
        //记录当前(第二)坐标点
        touch.x2 = firstTouch.pageX
        touch.y2 = firstTouch.pageY

        //计算位移的相对距离
        deltaX += Math.abs(touch.x1 - touch.x2)
        deltaY += Math.abs(touch.y1 - touch.y2)
      })
      //触控结束时监听
      .on('touchend MSPointerUp pointerup', function(e){
        if((_isPointerType = isPointerEventType(e, 'up')) &&
          !isPrimaryTouch(e)) return
        //取消掉长按（如果还没达到长按时间，就被取消了）
        cancelLongTap()

        // 1.位移超过30就算滑动
        // swipe
        if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
            (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30))
          //触发swipe事件
          swipeTimeout = setTimeout(function() {
            touch.el.trigger('swipe')
            touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
            touch = {}
          }, 0)
        // 2.否则如果还有未处理的 touch 记录(之前记录下来的touch.last)，算正常点击
        // normal tap
        else if ('last' in touch) 
          // 排除有30以上位移的情况，避免移出又移回之类的场景
          // don't fire tap when delta position changed by more than 30 pixels,
          // for instance when moving to a point and back to origin
          if (deltaX < 30 && deltaY < 30) {
            /* 
             * 在 setTimeout 中处理和触发 tap 事件
             * 使用 setTimeout 是为了可以在 scroll 事件时有机会把 tap 取消掉(但是会引起『穿透』BUG)
             * 穿透 BUG 产生原因：因为 tap handler 在 timeout 后触发，在其中使用 e.preventDefault() 无法终止元素继续产生延迟触发的 click 事件
             * 由于异步机制，在 timeout 执行前已经决定了是否触发 click 事件了
             * 解决方法：使用fastclick ,或手动在 touchend 中强制执行 preventDefault() 
             */
            // delay by one tick so we can cancel the 'tap' event if 'scroll' fires
            // ('tap' fires before 'scroll')
            tapTimeout = setTimeout(function() {

              // 创建并触发tap事件
              // 在事件对象中提供了 cancelTouch 方法，可以取消 tap 类型判断的跟踪
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
            //清空 touch 信息记录
            touch = {}
          }
          //清空位移记录
          deltaX = deltaY = 0

      })/* on touchend end */
      // 触控被中断时的触发，取消掉所有判断
      // when the browser window loses focus,
      // for example when a modal dialog is shown,
      // cancel all ongoing events
      .on('touchcancel MSPointerCancel pointercancel', cancelAll)

    // 如果是在window.scroll，则不进行处理. 取消和清空所有判断
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
