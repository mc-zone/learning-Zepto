//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var Zepto = (function() {
  var undefined, key, $, classList,
    emptyArray = [],
    //方便使用Array内置函数(类似with目的)
    slice = emptyArray.slice,
    filter = emptyArray.filter,
    document = window.document,
    //元素默认css display值缓存
    elementDisplay = {},
    //class name 正则公式缓存
    classCache = {},
    //此集中的css数值不需要加px
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    //fragment 正则
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    //判断单标签正则
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    //匹配缩写标签正则，例如 <div/> 、<p/>
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

    // 存在的属性操作方法集。get/set的使用风格
    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    //插入操作
    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    //预创建一批元素
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    //部分元素的默认容器
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    //就绪状态正则
    readyRE = /complete|loaded|interactive/,
    //认为是简单的选择器，单tagName的。例如p div
    simpleSelectorRE = /^[\w-]*$/,
    //进行类型判断的map存储
    class2type = {},
    //TODO 方便使用toString?
    toString = class2type.toString,
    //zepto方法集的对象
    zepto = {},
    //转驼峰方法(提前声明)
    camelize,
    //数组去重方法(提前声明)
    uniq,
    //临时父容器DOM元素
    tempParent = document.createElement('div'),
    //属性名兼容。效仿jQuery
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    //判断是否数组
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }

  //选择器匹配验证，判断元素是否符合传入的选择器。默认通过浏览器内置matchSelector实现
  zepto.matches = function(element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    //没有内置matchSelector时的处理 
    var match, parent = element.parentNode, temp = !parent
    //没有父节点，使用临时div
    if (temp) (parent = tempParent).appendChild(element)
    //使用qsa选择出匹配元素,取element在其中的索引,~按位非(即-1时为0, 0时为-1, 1时为-2)
    //TODO 使用~按位非的目的
    match = ~zepto.qsa(parent, selector).indexOf(element)
    //清空tempParent(临时div)
    temp && tempParent.removeChild(element)
    return match
  }

  //返回对象类型。空值(undefined null)时返回其string格式，否则返回class2type中的记录，或'object'
  //class2type中的值在 @tag:1 处初始化
  function type(obj) {
    return obj == null ? String(obj) :
      class2type[toString.call(obj)] || "object"
  }

  /*
   * 类型判断
   */
  function isFunction(value) { return type(value) == "function" }
  function isWindow(obj)     { return obj != null && obj == obj.window }
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }

  //纯对象（直接继承于Object的）
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }
  //类数组
  function likeArray(obj) { return typeof obj.length == 'number' }

  //去除数组中空值(null与undefined)
  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  /*
   * 扁平化二维数组
   * 只对二维以下数组有效
   * 通过apply方法使得array被作为arguments传入concat,contact可对数组或单个元素进行数组连接
   */
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }

  //中划线转驼峰
  //TODO 为何提前声明?
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }

  //驼峰转中划线
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }

  //数组去重,通过判断元素的数组索引是否等于第一次出现的索引值，不等则说明有重复
  //TODO 为何提前声明?
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  //制作class name正则匹配公式，并存入缓存
  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  //判断css值是否需要加上px
  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  //判断默认display属性.为none时默认应为block
  //存入elementDisplay缓存
  //TODO 使用机制?
  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  //获取元素下的子DOM节点
  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  /*
   * Zepto的DOM fragment
   * 根据string创建DOM元素
   * properties对象可传入一组设置集合(对应methodAttributes中的方法或HTML属性名),用于设置元素的初始属性
   */
  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overriden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    //如果传入的string是单个标签,不用考虑fragment,直接创建了。
    //RegExp.$n 返回最近一次匹配的第n个匹配结果(n:1-9)
    // A special case optimization for a single tag
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    if (!dom) {
      //展开缩写元素，形如:<div/> 转化为 <div></div>
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      //默认外层元素，为空时设为string中的第一个标签元素
      //TODO 使用机制 什么时候有name?
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      //到containers中找创建好的顶级容器
      //默认使用*,containers['*'] = div
      if (!(name in containers)) name = '*'

      //借用.innerHTML方法创建DOM树
      container = containers[name]
      container.innerHTML = '' + html
      //返回创建的元素，并清空container
      dom = $.each(slice.call(container.childNodes), function(){
        container.removeChild(this)
      })
    }

    //按照传入的合法对象集(进检测isPlainObject)，执行
    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        //存在方法则调用set
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        //不存在此方法，则认为是使用属性名设置，使用.attr()
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  /*
   * Z方法 转换普通dom数组对象为Zepto对象
   * (为其传递$.fn方法到prototype)
   */
  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. Note that `__proto__` is not supported on Internet
  // Explorer. This method can be overriden in plugins.
  zepto.Z = function(dom, selector) {
    dom = dom || []
    dom.__proto__ = $.fn
    dom.selector = selector || ''
    return dom
  }

  /*
   * 判断是否为Zepto对象
   */
  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overriden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  /*
   * Zepto初始方法，包含一些特定情况和用法
   */
  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // 如果传入的第一参数字符以<开头并且是标签,则调用zepto.fragment建立dom
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      // 另外，如果传入了context上下文，则从其中搜索节点
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      // 使用选择器全局搜索元素
      else dom = zepto.qsa(document, selector)
    }
    //如果传入的是function，则当做ready回调调用
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // 传入Zepto对象则简单的返回
    // If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // 如果传入数组则去除空值后放入dom变量(等待处理)
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      //如果单个元素则用数组包含
      else if (isObject(selector))
        dom = [selector], selector = null
      // 如果是html fragment,则创建
      // TODO 此时selector应该不是string 怎么走到此？
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  /* Zepto 基础入口方法
   */
  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  /*
   * 对象属性扩展，将source的值扩展到target上（会覆盖）。
   * deep指定为true时为深拷贝
   */
  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  /*
   * extend方法的扩展接口。可以传入多个对象（放入数组）进行拷贝
   */
  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  /*
   * Zepto的元素选择器。基于querySelectorAll
   */
  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#',
        maybeClass = !maybeID && selector[0] == '.',
        //可能是id和可能是class时，nameOnly分别为去掉"#","."的内容
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
        isSimple = simpleSelectorRE.test(nameOnly)
    return (isDocument(element) && isSimple && maybeID) ?
      //对形如"#id"并且在document范围下的选择优化使用getElementById
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
      slice.call(
        isSimple && !maybeID ?
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
      //在可能是简单class或tagName时使用getElementsByClassName/TagName
  }

  //按条件过滤Zepto node数组
  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  /*
   * 包含判断
   * dom对象支持contains的情况使用parent.contains
   * 不支持的，不断上溯parentNode进行判断
   */
  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  /*
   * zepto方法中的常用方法。对参数类型进行判断和执行
   * 如果arg(一般为用户传入)是function，则返回调用function的结果，否则直接返回arg
   */
  
  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  /*
   * set节点属性
   */
  function setAttribute(node, name, value) {
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  /*
   * 返回节点的className
   * TODO 注释说在符合SVGAnimatedString的情况下。即元素可以animate的情况下。为何?
   */
  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  /*
   * 格式化一些典型值
   */
  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          +value + "" == value ? +value :
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  //是否是空对象。判断有无可枚举属性
  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  //返回元素在数组中的索引,不存在则-1
  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  //驼峰
  $.camelCase = camelize
  //去除字符首尾空值。使用String.prototype.trim。ES5以上
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // uuid?
  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }

  /*
   * map遍历，将返回callback中return值组成的新数组
   * callback中参数为item,index
   */
  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    //去掉undefined和null
    return flatten(values)
  }

  /* 
   * each遍历，callback中return false时结束. 最后返回原数组.
   * callback中参数为index,item
   */
  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  /*
   * 过滤数组。其实就是直接调用Array filter
   */
  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  //parseJSON基于浏览器内置JSON的
  if (window.JSON) $.parseJSON = JSON.parse

  // 类型判断map的填充
  // @tag:1
  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  /*
   * Zepto 集合的方法集
   */
  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    indexOf: emptyArray.indexOf,
    concat: emptyArray.concat,

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    // 判断是否DOM就绪.通过测试 document.readyState 或 注册DOMContentLoaded事件
    ready: function(callback){
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      if (readyRE.test(document.readyState) && document.body) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    //获取sets中指定index的node,不传递参数时返回一份复制的sets
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    //get()别名
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    //删除所有节点
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    //遍历sets
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    //根据条件过滤
    filter: function(selector){
      //如果条件是function 获取那些能通过function的 (通过两次.not)
      if (isFunction(selector)) return this.not(this.not(selector))
      //否则当做选择器来判断,返回符合的
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    //往sets中加入元素
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    //is判断,判断元素(第一个)是否符合选择器
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    //非集判断
    not: function(selector){
      var nodes=[]
      //如果条件是function,收集无法通过function的nodes
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        //如果条件是选择器或类数组，返回不符合或不在其中的nodes
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    /*
     * 判断是否含有。如果传入对象则用contains判断，传入selector则find查找
     * 最后返回的是找到的内容
     */
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    //获取sets中指定index的node,返回zepto集合,不传递参数时返回一份复制的sets
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    //获取sets中第一个元素,返回zepto对象
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    //获取sets中最后一个元素,返回zepto对象
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    /*
     * 在集合内查找
     */
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      //如果传入对象则返回存在的此类对象
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      //如果stes只有一个元素,则qsa查找
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      //如sets果有多个则依次qsa查找返回数组
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    //向上匹配第一个元素的父级，返回最近的匹配成功的父级
    closest: function(selector, context){
      var node = this[0], collection = false
      if (typeof selector == 'object') collection = $(selector)
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    //返回所有元素的所有父级(返回元素都在一个数组内，下同)。可提供selector过滤
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    //返回所有元素的直接父元素,可提供selector过滤
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    //返回所有元素的所有子元素
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    //返回所有元素的所有子节点，包括文本和注释节点
    contents: function() {
      return this.map(function() { return slice.call(this.childNodes) })
    },
    //返回所有元素的所有兄弟元素
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    //把所有元素置空
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    //返回所有元素的指定的属性值（不去重）
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    //显示所有元素(把display置空或恢复)
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    //替换为。实际为在其前插入，然后将自身删除
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    /*
     * 在每个元素外层包裹一个容器。只对已插入到DOM中的元素有效。新生成元素无效
     * 可以传入function迭代生成相应容器
     */
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    /*
     * 在所有元素外层包裹一个容器
     * 只加一个wrap，其实是根据第一个元素去加wrap，然后把所有元素都移入
     * 同样只对已插入到DOM中的元素有效。新生成元素无效
     */
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    /*
     * 给每元素加一个inner wrap(内容包裹)
     * 使用方法同wrap
     */
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    /*
     * 给每个元素去掉父容器
     * this.parent()返回的是所有元素的父元素。因此作用到所有
     */
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    /*
     * 深度复制元素。(但不包括数据和事件，有别于jQuery)
     */
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    //隐藏
    hide: function(){
      return this.css("display", "none")
    },
    //显隐切换
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    //所有元素的每个的前一个元素
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    //所有元素的每个的后一个元素
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    //所有元素html内容的get/set
    html: function(html){
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    //所有元素textContent的get/set
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this[0].textContent : null)
    },
    //所有元素attribute的get/set
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (!this.length || this[0].nodeType !== 1 ? undefined :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    //所有元素property的get/set
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    /*
     * 简单的元素data，直接依靠attribute，只支持字符串。
    /* 返回前会对取得值进行格式化,见deserializeValue()
     */
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    //get/set元素value. select multiple元素会做处理查询选中的option的值返回数组
    val: function(value){
      return 0 in arguments ?
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        }) :
        (this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
        )
    },
    /*
     * offset的get/set 
     * get first ,set all
     * 返回 相对于document的left top width height
     * set时可传入function依据每个元素的oldOffset得出设置return
     */
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    /*
     * css的get/set
     * get first, set all
     * get时可传入数组，将返回key-val对象
     * 默认使用getComputedStyle查询style
     * set时可传入key-val对象
     */
    css: function(property, value){
      if (arguments.length < 2) {
        var computedStyle, element = this[0] //只对第一个元素取值
        if(!element) return
        computedStyle = getComputedStyle(element, '')
        if (typeof property == 'string')
          return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
        //支持获取一组css属性值
        else if (isArray(property)) {
          var props = {}
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      //set
      var css = ''
      if (type(property) == 'string') {
        //value 为 ""/false/null，即删除此css
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          //构造css set表达式
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        //多个prop
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    /*
     * 提供element参数时，返回element在集合中的位置。
     * 无参数时，返回第一个元素在其兄弟元素中的位置
     */
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    /*
     * 判断是否有指定的class
     * 只要集合中有元素含有，就返回true
     */
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    /*
     * 给所有元素加上指定class
     * 可以传入一组class,用空格分割的字符串
     * 或传入function进行迭代处理，返回class名
     */
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    /*
     * 所有元素删除指定的class
     */
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    /*
     * class toggle
     * 第二参数when可传入true/false,使得总是add/remove
     */
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    /*
     * 设置所有元素的滚动距离
     */
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    /*
     * 获取第一个元素的位置，相对于offsetParent
     */
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    //获取所有元素的offsetParent.即第一个有定位的祖先
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  //width 和 height 方法
  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            argType = type(arg)
            return argType == "object" || argType == "array" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)
