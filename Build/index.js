/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path = require('path')
const FileSystem = require('fs')
const Process = require('child_process')

const { create: Queue } = require('@oawu/queue')
const { title, done, fail, total, advance } = require('@oawu/cli-progress')
const { println, access, isFile, isDirectory, exists, mkdir, argv, Typeof, scanDir, during, verifyDirs, isSub } = require('@oawu/helper')
const { cmdColor, deSlash, dirOrEmpty, php2html } = require('../Core')

const startAt = Date.now()

const Setting = {
  root  : Path.resolve(__dirname, ('..' + Path.sep).repeat(5)) + Path.sep,
  config: Path.resolve(__dirname, ('..' + Path.sep).repeat(4)) + Path.sep + 'config' + Path.sep + 'Build.js'
}

module.exports = {
  Start: closure => {
    process.on('SIGINT', _ => process.exit(1))
    closure(println("\n" + ' § '.dim + '編譯 Lalilo 專案'.bold))
  },

  Check (closure) {
    const CmdExists  = require('command-exists').sync

    println("\n" + ' 【檢查編譯環境】'.yellow)

    Queue()
      .enqueue(next => {
        title('檢查設定檔是否存在？', cmdColor('執行動作', 'check Build\'s config file is exists?'))
        access(Setting.config) || fail(null, '沒有 ' + Path.relative(Setting.root, Setting.config) + ' 讀取權限')
        isFile(Setting.config) || fail(null, '路徑 ' + Path.relative(Setting.root, Setting.config) + ' 不是一個檔案')
        next(done())
      })

      .enqueue(next => {
        const Config = require(Setting.config)

        title('檢查設定檔內容', cmdColor('執行動作', 'verify Build\'s config file'))

        // entry
        Config.entry = Setting.root + Typeof.str.notEmpty.do.or(Config.entry, entry => dirOrEmpty(entry), 'src')
        access(Config.entry) || fail(null, Path.relative(Setting.root, Config.entry) + Path.sep + ' 沒有讀取權限')
        isDirectory(Config.entry) || fail(null, Path.relative(Setting.root, Config.entry) + Path.sep + ' 不是目錄類型')

        // dest
        Config.dest = Setting.root + Typeof.str.notEmpty.do.or(Config.dest, dest => dirOrEmpty(dest), 'src')
        exists(Config.dest) || mkdir(Config.dest)
        access(Config.dest) || fail(null, Path.relative(Setting.root, Config.dest) + Path.sep + ' 沒有讀取權限')
        isDirectory(Config.dest) || fail(null, Path.relative(Setting.root, Config.dest) + Path.sep + ' 不是目錄類型')

        // php
        Config.php = Typeof.object.or(Config.php, {})
        Config.php.enable = Typeof.bool.or(Config.php.enable, false)
        Config.php.maxBuffer = Typeof.num.or(Config.php.maxBuffer, 1024 * 1024)
        Config.php.env = Typeof.str.do.or(Config.php.env, env => ['Development', 'Testing', 'Staging', 'Production'].includes(env) ? env : null, 'Development')
        Config.php.baseURL = Typeof.str.do.or(Config.php.baseURL, baseURL => baseURL.replace(/\/*$/, '') + '/', null)
        Config.php.entry = Path.resolve(__dirname + ['', '..', 'PHP', 'Main.php'].join(Path.sep))
        Config.php.config = Setting.root + ['cmd', 'config', 'php', ''].join(Path.sep)

        // autoOpenFolder
        Config.autoOpenFolder = Typeof.bool.or(Config.autoOpenFolder, false)

        // minify
        Config.minify = Typeof.bool.or(Config.minify, false)

        // jsCover
        Config.jsCover = Typeof.arr.or(Config.jsCover, [])

        // exts
        Config.exts = Typeof.arr.do.or(Config.exts, exts => exts.map(ext => ext.toLowerCase()), [])

        Config.includeFiles = Typeof.arr.or(Config.includeFiles, []).map(dir => Config.entry + dir)

        Config.ignoreDirs = Typeof.arr.or(Config.ignoreDirs, []).map(dir => Config.entry + dirOrEmpty(dir)).filter(dir => access(dir) && exists(dir))

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
    const Serve = require('../Serve')
    Queue()
      .enqueue(Serve.Check)
      .enqueue(Serve.Compile)
      .enqueue((_, ServeConfig) => closure(ServeConfig, Config))
  },
  Export (closure, { dir: { html: htmlDir } = {} }, Config) {
    if (htmlDir === undefined) htmlDir = Config.entry

    println("\n" + ' 【編譯並輸出目錄】'.yellow)

    Queue()
      .enqueue(next => title('清空輸出目錄', cmdColor('執行指令', 'rm -rf ' + Path.relative(Setting.root, Config.dest) + Path.sep + '*'))
        && Process.exec('rm -rf ' + Config.dest + '*', error => error ? fail('錯誤', error) : next(done())))

      .enqueue(next => title('掃描開發目錄', cmdColor('執行動作', 'scan ' + Path.relative(Setting.root, Config.entry) + Path.sep + '*'))
        && next(scanDir(Config.entry)
          .map(src => ({ src, ext: Path.extname(src).toLowerCase() }))
          .filter(({ src }) => !Config.ignoreDirs.filter(ignoreDir => isSub(ignoreDir, src)).length)
          .filter(({ src, ext }) => Config.includeFiles.includes(src) || Config.exts.includes(ext))
          .filter(({ ext }) => ext != '.php' || Config.php.enable)
          .filter(file => !['.html', '.php'].includes(file.ext) || isSub(htmlDir, file.src))
          .map(file => ({
            ...file,
            dist: {
              base: Config.dest,
              dirs: deSlash(Path.relative(isSub(htmlDir, file.src) ? htmlDir : Config.entry, Path.dirname(file.src))),
              name: Path.basename(file.src, file.ext) + (file.ext == '.php' ? '.html' : file.ext),
              get path () { return this.base + [...this.dirs, this.name].join(Path.sep) }
            }
          })), done()))

      .enqueue((next, files) => title('整理分類檔案', cmdColor('執行動作', 'dispatch files'))
        && next({
          cssFiles: files.filter(({ ext }) => ext == '.css'),
          jsFiles: files.filter(({ ext }) => ext == '.js'),
          htmlFiles: files.filter(({ ext }) => ext == '.html'),
          phpFiles: files.filter(({ ext }) => ext == '.php'),
          otherFiles: files.filter(({ ext }) => !['.css', '.js', '.html', '.php'].includes(ext))
        }, done()))

      .enqueue((next, files) => title('建立 .gitignore 檔案', cmdColor('執行動作', 'create .gitignore file'))
        && FileSystem.writeFile(Config.dest + '.gitignore', '*' + "\n", 'utf8', error => error
          ? fail(null, '建立 .gitignore 時發生錯誤！', error)
          : next(files, done())))

      .enqueue((next, files) => {
        const Minify = require('clean-css'), queue = Queue()

        title((Config.minify ? '壓縮' : '複製') + ' CSS 檔案', cmdColor('執行動作', (Config.minify ? 'minify' : 'copy') + ' .css files'))
        total(files.cssFiles.length)

        files.cssFiles.forEach(file => queue.enqueue(next => verifyDirs(file.dist.base, file.dist.dirs) 
          ? FileSystem.readFile(file.src, 'utf8', (error, data) => error
            ? fail('失敗', '無法讀取 ' + Path.relative(Setting.root, file.src), error)
            : FileSystem.writeFile(file.dist.path, Config.minify ? new Minify().minify(data).styles : data, 'utf8', error => error
              ? fail('失敗', '無法寫入 ' + Path.relative(Setting.root, file.dist.path), error)
              : next(advance)))
          : fail('失敗', '無法建立 ' + Path.relative(Setting.root, file.dist.base + file.dist.dirs.join(Path.sep)) + Path.sep + ' 目錄')))

        queue.enqueue(_ => next(files, done()))
      })

      .enqueue((next, files) => {
        const Babel = require("@babel/core"), queue = Queue()

        title((Config.minify ? '處理' : '複製') + ' JavaScript 檔案', cmdColor('執行動作', (Config.minify ? 'modify' : 'copy') + ' .js files'))
        total(files.jsFiles.length)

        files.jsFiles.forEach(file => queue.enqueue(next => verifyDirs(file.dist.base, file.dist.dirs) 
          ? FileSystem.readFile(file.src, 'utf8', (error, data) => error
            ? fail('失敗', '無法讀取 ' + Path.relative(Setting.root, file.src), error)
            : FileSystem.writeFile(file.dist.path, Config.minify ? Babel.transformSync(data, { presets: Config.jsCover }).code : data, 'utf8', error => error
              ? fail('失敗', '無法寫入 ' + Path.relative(Setting.root, file.dist.path), error)
              : next(advance)))
          : fail('失敗', '無法建立 ' + Path.relative(Setting.root, file.dist.base + file.dist.dirs.join(Path.sep)) + Path.sep + ' 目錄')))

        queue.enqueue(_ => next(files, done()))
      })

      .enqueue((next, files) => {
        const Minify = require('html-minifier').minify, queue = Queue()

        title((Config.minify ? '編譯' : '複製') + ' PHP 檔案', cmdColor('執行動作', (Config.minify ? 'build' : 'copy') + ' .php files'))
        total(files.phpFiles.length)

        files.phpFiles.forEach(file => queue.enqueue(next => verifyDirs(file.dist.base, file.dist.dirs) 
          ? php2html(Config.dest, file.src, Config.php, (error, data) => error
            ? fail('失敗', '無法執行 ' + Path.relative(Setting.root, file.src), error)
            : FileSystem.writeFile(file.dist.path, Config.minify ? Minify(data, { collapseWhitespace: true, continueOnParseError: false }) : data, 'utf8', error => error
              ? fail('失敗', '無法寫入 ' + Path.relative(Setting.root, file.dist.path), error)
              : next(advance)))
          : fail('失敗', '無法建立 ' + Path.relative(Setting.root, file.dist.base + file.dist.dirs.join(Path.sep)) + Path.sep + ' 目錄')))

        queue.enqueue(_ => next(files, done()))
      })

      .enqueue((next, files) => {

        const Minify = require('html-minifier').minify, queue = Queue()

        title((Config.minify ? '壓縮' : '複製') + ' HTML 檔案', cmdColor('執行動作', (Config.minify ? 'minify' : 'copy') + ' .html files'))
        total(files.htmlFiles.length)

        files.htmlFiles.forEach(file => queue.enqueue(next => verifyDirs(file.dist.base, file.dist.dirs) 
          ? FileSystem.readFile(file.src, 'utf8', (error, data) => error
            ? fail('失敗', '無法讀取 ' + Path.relative(Setting.root, file.src), error)
            : FileSystem.writeFile(file.dist.path, Config.minify ? Minify(data, { collapseWhitespace: true, continueOnParseError: false }) : data, 'utf8', error => error
              ? fail('失敗', '無法寫入 ' + Path.relative(Setting.root, file.dist.path), error)
              : next(advance)))
          : fail('失敗', '無法建立 ' + Path.relative(Setting.root, file.dist.base + file.dist.dirs.join(Path.sep)) + Path.sep + ' 目錄')))

        queue.enqueue(_ => next(files, done()))
      })

      .enqueue((next, files) => {
        const queue = Queue()
        
        title('複製其他檔案', cmdColor('執行動作', 'copy other files'))
        total(files.otherFiles.length)

        files.otherFiles.forEach(file => queue.enqueue(next => verifyDirs(file.dist.base, file.dist.dirs) 
          ? FileSystem.copyFile(file.src, file.dist.path, error => error
            ? fail('失敗', '無法複製 ' + Path.relative(Setting.root, file.src), error)
            : next(advance))
          : fail('失敗', '無法建立 ' + Path.relative(Setting.root, file.dist.base + file.dist.dirs.join(Path.sep)) + Path.sep + ' 目錄')))

        queue.enqueue(_ => closure(Config, done()))
      })
  },
  Finish (closure, Config) {
    println("\n " + '【編譯完成】'.yellow)
    println(' '.repeat(3) + '🎉 太棒惹，已經完成編譯囉，趕緊去看一下的吧！')
    println(' '.repeat(3) + '⏰ 編譯耗費時間' + '：'.dim + during(startAt).lightGray)
    println(' '.repeat(3) + '🚀 編譯完後的目錄在專案下的 ' + (Path.relative(Setting.root, Config.dest) + Path.sep).lightGray)
    println("\n")
    Config.autoOpenFolder && require('open')(Config.dest)

    closure()
  }
}
