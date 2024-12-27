#!/usr/bin/env node
require('@babel/register')({
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: [
    ['@babel/plugin-transform-react-jsx', {
      runtime: 'automatic'
    }]
  ],
  extensions: ['.js', '.jsx'],
  cache: false
});

const meow = require('meow');
const { render } = require('ink');
const React = require('react');
const importJsx = require('import-jsx');
const App = importJsx('../src/ui/app.jsx');

const cli = meow(`
    使用方法
     $ trnow <command> [options]

    命令
      init        初始化配置文件
      scan        扫描并预览需要国际化的文本
      transform   执行国际化转换
      revert      撤销上次转换
      update      增量更新已有的翻译
      
    选项
      --src          要扫描的项目源码目录 (默认: ./src)
      --locale-dir   语言文件目录 (默认: ./src/locales)
      --source-lang  源语言 (默认: zh-CN)
      --config      配置文件路径 (默认: .trnow.yml)
      --dry-run      仅预览不执行实际修改
      --backup-dir   备份文件目录 (默认: ./.trnow-backup)
`);

render(React.createElement(App, { 
    command: cli.input[0],
    flags: cli.flags 
}));

process.on('unhandledRejection', (error) => {
    console.error('发生错误:', error);
    process.exit(1);
}); 