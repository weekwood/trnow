const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { parse: vueParser } = require('@vue/compiler-sfc');
const { parse: babelParser } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const AIKeyGenerator = require('../utils/ai-key-generator');

const execute = async (flags = {}) => {
    // 加载配置文件
    const config = await require('./init').loadConfig(flags.config);

    const src = flags.src || './src';

    const results = [];
    const aiGenerator = new AIKeyGenerator(config.keyGeneration?.ai);
    const batchSize = aiGenerator.batchSize || 20;
    const aiKeyMap = new Map();

    // 获取所有文件
    const files = glob.sync('**/*.{vue,js,jsx,tsx}', {
        cwd: src,
        absolute: true,
        nodir: true,
        ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**'
        ]
    });

    if (files.length === 0) {
        return [{
            type: 'info',
            text: `在 ${src} 目录下没有找到任何可扫描的文件`
        }];
    }

    // 先收集所有文���
    const allTexts = new Set();

    // 遍历所有文件
    const processFile = async (file) => {
        if (file.match(/\.(jsx|tsx)$/)) {
            const content = await fs.readFile(file, 'utf-8');
            const jsxResults = scanJSX(content);
            for (const { text, type } of jsxResults) {
                results.push({
                    file: path.relative(process.cwd(), file),
                    text,
                    type
                });
                allTexts.add(text);
            }
        } else if (file.match(/\.vue$/)) {
            const content = await fs.readFile(file, 'utf-8');
            const { descriptor } = vueParser(content);

            if (descriptor.template) {
                const templateResults = scanTemplate(descriptor.template.content);
                for (const { text, type } of templateResults) {
                    results.push({
                        file: path.relative(process.cwd(), file),
                        text,
                        type
                    });
                    allTexts.add(text);
                }
            }

            if (descriptor.script) {
                const scriptResults = scanScript(descriptor.script.content);
                for (const { text, type } of scriptResults) {
                    results.push({
                        file: path.relative(process.cwd(), file),
                        text,
                        type
                    });
                    allTexts.add(text);
                }
            }
        }

        // 更新扫描进度
        if (typeof flags.onProgress === 'function') {
            flags.onProgress({
                type: 'progress',
                text: `扫描中: ${path.relative(process.cwd(), file)}`,
                current: files.indexOf(file) + 1,
                total: files.length
            });
        }
    };

    // 并行处理所有文件
    await Promise.all(files.map(processFile));

    // 分批处理所有文本
    const textsArray = [...allTexts];
    const totalBatches = Math.ceil(textsArray.length / batchSize);
    for (let i = 0; i < textsArray.length; i += batchSize) {
        const batch = textsArray.slice(i, i + batchSize);
        await processAIBatch(batch, aiGenerator, flags, aiKeyMap);
        
        // 每个批次处理完后就更新文件
        if (flags.onBatchComplete) {
            await flags.onBatchComplete({
                results,
                aiKeyMap,
                processedTexts: batch
            });
        }
        
        // 更新 AI 处理进度
        if (typeof flags.onProgress === 'function') {
            flags.onProgress({
                type: 'progress',
                text: `AI 处理中: ${Math.min((i + batchSize) / textsArray.length * 100, 100).toFixed(1)}%`,
                current: Math.min(i + batchSize, textsArray.length),
                total: textsArray.length
            });
        }
    }

    if (results.length === 0) {
        return [{
            type: 'info',
            text: '没有找到需要国际化的中文文本'
        }];
    }

    return {
        results,
        aiKeyMap
    };
};

// 扫描模板中的中文文本
const scanTemplate = (template) => {
    const results = [];
    
    // 增加更多属性的扫描
    const attrRegex = /(?:label|message|placeholder|title|tooltip|alt|aria-label)=["']([^"']*[\u4e00-\u9fa5]+[^"']*)["']/g;
    
    // 增加对 v-text 和 v-html 的扫描
    const vDirectiveRegex = /v-(?:text|html)=["']'?([^"']*[\u4e00-\u9fa5]+[^"']*)'?["']/g;
    const bindRegex = /:(?:title|label|placeholder)=["']'?([^"']*[\u4e00-\u9fa5]+[^"']*)'?["']/g;
    
    let match;
    
    while ((match = attrRegex.exec(template)) !== null) {
        results.push(match[1]);
    }

    while ((match = vDirectiveRegex.exec(template)) !== null) {
        // 移除引号
        const text = match[1].replace(/^['"]|['"]$/g, '');
        results.push(text);
    }

    while ((match = bindRegex.exec(template)) !== null) {
        // 移除引号
        const text = match[1].replace(/^['"]|['"]$/g, '');
        results.push(text);
    }

    // 提取文本节点中的中文
    const textRegex = />([^<]*[\u4e00-\u9fa5]+[^<]*)</g;
    while ((match = textRegex.exec(template)) !== null) {
        results.push(match[1].trim());
    }

    return results.map(text => ({
        text,
        type: 'template'
    }));
};

// 扫描脚本中的中文文本
const scanScript = (script) => {
    const results = [];
    // 排除的式
    const excludePatterns = [
        /\/\/.*/,  // 单行注释
        /\/\*[\s\S]*?\*\//,  // 多行注释
        /console\.(log|info|warn|error)\(.*?\)/,  // console 语句
        /\b(if|for|while|switch)\s*\(.*?\)/,  // 控制语句
        /\.(test|match|replace|Format)\(.*?\)/,  // 方法调用
        /\b(url|path|api|endpoint):/i,  // API 相关
        /\b(function|class|const|let|var)\b/,  // 代码关键字
        /\b(this|new|return|import|export)\b/,  // 更多代码关键字
        /\b(getMonth|getFullYear|getMilliseconds)\b/,  // Date 方法
        /\b(RegExp|Math|Date|String|Number)\b/,  // 内置对象
        /\b(null|undefined|true|false)\b/,  // 基本值
        /[{,]\s*\w+\s*:/,  // 对象属性定义
        /\b\w+\s*\([^)]*\)/,  // 函数调用
        /\b\d+(\.\d+)?[a-z%]*/i,  // 数字和单位
    ];

    // 预处理：移除所有注释
    let processedScript = script.replace(/\/\*[\s\S]*?\*\//g, '')  // 多行注释
                               .replace(/\/\/.*/g, '');  // 单行注释

    // 扫描字符字面量中的中文
    const stringRegex = /'([^']*[\u4e00-\u9fa5]+[^']*)'/g;
    const doubleStringRegex = /"([^"]*[\u4e00-\u9fa5]+[^"]*)"/g;
    let match;

    excludePatterns.forEach(pattern => {
        processedScript = processedScript.replace(pattern, '');
    });

    while ((match = stringRegex.exec(processedScript)) !== null) {
        if (!match[1].includes('$t(')) {  // 排除已国际化的文本
            if (isValidChineseText(match[1])) {
                results.push(match[1]);
            }
        }
    }
    while ((match = doubleStringRegex.exec(processedScript)) !== null) {
        if (!match[1].includes('$t(')) {
            if (isValidChineseText(match[1])) {
                results.push(match[1]);
            }
        }
    }

    return results.map(text => ({
        text,
        type: 'script'
    }));
};

// 验证中文文本是否有效
const isValidChineseText = (text) => {
    // 排除的情况
    const invalidPatterns = [
        /^\s*$/,  // 空白字符
        /^[0-9.]+$/,  // 纯数字
        /^[A-Za-z0-9_]+$/,  // 纯英文和数字
        /^[{}[\]()]+$/,  // 括号
        /^[<>=!&|+-]+$/,  // 运算符
        /console\./,  // console 相关
        /function/,  // 函数相关
        /\.(js|vue|ts|jsx|tsx)$/,  // 文件扩展名
        /^\w+:$/,  // 对象键名
        /^[a-z]+[A-Z]\w*$/,  // 驼命名
        /^[A-Z][a-z]+\w*$/,  // Pascal 命名
        /^\$\w+$/,  // Vue 特殊属性
        /^v-\w+$/,  // Vue 指令
        /^@\w+$/,  // Vue 事件
        /^:\w+$/,  // Vue 绑定
        /^(get|set|async|await|import|export)\b/,  // JS 关键字
        /^(components?|props?|data|methods|computed|watch|filters?|directives?)$/i,  // Vue 选项
    ];

    // 果匹配任何无效模式，返回 false
    if (invalidPatterns.some(pattern => pattern.test(text))) {
        return false;
    }

    // 确保文本包含有意义的中文字符（至少2个字符）
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    // 增加更严格的中文文本验证
    if (!chineseChars || chineseChars.length < 2) {
        return false;
    }
    
    // 检查文本是否主要是中文（中文字符占比超过50%）
    const totalLength = text.length;
    const chineseLength = chineseChars.length;
    return chineseLength / totalLength > 0.5;
};

const scanJSX = (content) => {
    const results = [];
    
    // 使用 Babel 解析 JSX
    const ast = babelParser(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
    });
    
    // 遍历 AST
    traverse(ast, {
        // 处理 JSX 属性���的中文
        JSXAttribute(path) {
            const value = path.node.value;
            if (value && value.type === 'StringLiteral') {
                if (value.value.match(/[\u4e00-\u9fa5]/)) {
                    results.push(value.value);
                }
            }
        },
        
        // 处理 JSX 文本中的中文
        JSXText(path) {
            const text = path.node.value.trim();
            if (text.match(/[\u4e00-\u9fa5]/)) {
                results.push(text);
            }
        },
        
        // 处理普通字符串的中文
        StringLiteral(path) {
            if (path.node.value.match(/[\u4e00-\u9fa5]/)) {
                results.push(path.node.value);
            }
        }
    });
    
    return results.map(text => ({
        text,
        type: 'jsx'
    }));
};

// 处理一个批次的文本
const processAIBatch = async (batch, aiGenerator, flags, aiKeyMap) => {
    if (!aiGenerator?.config?.enabled || !aiGenerator?.config?.apiKey) {
        return;
    }

    const result = await aiGenerator.generateKeys(batch, flags.keyStyle);
    if (result) {
        for (const [text, key] of result.entries()) {
            aiKeyMap.set(text, key);
        }
    }
};

module.exports = {
    execute
}; 