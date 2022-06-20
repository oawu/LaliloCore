/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

const Path       = require('path')
const FileSystem = require('fs')
const { create: Queue } = require('@oawu/queue')
const { title, done, fail } = require('@oawu/cli-progress')
const { cmdColor, dirOrEmpty } = require('../Core')
const { println, access, isFile, argv, during, Typeof } = require('@oawu/helper')

const startAt = Date.now()
const errorLog = error => println("\n 【錯誤訊息】\n".red + ' '.repeat(3) + '◉'.red + ' ' + (error instanceof Error ? error.stack : error) + "\n") && process.emit('SIGINT')

const Setting = {
  root  : Path.resolve(__dirname, ('..' + Path.sep).repeat(5)) + Path.sep,
  config: Path.resolve(__dirname, ('..' + Path.sep).repeat(4)) + Path.sep + 'config' + Path.sep + 'Deploy.js'
}

module.exports = {
  Start: closure => {
    process.on('SIGINT', _ => process.exit(1))
    closure(println("\n" + ' § '.dim + '部署 Lalilo'.bold))
  },
  Build (closure) {
    const Build = require('../Build')
    Queue()
      .enqueue(Build.Check)
      .enqueue(Build.Compile)
      .enqueue(Build.Export)
      .enqueue((_, Config) => closure(Config))
  },
  Check (closure, BuildConfig) {
    println("\n" + ' 【檢查部署環境】'.yellow)

    Queue()
      .enqueue(next => {
        title('檢查設定檔是否存在？', cmdColor('執行動作', 'check Deploy\'s config file is exists?'))
        access(Setting.config) || fail(null, '沒有 ' + Path.relative(Setting.root, Setting.config) + ' 讀取權限')
        isFile(Setting.config) || fail(null, '路徑 ' + Path.relative(Setting.root, Setting.config) + ' 不是一個檔案')
        next(done())
      })

      .enqueue(next => {
        const Config = require(Setting.config)
        title('檢查設定檔內容', cmdColor('執行動作', 'verify Deploy\'s config file'))
        for (let key in Config)
          ['s3', 'github'].includes(Config[key].type) || delete Config[key]
        next(Config, done())
      })

      .enqueue((next, Config) => {
        title('檢查參數是否正確', cmdColor('執行動作', 'check Argv'))
        
        const goals = Object.keys(Config)
        goals.length || fail(null, '請給予 -G 參數，並且只允許 ' + goals.map(goal => goal.lightGray).join('、'.dim) + '')
        const goal = Typeof.str.do.or(argv(['-G', '--goal'], null), goal => goals.includes(goal) ? goal : null, goals[0])
        
        next(Config = Config[goal], done())
      })

      .enqueue((next, Config) => {

        if (Config.type != 'github')
          return next(Config)

        title('檢查 GitHub 設定參數', cmdColor('執行動作', 'check GitHub argv'))

        const project = (_ => {
          try { const output = require('child_process').execSync('git remote get-url origin', { stdio: 'pipe' }).toString(), { groups: { account = null, repository = null } = {} } = /^git@github\.com:(?<account>.*)\/(?<repository>.*)\.git/gi.exec(output) || /^https:\/\/github\.com\/(?<account>.*)\/(?<repository>.*)\.git/gi.exec(output) || {}; return { account, repository, branch: null, message: null } }
          catch (_) { return { account: null, repository: null, branch: null, message: null } }
        })()

        const config = (_ => ({
          account: Typeof.str.notEmpty.or(_.account, null),
          repository: Typeof.str.notEmpty.or(_.repository, null),
          branch: Typeof.str.notEmpty.or(_.branch, null),
          message: Typeof.str.notEmpty.or(_.message, null)
        }))(Config)

        const acc1 = argv(['-A', '--account'], null),    acc2 = config.account,    acc3 = project.account,    account    = Typeof.str.or(acc1, Typeof.str.or(acc2, Typeof.str.or(acc3, null)))
        const rep1 = argv(['-R', '--repository'], null), rep2 = config.repository, rep3 = project.repository, repository = Typeof.str.or(rep1, Typeof.str.or(rep2, Typeof.str.or(rep3, null)))
        const bra1 = argv(['-B', '--branch'], null),     bra2 = config.branch,     bra3 = project.branch,     branch     = Typeof.str.or(bra1, Typeof.str.or(bra2, Typeof.str.or(bra3, 'gh-pages')))
        const msg1 = argv(['-M', '--message'], null),    msg2 = config.message,    msg3 = project.message,    message    = Typeof.str.or(msg1, Typeof.str.or(msg2, Typeof.str.or(msg3, '🚀 部署！')))

        if (account === null) fail('錯誤', '部署至 GitHub 需給予 ' + '--account'.lightGray + ' 參數')
        if (repository === null) fail('錯誤', '部署至 GitHub 需給予 ' + '--repository'.lightGray + ' 參數')

        delete Config.account, delete Config.repository, delete Config.branch, delete Config.message

        Config.url = 'https://' + account + '.github.io/' + repository + '/'
        
        const destDir   = BuildConfig.dest
        const isDisplay = true

        done()

        require('@oawu/uploader')
          .GitHub({ account, repository, branch, message, destDir, isDisplay })
          .put(error => error ? errorLog(error) : next(Config))
      })

      .enqueue((next, Config) => {
        if (Config.type != 's3')
          return next(Config)

        title('檢查 AWS S3 設定參數', cmdColor('執行動作', 'check AWS S3 argv'))

        const bucket1 = argv(['-B', '--bucket'], null), bucket2 = Config.bucket, bucket = Typeof.str.or(bucket1, Typeof.str.or(bucket2, null))
        const access1 = argv(['-A', '--access'], null), access2 = Config.access, access = Typeof.str.or(access1, Typeof.str.or(access2, null))
        const secret1 = argv(['-S', '--secret'], null), secret2 = Config.secret, secret = Typeof.str.or(secret1, Typeof.str.or(secret2, null))
        
        if (bucket === null) fail('錯誤', '部署至 S3 需給予 ' + '--bucket'.lightGray + ' 參數')
        if (access === null) fail('錯誤', '部署至 S3 需給予 ' + '--access'.lightGray + ' 參數')
        if (secret === null) fail('錯誤', '部署至 S3 需給予 ' + '--secret'.lightGray + ' 參數')

        delete Config.bucket, delete Config.access, delete Config.secret
        
        const prefix     = Typeof.str.notEmpty.do.or(Config.prefix, val => dirOrEmpty(val), '')
        const ignoreDirs = Typeof.arr.do.or(Config.ignoreDirs, val => val.map(dirOrEmpty), [])
        const option     = Typeof.object.or(Config.putOptions, {})
        const destDir    = BuildConfig.dest
        const isDisplay  = true
        
        Config.url = 'https://' + bucket + '/' + prefix

        done()

        require('@oawu/uploader')
          .S3({ bucket, access, secret, prefix, ignoreDirs, option, destDir, isDisplay })
          .put(error => error ? errorLog(error) : next(Config))
      })

      .enqueue((next, { url }) => closure(url))
  },
  Finish (closure, url) {
    println("\n " + '【部署完成】'.yellow)
    println(' '.repeat(3) + '🎉 太棒惹，已經完成部署囉，趕緊去看最新版的吧！')
    println(' '.repeat(3) + '❗️ 若有設定 CDN 快取的話，請等 Timeout 後再試。')
    println(' '.repeat(3) + '⏰ 編譯耗費時間' + '：'.dim + during(startAt).lightGray)
    println(' '.repeat(3) + '🌏 這是您的網址' + '：'.dim + url.lightBlue.italic.underline)
    println("\n")
    closure()
  }
}
