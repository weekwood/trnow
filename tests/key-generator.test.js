const AIKeyGenerator = require('../src/utils/ai-key-generator');
const { generateFallbackKey } = require('../src/commands/transform');

describe('Key 生成器测试', () => {
    describe('AI Key Generator', () => {
        (process.env.AI_API_KEY ? test : test.skip)('当 AI 未启用时应该返回 null', async () => {
            const generator = new AIKeyGenerator({
                enabled: false,
                apiKey: 'fake-key'
            });

            const result = await generator.generateKey('用户管理', 'snake_case');
            expect(result).toBeNull();
        });

        (process.env.AI_API_KEY ? test : test.skip)('当 API 调用失败时应该返回 null', async () => {
            const originalError = console.error;
            console.error = jest.fn();

            const generator = new AIKeyGenerator({
                enabled: true,
                apiKey: 'invalid-key'
            });

            const result = await generator.generateKey('用户管理', 'camelCase');
            expect(result).toBeNull();

            console.error = originalError;
        });
    });

    describe('Fallback Key Generator', () => {
        test('生成 snake_case 格式的 key', () => {
            const testCases = [
                {
                    input: '用户管理',
                    expected: 'yonghu_guanli'
                },
                {
                    input: '新增用户User',
                    expected: 'xinzeng_yonghu_user'
                },
                {
                    input: 'userProfile设置',
                    expected: 'user_profile_shezhi'
                },
                {
                    input: '导入Excel文件',
                    expected: 'daoru_excel_wenjian'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = generateFallbackKey(input, 'snake_case');
                expect(result).toBe(expected);
            });
        });

        test('生成 camelCase 格式的 key', () => {
            const testCases = [
                {
                    input: '用户管理',
                    expected: 'yonghuGuanli'
                },
                {
                    input: '新增用户User',
                    expected: 'xinzengYonghuUser'
                },
                {
                    input: 'userProfile设置',
                    expected: 'userProfileShezhi'
                },
                {
                    input: '导入Excel文件',
                    expected: 'daoruExcelWenjian'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = generateFallbackKey(input, 'camelCase');
                expect(result).toBe(expected);
            });
        });

        test('处理特殊字符', () => {
            const testCases = [
                {
                    input: '用户(VIP)管理',
                    expected: 'yonghu_vip_guanli'
                },
                {
                    input: '新建/编辑表单',
                    expected: 'xinjian_bianji_biaodan'
                },
                {
                    input: '用户@通知',
                    expected: 'yonghu_tongzhi'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = generateFallbackKey(input, 'snake_case');
                expect(result).toBe(expected);
            });
        });

        test('保持英文单词的大小写（当使用 camelCase 时）', () => {
            const testCases = [
                {
                    input: '导入CSV文件',
                    expected: 'daoruCSVWenjian'
                },
                {
                    input: '设置API接口',
                    expected: 'shezhiAPIJiekou'
                },
                {
                    input: 'iOS设备管理',
                    expected: 'iOSShebeiGuanli'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = generateFallbackKey(input, 'camelCase');
                expect(result).toBe(expected);
            });
        });
    });
}); 