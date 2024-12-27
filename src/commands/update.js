const fs = require('fs-extra');
const path = require('path');

const execute = async (flags) => {
    const { src, localeDir, sourceLang } = flags;
    
    // 读取现有的语言文件
    const existingMessages = await loadMessages(localeDir, sourceLang);
    
    // 扫描新的文本
    const scanResults = await require('./scan').execute(flags);
    
    // 找出新增的文本
    const newTexts = scanResults.filter(item => {
        return !Object.values(existingMessages).includes(item.text);
    });

    // 生成新的 key
    const updates = {};
    newTexts.forEach(item => {
        const key = generateKey(item.text, Object.keys(existingMessages));
        updates[key] = item.text;
    });

    // 合并并保存
    const mergedMessages = {
        ...existingMessages,
        ...updates
    };

    if (!flags.dryRun) {
        await fs.outputJSON(
            path.join(localeDir, `${sourceLang}.json`),
            mergedMessages,
            { spaces: 2 }
        );

        // 更新其他语言文件
        const locales = await fs.readdir(localeDir);
        for (const locale of locales) {
            if (locale === `${sourceLang}.json`) continue;
            
            const localePath = path.join(localeDir, locale);
            const localeMessages = await fs.readJSON(localePath);
            
            // 只添加新的 key，保留现有翻译
            const updatedLocale = {
                ...localeMessages,
                ...Object.fromEntries(
                    Object.entries(updates)
                        .filter(([key]) => !localeMessages[key])
                        .map(([key]) => [key, '']) // 新增的 key 值置空
                )
            };
            
            await fs.outputJSON(localePath, updatedLocale, { spaces: 2 });
        }
    }

    return {
        totalNew: newTexts.length,
        newTexts: newTexts.map(t => t.text),
        updates
    };
};

// 加载现有的语言文件
const loadMessages = async (dir, lang) => {
    const file = path.join(dir, `${lang}.json`);
    return await fs.pathExists(file) 
        ? await fs.readJSON(file)
        : {};
};

module.exports = { execute }; 