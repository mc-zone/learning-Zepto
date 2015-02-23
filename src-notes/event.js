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
      //是否支持focusin( IE )
      focusinSupported = 'onfocusin' in window,
      //focus,hover事件的真实依据 (见 @tag:5 )
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  //@tags:3 $.Event()创造事件时，这些事件使用MouseEvents,其他使用Events
  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  /* 设置一个zepto id，并返回。
   * 用于handlers中事件handle的键记录
   * 也用于handler.fn
   */
  function zid(element) {
    return element._zid || (element._zid = _zid++) //给zid赋值
  }
  //分析事件，找出handle函数
  function findHandlers(element, event, fn, selector) {
    //分析event，返回事件名和(可能带有的)命名空间集
    event = parse(event)
    //如果带命名空间，则使用matcherFor()构造匹配命名空间使用的正则
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      //filter 对element注册的事件进行条件过滤判断，返回通过的handler
      return handler
        && (!event.e  || handler.e == event.e) //有e时(parse中分析得出必有)判断事件名是否相等
        && (!event.ns || matcher.test(handler.ns)) //有event.ns(命名空间时)判断命名空间是否相同
        && (!fn       || zid(handler.fn) === zid(fn)) //传入了fn时判断handler.fn是不是指定的fn(通过zid) 
        && (!selector || handler.sel == selector) //传入了选择器时判断选择器是否相同
    })
  }
  //对事件进行分析，返回事件名(eventType)和命名空间(namespace)
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')} //命名空间顺序按char排序后的
  }
  //构造namespace的正则匹配 
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }
  //事件捕获 TODO
  function eventCapture(handler, captureSetting) {
    return handler.del && //必须有delegator才进行捕获
      (!focusinSupported && (handler.e in focus)) || //IE focusin focusout可冒泡,其他focus,blur不可冒泡,使用捕获
      !!captureSetting //或者参数设置了要求捕获
  }

  //@tag:7 为focus,blur,mouseenter,mouseleave事件返回其实际的处理事件( @tag:5 )
  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  /*
   * 事件增加的内部方法
   * 传入参数:
   * element:元素
   * events:事件集("event1 event2 event3")
   * fn:处理函数
   * data:传入的数据
   * selector:选择器
   * delegator:委派
   * capture:捕获
   */
  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = [])) //返回已经存在的handle集(没有则新建)
    //对每一个事件遍历处理(传入格式为"event1 event2 event3")
    events.split(/\s/).forEach(function(event){
      if (event == 'ready') return $(document).ready(fn) //如果是ready事件，则使用$(document).ready()注册fn
      var handler   = parse(event) //parse分析事件，创建handler，(会分离出事件名和命名空间)
      handler.fn    = fn    //记录处理函数
      handler.sel   = selector //记录设定的选择器
      // 模拟mouseenter, mouseleave,重写fn (原handler.fn保留)
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        //e.relatedTarget 此时应为mouseover/out临界时指向的元素(e.formElement,e.toElement)
        //如果有 related (不是null) 且不是自己或自己的子元素，则判定为符合。在自己上调用fn
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      //记录委派
      handler.del   = delegator
      //如果有委派，callback等于委派，否则为fn
      var callback  = delegator || fn

      //设置proxy代理
      handler.proxy = function(e){
        //事件方法兼容处理 (见 @tag:6 )
        e = compatible(e)
        //如果设置了立即终止冒泡则立即返回
        if (e.isImmediatePropagationStopped()) return
        e.data = data
        //执行callback
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        //如果返回了false,则终止默认事件并终止冒泡
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      //留个顺序索引
      handler.i = set.length
      //加入handler
      set.push(handler)
      //addEventListener绑定事件
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
        /*
         * realEvent 替换blur,focus,hover等事件的实际绑定事件 ( 见 @tag:7 )
         * 实际绑定的处理函数是proxy不是fn
         * eventCapture 决定是冒泡还是捕获
         */
    })
  }
  //事件删除的内部方法
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      //找出相关的handlers
      findHandlers(element, event, fn, selector).forEach(function(handler){
        //删除handler
        delete handlers[id][handler.i]
      //删除事件listener
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  //返回一个新的函数(代理),在指定的context上下文上执行
  $.proxy = function(fn, context) {
    //如果参数大于两个，多出的部分为args，调用fn时将传递进去
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
   * 旧方法，通过on/off 去增加
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
        preventDefault: 'isDefaultPrevented', //停止默认事件
        stopImmediatePropagation: 'isImmediatePropagationStopped', //停止往上冒泡，同时停止所有其他handlers执行
        stopPropagation: 'isPropagationStopped' //停止往上冒泡
      }

  /* @tag:6
   * 事件方法兼容处理, 增加 @tags:4 中的方法
   * 即增加isDefaultPrevented,isImmediatePropagationStopped,isPropagationStopped三个方法
   * 执行过preventDefault的,isDefaultPrevented方法返回true,否则false
   * 执行过stopImmediatePropagation的,isImmediatePropagationStopped方法返回true,否则false
   * 执行过stopPropagation的,stopPropagation方法返回true,否则false
   */
  function compatible(event, source) {
    //有source 或者没有 isDefaultPrevented (没有执行过此函数) 的情况下
    if (source || !event.isDefaultPrevented) {
      //如果没有souce source就为event
      source || (source = event)

      //对每个eventMethods( @tags:4 )关联方法进行处理
      $.each(eventMethods, function(name, predicate) {
        var sourceMethod = source[name]
        event[name] = function(){
          this[predicate] = returnTrue //一旦执行过这个sourceMethod，则event[predicate]()返回true
          return sourceMethod && sourceMethod.apply(source, arguments) //执行原方法
        }
        event[predicate] = returnFalse //默认返回false
      })

      /* defaultPrevented的兼容处理
       * 如果果source有defaultPrevented并且为真
       * 或 returnValue 为 false (IE8及以下)
       * 或有getPreventDefault()且返回真 (旧方法)
       * 均代表已经取消了默认事件
       * 则isDefaultPrevented返回true
       */
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
