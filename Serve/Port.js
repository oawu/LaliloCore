/**
 * @author      OA Wu <comdan66@gmail.com>
 * @copyright   Copyright (c) 2015 - 2021, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Net = require('net')

module.exports = {
  status: (port, done, fail) => {
    const net = Net.createServer()
    return net.once('error', error => error.code != 'EADDRINUSE' ? fail(error) : fail('不明原因錯誤'))
      .once('listening', _ => net.once('close', _ => done()).close())
      .listen(port)
  },
  scan (now, min, max, each, done, fail) {
    if (now < min) return this.scan(min, max, each, done, fail)
    if (now > max) return fail(min + ' ~ ' + max + ' 的 port 皆已被使用中！')
    return each('' + now), this.status(now, _ => done(now), error => now >= max ? fail(min + ' ~ ' + max + ' 的 port 皆已被使用中！') : this.scan(now + 1, min, max, each, done, fail, fail()))
  }
}
