//     Zepto.js
//     (c) 2010-2014 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  /*
   * 把 form 中的表单元素序列化为键值对的类数组返回
   * [{name:value},{name:value}] 形式
   * 针对的是表单控件。只应该用在form元素上
   */
  $.fn.serializeArray = function() {
    var name, type, result = [],
      //定义一个add方法
      add = function(value) {
        //数组的话递归调用
        if (value.forEach) return value.forEach(add)
        //push到result中. name会在下面的each中赋值
        result.push({ name: name, value: value })
      }
    if (this[0]) $.each(this[0].elements, function(_, field){
      type = field.type, name = field.name
      //fieldset submit reset button file, 未选中的radio/checkbox 以及disabled的元素除外
      if (name && field.nodeName.toLowerCase() != 'fieldset' &&
        !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
        ((type != 'radio' && type != 'checkbox') || field.checked))
          add($(field).val())
    })
    return result
  }

  // 把序列化好的类数组转为 Url 友好的 query 字符串
  $.fn.serialize = function(){
    var result = []
    //先序列化为类数组
    this.serializeArray().forEach(function(elm){
      //编码后拼接
      result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
    })
    return result.join('&')
  }

  /*
   * 提交(实例中的第一个) form 表单(无参数时)
   * 或绑定一个 callback 在实例的 submit 事件上
   */
  $.fn.submit = function(callback) {
    //如果指定了callback参数，则绑定 submit 事件回调
    if (0 in arguments) this.bind('submit', callback)
    //否则进行提交操作
    else if (this.length) {
      //手工触发submit事件
      var event = $.Event('submit')
      this.eq(0).trigger(event)
      //如果事件没有被终止，提交表单
      if (!event.isDefaultPrevented()) this.get(0).submit()
    }
    return this
  }

})(Zepto)
