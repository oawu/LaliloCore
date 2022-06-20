/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path = require('path')
const Exec = require('child_process').exec

const cmdColor = (desc, action = null) => desc.lightGray.dim + (action !== null ? '：'.dim + action.lightGray.dim.italic : '')

const deSlash = path => path.split(Path.sep).filter(t => t.length)

const dirOrEmpty = path => (path = deSlash(path), path.length ? path.join(Path.sep) + Path.sep : '')

const php2html = (path, file, config, argv, done) => {
  typeof argv == 'function' && (done = argv) && (argv = {})
  argv['--path'] = path
  argv['--config'] = config.config
  argv['--file'] = file
  argv['--env']  = config.env
  argv['--base-url'] = config.baseURL
  return Exec(['php', config.entry, ...Object.entries(argv).reduce((a, b) => a.concat(b), [])].join(' '), { maxBuffer: config.maxBuffer }, done)
}


module.exports = { cmdColor, deSlash, dirOrEmpty, php2html }