/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const URL = require('url')
const Path = require('path')
const Mime = require('mime')
const FileSystem = require('fs')

const { println } = require('@oawu/helper')
const { title, fail, done } = require('@oawu/cli-progress')
const { cmdColor, php2html } = require('../Core')

const Response = function(type, config, request, response) {
  if (!(this instanceof Response))
    return new Response(type, config, request, response)

  let pathname  = URL.parse(request.url).pathname.replace(/\/+/gm, '/').replace(/\/$|^\//gm, '')
  let extension = pathname === '' ? null : Mime.getExtension(Mime.getType(pathname))

  this.response = response

  if (pathname === '')
    if (config.php.enable)
      if (FileSystem.existsSync(config.dir.html + 'index.html')) extension = 'html', this.filepath = config.dir.html + 'index.html'
      else if (FileSystem.existsSync(config.dir.html + 'index.php')) extension = 'php', this.filepath = config.dir.html + 'index.php'
      else return this.error()
    else
      if (FileSystem.existsSync(config.dir.html + 'index.html')) extension = 'html', this.filepath = config.dir.html + 'index.html'
      else return this.error()
  else
    if (extension === null)
      if (config.php.enable)
        if (FileSystem.existsSync(config.dir.html + pathname + '.html')) extension = 'html', this.filepath = config.dir.html + pathname + '.html'
        else if (FileSystem.existsSync(config.dir.html + pathname + Path.sep + 'index.html')) extension = 'html', this.filepath = config.dir.html + pathname + Path.sep + 'index.html'
        else if (FileSystem.existsSync(config.dir.html + pathname + '.php')) extension = 'php', this.filepath = config.dir.html + pathname + '.php'
        else if (FileSystem.existsSync(config.dir.html + pathname + Path.sep + 'index.php')) extension = 'php', this.filepath = config.dir.html + pathname + Path.sep + 'index.php'
        else return this.error()
      else
        if (FileSystem.existsSync(config.dir.html + pathname + '.html')) extension = 'html', this.filepath = config.dir.html + pathname + '.html'
        else if (FileSystem.existsSync(config.dir.html + pathname + Path.sep + 'index.html')) extension = 'html', this.filepath = config.dir.html + pathname + Path.sep + 'index.html'
        else return this.error()
    else
      if (FileSystem.existsSync(config.dir.html + pathname) && ['php', 'html'].includes(extension)) this.filepath = config.dir.html + pathname
      else if (FileSystem.existsSync(config.entry + pathname)) this.filepath = config.entry + pathname
      else return this.error()

  return extension != 'php'
    ? extension != 'html'
      ? this.file(config.server.utf8Exts.includes('.' + extension) ? 'utf8' : null, Mime.getType(this.filepath) + '; charset=UTF-8')
      : this.html()
    : this.php(config.entry, config.php)
}

Response.http = (closure, config) => {
  title('開啟 ' + 'http'.lightPurple + ' 伺服器', cmdColor('執行動作', 'run http Server, port:' + config.server.port.default))
  const http = require('http').Server()
  http.on('error', error => fail(null, error))
  http.listen(config.server.port.default, _ => closure(http, config.php.baseURL !== null || (config.php.baseURL = 'http://' + config.server.domain + ':' + config.server.port.default + '/'), done()))
  http.on('request', (request, response) => Response('http', config, request, response))
}

Response.https = (closure, ssl, config) => {
  title('開啟 ' + 'https'.lightCyan + ' 伺服器', cmdColor('執行動作', 'run https Server, port:' + config.server.port.default))
  const https = require('https').Server(ssl)
  https.on('error', error => Response.http(closure, config, fail('失敗'), println("\r" + ' '.repeat(5) + '↳'.purple.dim + ' ' + error.message)))
  https.listen(config.server.port.default, _ => closure(https, config.php.baseURL !== null || (config.php.baseURL = 'https://' + config.server.domain + ':' + config.server.port.default + '/'), done()))
  https.on('request', (request, response) => Response('https', config, request, response))
}

Response.server = (closure, ssl, config) => ssl ? Response.https(closure, ssl, config) : Response.http(closure, config)

Response.appendSocketJS = data => {
  const script = '<script src="/socket.io/socket.io.js"></script><script type="text/javascript">io && io.connect().on("reload", function(data) { location.reload(data); });</script>'
  return data = data.split('</head>'), data.length < 2 ? data.join('</head>') + script : [data.shift(), script, '</head>', data.join('</head>')].join('')
}

Response.prototype.output = function(status = 200, contentType = 'text/html; charset=UTF-8', data = '') {
  this.response.writeHead(status, { 'Content-Type': contentType })
  this.response.write(data)
  this.response.end()
}

Response.prototype.php = function(entry, config) {
  return php2html(entry, this.filepath, config,
    (error, data) => this.output(
      error ? 400 : 200, 'text/html; charset=UTF-8',
      Response.appendSocketJS(data)))
}

Response.prototype.html = function() {
  return FileSystem.readFile(this.filepath, { encoding: 'utf8' }, (error, data) => error
    ? this.error('無法讀取檔案！')
    : this.output(200, 'text/html; charset=UTF-8', Response.appendSocketJS(data)))
}

Response.prototype.file = function(encoding, contentType) {
  return FileSystem.readFile(this.filepath, { encoding: encoding }, (error, data) => error
    ? this.error('無法讀取檔案！')
    : this.output(200, contentType, data))
}

Response.prototype.error = function(message = '') {
  const contents = ['<!DOCTYPE html>', '<html lang="zh-Hant">', '<head>', '<meta http-equiv="Content-Language" content="zh-tw">', '<meta http-equiv="Content-type" content="text/html; charset=utf-8">', '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,minimal-ui">', '<meta name="robots" content="noindex,nofollow,noarchive">', '<meta name="googlebot" content="noindex,nofollow,noarchive">', '<title>404 Not Found | Lalilo</title>', '<link href="https://fonts.googleapis.com/css?family=Comfortaa:400,300,700" rel="stylesheet" type="text/css">', '<link href="https://cdn.jsdelivr.net/npm/hack-font@3.3.0/build/web/hack.css" rel="stylesheet">', '<style type="text/css">*, *:after, *:before { vertical-align: top; -moz-box-sizing: border-box; -webkit-box-sizing: border-box; box-sizing: border-box; -moz-osx-font-smoothing: subpixel-antialiased; -webkit-font-smoothing: subpixel-antialiased; -moz-font-smoothing: subpixel-antialiased; -ms-font-smoothing: subpixel-antialiased; -o-font-smoothing: subpixel-antialiased; }html { padding: 0; }body { margin: 0; text-align: center; background-color: #373832; }body, h1, h1:before, p, article, article:before, div, div:before, svg, a, a:after, i, section, footer { display: inline-block; }a, i { float: left; }html, body, article, div, a { position: relative; }article:before, div:before, a:after { position: absolute; }article:before, div:before { left: 0; top: 0; }body, h1, article:before, div, footer, p { width: 100%; }h1 { margin-top: 32px; color: #d7d7d7; font-size: 56px; font-family: Comfortaa; height: 72px; line-height: 72px; text-shadow: 1px 1px 10px rgba(0, 0, 0, 0.5); }h1:after { color: #e6e6e6; font-size: 64px; margin-left: 6px; }h1[v7]:after { content: "7"; }p { color: white; margin: 0; margin-top: -30px; color: #7f7f7f; }p + p { margin-top: 4px; }p + footer { margin-top: 52px; }article { width: calc(100% - 16px); max-width: 500px; text-align: left; padding: 12px 8px; padding-left: 0; margin: 0 8px; margin-top: 20px; background-color: #282923; overflow: hidden; overflow-x: auto; -moz-border-radius: 3px; -webkit-border-radius: 3px; border-radius: 3px; -moz-box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.3), 1px 1px 1px rgba(255, 255, 255, 0.075); -webkit-box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.3), 1px 1px 1px rgba(255, 255, 255, 0.075); box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.3), 1px 1px 1px rgba(255, 255, 255, 0.075); }article:before { content: ""; height: 100%; width: 36px; background-color: #282923; -moz-box-shadow: 0 0 5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.2); -webkit-box-shadow: 0 0 5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.2); box-shadow: 0 0 5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.2); }div { width: 420px; height: 22px; line-height: 22px; padding: 0 16px; padding-left: 48px; color: #f8f8f2; font-family: Hack, Comfortaa; }div:before { width: 36px; color: #90918b; font-size: 13px; font-weight: 100; text-align: center; }div:nth-child(1):before { content: "01"; }div:nth-child(2):before { content: "02"; }div:nth-child(3):before { content: "03"; }div:nth-child(4):before { content: "04"; }div:nth-child(5):before { content: "05"; }div:nth-child(6):before { content: "06"; }div:nth-child(7):before { content: "07"; }div:nth-child(8):before { content: "08"; }div:nth-child(9):before { content: "09"; }div:nth-child(10):before { content: "10"; }div:nth-child(11):before { content: "11"; }div:nth-child(12):before { content: "12"; }div:nth-child(13):before { content: "13"; }div:nth-child(14):before { content: "14"; }.purple { color: #b07dff; }.blue { color: #61d8f1; }.yellow { color: #d3c964; }.red { color: #ee1b6b; }.space { padding-left: 16px; }svg { width: 14px; height: 14px; fill: white; margin-right: 2px; margin-top: 2px; fill: #696a65; -moz-transition: fill 0.3s; -o-transition: fill 0.3s; -webkit-transition: fill 0.3s; transition: fill 0.3s; }a { text-decoration: none; color: #7e807c; -moz-transition: color 0.3s; -o-transition: color 0.3s; -webkit-transition: color 0.3s; transition: color 0.3s; font-family: Comfortaa; font-size: 13px; }a:hover { color: #9c9d9c; }a:hover svg { fill: rgba(156, 157, 156, 0.75); }a:after { left: -11px; top: calc(50% - 12px/2); width: 1px; height: 12px; border-left: 1px solid rgba(255, 255, 255, 0.1); }a + a { margin-left: 21px; }a + a:after { content: ""; }section { height: 20px; line-height: 20px; *zoom: 1; }section:after { display: table; content: ""; line-height: 0; clear: both; }footer { margin-top: 16px; }</style>', '</head>', '<body>']
  if (message) contents.push('<h1>GG . 惹</h1>', '<p style="font-size: 20px;">糟糕，' + message + '</p>')
  else contents.push('<h1>肆 . 零 . 肆</h1>', '<p>糟糕，是 404 not found！</p>', '<article>', '<div><span class="red">html</span> {</div>', '<div><span class="blue space">position</span>: <span class="blue">fixed</span>;</div>', '<div><span class="blue space">top</span>: <span class="purple">-99999</span><span class="red">px</span>;</div>', '<div><span class="blue space">left</span>: <span class="purple">-99999</span><span class="red">px</span>;</div>', '<div></div>', '<div><span class="blue space">z-index</span>: <span class="purple">-99999</span>;</div>', '<div></div>', '<div><span class="blue space">display</span>: <span class="blue">none</span>;</div>', '<div><span class="blue space">width</span>: <span class="purple">0</span>;</div>', '<div><span class="blue space">height</span>: <span class="purple">0</span>;</div>', '<div></div>', '<div><span class="red space">@include</span> <span class="blue">opacity</span>(<span class="purple">0</span>);</div>', '<div><span class="red space">@include</span> <span class="blue">scale</span>(<span class="purple">0</span>);</div>', '<div>}</div>', '</article>')
  contents.push('<footer>', '<section>', '<a href="/"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><path d="M512 0c-282.77 0-512 229.23-512 512s229.23 512 512 512 512-229.23 512-512-229.23-512-512-512zM512 960.002c-62.958 0-122.872-13.012-177.23-36.452l233.148-262.29c5.206-5.858 8.082-13.422 8.082-21.26v-96c0-17.674-14.326-32-32-32-112.99 0-232.204-117.462-233.374-118.626-6-6.002-14.14-9.374-22.626-9.374h-128c-17.672 0-32 14.328-32 32v192c0 12.122 6.848 23.202 17.69 28.622l110.31 55.156v187.886c-116.052-80.956-192-215.432-192-367.664 0-68.714 15.49-133.806 43.138-192h116.862c8.488 0 16.626-3.372 22.628-9.372l128-128c6-6.002 9.372-14.14 9.372-22.628v-77.412c40.562-12.074 83.518-18.588 128-18.588 70.406 0 137.004 16.26 196.282 45.2-4.144 3.502-8.176 7.164-12.046 11.036-36.266 36.264-56.236 84.478-56.236 135.764s19.97 99.5 56.236 135.764c36.434 36.432 85.218 56.264 135.634 56.26 3.166 0 6.342-0.080 9.518-0.236 13.814 51.802 38.752 186.656-8.404 372.334-0.444 1.744-0.696 3.488-0.842 5.224-81.324 83.080-194.7 134.656-320.142 134.656z"></path></svg>回首頁</a>', '<a href="https://github.com/oawu/Lalilo" target="_blank"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path d="M256.004 6.321c-141.369 0-256.004 114.609-256.004 255.999 0 113.107 73.352 209.066 175.068 242.918 12.793 2.369 17.496-5.555 17.496-12.316 0-6.102-0.24-26.271-0.348-47.662-71.224 15.488-86.252-30.205-86.252-30.205-11.641-29.588-28.424-37.458-28.424-37.458-23.226-15.889 1.755-15.562 1.755-15.562 25.7 1.805 39.238 26.383 39.238 26.383 22.836 39.135 59.888 27.82 74.502 21.279 2.294-16.543 8.926-27.84 16.253-34.232-56.865-6.471-116.638-28.425-116.638-126.516 0-27.949 10.002-50.787 26.38-68.714-2.658-6.45-11.427-32.486 2.476-67.75 0 0 21.503-6.876 70.42 26.245 20.418-5.674 42.318-8.518 64.077-8.617 21.751 0.099 43.668 2.943 64.128 8.617 48.867-33.122 70.328-26.245 70.328-26.245 13.936 35.264 5.175 61.3 2.518 67.75 16.41 17.928 26.347 40.766 26.347 68.714 0 98.327-59.889 119.975-116.895 126.312 9.182 7.945 17.362 23.523 17.362 47.406 0 34.254-0.298 61.822-0.298 70.254 0 6.814 4.611 14.797 17.586 12.283 101.661-33.888 174.921-129.813 174.921-242.884 0-141.39-114.617-255.999-255.996-255.999z"></path></svg>GitHub</a>', '</section>', '</footer>', '</body>', '</html>')
  this.output(message ? 500 : 404, 'text/html; charset=UTF-8', contents.join(''))
}

module.exports = Response
