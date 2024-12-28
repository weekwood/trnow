const OpenAI = require('openai');

class AIKeyGenerator {
    constructor(config) {
        this.config = config;

        this.batchSize = 20;
        this.prompt = `为中文文本生成合适的国际化 key，要求：
            1. 使用点号分隔的命名空间，如：
               - common.form.username
               - common.table.noData
               - user.list.title
               - user.form.submit
            4. 使用 {style} 命名风格
            5. 保持命名的一致性和语义化
            7. 直接返回 key，格式：Key: \`your_key_here\`

            文本列表：
            {text}`;
    }

    async generateKeys(texts, style) {
        if (!this.config?.enabled || !this.config?.apiKey || !this.config?.baseURL || !this.config?.model) {
            return null;
        }

        try {
            // 延迟创建 OpenAI 客户端
            if (!this.client) {
                this.client = new OpenAI({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL
                });
            }

            // 使用配置文件中的 prompt
            const prompt = this.prompt
                .replace('{style}', style)
                .replace('{text}', texts.join('\n'));

            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.3,
                max_tokens: 1000,
                n: 1
            });

            // 解析返回的结果
            const content = response.choices[0].message.content;
            const keyMap = new Map();
            
            // 尝试从不同格式中提取 key
            const keyMatches = content.match(/Key:\s*[`']([^`']+)[`']/i) ||
                             content.match(/:\s*[`']([^`']+)[`']/);
            
            if (keyMatches) {
                const key = keyMatches[1];
                texts.forEach(text => {
                    keyMap.set(text, this.normalizeKey(key, style));
                });
            }

            return keyMap;
        } catch (error) {
            console.error('AI key generation failed:', error);
            return null;
        }
    }

    async generateKey(text, style) {
        const keyMap = await this.generateKeys([text], style);
        return keyMap?.get(text) || null;
    }

    normalizeKey(key, style) {
        // 保留点号作为命名空间分隔符
        key = key.replace(/['"]/g, '').replace(/[^\w\s.]/g, '_');
        
        // 如果 key 中已经包含点号，说明是命名空间格式，保持原样
        if (key.includes('.')) {
            if (style === 'camelCase') {
                // 只对每个部分的首字母做大小写处理
                return key.split('.')
                    .map(part => part
                        .split(/[\s_-]+/)
                        .map((word, index) => 
                            index === 0 ? word.toLowerCase() : 
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                        )
                        .join(''))
                    .join('.');
            }
            // snake_case 时保持原有的点号分隔
            return key.split('.')
                .map(part => part.toLowerCase().replace(/[\s-]+/g, '_'))
                .join('.');
        }

        // 如果没有点号，按照原来的方式处理
        const words = key.split(/[\s_-]+/);
        if (style === 'camelCase') {
            return words
                .map((word, index) => 
                    index === 0 ? word.toLowerCase() : 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join('');
        }
        return words.join('_').toLowerCase();
    }
}

module.exports = AIKeyGenerator; 