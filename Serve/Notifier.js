/**
 * @author      OA Wu <comdan66@gmail.com>
 * @copyright   Copyright (c) 2015 - 2021, Lalilo
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

let notifierEnable = true
const { Typeof } = require('@oawu/helper')
const Notifier = require('node-notifier').NotificationCenter

module.exports = (message, title, subtitle) => {
  if (!notifierEnable) return
  else option = { sound: true, wait: false, timeout: 5, closeLabel: '關閉', actions: ['不再顯示'], dropdownLabel: '其他', withFallback: true, reply: true }
  Typeof.str.notEmpty.do(title, title => option.title = title)
  Typeof.str.notEmpty.do(subtitle, subtitle => option.subtitle = subtitle)
  Typeof.str.notEmpty.do(message, message => option.message = message)
  new Notifier().notify(option, (error, response, metadata) => notifierEnable = !(response == 'activate' && metadata.activationValue == '不再顯示'))
}
