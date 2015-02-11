//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  var _zid = 1, undefined,
      //方便使用
      slice = Array.prototype.slice,
      //类型判断
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },
      //用于记录事件handler(使用zid记录)
      handlers = {},
      //"特殊"事件集 (见 @tags:3 )
      specialEvents={},
      //是否支持focusin
      focusinSupported = 'onfocusin' in window,
      //focus,hover事件的真实依据
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  //@tags:3 $.Event()创造事件时，这些事件使用MouseEvents,其他使用Events
  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  //为元素设置一个zepto id 属性，并返回。
  //应该是用于handlers中记录,以及remove时删除
  function zid(element) {
    return element._zid || (element._zid = _zid++) //绑定多个事件时简单累加
  }
  //分析事件，找出handle函数
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    //如果带命名空间，则matcherFor寻找
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      //进行一些属性判断，通过后返回handler函数的引用
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  //对事件名进行split，分出其namespace
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')} //命名空间顺序按char排序后的
  }
  //构造namespace的正则匹配 
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }
  //事件捕获
  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
  }

  //为hover,foucus事件返回其真实处理事件
  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  //事件增加的内部方法
  //TODO 详细理解
  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    events.split(/\s/).forEach(function(event){
      if (event == 'ready') return $(document).ready(fn)
      var handler   = parse(event)
      handler.fn    = fn
      handler.sel   = selector
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = delegator
      var callback  = delegator || fn
      handler.proxy = function(e){
        e = compatible(e)
        if (e.isImmediatePropagationStopped()) return
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      handler.i = set.length
      set.push(handler)
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }
  //事件删除的内部方法
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  //TODO 详细理解
  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  /*
   * 旧方法，通过on/off 增加
   */
  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  // 创建返回Boolean的方法实例
  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      //事件包装时不需理会的事件属性
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
      //事件方法 @tags:4
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }

  //兼容处理, 增加 @tags:4 中的方法
  //TODO 详细理解
  function compatible(event, source) {
    //有source 或者没有 defaultPrevented 的情况下
    if (source || !event.isDefaultPrevented) {
      //如果没有souce source就为event
      source || (source = event)

      //对每个eventMethods( @tags:4 )方法进行赋予
      $.each(eventMethods, function(name, predicate) {
        var sourceMethod = source[name]
        event[name] = function(){
          this[predicate] = returnTrue
          return sourceMethod && sourceMethod.apply(source, arguments)
        }
        event[predicate] = returnFalse
      })

      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
          'returnValue' in source ? source.returnValue === false :
          source.getPreventDefault && source.getPreventDefault())
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  /*
   * 拷贝事件,把原事件赋值到originalEvent
   * 
   */
  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  /*
   * 旧方法，通过on/off 增加
   */
  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  /*
   * 事件增加统一方法
   * event 可以对象传入多个{event1:handler1,event2:handler2}
   */
  $.fn.on = function(event, selector, data, callback, one){
    var autoRemove, delegator, $this = this
    //支持以对象传入多个
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    //参数适应，可以不传入selector和data
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    if (isFunction(data) || data === false)
      callback = data, data = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(_, element){
      //如果是只执行一次(one),回调绑定到remove()中执行
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }

      //如果是有选择器,作为事件委托
      if (selector) delegator = function(e){
        //找到元素最近的符合 selector 的父级
        var evt, match = $(e.target).closest(selector, element).get(0)
        if (match && match !== element) {
          //拷贝事件对象,并给对象扩展: currentTarget 指向委托对象 match, liveFired指向自己
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      //增加事件
      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }

  //事件删除统一方法
  $.fn.off = function(event, selector, callback){
    var $this = this
    //支持对象方式传入多个
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }

    //参数适配，selector 为可选
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse

    //调用remove
    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

 /*
  * 手动触发一个事件
  * 可传入参数
  */
  $.fn.trigger = function(event, args){
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      else $(this).triggerHandler(event, args)
    })
  }

 /*
  * 不冒泡的trigger,且不触发真实事件
  * 
  */
  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  /* 
   * 事件直接调用的快捷方式
   * 带回调函数，用bind绑定事件处理程序
   * 不带参数视为trigger调用
   */
  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout focus blur load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return (0 in arguments) ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  /*
   * 创建事件
   * 使用document.createEvent创建
   */
  $.Event = function(type, props) {
    //支持只传一个对象的使用，把type写到props里
    if (!isString(type)) props = type, type = props.type
    //创建事件。如果 specialEvents ( @tags:3 )中没有事件类型记录，则使用默认Events类型事件
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true 
    //事件属性设置。默认冒泡，可以在props里设置bubbles:false取消
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    // 使用initEvent初始化事件，给事件赋type
    event.initEvent(type, bubbles, true) 
    return compatible(event)
  }

})(Zepto)
