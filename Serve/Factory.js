/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path = require('path')
const SCSS = require('@oawu/scss')
const FileSystem = require('fs')
const Notifier = require('./Notifier')
const Process = require('child_process')

const { verifyDirs, println, isSub } = require('@oawu/helper')

SCSS.minify = false

let Queue = {
  $file: require('@oawu/queue').create(),
  $loader: require('@oawu/queue').create(),
  icon: {},
  scss: {},
  file: {},
  object (factory) {
    if (factory instanceof Factory.Icon) return this.icon
    if (factory instanceof Factory.Scss) return this.scss
    if (factory instanceof Factory.File) return this.file
    return undefined
  },
  push (factory, time) {
    let object = this.object(factory)
    if (object === undefined) return 
    else object[factory.file] = setTimeout(_ => this.$file.enqueue(next => factory.build(errors => next(errors, object[factory.file].count = 0))), time, clearTimeout(object[factory.file]))
  }
}

const lineRed    = (text, ...lines) => println('   ● '.red + text + lines.map(line => "\n     ↳ ".red.dim + line).join(''))
const lineBlue   = (text, ...lines) => println('   ● '.lightBlue + text + lines.map(line => "\n     ↳ ".lightBlue.dim + line).join(''))
const lineGreen  = (text, ...lines) => println('   ● '.green + text + lines.map(line => "\n     ↳ ".green.dim + line).join(''))
const removeFile = (path, fail, done) => FileSystem.exists(path, exists => exists ? FileSystem.unlink(path, error => error ? fail(error.message) : FileSystem.exists(path, exists => exists ? fail('刪除失敗！') : done())) : done())

const Factory = function(type, file) {
  if (this instanceof Factory)
    return this.type = type, this.file = file, this.name = Path.relative(Factory.root, file), this

  const last = file.split(Path.sep).pop()

  if (last == '.DS_Store') return

  const ext = Path.extname(last)

  if (isSub(Factory.config.dir.icon, file) && ext == '.css' && last == 'style.css')
    return Queue.push(Factory.Icon(type, file), 357)

  if (isSub(Factory.config.dir.scss, file) && ext == '.scss')
    return Queue.push(Factory.Scss(type, file), 357)

  if (isSub(Factory.config.entry, file) && !Factory.config.watch.ignoreDirs.filter(dir => isSub(dir, file)).length && Factory.config.watch.formats.includes(ext))
    return Queue.$file.enqueue(next => Factory.File(type, file).build(next))

  return Factory.config.loaders
    .filter(({ ext }) => ext !== null)
    .forEach(loader => Queue.$loader.enqueue(next => Process.exec(`node ${loader.file} --dir "${Factory.root}" --entry "${Factory.config.entry}" --file "${file}" --type ${type}`, error => error ? next(lineRed(`${loader.title} 失敗`, '錯誤原因：'.dim + error.message)) : next(lineBlue(`${loader.title} 成功`, '檔案路徑：'.dim + Path.relative(Factory.root, file).dim)))))
}

Factory.root   = null
Factory.reload = null
Factory.config = null

Factory.prototype.build = function(done) { return done([]) }
Factory.prototype.parse = function(data) { return data }

Factory.Icon = function(type, file) {
  if (!(this instanceof Factory.Icon)) return new Factory.Icon(type, file)
  else Factory.call(this, type, file)

  this.dir   = Path.dirname(file).split(Path.sep).pop()
  this.face  = 'icon' + (this.dir != 'icomoon' ? '-' + this.dir : '')
  this.class = '.' + this.face + '-'
  this.scss  = Factory.config.dir.scss + this.face + '.scss'
}
Factory.Icon.prototype = Object.create(Factory.prototype)
Factory.Icon.prototype.build = function(done) {
  if (this.type == 'first')
    return FileSystem.readFile(this.file, 'utf8', (error, data) => error
      ? done(['無法讀取：' + this.name, error])
      : FileSystem.writeFile(this.scss, this.parse(data), error => error
        ? done(['無法寫入：' + Path.relative(Factory.root, this.scss), error])
        : done([])))

  if (this.type == 'create')
    return FileSystem.readFile(this.file, 'utf8', (error, data) => error
      ? done(lineRed('新增 icon 失敗', '錯誤原因：'.dim + '無法讀取：' + this.name + '，' + error.message))
      : FileSystem.writeFile(this.scss, this.parse(data), error => error
        ? done(lineRed('新增 icon 失敗', '錯誤原因：'.dim + '無法寫入：' + Path.relative(Factory.root, this.scss) + '，' + error.message))
        : done(lineBlue('新增 icon 成功', '檔案路徑：'.dim + this.name.dim, '新增檔案：'.dim + Path.relative(Factory.root, this.scss).dim))))
  
  if (this.type == 'update')
    return FileSystem.readFile(this.file, 'utf8', (error, data) => error
      ? done(lineRed('修改 icon 失敗', '錯誤原因：'.dim + '無法讀取：' + this.name + '，' + error.message))
      : FileSystem.writeFile(this.scss, this.parse(data), error => error
        ? done(lineRed('修改 icon 失敗', '錯誤原因：'.dim + '無法寫入：' + Path.relative(Factory.root, this.scss) + '，' + error.message))
        : done(lineBlue('修改 icon 成功', '檔案路徑：'.dim + this.name.dim, '更新檔案：'.dim + Path.relative(Factory.root, this.scss).dim))))

  if (this.type == 'delete')
    return removeFile(this.scss,
      error => done(lineRed('移除 scss 失敗', '錯誤原因：'.dim + '無法移除：' + Path.relative(Factory.root, this.scss) + '，' + error)),
      _ => done(lineBlue('移除 scss 成功', '檔案路徑：'.dim + Path.relative(Factory.root, this.scss).dim)))

  return done()
}
Factory.Icon.prototype.parse = function(data) {
  const importStr = '@import "Lalilo";', basePath = '../icon/', contents = ['//', '// @author      OA Wu <oawu.twu@gmail.com>', '// @copyright   Copyright (c) 2015 - ' + new Date().getFullYear() + ', Lalilo', '// @license     http://opensource.org/licenses/MIT  MIT License', '// @link        https://www.ioa.tw/', '//', '', importStr]
  return data = data.match(/\.icon-[a-zA-Z_\-0-9]*:before\s?\{\s*content:\s*"[\\A-Za-z0-9]*";(\s*color:\s*#[A-Za-z0-9]*;)?\s*}/g), data = Array.isArray(data) ? data.map(v => v.replace(/^\.icon-/g, this.class).replace(/\n/g, ' ').replace(/\{\s*/g, '{ ').replace(/\s+/g, ' ')).sort((a, b) => a >= b ? a == b ? 0 : 1 : -1) : [], data.length ? [...contents, '', '@font-face { font-family: "' + this.face + '"; src: url("' + basePath + this.dir + '/fonts/icomoon.eot?t='  + new Date().getTime() + '") format("embedded-opentype"), url("' + basePath + this.dir + '/fonts/icomoon.woff?t=' + new Date().getTime() + '") format("woff"), url("' + basePath + this.dir + '/fonts/icomoon.ttf?t='  + new Date().getTime() + '") format("truetype"), url("' + basePath + this.dir + '/fonts/icomoon.svg?t='  + new Date().getTime() + '") format("svg"); }', '', '*[class^="' + this.face +'-"]:before, *[class*=" ' + this.face +'-"]:before {', '  font-family: "' + this.face + '";', '  speak: none;', '  font-style: normal;', '  font-weight: normal;', '  font-variant: normal;', '}', '', ...data, ''].join("\n") : contents.join("\n")
}

Factory.Scss = function(type, file) {
  return this instanceof Factory.Scss
    ? Factory.call(this, type, file, this.dirs = Path.relative(Factory.config.dir.scss, file).split(Path.sep).filter(t => t.length), this.css = Factory.config.dir.css + [...this.dirs.slice(0, -1), Path.basename(this.dirs.pop(), '.scss') + '.css'].join(Path.sep))
    : new Factory.Scss(type, file)
}
Factory.Scss.prototype = Object.create(Factory.prototype)
Factory.Scss.prototype.build = function(done) {
  if (this.type == 'first')
    return SCSS.file(this.file, (error, result) => error
      ? done(['無法編譯：' + this.name, '錯誤位置：第 ' + error.line + ' 行，第 ' + error.column + ' 個字', '錯誤原因：' + error.info])
      : verifyDirs(Factory.config.dir.css, this.dirs) !== true
        ? done(['無法建立目錄：' + Path.dirname(Path.relative(Factory.root, this.css)) + Path.sep])
        : FileSystem.writeFile(this.css, result.utf8.replace(/^\uFEFF/gm, ""), error => error
          ? done(['無法寫入：' + Path.relative(Factory.root, this.css), error])
          : done([])))

  if (this.type == 'create')
    return SCSS.file(this.file, (error, result) => error
      ? done(lineRed('編譯 scss 失敗', '錯誤檔案：'.dim + this.name, '錯誤位置：'.dim + '第 ' + error.line + ' 行，第 ' + error.column + ' 個字', '錯誤原因：'.dim + error.info), Notifier('錯誤檔案：' + this.name + '\n錯誤位置：第 ' + error.line + ' 行，第 ' + error.column + ' 個字', '編譯 scss 失敗'))
      : verifyDirs(Factory.config.dir.css, this.dirs) !== true
        ? done(lineRed('無法建立目錄：' + Path.dirname(Path.relative(Factory.root, this.css)) + Path.sep), Notifier('無法建立目錄：' + Path.dirname(Path.relative(Factory.root, this.css)) + Path.sep))
        : FileSystem.writeFile(this.css, result.utf8.replace(/^\uFEFF/gm, ""), error => error
          ? done(lineRed('新增 scss 失敗', '錯誤原因：'.dim + '無法寫入 ' + Path.relative(Factory.root, this.css) + '，' + error.message), Notifier('錯誤原因：無法寫入 ' + Path.relative(Factory.root, this.css) + '，' + error.message, '新增 scss 失敗'))
          : done(lineGreen('新增 scss 成功', '檔案路徑：'.dim + this.name.dim, '新增檔案：'.dim + Path.relative(Factory.root, this.css).dim, '編譯耗時：'.dim + (result.stats.duration / 1000) + ' 秒'.dim))))

  if (this.type == 'update')
    return SCSS.file(this.file, (error, result) => error
      ? done(lineRed('編譯 scss 失敗', '錯誤檔案：'.dim + this.name, '錯誤位置：'.dim + '第 ' + error.line + ' 行，第 ' + error.column + ' 個字', '錯誤原因：'.dim + error.info), Notifier('錯誤檔案：' + this.name + '\n錯誤位置：第 ' + error.line + ' 行，第 ' + error.column + ' 個字', '編譯 scss 失敗'))
      : verifyDirs(Factory.config.dir.css, this.dirs) !== true
        ? done(lineRed('無法建立目錄：' + Path.dirname(Path.relative(Factory.root, this.css)) + Path.sep), Notifier('無法建立目錄：' + Path.dirname(Path.relative(Factory.root, this.css)) + Path.sep))
        : FileSystem.writeFile(this.css, result.utf8.replace(/^\uFEFF/gm, ""), error => error
          ? done(lineRed('修改 scss 失敗', '錯誤原因：'.dim + '無法寫入 ' + Path.relative(Factory.root, this.css) + '，' + error.message), Notifier('錯誤原因：無法寫入 ' + Path.relative(Factory.root, this.css) + '，' + error.message, '修改 scss 失敗'))
          : done(lineGreen('修改 scss 成功', '檔案路徑：'.dim + this.name.dim, '更新檔案：'.dim + Path.relative(Factory.root, this.css).dim, '編譯耗時：'.dim + (result.stats.duration / 1000) + ' 秒'.dim))))

  if (this.type == 'delete')
    return removeFile(this.css,
      error => done(lineRed('移除 css 失敗', '錯誤原因：'.dim + '無法移除：' + Path.relative(Factory.root, this.css) + '，' + error), Notifier('錯誤原因：無法移除 ' + Path.relative(Factory.root, this.css) + '，' + error, '移除 css 失敗')),
      _ => done(lineGreen('移除 css 成功', '檔案路徑：'.dim + Path.relative(Factory.root, this.css).dim)))

  return done()
}

Factory.File = function(type, file) {
  return this instanceof Factory.File
    ? Factory.call(this, type, file, this.title = (type != 'create' ? type != 'update' ? '刪除' : '修改' : '新增') + '：' + Path.relative(Factory.root, file), Queue.file[this.title] === undefined ? (Queue.file[this.title] = 1) : (Queue.file[this.title] += 1))
    : new Factory.File(type, file)
}
Factory.File.timer = null
Factory.File.prototype = Object.create(Factory.prototype)
Factory.File.prototype.build = function(done) { return done(
  clearTimeout(Factory.File.timer),
  Factory.File.timer = setTimeout(
    _ => Factory.reload && Factory.reload(
      Object.entries(Queue.file).map(
        ([key, val]) => key + (val > 1 ? ' (' + val + ')' : '')),
      Queue.file = {}), 300)) }

module.exports = Factory
