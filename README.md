# trnow

[![NPM version](https://img.shields.io/npm/v/@weekwood/trnow.svg)](https://www.npmjs.com/package/@weekwood/trnow)
[![NPM downloads](https://img.shields.io/npm/dm/@weekwood/trnow.svg)](https://www.npmjs.com/package/@weekwood/trnow)
[![License](https://img.shields.io/npm/l/@weekwood/trnow.svg)](https://github.com/weekwood/trnow/blob/main/LICENSE)

自动化的多框架国际化工具，支持 Vue 和 React 项目。自动扫描和替换项目中的中文文本，支持智能分词、增量更新、备份还原等功能。

## 特性

- 🔍 自动扫描 Vue/React 文件中的中文文本
- 🤖 智能中文分词和 key 生成
- 🎨 支持 AI 生成语义化的翻译 key
- 🎯 智能识别文本类型和上下文
- 🔄 实时批量处理和文件更新
- 🎨 支持 camelCase 和 snake_case 命名风格
- 📦 支持模板和脚本中的文本
- 🔧 可配置的扫描规则
- 📝 支持增量更新
- ⏪ 支持操作回滚
- 🔍 支持预览模式（dry-run）
- 💻 友好的命令行交互界面

## 安装

```bash
npm install -g @weekwood/trnow
# 或
yarn global add @weekwood/trnow
```

## 使用

### 1. 初始化项目

```bash
trnow init
```

这将创建配置文件 `.trnow.yml` 并引导你完成基本设置。

### AI 功能配置

如果你想使用 AI 功能来生成更语义化的翻译 key：

1. 在初始化时选择启用 AI 功能
2. 配置 DeepSeek API Key
3. AI 将自动：
   - 识别文本类型（按钮、标签、提示等）
   - 生成合适的命名空间
   - 创建语义化的 key

### 2. 扫描项目

```bash
# 使用配置文件
trnow scan

# 预览模式
trnow scan --dry-run
```

### 3. 执行转换

```bash
# 预览变更
trnow transform --dry-run

# 执行转换
trnow transform
```

### 4. 增量更新

当你添加了新的中文文本后：

```bash
trnow update
```

### 5. 撤销更改

如果需要回滚到上一次操作前：

```bash
trnow revert
```

## 配置文件

`.trnow.yml` 示例：

```yaml
source:
  dir: ./src
  patterns:
    - "**/*.vue"
    - "**/*.js"
    - "**/*.jsx"
    - "**/*.ts"
    - "**/*.tsx"
  ignore:
    - "node_modules/**"
    - "dist/**"
    - "**/*.test.{js,jsx,ts,tsx}"

locales:
  dir: ./src/locales
  source: zh-CN
  target:
    - en-US

patterns:
  jsx:
    attributes:
      - aria-label
      - placeholder
      - alt
      - title
      - data-tooltip
    componentProps:
      - label
      - message
      - description
      - tooltip

keyGeneration:
  style: snake_case  # 或 camelCase
  maxLength: 32
  prefix: ''
  ai:
    enabled: false  # 是否启用 AI 功能
    provider: 'deepseek'
    model: 'deepseek-chat'
    baseURL: 'https://api.deepseek.com/v1'
    apiKey: ''  # 你的 DeepSeek API Key

backup:
  dir: ./.trnow-backup
  keep: 5  # 保留最近5次备份
```

## 命令行选项

```bash
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
  --config       配置文件路径 (默认: .trnow.yml)
  --dry-run      仅预览不执行实际修改
```

## 开发

```bash
# 克隆项目
git clone https://github.com/weekwood/trnow.git

# 安装依赖
npm install

# 本地测试
npm run dev
```

## 贡献

欢迎提交 PR 和 Issue！

## License

MIT © [weekwood](https://github.com/weekwood)
