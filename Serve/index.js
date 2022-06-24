/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path = require('path')
const FileSystem = require('fs')

const { create: Queue } = require('@oawu/queue')
const { title, done, fail } = require('@oawu/cli-progress')
const { println, access, isFile, isDirectory, exists, mkdir, argv, Typeof, scanDir, during } = require('@oawu/helper')
const { cmdColor, deSlash, dirOrEmpty } = require('../Core')

const startAt = Date.now()

const Setting = {
  root  : Path.resolve(__dirname, ('..' + Path.sep).repeat(5)) + Path.sep,
  config: Path.resolve(__dirname, ('..' + Path.sep).repeat(4)) + Path.sep + 'config' + Path.sep + 'Serve.js'
}

let ready = false

module.exports = {
  Start: closure => {
    process.on('SIGINT', _ => process.exit(1))
    closure(println("\n" + ' § '.dim + '啟動 Lalilo 開發環境'.bold))
  },
  Check (closure) {

    const CmdExists = require('command-exists').sync

    println("\n" + ' 【檢查開發環境】'.yellow)

    Queue()
      .enqueue(next => {
        title('檢查設定檔是否存在？', cmdColor('執行動作', 'check Serve\'s config file is exists?'))
        access(Setting.config) || fail(null, '沒有 ' + Path.relative(Setting.root, Setting.config) + ' 讀取權限')
        isFile(Setting.config) || fail(null, '路徑 ' + Path.relative(Setting.root, Setting.config) + ' 不是一個檔案')
        next(done())
      })

      .enqueue(next => {
        const Config = require(Setting.config)

        title('檢查設定檔內容', cmdColor('執行動作', 'verify Serve\'s config file'))

        // entry
        Config.entry = Setting.root + Typeof.str.notEmpty.do.or(Config.entry, entry => dirOrEmpty(entry), 'src')
        access(Config.entry) || fail(null, Path.relative(Setting.root, Config.entry) + Path.sep + ' 沒有讀取權限')
        isDirectory(Config.entry) || fail(null, Path.relative(Setting.root, Config.entry) + Path.sep + ' 不是目錄類型')

        // php
        Config.php = Typeof.object.or(Config.php, {})
        Config.php.enable = Typeof.bool.or(Config.php.enable, false)
        Config.php.maxBuffer = Typeof.num.or(Config.php.maxBuffer, 1024 * 1024)
        Config.php.env = Typeof.str.do.or(Config.php.env, env => ['Development', 'Testing', 'Staging', 'Production'].includes(env) ? env : null, 'Development')
        Config.php.baseURL = Typeof.str.do.or(Config.php.baseURL, baseURL => baseURL.replace(/\/*$/, '') + '/', null)
        Config.php.entry = Path.resolve(__dirname + ['', '..', 'PHP', 'Main.php'].join(Path.sep))
        Config.php.config = Setting.root + ['cmd', 'config', 'php', ''].join(Path.sep)

        // autoOpenBrowser
        Config.autoOpenBrowser = Typeof.bool.or(Config.autoOpenBrowser, false)

        // dir
        const r = FileSystem.constants.R_OK, rw = r | FileSystem.constants.W_OK, configD4 = { icon: { dir: 'icon', permission: r }, scss: { dir: 'scss', permission: rw }, css: { dir: 'css', permission: rw }, img: { dir: 'img', permission: r }, js: { dir: 'js', permission: r }, html: { dir: '',  permission: r } }
        if (Config.dir !== undefined)
          for (let key in configD4) {
            Config.dir[key] = Config.entry + dirOrEmpty(Typeof.str.do.or(Config.dir[key], dir => dir, configD4[key].dir))
            exists(Config.dir[key]) || mkdir(Config.dir[key])
            access(Config.dir[key], configD4[key].permission) || fail(null, '沒有 ' + Path.relative(Setting.root, Config.dir[key]) + Path.sep + ' ' + (configD4[key].permission == rw ? '讀寫' : '讀取') + '權限')
            isDirectory(Config.dir[key]) || fail(null, '路徑 ' + Path.relative(Setting.root, Config.dir[key]) + Path.sep + ' 不是一個目錄')
          }

        // watch
        Config.watch = Typeof.object.or(Config.watch, {})
        Config.watch.formats = Typeof.arr.or(Config.watch.formats, ['.php', '.html', '.css', '.js'])
        Config.watch.ignoreDirs = Typeof.arr.or(Config.watch.ignoreDirs, ['icon']).map(dir => Config.entry + dirOrEmpty(dir)).filter(dir => access(dir) && exists(dir))

        // plugin
        Config.plugin = Typeof.object.or(Config.plugin, {})
        Config.loaders = Typeof.arr.or(Config.loaders, []).map(loader => {
          loader = Typeof.object.or(loader, null)
          return loader
            && Typeof.str.notEmpty(loader.title)
            && Typeof.str.notEmpty(loader.file) ? loader : null
        })
        .filter(t => t)
        .map(({ title, ext = null, file }) => ({ title, ext, file: Setting.root + ['cmd', file].join(Path.sep) }))
        .filter(({ file }) => exists(file) && access(file, FileSystem.constants.R_OK))

        // server
        Config.server = Typeof.object.or(Config.server, {})
        Config.server.domain = Typeof.str.notEmpty.or(Config.server.domain, '127.0.0.1')
        Config.server.port = Typeof.object.or(Config.server.port, {})
        Config.server.port.min = Typeof.num.or(Config.server.port.min, 8000)
        Config.server.port.max = Typeof.num.or(Config.server.port.max, 8999)
        Config.server.port.default = Typeof.num.or(Config.server.port.default, 8000)
        Config.server.utf8Exts = Typeof.arr.or(Config.server.utf8Exts, ['.html', '.css', '.js', '.json', '.text'])
        Config.server.ssl = Typeof.object.do.or(Config.server.ssl, ssl => { try { return { key: FileSystem.readFileSync(ssl.key[0] != Path.sep ? Setting.root + ['cmd', 'config', 'ssl', ssl.key].join(Path.sep) : ssl.key), cert: FileSystem.readFileSync(ssl.cert[0] != Path.sep ? Setting.root + ['cmd', 'config', 'ssl', ssl.cert].join(Path.sep) : ssl.cert) } } catch (e) { return null } }, null)

        Config.php.enable ? next(Config, done()) : closure(Config, done())
      })

      .enqueue((next, Config) => {
        title('檢查參數', cmdColor('執行動作', 'check argvs'))
        Config.php.env = Typeof.str.do.or(argv(['-E', '--env']), env => ['Development', 'Testing', 'Staging', 'Production'].includes(env) ? env : null, Config.php.env || 'Development')
        Config.php.baseURL = Typeof.str.do.or(argv(['-U', '--base-url']), baseURL => baseURL.replace(/\/*$/, '') + '/', Config.php.baseURL || null)
        next(Config, done())
      })

      .enqueue((next, Config) => title('檢查是否有 PHP 指令', cmdColor('執行動作', 'check php command'))
        && CmdExists('php')
          ? next(Config, done())
          : fail(null, '找不到 PHP 指令，請先確認本地環境是否有 PHP 指令環境！'))

      .enqueue((next, Config) => {
        title('檢查 PHP 主要檔案是否存在', cmdColor('執行動作', 'check PHP Main file is exists？'))
        access(Config.php.entry) || fail(null, '沒有' + Path.relative(Setting.root, Config.php.entry) + ' 讀取權限')
        isFile(Config.php.entry) || fail(null, '路徑 ' + Path.relative(Setting.root, Config.php.entry) + ' 不是一個檔案')
        closure(Config, done())
      })
  },
  Compile (closure, Config) {
    println("\n 【編譯檔案】".yellow)
    const Process = require('child_process')

    const Factory = require('./Factory')
    Factory.config = Config
    Factory.root = Setting.root
    
    if (Config.dir === undefined)
      return closure(Config, Factory)

    const q = Queue()
      q.enqueue(next => title('清空 CSS 目錄', cmdColor('執行指令', 'rm -rf ' + Path.relative(Setting.root, Config.dir.css) + Path.sep + '*'))
        && Process.exec('rm -rf ' + Config.dir.css + '*', error => error ? fail(null, error) : next(done())))

      q.enqueue(next => title('執行 ICON 功能', cmdColor('執行動作', 'verify src/icon/*/style.css'))
        && Promise.all(scanDir(Config.dir.icon, false)
          .map(path => path + Path.sep + 'style.css')
          .filter(file => exists(file))
          .map(file => new Promise((resolve, reject) => Factory.Icon('first', file).build(errors => errors.length
            ? reject(errors)
            : resolve()))))
        .then(_ => next(done()))
        .catch(errors => fail(null, errors)))

      q.enqueue(next => title('執行 SCSS 功能', cmdColor('執行動作', 'verify src/scss/*/*.scss'))
        && setTimeout(_ => Promise.all(scanDir(Config.dir.scss)
          .filter(file => Path.extname(file) == '.scss')
          .map(file => new Promise((resolve, reject) => Factory.Scss('first', file).build(errors => errors.length
            ? reject(errors)
            : resolve()))))
        .then(_ => next(done()))
        .catch(errors => fail(null, errors)), 500))
      
      Config.loaders.filter(({ ext }) => ext === null)
        .forEach(loader => q.enqueue(next => title(`執行 ${loader.title} 功能`, cmdColor('執行動作', `node ${Path.relative(Setting.root, loader.file)}`))
          && setTimeout(_ => Process.exec(`node ${loader.file} --entry "${Config.entry}"`, error => error ? fail(null, error) : next(done())), 100)))

      Config.loaders.filter(({ ext }) => ext !== null)
        .forEach(loader => q.enqueue(next => title(`執行 ${loader.title} 功能`, cmdColor('執行動作', `verify src/*/*${loader.ext}`))
            && setTimeout(_ => Promise.all(scanDir(Config.entry)
              .filter(file => Path.extname(file) == loader.ext)
              .map(file => new Promise((resolve, reject) => Process.exec(`node ${loader.file} --entry "${Config.entry}" --file "${file}" --type first`, error => error ? reject(error) : resolve()))))
            .then(_ => next(done()))
            .catch(errors => fail(null, errors)), 100)))

      q.enqueue(next => closure(Config, Factory))
  },
  Watch (closure, Config, Factory) {
    title('監控 FILE 檔案', cmdColor('執行動作', 'watch files'))

    require('chokidar')
      .watch(Config.entry + '**' + Path.sep + '*')
      .on('add',    file => ready && Factory('create', file))
      .on('change', file => ready && Factory('update', file))
      .on('unlink', file => ready && Factory('delete', file))
      .on('error', error => ready ? title('監聽 FILE 檔案時發生錯誤！').fail(null, error) : fail(null, error))
      .on('ready', _ => closure(Config, Factory, done()))
  },
  Server (closure, Config, Factory) {
    const Port = require('./Port')

    println("\n 【啟動開發伺服器】".yellow)

    Queue()
      .enqueue(next => title('檢查 Server port ' + ('' + Config.server.port.default).lightGray, cmdColor('執行動作', 'listening ' + Config.server.port.default))
        && Port.status(Config.server.port.default,
          _ => next(true, done()),
          error => next(false, fail('失敗'))))

      .enqueue((next, result) => result
        ? next(Config.server.ssl, Config)
        : Port.scan(Config.server.port.min, Config.server.port.min, Config.server.port.max,
          port => title('檢查 Server port ' + port.lightGray, cmdColor('執行動作', 'listening ' + port)),
          port => next(Config.server.ssl, Config, done(Config.server.port.default = port)),
          (...errors) => fail('已被使用', ...errors)))

      .enqueue(require('./Response').server)

      .enqueue((next, server) => {
        title('開啟 ' + 'WebSocket'.yellow + ' 伺服器', cmdColor('執行動作', 'run WebSocket Server'))
        const SocketIO = require('socket.io')(server)
        Factory.reload = files => SocketIO.sockets.emit('reload', true, ready && println('   ● '.cyan + '重新整理頁面' + files.map((file) => "\n     ↳ ".cyan.dim + file.dim).join('') + "\n     ↳ ".cyan.dim + ('數量：' + SocketIO.sockets.sockets.size + ' 個頁面').dim))
        closure(Config, done())
      })
  },
  Finish (closure, Config) {
    const url = (Config.server.ssl ? 'https' : 'http') + '://' + Config.server.domain + ':' + Config.server.port.default + '/'

    println("\n 【準備開發】".yellow)
    println(' '.repeat(3) + '🎉 Yes! 環境已經就緒惹！')
    println(' '.repeat(3) + '⏰ 啟動耗費時間' + '：'.dim + during(startAt).lightGray)
    println(' '.repeat(3) + '🌏 開發網址' + '：'.dim + url.lightBlue.italic.underline)
    println(' '.repeat(3) + '🚀 Go! Go! Go! 趕緊來開發囉！')
    println("\n 【開發紀錄】".yellow)

    Config.autoOpenBrowser && require('open')(url)

    closure(ready = true)
  }
}
