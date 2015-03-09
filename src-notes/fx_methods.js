//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($, undefined){
  var document = window.document, docElem = document.documentElement,
    //保存旧方法
    origShow = $.fn.show, origHide = $.fn.hide, origToggle = $.fn.toggle

  //动画方法特殊处理
  function anim(el, speed, opacity, scale, callback) {
    //适应参数，第二参数传入callback
    if (typeof speed == 'function' && !callback) callback = speed, speed = undefined
    var props = { opacity: opacity }
    if (scale) {
      props.scale = scale
      //设置transform-origin 用于应用 scale
      el.css($.fx.cssPrefix + 'transform-origin', '0 0')
    }
    //调用 fx 中的 animate
    return el.animate(props, speed, null, callback)
  }

  //隐藏时的调用函数，在回调中加上旧的回调方法
  function hide(el, speed, scale, callback) {
    return anim(el, speed, 0, scale, function(){
      origHide.call($(this))
      callback && callback.call(this)
    })
  }

  //显示
  $.fn.show = function(speed, callback) {
    //先调用旧的显示方法
    origShow.call(this)
    //如果有速度，体现到透明度变化
    if (speed === undefined) speed = 0
    else this.css('opacity', 0)
    return anim(this, speed, 1, '1,1', callback)
  }

  //隐藏
  $.fn.hide = function(speed, callback) {
    //如果没有速度（即没有动画），直接使用旧的隐藏方法
    if (speed === undefined) return origHide.call(this)
    //通过 scale 缩小来实现 hide 动画
    else return hide(this, speed, '0,0', callback)
  }

  //切换
  $.fn.toggle = function(speed, callback) {
    //没有速度动画）的情况下使用旧的切换方法
    if (speed === undefined || typeof speed == 'boolean')
      return origToggle.call(this, speed)
    else return this.each(function(){
      var el = $(this)
      //通过 display 值判断调用 show() 、hide()
      el[el.css('display') == 'none' ? 'show' : 'hide'](speed, callback)
    })
  }

  //淡出到指定透明度
  $.fn.fadeTo = function(speed, opacity, callback) {
    return anim(this, speed, opacity, null, callback)
  }

  //淡入
  $.fn.fadeIn = function(speed, callback) {
    //如果预先有设置 opacity 透明度 css ,则淡入到设置的 opacity
    var target = this.css('opacity')
    if (target > 0) this.css('opacity', 0)
    //否则淡入到无透明度
    else target = 1
    //先调用旧的显示方法，再 fadeTo
    return origShow.call(this).fadeTo(speed, target, callback)
  }

  //淡出
  $.fn.fadeOut = function(speed, callback) {
    //直接使用定义的 hide() ，本身就是使用透明度的
    return hide(this, speed, null, callback)
  }

  //淡入淡出切换
  $.fn.fadeToggle = function(speed, callback) {
    return this.each(function(){
      var el = $(this)
      //通过 opacity 和 display 值来判断淡入还是淡出
      el[
        (el.css('opacity') == 0 || el.css('display') == 'none') ? 'fadeIn' : 'fadeOut'
      ](speed, callback)
    })
  }

})(Zepto)
