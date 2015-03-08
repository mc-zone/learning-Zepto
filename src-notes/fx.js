//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($, undefined){
  var prefix = '',//使用的前缀
    eventPrefix, //事件前缀
    endEventName,
    endAnimationName,
    //平台前缀
    vendors = { Webkit: 'webkit', Moz: '', O: 'o' },
    document = window.document,
    //新建一个用来测试的div
    testEl = document.createElement('div'),
    //支持的 transform 判断正则
    supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i,
    //transform 的 css 名称
    transform,
    //transition 各项
    transitionProperty, transitionDuration, transitionTiming, transitionDelay,
    //animation 各项
    animationName, animationDuration, animationTiming, animationDelay,
    cssReset = {}

  //驼峰转中划线
  function dasherize(str) { return str.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase() }
  //事件名与前缀
  function normalizeEvent(name) { return eventPrefix ? eventPrefix + name : name.toLowerCase() }

  //确定能使用的前缀
  $.each(vendors, function(vendor, event){
    if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
      prefix = '-' + vendor.toLowerCase() + '-'
      eventPrefix = event
      return false
    }
  })

  transform = prefix + 'transform'
  //设置各项值的名称，并初始化 cssReset
  cssReset[transitionProperty = prefix + 'transition-property'] =
  cssReset[transitionDuration = prefix + 'transition-duration'] =
  cssReset[transitionDelay    = prefix + 'transition-delay'] =
  cssReset[transitionTiming   = prefix + 'transition-timing-function'] =
  cssReset[animationName      = prefix + 'animation-name'] =
  cssReset[animationDuration  = prefix + 'animation-duration'] =
  cssReset[animationDelay     = prefix + 'animation-delay'] =
  cssReset[animationTiming    = prefix + 'animation-timing-function'] = ''

  //动画模块的全局设置
  $.fx = {
    //是否禁止动画,true 时禁止。默认如果检查到不支持也禁止
    off: (eventPrefix === undefined && testEl.style.transitionProperty === undefined),
    //默认速度定义
    speeds: { _default: 400, fast: 200, slow: 600 },
    //css前缀
    cssPrefix: prefix,
    //结束回调的名称
    transitionEnd: normalizeEvent('TransitionEnd'),
    animationEnd: normalizeEvent('AnimationEnd')
  }


  /* 
   * animate 方法执行动画
   * 可以传入一组动画的目标属性，并(可选)设置时间(duration)，缓动函数(ease:easing)，回调(callback:complete)，延迟(delay)
   * 设置项也可以以对象方式在第二个参数传入: $el.animate(prop,{duration:300,easing:'ease-in'});
   * ps: ease 和 callback 在对象中的名称为 easing 和 complete 。
   * 或使用定义好的 keyframes: $el.animate(keyframeName, ...);
   */
  $.fn.animate = function(properties, duration, ease, callback, delay){
    //参数适配,不传入 duration 和 ease 时
    if ($.isFunction(duration))
      callback = duration, ease = undefined, duration = undefined
    //不传入 ease 时
    if ($.isFunction(ease))
      callback = ease, ease = undefined
    //对象方式传入时
    if ($.isPlainObject(duration))
      ease = duration.easing, callback = duration.complete, delay = duration.delay, duration = duration.duration
    //duration 值确定
    if (duration) duration = (typeof duration == 'number' ? duration :
                    ($.fx.speeds[duration] || $.fx.speeds._default)) / 1000
    //delay 值确定
    if (delay) delay = parseFloat(delay) / 1000
    //确认参数后调用实际处理方法 .anim
    return this.anim(properties, duration, ease, callback, delay)
  }

  /*
   * animate 方法的实际过程。（确认参数后的调用）
   */
  $.fn.anim = function(properties, duration, ease, callback, delay){
    var key, cssValues = {}, cssProperties, transforms = '',
        that = this, wrappedCallback, endEvent = $.fx.transitionEnd,
        fired = false

    //确认该使用的 duration 和 delay
    if (duration === undefined) duration = $.fx.speeds._default / 1000 //单位为s
    if (delay === undefined) delay = 0
    if ($.fx.off) duration = 0 //关闭动画动画时间时置为0

    //使用 keyframes 动画
    if (typeof properties == 'string') {
      // keyframe animation
      //设置 cssValues 值
      cssValues[animationName] = properties
      cssValues[animationDuration] = duration + 's'
      cssValues[animationDelay] = delay + 's'
      cssValues[animationTiming] = (ease || 'linear')
      endEvent = $.fx.animationEnd
    } else {//属性变化动画
      //涉及的 css 属性(应用到transitionProperty中)
      cssProperties = []
      // CSS transitions
      for (key in properties)
        //判断是transform 值还是其他 css 值
        if (supportedTransforms.test(key)) transforms += key + '(' + properties[key] + ') '
        else cssValues[key] = properties[key], cssProperties.push(dasherize(key))

      // 设置 cssValues 
      // transform 加入到其中
      if (transforms) cssValues[transform] = transforms, cssProperties.push(transform)
      // 加入 transition 各项值
      if (duration > 0 && typeof properties === 'object') {
        cssValues[transitionProperty] = cssProperties.join(', ')
        cssValues[transitionDuration] = duration + 's'
        cssValues[transitionDelay] = delay + 's'
        cssValues[transitionTiming] = (ease || 'linear') //默认为平滑
      }
    }

    //包装回调函数
    wrappedCallback = function(event){
      //先解绑event
      if (typeof event !== 'undefined') {
        //不在冒泡上来的 target 上执行
        if (event.target !== event.currentTarget) return // makes sure the event didn't bubble from "below"
        $(event.target).unbind(endEvent, wrappedCallback)
      } else
        $(this).unbind(endEvent, wrappedCallback) // triggered by setTimeout

      //标记为已执行
      fired = true
      //置空所有动画属性
      $(this).css(cssReset)
      //执行callback
      callback && callback.call(this)
    }
    //有动画时间时绑定回调函数
    if (duration > 0){
      //绑定回调函数
      this.bind(endEvent, wrappedCallback)
      // 25ms 后检查是否触发了回调(旧安卓机型bug)，如果没有触发手动触发
      // transitionEnd is not always firing on older Android phones
      // so make sure it gets fired
      setTimeout(function(){
        if (fired) return
        wrappedCallback.call(that)
      }, ((duration + delay) * 1000) + 25)
    }

    // 触发页面reflow
    // trigger page reflow so new elements can animate
    this.size() && this.get(0).clientLeft

    // css 赋值
    this.css(cssValues)

    //如果没有动画时间，直接触发回调函数
    if (duration <= 0) setTimeout(function() {
      that.each(function(){ wrappedCallback.call(this) })
    }, 0)

    return this
  }

  //清空测试用div，避免内存泄露
  testEl = null
})(Zepto)
