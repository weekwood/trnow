const fs = require('fs-extra');
const path = require('path');
const pinyin = require('pinyin').default;
const jieba = require('@node-rs/jieba');
const crypto = require('crypto');
const yaml = require('yaml');

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

// 生成唯一的 key
const generateUniqueKey = (text, existingKeys, style = 'camelCase') => {
    let key = generateKey(text, style);
    
    return key;
};

// 生成合适的 key
const generateKey = (text, style = 'camelCase') => {
    // 移除两端空白
    text = text.trim();

    // 移除特殊字符，保留中文和英文
    const cleanText = text
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
        .trim();
    
    // 如果是纯中文，转换为拼音
    if (/^[\u4e00-\u9fa5]+$/.test(cleanText)) {
        // 直接使用 jieba 进行分词
        const words = jieba.cut(cleanText);
        
        // 对分词结果转换为拼音
        const pinyinWords = words.map(word => {
            const pinyinArray = pinyin(word, {
                style: pinyin.STYLE_NORMAL,
                heteronym: false
            });
            return pinyinArray.map(p => p[0]).join('');
        });
        
        // 所有拼音转小写
        const lowerPinyinWords = pinyinWords.map(word => word.toLowerCase());
        
        // 根据样式格式化
        if (style === 'camelCase') {
            return lowerPinyinWords
                .map((word, index) => 
                    index === 0 ? word : 
                    word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join('');
        }
        return lowerPinyinWords.join('_');
    }
    
    // 处理混合文本
    const words = cleanText
        .replace(/([a-z])([A-Z])/g, '$1 $2') // 分割驼峰
        .toLowerCase()
        .split(/[\s_-]+/) // 分割单词
        .filter(Boolean); // 移除空字符串
    
    // 所有单词转小写
    const lowerWords = words.map(word => word.toLowerCase());
    
    if (style === 'camelCase') {
        return lowerWords
            .map((word, index) => 
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join('');
    }
    
    return lowerWords.join('_');
};

const execute = async (flags) => {
    const { src, localeDir, sourceLang, dryRun } = flags;
    
    // 加载配置文件
    const config = await loadConfig(flags.config);
    
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
    
    // 生成 key-value 映射
    const messages = {
        ...existingMessages
    };
    const keyMap = new Map();
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
        
        // 只为新文本生成 key
        const key = generateUniqueKey(item.text, existingKeys, options.keyStyle);
        messages[key] = item.text;
        keyMap.set(item.text, key);
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
    // 确保文件路径存在
    const filePath = typeof file === 'string' ? file : file.file;
    if (!filePath) {
        return; // 跳过无效的文件
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
                `>${text}<`,
                `>{t('${key}')}<`
            );
            
            // 替换字符串字面量
            newContent = newContent.replace(
                `'${text}'`,
                `t('${key}')`
            );
        }
    } else if (fileType === '.vue' || fileType === 'template') {
        // Vue 模板转换逻辑
        for (const [text, key] of keyMap.entries()) {
            // 替换属性中的文本
            newContent = newContent.replace(
                `="${text}"`,
                `:="${'$t(\'' + key + '\')'}"`
            );
            
            // 替换文本节点
            newContent = newContent.replace(
                `>${text}<`,
                `>{{ $t('${key}') }}<`
            );
            
            // 替换 v-text 和 v-html
            newContent = newContent.replace(
                `v-text="${text}"`,
                `v-text="$t('${key}')"`
            ).replace(
                `v-html="${text}"`,
                `v-html="$t('${key}')"`
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
    execute
}; 