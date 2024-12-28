const AIKeyGenerator = require('../src/utils/ai-key-generator');

describe('AI Key Generator', () => {
    // 跳过没有 API key 的情况
    (process.env.AI_API_KEY ? describe : describe.skip)('With API Key', () => {
        const generator = new AIKeyGenerator({
            enabled: true,
            apiKey: process.env.AI_API_KEY,
            model: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com/v1',
            provider: 'deepseek'
        });

        test('应该生成 camelCase 格式的 key', async () => {
            jest.setTimeout(10000);
            const result = await generator.generateKey('用户管理', 'camelCase');
            if (!process.env.AI_API_KEY) {
                return;
            }
            expect(result).toMatch(/^[a-z]+\.[a-z]+(\.[a-zA-Z0-9]+)*$/);
            expect(result).toMatch(/(user|common)\.(list|management)\.[a-zA-Z0-9]+/);
        });

        test('应该生成 snake_case 格式的 key', async () => {
            jest.setTimeout(10000);
            const result = await generator.generateKey('用户管理', 'snake_case');
            if (!process.env.AI_API_KEY) {
                return;
            }
            expect(result).toMatch(/^[a-z]+\.[a-z]+(\.[a-z0-9_]+)*$/);
            expect(result).toMatch(/(user|common)\.(list|management)\.[a-z0-9_]+/);
        });

        test('应该处理中英文混合的文本', async () => {
            jest.setTimeout(10000);
            const result = await generator.generateKey('导入CSV文件', 'camelCase');
            if (!process.env.AI_API_KEY) {
                return;
            }
            expect(result).toMatch(/^[a-z]+\.[a-z]+(\.[a-zA-Z0-9]+)*$/);
            expect(result).toMatch(/(common|system)\.(import|file)\.[a-zA-Z0-9]+/);
        });
    });

    // 测试没有 key 的情况
    test('没有 API key 时应该返回 null', async () => {
        jest.setTimeout(1000);
        const generator = new AIKeyGenerator({
            enabled: true,
            apiKey: '',
            model: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com/v1'
        });

        const result = await generator.generateKey('用户管理', 'camelCase');
        expect(result).toBeNull();
    });

    test('未启用时应该返回 null', async () => {
        const generator = new AIKeyGenerator({
            enabled: false,
            apiKey: 'some-key',
            model: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com/v1'
        });

        const result = await generator.generateKey('用户管理', 'camelCase');
        expect(result).toBeNull();
    });
}); 