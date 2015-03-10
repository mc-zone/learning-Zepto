//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// The following code is heavily inspired by jQuery's $.fn.data()

;(function($){
  var data = {}, dataAttr = $.fn.data, camelize = $.camelCase,
    exp = $.expando = 'Zepto' + (+new Date()), emptyArray = []

  // 取值的流程：先直接使用key，再尝试转驼峰key，不行再去读data-key attribute
  // Get value from node:
  // 1. first try key as given,
  // 2. then try camelized key,
  // 3. fall back to reading "data-*" attribute.
  function getData(node, name) {
    //获取存在节点上的 data id,使用 id 从 data 中读取节点的 data 集(store)
    var id = node[exp], store = id && data[id]
    //如果没有指定数据，则返回数据集(如果数据集为空，顺便 setData 为节点初始化数据集)
    if (name === undefined) return store || setData(node)
    else {
      //有数据集时
      if (store) {
        //如果存在，直接返回
        if (name in store) return store[name]
        //尝试驼峰
        var camelName = camelize(name) 
        if (camelName in store) return store[camelName]
      }
      //如果都没有，调用 dataAttr 读取data-*
      return dataAttr.call($(node), name)
    }
  }

  // 驼峰格式设置 data
  // Store value under camelized key on node
  function setData(node, name, value) {
    //取得或创建属于节点的data id
    var id = node[exp] || (node[exp] = ++$.uuid),
      //取得节点的数据集，没有则 attributeData 创建一个
      store = data[id] || (data[id] = attributeData(node))
    //存储到数据集中，返回新的数据集
    if (name !== undefined) store[camelize(name)] = value
    return store
  }

  // 读取所有 data-* 属性存到 data 集并返回
  // Read all "data-*" attributes from a node
  function attributeData(node) {
    var store = {}
    ///对其属性遍历
    $.each(node.attributes || emptyArray, function(i, attr){
      //如果有data-*
      if (attr.name.indexOf('data-') == 0)
        //取得键值，转化驼峰
        store[camelize(attr.name.replace('data-', ''))] =
          //存到store
          $.zepto.deserializeValue(attr.value)
    })
    return store
  }

  //实例方法
  $.fn.data = function(name, value) {
    return value === undefined ?
      // set multiple values via object
      $.isPlainObject(name) ?
        this.each(function(i, node){
          //设置
          $.each(name, function(key, value){ setData(node, key, value) })
        }) :
        //求值
        // get value from first element
        (0 in this ? getData(this[0], name) : undefined) :
      // set value on all elements
      this.each(function(){ setData(this, name, value) })
  }

  //删除数据
  $.fn.removeData = function(names) {
    if (typeof names == 'string') names = names.split(/\s+/)
    return this.each(function(){
      var id = this[exp], store = id && data[id]
      if (store) $.each(names || store, function(key){
        //使用 delete 删除
        delete store[names ? camelize(this) : key]
      })
    })
  }

  // 在 remove empty 上扩展，移除数据
  // Generate extended `remove` and `empty` functions
  ;['remove', 'empty'].forEach(function(methodName){
    //暂存旧方法
    var origFn = $.fn[methodName]
    $.fn[methodName] = function() {
      var elements = this.find('*')
      //remove 的话加上自己！
      if (methodName === 'remove') elements = elements.add(this)
      //删除数据
      elements.removeData()
      return origFn.call(this)//调用原方法
    }
  })
})(Zepto)
