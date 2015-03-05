//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  //jsonp callback的后缀id
  var jsonpID = 0,
      document = window.document,
      key,
      name,
      //script标签匹配正则
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      //script标签type匹配正则
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      //xml type匹配正则
      xmlTypeRE = /^(?:text|application)\/xml/i,
      //mime type
      jsonType = 'application/json',
      htmlType = 'text/html',
      //匹配空白符
      blankRE = /^\s*$/,
      //预先创建一个a标签元素,指向当前页地址
      originAnchor = document.createElement('a')
  
  originAnchor.href = window.location.href

  // 触发一个自定义事件。然后如果取消了默认行为则返回false，否则返回true
  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.isDefaultPrevented()
  }

  /* 触发一个Ajax全局事件
   * 参数settings中必须设置了global属性为true
   */
  // trigger an Ajax "global" event
  function triggerGlobal(settings, context, eventName, data) {
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // 当前在激活状态的ajax请求数,用于判断是否执行ajaxStart() 和 ajaxStop()
  // Number of active Ajax requests
  $.active = 0

  /*
   * 触发ajaxStart事件
   * 在$.active不为0时说明已经有未结束的ajax请求(已经开始过了)，不触发
   */
  function ajaxStart(settings) {
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  /*
   * 触发ajaxStop事件
   * 在$.active不为1时说明还有请求未结束，不触发
   */
  function ajaxStop(settings) {
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  /*
   * XHR send 发送前的执行，触发全局ajaxBeforeSend事件
   */
  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
      return false

    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }

  /*
   * ajax 成功后的执行，触发全局 ajaxSuccess 事件
   */
  function ajaxSuccess(data, xhr, settings, deferred) {
    var context = settings.context, status = 'success'
    settings.success.call(context, data, status, xhr) //执行 success 回调
    //deferred 对象处理
    if (deferred) deferred.resolveWith(context, [data, status, xhr])
    //全局事件触发
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    //执行ajaxComplete
    ajaxComplete(status, xhr, settings)
  }
  /*
   * ajax 失败后的执行，触发全局 ajaxError 事件
   * 参数 type 失败类型 "timeout", "error", "abort", "parsererror"
   */
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings, deferred) {
    var context = settings.context
    settings.error.call(context, xhr, type, error) //执行 error 回调
    if (deferred) deferred.rejectWith(context, [xhr, type, error])
    //同 ajaxSuccess
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
    ajaxComplete(type, xhr, settings)
  }
  /*
   * ajax 结束后的执行（无论成功或失败），触发全局 ajaxComplete 事件
   * 参数 type 状态类型 "success", "notmodified", "error", "timeout", "abort", "parsererror"
   */
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    ajaxStop(settings) //尝试执行ajaxStop 回调 (只有是最后一个结束时才能成功)
  }

  // 空函数方便赋默认空回调
  // Empty function, used as default callback
  function empty() {}

  /* JSONP 方法支持
   */
  $.ajaxJSONP = function(options, deferred){
    //如果没有设置 options.type 指定类型，则走 $.ajax() 方法
    if (!('type' in options)) return $.ajax(options)

    //创建 JSONP 回来时调用的 callback 的名字
    //如果 options.jsonpCallback 中指定了名字，则用指定的。指定时可以使用 function 
    //否则使用 jsonpID 创建一个唯一的 callback 名
    var _callbackName = options.jsonpCallback,
      callbackName = ($.isFunction(_callbackName) ?
        _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
      //创建新的 script 放置返回内容
      script = document.createElement('script'),
      //把用户写在 window 中有名为 callbackName 的全局属性(可能是 function )，保存到 originalCallback 中
      originalCallback = window[callbackName],
      //用来存储返回的数据
      responseData,
      //提供一个中断方法
      abort = function(errorType) {
        $(script).triggerHandler('error', errorType || 'abort')
      },
      xhr = { abort: abort },
      //存储执行超时中断的 setTimeout ID
      abortTimeout

    //deferred 包装
    if (deferred) deferred.promise(xhr)

    //为 script 绑定 load 和 error 处理回调
    $(script).on('load error', function(e, errorType){
      //不再执行超时处理
      clearTimeout(abortTimeout)
      //只要 load 或 error 后，就去掉所有事件并删除 script
      $(script).off().remove()

      //如果是 error 事件或者是没有返回内容
      if (e.type == 'error' || !responseData) {
        //执行 ajaxError 方法
        ajaxError(null, errorType || 'error', xhr, options, deferred)
      } else {
        //否则执行 ajaxSuccess
        ajaxSuccess(responseData[0], xhr, options, deferred)
      }
      //还原原来的 window[callbackName] 里的内容
      window[callbackName] = originalCallback

      /* 如果 responseData 里有内容了(加载回来的脚本已经执行了window[callbackName])
       * 并且原来的 window[callbackName] 即 originalCallback 是(用户定义好的)function
       * 把 responseData 传入 originalCallback 中执行
       */
      if (responseData && $.isFunction(originalCallback))
        originalCallback(responseData[0])
      //把 originalCallback 和 responseData 清空
      originalCallback = responseData = undefined
    })
    // on load error END

    //如果执行 ajaxBeforeSend 返回了false, 中断
    if (ajaxBeforeSend(xhr, options) === false) {
      abort('abort')
      return xhr
    }
    //建立一个新的存在 window 下的 callback function
    window[callbackName] = function(){
      //把 callback 传入的数据存到 responseData
      responseData = arguments
    }
    //给 script 赋上 src ,插入到 head 中
    //url 中会加入callbackName。把 url 中 ?...jsonp=? 替换成 ?...jsonp=callbackName
    script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
    document.head.appendChild(script)

    //如果有用 options.timeout 设置超时，超时的时候 abort 中断
    if (options.timeout > 0) abortTimeout = setTimeout(function(){
      abort('timeout')
    }, options.timeout)

    return xhr
  }

  /*
   * 全局 Ajax 设置
   */
  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    // IIS returns Javascript as "application/x-javascript"
    accepts: {
      script: 'text/javascript, application/javascript, application/x-javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0,
    // 是否把要发送的 data 转换为字符串
    // Whether data should be serialized to string
    processData: true,
    // 是否缓存 GET 响应结果
    // Whether the browser should be allowed to cache GET responses
    cache: true
  }

  //根据 mimeType 得出数据类型
  function mimeToDataType(mime) {
    if (mime) mime = mime.split(';', 2)[0]
    return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
      scriptTypeRE.test(mime) ? 'script' :
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  //url query 拼接
  function appendQuery(url, query) {
    if (query == '') return url
    //正则修正 url query. replace(/[&?]{1,2}/, '?') 把第一次出现的 & 或 ? 或 ?& 替换为 ? ({1,2}代表1或2次)
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }
  // 根据条件判断并进行参数序列化处理
  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    //如果设置需要把 data 序列化为字符串，并且确实传入了 data 且不为字符串，则转化为字符串  
    if (options.processData && options.data && $.type(options.data) != "string")
      //options.traditional 指定了是否使用 `foo[]=bar&foo[]=baz` 的数组格式
      options.data = $.param(options.data, options.traditional)
    //如果已有 data 且 type 为 GET (默认也为 GET),则把 data 作为 query 加到 url 上
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
      options.url = appendQuery(options.url, options.data), options.data = undefined
  }

  /*
   * 通用 Ajax 方法
   */
  $.ajax = function(options){
    var settings = $.extend({}, options || {}),
        deferred = $.Deferred && $.Deferred(),
        urlAnchor
    //填充默认 settings
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    //尝试触发 ajaxStart
    ajaxStart(settings)

    //不允许跨域的情况下
    if (!settings.crossDomain) {
      //创建一个 a 元素, 地址设置为目标地址
      urlAnchor = document.createElement('a')
      urlAnchor.href = settings.url
      urlAnchor.href = urlAnchor.href //??
      //判断是否真的跨域了。originAnchor 是指向当前页面地址的 a 元素
      settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
    }

    //如果没有 url ,则向当前页地址发送
    if (!settings.url) settings.url = window.location.toString()
    serializeData(settings)

    var dataType = settings.dataType,
        //检查是否是 jsonp 请求(形如 ?...=? 的url)
        hasPlaceholder = /\?.+=\?/.test(settings.url)
    if (hasPlaceholder) dataType = 'jsonp'

    /*
     * 如果settings设置了不缓存
     * 或没有设置为 true 并且 为script 或 jsonp 类型
     * 都不走缓存。在url上加上时间戳不走缓存
     */
    if (settings.cache === false || (
         (!options || options.cache !== true) &&
         ('script' == dataType || 'jsonp' == dataType)
        ))
      settings.url = appendQuery(settings.url, '_=' + Date.now())

    //如果是 jsonp 
    if ('jsonp' == dataType) {
      //如果url中没有 jsonp参数名=? 的预置项,加上这项
      if (!hasPlaceholder)
        settings.url = appendQuery(settings.url,
          //如果设置里有 jsonp 参数名则使用，否则使用callback。如果 settings.jsonp 为 false 的话不加(即不用参数)
          settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
      //转到 $.ajaxJSONP
      return $.ajaxJSONP(settings, deferred)
    }

    //根据 dataType 获取相应的 mimeType
    var mime = settings.accepts[dataType],
        //Header 头信息
        headers = { },
        //setHeader 方法
        setHeader = function(name, value) { headers[name.toLowerCase()] = [name, value] },
        //捕捉协议类型
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        //新建 XHR 对象
        xhr = settings.xhr(),
        //原生设置请求头方法
        nativeSetHeader = xhr.setRequestHeader,
        //超时中断的 timeOutID
        abortTimeout

    //deferred 操作
    if (deferred) deferred.promise(xhr)

    //如果不跨域,标明 X-Requested-With 请求类型是 XMLHttpRequest
    if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
    //接受的格式
    setHeader('Accept', mime || '*/*')
    //在有指定 mimeType 的情况下尝试主动设置响应的 mimeType 要求 (overrideMimeType)
    if (mime = settings.mimeType || mime) {
      //如果以逗号隔开的形式多于一个，留下第一个
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      //overrideMimeType 主动指定要求返回的 mimeType
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    //请求的 Content-type 设置。未设置情况下设为 application/x-www-form-urlencoded 兼顾所有情况
    if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
      setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

    //settings中指定的头信息
    if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
    //覆写 setHeader 到 xhr.setRequestHeader (原来的已经有保存到nativeSetHeader)
    //TODO why?
    xhr.setRequestHeader = setHeader

    //readyStateChange 事件处理 handler
    xhr.onreadystatechange = function(){
      //返回 response 时
      if (xhr.readyState == 4) {
        //先置空 handler
        xhr.onreadystatechange = empty
        //取消超时处理
        clearTimeout(abortTimeout)
        var result, error = false
        
        //在以下状态中认为是可能成功的
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          //加入对 response 中 contentType 的考虑，重新判断 dataType
          dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))
          //result 默认置为 responseText
          result = xhr.responseText

          try {
            // 如果是 script 使用 eval 执行
            // http://perfectionkills.com/global-eval-what-are-the-options/
            if (dataType == 'script')    (1,eval)(result)
            //xml responseXML
            else if (dataType == 'xml')  result = xhr.responseXML
            //JSON 返回, 调用$.parseJSON
            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
          } catch (e) { error = e }

          //都不符合的情况下，抛出解析错误
          if (error) ajaxError(error, 'parsererror', xhr, settings, deferred)
          //执行 ajaxSuccess
          else ajaxSuccess(result, xhr, settings, deferred)
        } else {
          //错误
          ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
        }
      }
    }

    //如果 ajaxBeforeSend 中返回了false，直接终止，不执行
    if (ajaxBeforeSend(xhr, settings) === false) {
      xhr.abort()
      ajaxError(null, 'abort', xhr, settings, deferred)
      return xhr
    }

    // xhr 属性设置
    if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

    //默认异步
    var async = 'async' in settings ? settings.async : true
    xhr.open(settings.type, settings.url, async, settings.username, settings.password)

    //开始设置头信息
    for (name in headers) nativeSetHeader.apply(xhr, headers[name])

    //超时设置
    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings, deferred)
      }, settings.timeout)

    // 发送
    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  // 对 $.get, $.post 等几个别名方法的 arguments 参数解析，转为调用 $.ajax 的参数
  // handle optional data/success arguments
  function parseArguments(url, data, success, dataType) {
    if ($.isFunction(data)) dataType = success, success = data, data = undefined
    if (!$.isFunction(success)) dataType = success, success = undefined
    return {
      url: url
    , data: data
    , success: success
    , dataType: dataType
    }
  }

  /*
   * 以下一些别名方法
   * 对参数和条件分析处理后通过 $.ajax 实现
   */
  //$.get 方法 
  $.get = function(/* url, data, success, dataType */){
    return $.ajax(parseArguments.apply(null, arguments))
  }
  //$.post 方法
  $.post = function(/* url, data, success, dataType */){
    var options = parseArguments.apply(null, arguments)
    options.type = 'POST'
    return $.ajax(options)
  }
  //$.getJSON 方法
  $.getJSON = function(/* url, data, success */){
    var options = parseArguments.apply(null, arguments)
    options.dataType = 'json'
    return $.ajax(options)
  }

  /*
   * 实例方法 load 内容到元素
   * 第一参数 url 可以尾部空格加上 selector 指定要写入的确切内容
   * 如"http://google.com #container"
   * 仅在获得内容后 find。Ajax 加载时仍然加载整个文档
   */
  $.fn.load = function(url, data, success){
    if (!this.length) return this
    var self = this,
        //分解 url。可能含有空格隔开的 selector
        parts = url.split(/\s/), selector,
        options = parseArguments(url, data, success),
        //保存原有的success callback
        callback = options.success
    //取出 selector
    if (parts.length > 1) options.url = parts[0], selector = parts[1]
    options.success = function(response){
      //设置成功后的 callback 为调用 .html() 方法写入内容
      self.html(selector ?
        //有选择器的情况下，response 过滤掉<script>元素后作为一个 div 的 HTML 将其新建。再 find(selector)
        $('<div>').html(response.replace(rscript, "")).find(selector)
        : response)
      //继续把原来的 success callback 执行
      callback && callback.apply(self, arguments)
    }
    //调用 $.ajax 方法
    $.ajax(options)
    return this
  }

  //url 参数 encode
  var escape = encodeURIComponent

  /*
   * $.param 方法的辅助函数
   * 将传入的 obj 遍历转化为字符串结构放入 params 数组中
   * 最后将在 $.param 中被拼接为 URL query 返回
   */
  function serialize(params, obj, traditional, scope){
    var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
    $.each(obj, function(key, value) {
      type = $.type(value)
      if (scope) key = traditional ? scope :
        scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
      // handle data in serializeArray() format
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      else if (type == "array" || (!traditional && type == "object"))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  /*
   * 把传入的对象序列化成 URL query 的格式
   * obj 中的 value 值可以为字符串、数组、对象和带返回值的function
   * 如果 traditional 参数传入了true，数组和对象将不会被改成 []= 和 [key]= 的形式(在 serialize() 中处理)
   * 例如:
   *   数组 a:[1,2,3] 转为a[]=1&a[]=2&a[]=3, traditional 为 true 时则为 a=1&a=2&2=3
   *   对象 foo:{bar:'baz'} 转为 foo[bar]=baz, traditional 为 true 时则为 foo=[object+Object]
   *   ( 详细在 serialize() 函数中实现 )
   */
  $.param = function(obj, traditional){
    var params = []
    //给params 预置一个 add 方法，在 serialize() 中入栈数据时调用
    params.add = function(key, value) {
      if ($.isFunction(value)) value = value() //value 可以为 function
      if (value == null) value = ""
      this.push(escape(key) + '=' + escape(value)) //URL 编码（使用encodeURIComponent）
    }
    //通过 serialize() 函数处理数据
    serialize(params, obj, traditional)
    return params.join('&').replace(/%20/g, '+')//空格最后被过滤为+
  }
})(Zepto)

