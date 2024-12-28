const fs = require('fs-extra');
const path = require('path');
const pinyin = require('pinyin').default;
const jieba = require('@node-rs/jieba');
const yaml = require('yaml');
const AIKeyGenerator = require('../utils/ai-key-generator');

// 加载配置文件
const loadConfig = async (configPath = '.trnow.yml') => {
    const defaultConfig = require('../config/default');
    try {
        if (await fs.pathExists(configPath)) {
            const content = await fs.readFile(configPath, 'utf-8');
            return {
                ...defaultConfig,
                ...yaml.parse(content)
            };
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }
    return defaultConfig;
};

// 加载已存在的语言文件
const loadExistingMessages = async (flags) => {
    const { localeDir, sourceLang } = flags;
    const messagesPath = path.join(localeDir, `${sourceLang}.json`);
    
    try {
        if (await fs.pathExists(messagesPath)) {
            return await fs.readJson(messagesPath);
        }
    } catch (error) {
        console.error('读取语言文件失败:', error);
    }
    
    return {};
};

// 使用 pinyin + jieba 生成 key
const generateFallbackKey = (text, style = 'camelCase') => {
    // 移除两端空白
    text = text.trim();

    // 将特殊字符替换为下划线，保留中文和英文
    const cleanText = text
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') // 移除首尾的下划线
        .trim();
    
    // 处理混合文本
    const processSegment = (segment) => {
        // 检查是否是纯中文
        if (/^[\u4e00-\u9fa5]+$/.test(segment)) {
            // 使用 jieba 进行分词
            const words = jieba.cut(segment);
            
            // 对分词结果转换为拼音
            const pinyins = words.map(word => {
                const pinyinArray = pinyin(word, {
                    style: pinyin.STYLE_NORMAL,
                    heteronym: false
                });
                return pinyinArray.map(p => p[0]).join('');
            });
            
            // 如果是单个词，直接返回
            if (pinyins.length === 1) {
                return pinyins;
            }
            
            // 如果是多个词，每个词作为独立的部分
            return pinyins;
        }
        
        // 处理英文
        if (/^[a-zA-Z0-9]+$/.test(segment)) {
            if (style === 'snake_case') {
                return segment
                    .replace(/([a-z])([A-Z])/g, '$1_$2')
                    .toLowerCase()
                    .split('_');
            } else {
                // camelCase 模式下保持原有
                return [segment];
            }
        }
        
        // 处理数字
        return [segment.toLowerCase()];
    };
    
    // 分割中英文
    const segments = cleanText.split('_').filter(Boolean);
    
    // 处理每个片段并合并结果
    const words = segments.reduce((acc, segment) => {
        // 进一步分割中英文
        const subSegments = segment.match(/[\u4e00-\u9fa5]+|[a-zA-Z][a-zA-Z0-9]*|\d+/g) || [];
        const processed = subSegments.reduce((subAcc, subSegment) => {
            return [...subAcc, ...processSegment(subSegment)];
        }, []);
        return [...acc, ...processed];
    }, []);
    
    // 根据文本内容判断命名空间
    const getNamespace = (text) => {
        if (text.includes('错误') || text.includes('异常')) {
            return 'error';
        }
        if (text.includes('成功') || text.includes('完成')) {
            return 'success';
        }
        if (text.includes('提示') || text.includes('警告')) {
            return 'message';
        }
        return 'common';
    };

    if (style === 'camelCase') {
        const key = words
            .map((word, index) => 
                index === 0 ? word.toLowerCase() : 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');
        return `${getNamespace(text)}.${key}`;
    }
    
    return `${getNamespace(text)}.${words.join('_')}`;
};

const execute = async (flags) => {
    const { src, localeDir, sourceLang, dryRun } = flags;
    
    // 加载配置文件
    const config = await loadConfig(flags.config);
    console.log('Loaded config:', {
        aiEnabled: config.keyGeneration.ai?.enabled,
        aiApiKey: config.keyGeneration.ai?.apiKey ? '***' : undefined
    });

    const aiGenerator = new AIKeyGenerator(config.keyGeneration.ai);
    
    // 设置默认值
    const options = {
        src: src || './src',
        localeDir: localeDir || './src/locales',
        sourceLang: sourceLang || 'zh-CN',
        dryRun: dryRun || false,
        keyStyle: flags.keyStyle || config.keyGeneration.style || 'snake_case'
    };

    const scanResults = await require('./scan').execute(flags);
    
    // 如果没有扫描结果或者是信息类型的消息，直接返回
    if (!Array.isArray(scanResults) || scanResults.length === 0 || scanResults[0].type === 'info') {
        return {
            totalFiles: 0,
            totalTexts: 0,
            newKeys: 0,
            messages: {}
        };
    }

    // 添加对已存在的语言文件的处理
    const existingMessages = await loadExistingMessages(options);
    
    // 添加对重复文本的处理
    const duplicateKeys = new Map();
    
    // 添加备份功能
    if (!flags.dryRun) {
        const filesToBackup = [...new Set(scanResults.map(r => r.file))]
            .filter(Boolean)
            .map(file => path.resolve(process.cwd(), file));
        
        if (filesToBackup.length > 0) {
            await backupFiles(filesToBackup);
        }
    }
    
    // 添加转换报告
    const report = {
        totalFiles: 0,
        totalTexts: 0,
        newKeys: [],
        duplicateTexts: [],
        errors: []
    };
    
    // 收集需要生成 key 的文本
    const textsNeedingKeys = [];
    scanResults.forEach((item) => {
        const existingEntry = Object.entries(existingMessages)
            .find(([_, value]) => value === item.text);
        
        if (!existingEntry) {
            textsNeedingKeys.push(item.text);
        }
    });

    // 批量生成 key
    let aiKeyMap = new Map();
    if (textsNeedingKeys.length > 0 && config.keyGeneration.ai.enabled && config.keyGeneration.ai.apiKey) {
        console.log('Using AI for key generation:', {
            enabled: config.keyGeneration.ai.enabled,
            hasApiKey: !!config.keyGeneration.ai.apiKey,
            textsCount: textsNeedingKeys.length
        });
        aiKeyMap = await aiGenerator.generateKeys(textsNeedingKeys, options.keyStyle) || new Map();
        console.log('AI key map:', aiKeyMap);
    }

    // 为所有需要的文本生成 key
    const keyMap = new Map();
    textsNeedingKeys.forEach(text => {
        const key = aiKeyMap.get(text) || generateFallbackKey(text, options.keyStyle);
        keyMap.set(text, key);
    });

    // 生成 key-value 映射
    const messages = {
        ...existingMessages
    };
    const existingKeys = new Set(Object.keys(existingMessages));
    
    scanResults.forEach((item) => {
        // 先检查文本是否已经存在
        const existingEntry = Object.entries(existingMessages)
            .find(([_, value]) => value === item.text);
        
        if (existingEntry) {
            // 如果文本已存在，使用原来的 key
            const [key] = existingEntry;
            keyMap.set(item.text, key);
            return;
        }
        
        // 使用已生成的 key
        const key = keyMap.get(item.text);
        messages[key] = item.text;
        existingKeys.add(key);
        
        report.newKeys.push(key);
    });

    if (!dryRun) {
        // 保存语言文件
        await fs.outputJSON(
            path.join(options.localeDir, `${options.sourceLang}.json`),
            messages,
            { spaces: 2 }
        );

        // 替换文件中的文本
        for (const file of scanResults) {
            if (!file || !file.file) {
                continue;
            }
            // 发送进度更新
            if (typeof flags.onProgress === 'function') {
                flags.onProgress({
                    type: 'progress',
                    text: `正在处理: ${path.relative(process.cwd(), file.file)}`,
                    current: scanResults.indexOf(file) + 1,
                    total: scanResults.length
                });
            }
            await replaceInFile(file, keyMap);
        }
    }

    return {
        totalFiles: new Set(scanResults.map(r => r.file)).size,
        totalTexts: scanResults.length,
        newKeys: report.newKeys.length,
        processedFiles: scanResults.map(r => path.relative(process.cwd(), r.file)),
        messages,
        summary: {
            type: 'success',
            text: `转换完成！\n` +
                  `- 处理文件数：${new Set(scanResults.map(r => r.file)).size}\n` +
                  `- 替换文本数：${scanResults.length}\n` +
                  `- 新增翻译：${report.newKeys.length}\n` +
                  `\n语言文件已更新，请检查 ${path.join(options.localeDir, `${options.sourceLang}.json`)}`
        }
    };
};

// 替换文件中的文本
const replaceInFile = async (file, keyMap) => {
    const filePath = typeof file === 'string' ? file : file.file;
    if (!filePath) {
        return;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    let newContent = content;

    const fileType = typeof file === 'string' ? path.extname(filePath) : file.type;

    if (fileType === '.jsx' || fileType === 'jsx') {
        // 替换 JSX 中的文本
        for (const [text, key] of keyMap.entries()) {
            // 替换属性中的文本
            newContent = newContent.replace(
                `="${text}"`,
                `={t('${key}')}`
            );
            
            // 替换文本节点
            newContent = newContent.replace(
                new RegExp(`>\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`, 'g'),
                `>{t('${key}')}<`
            );
            
            // 替换字符串字面量
            newContent = newContent.replace(
                `'${text}'`,
                `t('${key}')`
            );
        }
    } else if (fileType === '.vue' || fileType === 'template') {
        // 替换 Vue 模板中的文本
        for (const [text, key] of keyMap.entries()) {
            // 处理普通属性
            newContent = newContent.replace(
                new RegExp(`(\\w+)="` + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `"`, 'g'),
                `:$1="$t('${key}')"`
            );
            // 处理已经绑定属性的情况
            newContent = newContent.replace(
                new RegExp(`:(\\w+)="` + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `"`, 'g'),
                `:$1="$t('${key}')"`
            );
            
            // 替换文本节点
            newContent = newContent.replace(
                new RegExp(`>\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`, 'g'),
                `>{{ $t('${key}') }}<`
            );
            
            // 处理带引号的字符串字面量
            newContent = newContent.replace(
                new RegExp(`v-text="'${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'"`, 'g'),
                `v-text="$t('${key}')"`
            ).replace(
                new RegExp(`v-html="'${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'"`, 'g'),
                `v-html="$t('${key}')"`
            );
            
            // 处理带引号的属性值
            newContent = newContent.replace(
                new RegExp(`:(\\w+)="'${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'"`, 'g'),
                `:$1="$t('${key}')"`
            );

            // 处理 script 中的字符串
            newContent = newContent.replace(
                new RegExp(`(\\w+):\\s*['"]${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
                `$1: this.$t('${key}')`
            );
        }
    }

    if (newContent !== content) {
        await fs.writeFile(filePath, newContent, 'utf-8');
    }
};

// 添加备份功能
const backupFiles = async (files) => {
    // 使用更好的时间格式
    const now = new Date();
    const timestamp = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/[/:\s]/g, '-');
    
    const backupDir = path.join(process.cwd(), '.trnow-backup', timestamp);
    
    // 确保备份目录存在
    await fs.ensureDir(backupDir);
    
    for (const file of files) {
        if (await fs.pathExists(file)) {
            const relativePath = path.relative(process.cwd(), file);
            const backupPath = path.join(backupDir, relativePath);
            
            // 确保备份文件的目录存在
            await fs.ensureDir(path.dirname(backupPath));
            
            // 复制文件
            await fs.copy(file, backupPath);
        }
    }
    
    return {
        timestamp,
        backupDir,
        files: files.length
    };
};

module.exports = {
    execute,
    generateFallbackKey
}; 