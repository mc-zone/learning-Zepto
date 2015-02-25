//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  var _zid = 1, undefined,
      //数组slice()的函数方式。方便使用
      slice = Array.prototype.slice,
      //类型判断
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },

      /*
       * handlers: 事件handler的二维记录集(使用element zid为键记录，每个element的所有handler为一组，组内handler索引与handler.i关联)
       * handler: 可理解为"处理对象"或"处理器", 具体内容在add()方法中可以看到
       * 每一个 handler 记录和说明了对一个事件回调的相关处理细节(例如事件type,绑定回调,选择器,委派,包装好的EventListener回调proxy等)
       */
      handlers = {},

      //"特殊"事件集 (见 @tag:3 )
      specialEvents={},

      //是否支持focusin( Gecko貌似不支持 )
      focusinSupported = 'onfocusin' in window,

      //@tag:5 focus,hover事件的替代
      //focusin/focusout可冒泡，focus/blur不能冒泡但可捕获
      focus = { focus: 'focusin', blur: 'focusout' }, 
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  //@tag:3 $.Event()创造事件时，这些事件使用MouseEvents,其他使用Events
  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  /* 
   * 维护一个记录用的不重复id，并返回
   * 使用到的地方:
   * 1: 绑定了事件处理handler的元素element具有zid. handlers中将以zid为key存放元素的所有事件handler
   * 2: $.proxy() 中创建新函数时，在新函数与旧函数之间建立对应关系( proxyFn._zid = zid(fn) )
   */
  function zid(element) {
    return element._zid || (element._zid = _zid++) //给zid赋值，有值则直接返回
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
  /*
   * 判断在EventLisenter中应该使用冒泡还是捕获（即第三个参数。true为捕获，false为冒泡）
   * 以下两种情景中一种时就使用捕获：
   * 情景1：captureSetting参数要求了使用捕获
   * 情景2：是事件委派(delegator)，并且，事件属于focus且不支持focusin时
   * (注: focusin/focusout可冒泡,focus/blur不可冒泡,因此不支持focusin时使用捕获. IE9以下没有捕获,但Zepto不涉及 )
   */
  function eventCapture(handler, captureSetting) {
    return handler.del && //有delegator
      (!focusinSupported && (handler.e in focus)) || //focus类型事件:focus, blur ( 见 @tag:5 )
      !!captureSetting //或者参数设置了要求捕获
  }

  //@tag:7 为focus,blur,mouseenter,mouseleave事件返回其实际的处理事件( 见@tag:5 )
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
    var id = zid(element), set = (handlers[id] || (handlers[id] = [])) //引用元素的handler集(没有则新建)
    //对每一个事件遍历处理(传入格式为"event1 event2 event3")
    events.split(/\s/).forEach(function(event){
      if (event == 'ready') return $(document).ready(fn) //如果是ready事件，则使用$(document).ready()注册fn
      var handler   = parse(event) //parse分析事件，创建handler，(会分离出事件名和命名空间)
      handler.fn    = fn    //记录原始处理函数
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

      //设置proxy方法。包装callback，并处理一些事件传递机制。
      //这是真正EventLisenter时和triggerHandler时回调执行的handler callback
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
      //留个顺序索引,方便从handlers中删除时使用
      handler.i = set.length
      //往handlers中加入handler( set是元素handlers中handler集的引用 )
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

  /*
   * 返回一个新的函数, 在指定的context上下文上执行fn
   * 传入方法有两种
   * 1: fn, context 传入(fn为function)
   * 2: context, propName 传入(propName为string, 此时认为fn为context[propName]中的函数)
   * 两个参数之外的更多参数将被带着走，在fn中继续传递。
   */
  $.proxy = function(fn, context) {
    //如果参数大于两个，多出的部分复制为args，执行fn时将传递进去
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      //新建一个代理函数。在context为this的上下文中执行fn。传入的参数为args(若有的话)与arguments
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      //fn传入不为function且context传入了string时，支持另外一种方式，转换一下
      //此时认为真正的fn是传入的fn的[context], 传入的fn则为context
      //组织参数顺序后再调用
      if (args) {
        //如果有多余参数则拼接上
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
   * 事件绑定的旧方法，通过 on/off 去增加
   */
  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  //只一次
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  // 创建返回Boolean的方法实例
  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      //事件包装时不需理会的事件属性
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
      //事件方法 @tag:4
      eventMethods = {
        preventDefault: 'isDefaultPrevented', //停止默认事件
        stopImmediatePropagation: 'isImmediatePropagationStopped', //停止往上冒泡，同时停止所有其他handlers执行
        stopPropagation: 'isPropagationStopped' //停止往上冒泡
      }

  /* @tag:6
   * 事件方法兼容处理, 增加 @tag:4 中的方法
   * 即增加isDefaultPrevented,isImmediatePropagationStopped,isPropagationStopped三个方法
   * 执行过preventDefault的,isDefaultPrevented方法返回true,否则false
   * 执行过stopImmediatePropagation的,isImmediatePropagationStopped方法返回true,否则false
   * 执行过stopPropagation的,stopPropagation方法返回true,否则false
   */
  function compatible(event, source) {
    //有source 或者没有 isDefaultPrevented (没有禁止默认事件) 的情况下
    if (source || !event.isDefaultPrevented) {
      //如果没有souce source就为event自身
      source || (source = event)

      //对每个eventMethods( @tag:4 )关联方法进行处理
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
   * 根据传入的事件对象包装出一个新的事件对象，把原事件保留到originalEvent属性中
   */
  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]
      //过滤掉ignore的属性和undefined

    return compatible(proxy, event)
  }

  /*
   * 事件委托方法，通过on/off 增加
   */
  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  //使用body做委托的旧方法
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
   * event 可以对象形式传入多个: {event1:fn1,event2:fn2}
   * 如果selector是选择器。则在元素上做selector的事件委托
   * 否则跳过selector参数。直接为元素绑定事件
   * 如果传入data，将会被赋值到回调中事件对象的e.data上( 见function add() )
   * 如果没有传入data或是data是function，认为data是callback
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
      //如果是只执行一次(one)，包装callback，先删除事件后执行callback
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }

      //如果是有选择器,作为事件委托,创建委托回调
      if (selector) delegator = function(e){
        //找到元素最近的符合 selector 的父级
        var evt, match = $(e.target).closest(selector, element).get(0)
        if (match && match !== element) {
          //包装事件对象,并给对象扩展: currentTarget 指向委托受理的对象 match, liveFired指向自己
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          //在委托对象上执行callback
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
    //支持对象方式传入多个，格式同$.fn.on。遍历一个一个删除
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

    //调用remove删除事件绑定
    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

 /*
  * 手动触发一个事件
  * 可传入参数
  */
  $.fn.trigger = function(event, args){
    //如果不是事件对象(字符串指出的事件或纯对象)，则初始化一个事件对象
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      //特殊事件直接用快捷方式触发
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      //如果元素(自身上下文)是DOM元素(有dispatchEvent)则使用dispatchEvent触发真实DOM事件
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      //否则triggerHandler触发事件的handler ( 见$.fn.triggerHandler )
      else $(this).triggerHandler(event, args)
    })
  }

 
  //不冒泡的trigger，且不触发真实事件，仅仅是触发了事件注册的handler fn
  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      //找出元素上事件被绑定的handler集，遍历调用所有回调。
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        //有遇到立即终止命令时停止遍历
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    //返回的是最后一次handler的返回结果
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
   * 创建自定义事件对象(使用document.createEvent创建)
   * 两种使用方法:
   * $.Event( eventType, { prop1:val1, pro2:val2 } )
   * $.Event( { type:eventType, prop1:val1, prop2:val2 } )
   * 可在props中指定是否冒泡( { bubbles:true|false } )
   */
  $.Event = function(type, props) {
    //支持只传一个对象的使用，把type写到props里
    if (!isString(type)) props = type, type = props.type
    //创建事件。如果 specialEvents ( @tag:3 )中没有事件类型记录，则使用默认Events类型事件
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true 
    //事件属性设置。默认冒泡，可以在props里设置bubbles:false取消
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    // 使用initEvent初始化事件，给事件赋type
    event.initEvent(type, bubbles, true) 
    return compatible(event)
  }

})(Zepto)
