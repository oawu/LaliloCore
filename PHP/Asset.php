<?php

/**
 * @author      OA Wu <oawu.twu@gmail.com>
 * @copyright   Copyright (c) 2015 - 2022, LaliloCore
 * @license     http://opensource.org/licenses/MIT  MIT License
 * @link        https://www.ioa.tw/
 */

namespace HTML {
  class Asset {
    private $cssPaths = [];
    private $jsPaths = [];

    public function __construct() {}

    private function map($path, $ext) {
      $dirs = [];
      $subs = [];
      foreach (scandir($path) as $dir)
        if (is_dir($path . $dir))
          in_array($dir, ['.', '..']) || $subs = array_merge($subs, $this->map($path . $dir . DIRECTORY_SEPARATOR, $ext));
        else
          pathinfo($path . $dir, PATHINFO_EXTENSION) == $ext && is_readable($path . $dir) && array_push($dirs, $path . $dir);
      $dirs = array_merge($dirs, $subs);
      return $dirs;
    }

    public function css($path) {
      if (preg_match('/^https?:\/\/.*/ui', $path)) {
        $this->cssPaths[$path] = true;
        return $this;
      }
      if (substr($path, -1) == '*' && ($path = realpath(PATH_ENTRY_CSS . str_replace('/', DIRECTORY_SEPARATOR, substr($path, 0, -1)))) !== false) {
        $files = $this->map($path . DIRECTORY_SEPARATOR, 'css');
        foreach ($files as $file) $this->cssPaths[(ENVIRONMENT != 'Development' ? URL_CSS : '/css/') . pathReplace(PATH_ENTRY_CSS, $file)] = $file;
        return $this;
      }

      $path = realpath(PATH_ENTRY_CSS . str_replace('/', DIRECTORY_SEPARATOR, $path));
      if (!($path !== false && pathinfo($path, PATHINFO_EXTENSION) == 'css' && is_readable($path))) return $this;
      $this->cssPaths[(ENVIRONMENT != 'Development' ? URL_CSS : '/css/') . pathReplace(PATH_ENTRY_CSS, $path)] = $path;
      return $this;
    }


    public function js($path) {
      if (preg_match('/^https?:\/\/.*/ui', $path)) {
        $this->jsPaths[$path] = true;
        return $this;
      }
      if (substr($path, -1) == '*' && ($path = realpath(PATH_ENTRY_JS . str_replace('/', DIRECTORY_SEPARATOR, substr($path, 0, -1)))) !== false) {
        $files = $this->map($path . DIRECTORY_SEPARATOR, 'js');
        foreach ($files as $file) $this->jsPaths[(ENVIRONMENT != 'Development' ? URL_JS : '/js/') . pathReplace(PATH_ENTRY_JS, $file)] = $file;
        return $this;
      }

      $path = realpath(PATH_ENTRY_JS . str_replace('/', DIRECTORY_SEPARATOR, $path));
      if (!($path !== false && pathinfo($path, PATHINFO_EXTENSION) == 'js' && is_readable($path))) return $this;
      $this->jsPaths[(ENVIRONMENT != 'Development' ? URL_JS : '/js/') . pathReplace(PATH_ENTRY_JS, $path)] = $path;
      return $this;
    }

    public function __toString() {
      $strs = [];
      $prev = loadConfig('Asset', []);
      
      if (in_array(ENVIRONMENT, ['Development', 'Testing'])) {
        $css = array_values(
          array_filter(
            array_map(function($path) {
              return !is_string($path)
                ? is_array($path)
                  ? implode("\n", array_map(function($src, $file) {
                      return \HTML\link()->type('text/css')->rel('stylesheet')->href($src . '?v=' . md5_file($file));
                    }, array_keys($path), array_values($path)))
                  : null
                : \HTML\link()->type('text/css')->rel('stylesheet')->href($path); },
            self::merge($this->cssPaths))));

        $js = array_values(
          array_filter(
            array_map(function($path) {
              return !is_string($path)
                ? is_array($path)
                  ? implode("\n", array_map(function($src, $file) {
                      return \HTML\script()->type('text/javascript')->language('javascript')->src($src . '?v=' . md5_file($file));
                    }, array_keys($path), array_values($path)))
                  : null
                : \HTML\script()->type('text/javascript')->language('javascript')->src($path);
            },
            self::merge($this->jsPaths))));
        
        array_push($strs, "\n");
        $prev && array_push($strs, ...$prev, ...['']);
        $css && array_push($strs, ...$css, ...['']);
        $js && array_push($strs, ...$js, ...['']);
        array_push($strs, "");
        return implode("\n", $strs);
      }

      $css = implode('',
        array_values(
          array_filter(
            array_map(function($path) {
              return !is_string($path)
                ? is_array($path)
                  ? \HTML\style(...array_map(function($src, $file) {
                      return preg_replace("/^" . pack('H*','EFBBBF') . "/", '',
                            preg_replace("/url\(\'?\.\.\/icon\//", "url(" . URL_ICON,
                              fileRead($file)));
                    }, array_keys($path), array_values($path))
                  )->type('text/css')
                  : null
                : \HTML\link()->type('text/css')->rel('stylesheet')->href($path);
              }, self::merge($this->cssPaths)))));
      
      $prev = implode('', array_map(function($prev) { return $prev->text(); }, $prev));

      $js = implode("\n",
        array_values(
          array_filter(
            array_map(function($path) use ($prev) {
              return !is_string($path)
                ? is_array($path)
                  ? \HTML\script($prev . "\n" . implode("\n", array_map(function($src, $file) {
                      return preg_replace("/^" . pack('H*','EFBBBF') . "/", '', fileRead($file));
                    }, array_keys($path), array_values($path))))->type('text/javascript')
                  : null
                : \HTML\script()->type('text/javascript')->language('javascript')->src($path);
            }, self::merge($this->jsPaths)))));

      $css && array_push($strs, $css);
      $js && array_push($strs, $js);

      return implode("", $strs);
    }

    private static function merge($tmps) {
      $paths = [];

      foreach (array_filter($tmps) as $src => $tmp)
        if (is_string($tmp) && isset($paths[count($paths) - 1]) && is_array($paths[count($paths) - 1]))
          $paths[count($paths) - 1][$src] = $tmp;
        else if (is_string($tmp))
          array_push($paths, [$src => $tmp]);
        else
          array_push($paths, $src);

      return $paths;
    }

    public static function create() {
      return new static();
    }
  }
  function Asset() {
    return Asset::create();
  }
}
